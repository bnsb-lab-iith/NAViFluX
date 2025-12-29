from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cobra
from cobra import Model, Reaction, Metabolite
from cobra.io.mat import create_mat_dict
from cobra.io import write_sbml_model
from cobra.io import save_json_model
import time
import os
import tempfile
import uuid
import pickle
import re
from collections import defaultdict
from scipy.io import savemat
import io
from collections import defaultdict
import math
import numpy as np
import base64
import pandas as pd
import networkx as nx
import gseapy as gp
import json
import subprocess
import sys
import shutil
import zipfile
import threading

from cobra.flux_analysis import pfba
from cobra.flux_analysis import flux_variability_analysis
from cobra.flux_analysis.loopless import loopless_solution
from cobra.flux_analysis import single_reaction_deletion, single_gene_deletion

app = Flask(__name__)
CORS(app)


cached_data = {
    "BIGG": None,  # will store tuple (cur_metabolites, smat, df, df2)
    "KEGG": None,
    "Other": None
}

compartments = {
    "c": "Cytoplasm",
    "n": "Nucleus",
    "m": "Mitochondria",
    "er": "Endoplasmic Reticulum",
    "g": "Golgi Apparatus",
    "l": "Lysosome",
    "p": "Peroxisome",
    "e": "Extracellular",
    "pm": "Plasma Membrane",
    "v": "Vacuole",
    "en": "Endosome",
    "ch": "Chloroplast",
    "mm": "Mitochondrial Matrix",
    "ims": "Mitochondrial Intermembrane Space",
    "ap": "Apoplast",
    "np": "Cytosolic Nucleoplasm"
}

key_map = {
    "BIGG": "bigg.reaction",
    "KEGG": "kegg.reaction",
    "EC": "ec-code"
}

def get_data(db="Other"):
    """
    Returns (cur_metabolites, smat, df, df2) for the requested DB.
    Loads from disk only if not already cached.
    """
    global cached_data

    # if db not in ["BIGG", "KEGG"]:
    #     raise ValueError("db must be 'BIGG' or 'KEGG'")

    if cached_data[db] is not None:
        # already loaded, return cached version
        return cached_data[db]

    # load data depending on DB
    if db == "BIGG":
        cur_metabolites = []
        smat = pd.read_parquet('./../data/BiGG/smatrix-v2.parquet')
        df = pd.read_csv('./../data/BiGG/reactions.csv', index_col=0)
        df2 = pd.read_csv('./../data/BiGG/bigg_models_metabolites.txt', sep="\t")
    elif db == "KEGG":  # KEGG
        with open("./../data/KEGG/currmets_kegg.txt") as f:
            cur_metabolites = [clean_met_name(line.strip()) for line in f if line.strip()]
        kegg_smat = pd.read_parquet("./../data/KEGG/kegg_smat.parquet", engine="fastparquet")
        kegg_smat.set_index('Unnamed: 0', inplace=True)
        kegg_smat.index.name = None
        smat = kegg_smat
        df = pd.read_csv("./../data/KEGG/kegg_reactions.tsv", sep="\t")
        df2 = pd.read_csv("./../data/KEGG/kegg_metabolites.tsv", sep="\t")
    else:
        cur_metabolites = []
        smat = None
        df = None
        df2 = None

    # cache it
    cached_data[db] = (cur_metabolites, smat, df, df2)
    return cached_data[db]


def check_kegg_bigg(met):
    cleaned_met = clean_met_name(met)
    kegg_mets_df = pd.read_csv("./../data/KEGG/kegg_metabolites.tsv", sep="\t")
    kegg_mets = kegg_mets_df['Abbreviation'].map(lambda x: clean_met_name(x))
    if(any(cleaned_met == kegg_mets)):
        return "KEGG"
    bigg_mets_df = pd.read_csv('./../data/BiGG/bigg_models_metabolites.txt', sep="\t")
    bigg_mets = bigg_mets_df['Abbreviation'].map(lambda x: clean_met_name(x))
    if(any(cleaned_met == bigg_mets)):
        return "BIGG"

def clean_cobra_model(model: Model, name="Cleaned_Model") -> Model:
        # Filter out invalid reactions, metabolites, and genes
        valid_rxns = [r for r in model.reactions if r.id and r.id.strip()]
        valid_mets = [m for m in model.metabolites if m.id and m.id.strip() and m.compartment and m.compartment.strip()]
        valid_genes = [g for g in model.genes if g.id and g.id.strip()]

        # Create new model
        cleaned = Model(name)
        
        # Add valid components
        cleaned.add_metabolites(valid_mets)
        cleaned.add_reactions(valid_rxns)
        for gene in valid_genes:
            cleaned.genes.add(gene)

        # Clean compartments
        cleaned.compartments = {
            k.strip(): v.strip()
            for k, v in model.compartments.items()
            if k and k.strip() and v and v.strip()
        }
        
        return cleaned

def clean_met_name(name):
    return re.sub(r'\[.*?\]', '', name)

def get_negative_enzymes(df, metabolite_name, db):
    if (db == "BIGG"):
        cleaned_metabolite = clean_met_name(metabolite_name)
        cleaned_index_map = {clean_met_name(idx): idx for idx in df.index}
        actual_index = cleaned_index_map.get(cleaned_metabolite)
        if actual_index is None:
            return [] 
        row = df.loc[actual_index]
        return row[(row < 0) | (row > 0)].index.tolist()
    elif (db == "KEGG"):
        cleaned_index_map = {idx: idx for idx in df.index}
        actual_index = cleaned_index_map.get(metabolite_name)
        if actual_index is None:
            return [] 
        row = df.loc[actual_index]
        return row[(row < 0) | (row > 0)].index.tolist()


def sanitize(obj):
    """Recursively replace NaN with None and convert tuples to lists."""
    if isinstance(obj, float):
        return None if math.isnan(obj) else obj
    elif isinstance(obj, tuple):
        return [sanitize(v) for v in obj]
    elif isinstance(obj, list):
        return [sanitize(v) for v in obj]
    elif isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    else:
        return obj
    
def get_positive_enzymes(df, metabolite_name):
    cleaned_metabolite = clean_met_name(metabolite_name)
    cleaned_index_map = {clean_met_name(idx): idx for idx in df.index}
    actual_index = cleaned_index_map.get(cleaned_metabolite)
    if actual_index is None:
        return [] 
    row = df.loc[actual_index]
    return row[row > 0].index.tolist()

def find_crossrefs_mets(row, db):
    if db == "BIGG":
        text = row["database_links"].iloc[0]
        entries = [e.strip() for e in text.split(";") if e.strip()]

        db_ids = {}
        for entry in entries:
            if ":" not in entry:
                continue
            db, url = entry.split(":", 1)
            db = db.strip()
            url = url.strip()
            db_id = url.split("/")[-1]
            db_ids.setdefault(db, []).append(db_id)

        return db_ids["CHEBI"]
    elif db == "KEGG":
        return []
    else:
        return []




def get_matching_enzymes(query, database):
    if(database == "BIGG"):
        cur_metabolites, smat, df, df2 = get_data(database)
    elif(database == "KEGG"):
         cur_metabolites, smat, df, df2 = get_data(database)
    # _, _, df, _ = get_cached_data()
    q = query.lower()

    mask_abbr = df['Abbreviation'].astype(str).str.lower().str.contains(q, na=False)
    mask_rxn  = df['Reaction'].astype(str).str.lower().str.contains(q, na=False)
    mask_desc = df['Description'].astype(str).str.lower().str.contains(q, na=False)

    combined_mask = mask_abbr | mask_rxn | mask_desc
    return df.loc[combined_mask, 'Abbreviation'].tolist()


def serialize_deletion_result(df):
    def safe_convert(x):
        if isinstance(x, set):
            return list(x)
        if isinstance(x, float) and (np.isnan(x) or np.isinf(x)):
            return None
        return x

    serialized_data = [
        [safe_convert(cell) for cell in row]
        for row in df.itertuples(index=False)
    ]

    return {
        "columns": df.columns.tolist(),
        "index": df.index.tolist(),
        "data": serialized_data
    }



@app.route("/", methods=['GET', 'POST'])
def index():
    return "Hello flask"


@app.route("/api/v1/cobra-model", methods=['GET', 'POST'])
def analyseModel():
    
    uploaded_file = request.files['file']
    filename = uploaded_file.filename.lower()

    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, filename)
    uploaded_file.save(file_path)


    try:
        if filename.endswith('.xml'):
            model = cobra.io.read_sbml_model(file_path)
        elif filename.endswith('.mat'):
            model = cobra.io.load_matlab_model(file_path)
        elif filename.endswith('.json'):
            model = cobra.io.load_json_model(file_path)
        else:
            return jsonify({'status': 'error', 'message' : "Unsupported file type"})

        # Stoichiometric matrix
        S = cobra.util.create_stoichiometric_matrix(model)
        S_df = pd.DataFrame(S, index=[m.id for m in model.metabolites],
                            columns=[r.id for r in model.reactions])

        # FBA
        # tic = time.time()
        # solution = model.optimize()
        # toc = time.time()
        # flux_series = solution.fluxes

        # Metabolite metadata
        metabolite_data = []
        for met in model.metabolites:
            metabolite_data.append({
                "Abbreviation": met.id,
                "Name": met.name,
                "Formula": met.formula,
                "Charge": met.charge,
                "Compartment": met.compartment,
                "Chebi-crossref": met.annotation["chebi"] if "chebi" in met.annotation else []
            })

        metabolite_df2 = pd.DataFrame(metabolite_data)
        df1 = pd.DataFrame({
            "Abbreviation": [rxn.id for rxn in model.reactions],
            "Description": [rxn.name for rxn in model.reactions],
            "Reaction": [rxn.reaction for rxn in model.reactions],
            # "flux_solution": [flux_series[rxn.id] for rxn in model.reactions],
            "Subsystem": [rxn.subsystem if hasattr(rxn, "subsystem") else None for rxn in model.reactions],
            "ec-code": [
                rxn.annotation.get("ec-code", []) if rxn.annotation else []
                for rxn in model.reactions
            ],
            "bigg-crossref": [
                rxn.annotation.get("bigg.reaction", []) if rxn.annotation else []
                for rxn in model.reactions
            ],
            "kegg-crossref": [
                rxn.annotation.get("kegg.reaction", []) if rxn.annotation else []
                for rxn in model.reactions
            ],
            "lower_bound": [rxn.lower_bound for rxn in model.reactions],
            "upper_bound": [rxn.upper_bound for rxn in model.reactions]
        })

        gene_obj = {r.id: [g.id for g in r.genes] for r in model.reactions}
        gene_df = pd.DataFrame([
            {"reaction": r_id, "gene": genes}
            for r_id, genes in gene_obj.items()
        ])
        df1 = pd.merge(df1, gene_df, left_on="Abbreviation", right_on="reaction")


        flag_met = metabolite_df2.iloc[0]['Abbreviation']
        db = check_kegg_bigg(flag_met) 
        if db is None:
            db = "Other"

        cur_metabolites, _, _, _ = get_data(db)
        
        if (db != "BIGG" and db != "KEGG"): 
            return jsonify({
                    'status': 'error',
                    'message': f'Reaction and Metabolites should belong to only one database either KEGG or BiGG'
                }), 400
        
        def is_currency_metabolite(met):
            
            currency_keywords = [
                "h", "pi", "o2", "na1", "h2o", "co2", "atp", "adp",
                "amp", "nad", "fad", "coa", "ppi", 
                "nadh", "fadh", "nadp", "nadph"
            ]
            currency_keywords_final = cur_metabolites + currency_keywords
            return any(met.lower().startswith(cur.lower()) for cur in currency_keywords_final)

        result = {}

        for pathwayName in df1['Subsystem'].dropna().unique():
            path_Df = df1[df1['Subsystem'] == pathwayName]
            enzymes = path_Df['Abbreviation'].tolist()
            path_smat = S_df[enzymes]
            edges = []
            currency_edges = []
            enzyme_info = {}
            metabolite_names = []
            gene_info = {}
            enzyme_crossref = {}
            stoichiometry = {}

            for reac in enzymes:
                
                stoichiometry[reac] = {}
                for met in S_df.index:
                    coef = S_df.at[met, reac]
                    if coef == 0:
                        continue

                    edge = [met, reac] if coef < 0 else [reac, met]
                    stoichiometry[reac][met] = coef
                    

                    if is_currency_metabolite(met):
                        currency_edges.append(edge)
                    else:
                        edges.append(edge)
                        metabolite_names.append(met)

                # Enzyme metadata
                row = path_Df[path_Df['Abbreviation'] == reac]
                desc = row['Description'].iloc[0] if not row.empty else reac
                # flux = row['flux_solution'].iloc[0] if not row.empty else 0.0
                flux = "Not Calculated"
                lower_bound = row['lower_bound'].iloc[0] if not row.empty else -1000.0
                upper_bound = row['upper_bound'].iloc[0] if not row.empty else 1000.0
                enzyme_info[reac] = [desc, flux, lower_bound, upper_bound, pathwayName]
                gene_info[reac] = row["gene"].iloc[0]
                enzyme_crossref[reac] = {"BIGG": row["bigg-crossref"].iloc[0], "KEGG": row["kegg-crossref"].iloc[0], "EC": row["ec-code"].iloc[0]}

            
            metabolite_names = np.unique(np.array(metabolite_names))
            final_metabolites = {}
            for met in metabolite_names:
                row = metabolite_df2[metabolite_df2['Abbreviation'] == met]
                formula = (
                    row["Formula"].iloc[0]
                    if not row.empty and "Formula" in row.columns
                    else "None"
                )
                compartment = compartments.get(row['Compartment'].iloc[0], 'Cytoplasm')
                desc = row['Name'].iloc[0] if not row.empty else met
                chebi_crossref = row["Chebi-crossref"].iloc[0] if not row.empty else []
                final_metabolites[str(met)] = [desc, formula, compartment, chebi_crossref, 'No weight']
                
            result[pathwayName] = {
                "edges": edges,
                "currency_edges": currency_edges,
                "enzymes": enzyme_info,
                "metabolites": final_metabolites,
                "genes": gene_info, 
                "enzyme_crossref" : enzyme_crossref,
                "stoichiometry": stoichiometry
            }

        response = {
            'state': 'success',
            'result': result,
            'database': db
            
        }
        return jsonify(response)

    except Exception as e:
        return f"Error loading model: {str(e)}", 500
    
@app.route('/api/v1/add-reactions', methods=['POST']) 
def addReactions():
    try:
        if not request.is_json:
            return jsonify({'status': 'error', 'message': 'Request must be JSON'}), 400
    
        data = request.get_json()
        metabolite = data.get('metabolite')

        try:
            db = check_kegg_bigg(metabolite)
            if(db == "BIGG"):
                cur_metabolites, smat, df, df2 = get_data(db)
            elif(db == "KEGG"):
                cur_metabolites, smat, df, df2 = get_data(db)
            else: 
                return jsonify({
                    'status': 'error',
                    'message': f'Metabolite should belong to only one database either KEGG or BiGG'
                }), 400
            
            def is_currency_metabolite(met):
                
                currency_keywords = [
                    "h", "k", "pi", "cl", "o2", "na1", "h2o", "co2", "atp", "adp",
                    "utp", "gtp", "gdp", "amp", "nad", "fad", "coa", "ppi", "nh4", "nh3",
                    "acp", "thf", "crn", "nadh", "fadh", "nadp", "nadph"
                ]
                currency_keywords_final = cur_metabolites + currency_keywords
                return any(met.lower().startswith(cur.lower()) for cur in currency_keywords_final)

            if not metabolite:
                return {'status': 'error', 'message': 'Missing metabolite'}, 400

            try:
                result = get_negative_enzymes(smat, metabolite, db)
                if not result:
                    return jsonify({
                        'status': 'error',
                        'message': 'No enzymes found for this metabolite',
                        'result': {}
                    }), 200

                filtered_smat = smat[result]
                edges_by_enzyme = {}
                currency_edges_by_enzyme = {}
                metabolite_names_by_enzyme = {}
                stoichiometry = {}

                for reac in filtered_smat.columns:
                    enzyme_edges = []
                    enzyme_currency_edges = []
                    metabolite_names = []
                    stoichiometry[reac] = {}

                    for met in filtered_smat.index:
                        if(db == "KEGG"):
                            cleaned_metabolite = clean_met_name(met)
                            coef = filtered_smat.loc[met, reac]

                            if coef == 0:
                                continue

                            edge = [met, reac] if coef < 0 else [reac, met]
                            stoichiometry[reac][met] = coef.item()

                            if is_currency_metabolite(met):
                                enzyme_currency_edges.append(edge)
                            else:
                                enzyme_edges.append(edge)
                                metabolite_names.append(met)
                        elif (db == "BIGG"):
                            cleaned_metabolite = clean_met_name(met)
                            coef = filtered_smat.loc[met, reac]

                            if coef == 0:
                                continue

                            edge = [cleaned_metabolite, reac] if coef < 0 else [reac, cleaned_metabolite]
                            stoichiometry[reac][cleaned_metabolite] = coef.item()

                            if is_currency_metabolite(cleaned_metabolite):
                                enzyme_currency_edges.append(edge)
                            else:
                                enzyme_edges.append(edge)
                                metabolite_names.append(cleaned_metabolite)

                    if enzyme_edges:
                        edges_by_enzyme[reac] = enzyme_edges
                        metabolite_names_by_enzyme[reac] = metabolite_names
                    if enzyme_currency_edges:
                        currency_edges_by_enzyme[reac] = enzyme_currency_edges

                final = {}
                for enzyme in filtered_smat.columns:
                    try:
                        edges = edges_by_enzyme.get(enzyme, [])
                        currency_edges = currency_edges_by_enzyme.get(enzyme, [])
                        met_list = metabolite_names_by_enzyme.get(enzyme, [])
                        stoichs_for_reaction = stoichiometry[enzyme]

                        # Build reaction string
                        reactants = []
                        products = []
                        for met, coeff in stoichs_for_reaction.items():
                            if coeff == 0:
                                continue
                            
                            abs_coeff = abs(coeff)
                            
                            if abs_coeff == 1:
                                formatted = f"{met}"
                            else:
                                
                                coeff_str = str(int(abs_coeff)) if abs_coeff.is_integer() else str(abs_coeff)
                                formatted = f"{coeff_str} {met}"
                            
                            # Add to reactants or products based on sign
                            if coeff < 0:
                                reactants.append(formatted)
                            else:
                                products.append(formatted)

                        rxn_str = " + ".join(reactants) + " <==> " + " + ".join(products)

                        # Enzyme description
                        desc_row = df[df['Abbreviation'] == enzyme]
                        description = desc_row['Description'].iloc[0] if not desc_row.empty else enzyme

                        # Metabolite name mapping
                        metabolites = {}
                        for met in met_list:
                            row = df2[df2['Abbreviation'] == met]
                            desc = row['Description'].iloc[0] if not row.empty else met
                            formula = (
                                row["Formula"].iloc[0]
                                if not row.empty and "Formula" in row.columns
                                else "None"
                            )
                            # chebi_crossref = find_crossrefs_mets(row, db)
                            chebi_crossref = []
                            metabolites[str(met)] = [desc, formula, 'Cytoplasm', chebi_crossref, 'No weight']

                        final[enzyme] = {
                            'edges': edges,
                            'currency_edges': currency_edges,
                            'reaction': rxn_str,
                            'description': description,
                            'metabolites': metabolites,
                            "stoichiometry": stoichs_for_reaction
                        }

                    except Exception as edge_error:
                        
                        continue

                clean_data = sanitize(final)


                return jsonify({
                    'status': 'success',
                    'result': clean_data
                })

            except KeyError as ke:
                return jsonify({
                    'status': 'error',
                    'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                }), 400
            
            except Exception as processing_error:
                
                return jsonify({
                    'status': 'error',
                    'message': 'Failed to process metabolic data'
                }), 500

        except Exception as e:
            
            return jsonify({
                'status': 'error',
                'message': 'Internal server error'
            }), 500
    except Exception as e:
        
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500
    

@app.route('/api/v1/fill-missing', methods=['POST'])
def fillMissing():
    
    try:
        if not request.is_json:
            return jsonify({'status': 'error', 'message': 'Request must be JSON'}), 400
        data = request.get_json()
        metabolite = data.get('metabolite')

        if not metabolite:
            return jsonify({'status': 'error', 'message': 'Missing metabolite'}), 400
        
        db1 = check_kegg_bigg(metabolite[0])
        db2 = check_kegg_bigg(metabolite[1])

        if(db1 == "BIGG" and db2 == "BIGG"):
            cur_metabolites, smat, df, df2 = get_data(db1)
        elif(db1 == "KEGG" and db2 == "KEGG"):
            cur_metabolites, smat, df, df2 = get_data(db1)
        else: 
            return jsonify({
                    'status': 'error',
                    'message': f'Metabolite should belong to only one database either KEGG or BiGG'
                }), 400

        def is_currency_metabolite(met):
            currency_keywords = [
                "h", "k", "pi", "cl", "o2", "na1", "h2o", "co2", "atp", "adp",
                "utp", "gtp", "gdp", "amp", "nad", "fad", "coa", "ppi", "nh4", "nh3",
                "acp", "thf", "crn", "nadh", "fadh", "nadp", "nadph"
                ]
            currency_keywords_final = cur_metabolites + currency_keywords
            return any(met.lower().startswith(cur.lower()) for cur in currency_keywords_final)
        
        try:
            first = clean_met_name(metabolite[0])
            second = clean_met_name(metabolite[1])
            cleaned_index_map = {clean_met_name(idx): idx for idx in smat.index}
            actual_index1 = cleaned_index_map.get(first)
            actual_index2 = cleaned_index_map.get(second)
                
            row1 = smat.loc[actual_index1]
            row2 = smat.loc[actual_index2]

            if row1.empty or row2.empty:
                return jsonify({
                        'status': 'error',
                        'message': 'No enzymes found for this metabolite',
                        'result': {}
                }), 200
                
            filtered_enzymes = []
            for enz in row1.index:
                if ((row1[enz] < 0) and (row2[enz] > 0)):
                    filtered_enzymes.append(enz)

            filtered_smat = smat[filtered_enzymes]
            edges_by_enzyme = {}
            currency_edges_by_enzyme = {}
            metabolite_names_by_enzyme = {}
            stoichiometry = {}

            for reac in filtered_smat.columns:
                enzyme_edges = []
                currency_edges = []
                metabolite_names = []
                stoichiometry[reac] = {}

                for met in filtered_smat.index:
                    if (db1 == "BIGG"):
                        cleaned_metabolite = clean_met_name(met)
                        coef = filtered_smat.loc[met, reac]

                        if coef == 0:
                            continue
                        edge = [cleaned_metabolite, reac] if coef < 0 else [reac, cleaned_metabolite]
                        stoichiometry[reac][cleaned_metabolite] = coef.item()

                        if is_currency_metabolite(cleaned_metabolite):
                            currency_edges.append(edge)
                        else:
                            enzyme_edges.append(edge)
                            metabolite_names.append(cleaned_metabolite)
                    elif (db1 == "KEGG"):
                        cleaned_metabolite = clean_met_name(met)
                        coef = filtered_smat.loc[met, reac]

                        if coef == 0:
                            continue
                        edge = [met, reac] if coef < 0 else [reac, met]

                        stoichiometry[reac][met] = coef.item()
                        if is_currency_metabolite(met):
                            currency_edges.append(edge)
                        else:
                            enzyme_edges.append(edge)
                            metabolite_names.append(met)

                if enzyme_edges:
                    edges_by_enzyme[reac] = enzyme_edges
                    metabolite_names_by_enzyme[reac] = metabolite_names
                if currency_edges:
                    currency_edges_by_enzyme[reac] = currency_edges

            final = {}
            for enzyme in filtered_smat.columns:
                try:
                    edges = edges_by_enzyme.get(enzyme, [])
                    currency_edges = currency_edges_by_enzyme.get(enzyme, [])
                    met_list = metabolite_names_by_enzyme.get(enzyme, [])
                    stoichs_for_reaction = stoichiometry[enzyme]

                    reactants = []
                    products = []
                    for met, coeff in stoichs_for_reaction.items():
                            if coeff == 0:
                                continue
                            
                            abs_coeff = abs(coeff)
                            
                            if abs_coeff == 1:
                                formatted = f"{met}"
                            else:
                                
                                coeff_str = str(int(abs_coeff)) if abs_coeff.is_integer() else str(abs_coeff)
                                formatted = f"{coeff_str} {met}"
                            
                            if coeff < 0:
                                reactants.append(formatted)
                            else:
                                products.append(formatted)

                    rxn_str = " + ".join(reactants) + " <==> " + " + ".join(products)
                    desc_row = df[df['Abbreviation'] == enzyme]
                    description = desc_row['Description'].iloc[0] if not desc_row.empty else enzyme
                    metabolites = {}
                    for met in met_list:
                        row = df2[df2['Abbreviation'] == met]
                        desc = row['Description'].iloc[0] if not row.empty else met
                        formula = (
                            row["Formula"].iloc[0]
                            if not row.empty and "Formula" in row.columns
                            else "None"
                        )
                        chebi_crossref = []
                        metabolites[str(met)] = [desc, formula, 'Cytoplasm', chebi_crossref, 'No weight']

                    final[enzyme] = {
                            'edges': edges,
                            'currency_edges': currency_edges,
                            'reaction': rxn_str,
                            'description': description,
                            'metabolites': metabolites,
                            "stoichiometry": stoichs_for_reaction
                    }
                except Exception as edge_error:
                    
                    continue

            clean_data = sanitize(final)

            return jsonify({
                    'status': 'success',
                    'result': clean_data
            })

        except KeyError as ke:
                return jsonify({
                    'status': 'error',
                    'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                }), 400

        except Exception as processing_error:
                
                return jsonify({
                    'status': 'error',
                    'message': 'Failed to process metabolic data'
                }), 500

    except Exception as e:
        
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500
    
@app.route("/api/v1/serve-query-table", methods=["POST"])
def serve_table():
    try:
        if not request.is_json:
                return jsonify({'status': 'error', 'message': 'Request must be JSON'}), 400
        data = request.get_json()
        query = data.get('query')
        database = data.get('database')
        

        if(database == "BIGG"):
            cur_metabolites, smat, df, df2 = get_data(database)
        elif(database == "KEGG"):
            cur_metabolites, smat, df, df2 = get_data(database)

        matching_enzymes = get_matching_enzymes(query=query, database=database)

        if not matching_enzymes:
            return jsonify({'status': 'error', 'message': 'No results found for your query'}), 400
        
        enzymes_df = df[df["Abbreviation"].isin(matching_enzymes)]

        final = {}
        for i in range(len(enzymes_df)):
            row = enzymes_df.iloc[i]
            enzyme = row["Abbreviation"]
            final[enzyme] = {
                'reaction': row["Reaction"],
                'description': row["Description"]
            }

        clean_data = sanitize(final)
    
        return jsonify({
            'status': 'success',
            'result': clean_data
        })

    
    except Exception as e:
        
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500
    
@app.route("/api/v1/add-full-reactions-v2", methods=['POST'])
def addFullReactionsv2():
    try:
        data = request.get_json()
        database = data.get('database')
        selected_enzymes = data.get("enzymes")
        if(database == "BIGG"):
            cur_metabolites, smat, df, df2 = get_data(database)
        elif(database == "KEGG"):
            cur_metabolites, smat, df, df2 = get_data(database)

        def is_currency_metabolite(met):
            currency_keywords = [
                "h", "k", "pi", "cl", "o2", "na1", "h2o", "co2", "atp", "adp",
                "utp", "gtp", "gdp", "amp", "nad", "fad", "coa", "ppi", "nh4", "nh3",
                "acp", "thf", "crn", "nadh", "fadh", "nadp", "nadph"
                ]
            currency_keywords_final = cur_metabolites + currency_keywords
            return any(met.lower().startswith(cur.lower()) for cur in currency_keywords_final)
        
        try:
            filtered_smat = smat[selected_enzymes]
            edges_by_enzyme = {}
            currency_edges_by_enzyme = {}
            metabolite_names_by_enzyme = {}
            stoichiometry = {}

            for reac in filtered_smat.columns:
                enzyme_edges = []
                enzyme_currency_edges = []
                metabolite_names = []
                stoichiometry[reac] = {}

                for met in filtered_smat.index:
                    if (database == "BIGG"):
                        cleaned_metabolite = clean_met_name(met)
                        coef = filtered_smat.loc[met, reac]

                        if coef == 0:
                            continue

                        edge = [cleaned_metabolite, reac] if coef < 0 else [reac, cleaned_metabolite]
                        stoichiometry[reac][cleaned_metabolite] = coef.item()

                        if is_currency_metabolite(cleaned_metabolite):
                                enzyme_currency_edges.append(edge)
                        else:
                            enzyme_edges.append(edge)
                            metabolite_names.append(cleaned_metabolite)
                    elif (database == "KEGG"):
                        cleaned_metabolite = clean_met_name(met)
                        coef = filtered_smat.loc[met, reac]

                        if coef == 0:
                            continue

                        edge = [met, reac] if coef < 0 else [reac, met]
                        stoichiometry[reac][met] = coef.item()

                        if is_currency_metabolite(met):
                                enzyme_currency_edges.append(edge)
                        else:
                            enzyme_edges.append(edge)
                            metabolite_names.append(met)

                if enzyme_edges:
                    edges_by_enzyme[reac] = enzyme_edges
                    metabolite_names_by_enzyme[reac] = metabolite_names
                if enzyme_currency_edges:
                    currency_edges_by_enzyme[reac] = enzyme_currency_edges

            final = {}
            for enzyme in filtered_smat.columns:
                try:
                    edges = edges_by_enzyme.get(enzyme, [])
                    currency_edges = currency_edges_by_enzyme.get(enzyme, [])
                    met_list = metabolite_names_by_enzyme.get(enzyme, [])
                    stoichs_for_reaction = stoichiometry[enzyme]

                    reactants = []
                    products = []
                    for met, coeff in stoichs_for_reaction.items():
                            if coeff == 0:
                                continue
                            
                            abs_coeff = abs(coeff)
                            
                            if abs_coeff == 1:
                                formatted = f"{met}"
                            else:
                                
                                coeff_str = str(int(abs_coeff)) if abs_coeff.is_integer() else str(abs_coeff)
                                formatted = f"{coeff_str} {met}"
                            
                            # Add to reactants or products based on sign
                            if coeff < 0:
                                reactants.append(formatted)
                            else:
                                products.append(formatted)

                    rxn_str = " + ".join(reactants) + " <==> " + " + ".join(products)
                        # Enzyme description
                    desc_row = df[df['Abbreviation'] == enzyme]
                    description = desc_row['Description'].iloc[0] if not desc_row.empty else enzyme

                        # Metabolite name mapping
                    metabolites = {}
                    for met in met_list:
                        row = df2[df2['Abbreviation'] == met]
                        desc = row['Description'].iloc[0] if not row.empty else met
                        formula = (
                                row["Formula"].iloc[0]
                                if not row.empty and "Formula" in row.columns
                                else "None"
                            )
                        # chebi_crossref = find_crossrefs_mets(row, db)
                        chebi_crossref = []
                        metabolites[str(met)] = [desc, formula, 'Cytoplasm', chebi_crossref, 'No weight']
                       

                    final[enzyme] = {
                            'edges': edges,
                            'currency_edges': currency_edges,
                            'reaction': rxn_str,
                            'description': description,
                            'metabolites': metabolites,
                            "stoichiometry": stoichs_for_reaction
                        }
                    
                except Exception as edge_error:
                    
                    continue

            clean_data = sanitize(final)

            return jsonify({
                    'status': 'success',
                    'result': clean_data
                })
            
        except KeyError as ke:
            return jsonify({
                    'status': 'error',
                    'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                }), 400
            
        except Exception as processing_error:
                
                return jsonify({
                    'status': 'error',
                    'message': 'Failed to process metabolic data'
                }), 500
        

    except Exception as e:
        
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500
  

@app.route('/api/v1/calculate-flux', methods=['POST'])
def calculateFlux():
    try:
        if not request.is_json:
            return jsonify({'status': 'error', 'message': 'Request must be JSON'}), 400

        data = request.get_json()
        modelData = data.get('new_rxn')
        flux_type = data.get('flux_type')
        objective_rxn = data.get("objective")

        path_key = list(modelData.keys())[0]
        path_obj = modelData[path_key]
        firstmet = list(path_obj["metabolites"].keys())[0]

        db = check_kegg_bigg(firstmet)
        if(db == "BIGG"):
            cur_metabolites, smat, df, df2 = get_data(db)
        elif(db == "KEGG"):
            cur_metabolites, smat, df, df2 = get_data(db)
        else: 
            return jsonify({
                    'status': 'error',
                    'message': f'Metabolite should belong to only one database either KEGG or BiGG'
                }), 400

        def is_currency_metabolite(met):
            currency_keywords = [
                "h", "k", "pi", "cl", "o2", "na1", "h2o", "co2", "atp", "adp",
                "utp", "gtp", "gdp", "amp", "nad", "fad", "coa", "ppi", "nh4", "nh3",
                "acp", "thf", "crn", "nadh", "fadh", "nadp", "nadph"
                ]
            currency_keywords_final = cur_metabolites + currency_keywords
            return any(met.lower().startswith(cur.lower()) for cur in currency_keywords_final)
        try:
            model = Model('new_model')
            for path in modelData:
                pathData = modelData[path]
                metabolites = {}
                for met_id, arr in pathData['metabolites'].items():
                    name, formula, compt, crossref, weight = arr
                    crossrefdict = {"chebi": crossref}
                    metabolites[met_id] = Metabolite(id=met_id, name=name, compartment=met_id.split('_')[-1], formula=formula)
                    metabolites[met_id].annotation = crossrefdict
                all_edges = pathData['edges'] + pathData['currency_edges']
                currency_mets = set()
                for a, b in all_edges:
                    for met in [a, b]:
                        if is_currency_metabolite(met):
                            currency_mets.add(met)
                for met_id in currency_mets:
                    if met_id not in metabolites:
                        metabolites[met_id] = Metabolite(id=met_id, name=met_id)

                reaction_edges = defaultdict(list)
                for src, tgt in all_edges:
                    if src in pathData['enzymes']:  # enzyme → metabolite (product)
                        reaction_edges[src].append((None, tgt))
                    elif tgt in pathData['enzymes']:  # metabolite (substrate) → enzyme
                        reaction_edges[tgt].append((src, None))

                gene_list = pathData.get("genes", {})

                for enzyme_id, edge_list in reaction_edges.items():
                    reaction = Reaction(enzyme_id)
                    enzyme_info = pathData['enzymes'].get(enzyme_id, [])
                    

                    reaction.name = enzyme_info[0] if len(enzyme_info) > 0 else enzyme_id
                    reaction.lower_bound = enzyme_info[2] 
                    reaction.upper_bound = enzyme_info[3] 
                    rxn_annotation = pathData["enzyme_crossref"][enzyme_id]
                    cobra_annotation = {key_map[k]: v for k, v in rxn_annotation.items() if k in key_map}
                    reaction.annotation = cobra_annotation

                    actual_stoichiometry = pathData["stoichiometry"][enzyme_id]
                    model_stoichiometry = {}
                    for src, tgt in edge_list:
                        if src:
                            model_stoichiometry[metabolites[src]] = actual_stoichiometry[src]
                        if tgt:
                            model_stoichiometry[metabolites[tgt]] = actual_stoichiometry[tgt]

                    reaction.add_metabolites(model_stoichiometry)

                    reaction.subsystem = enzyme_info[4]

                    gene = list({g.strip() for g in gene_list.get(enzyme_id, []) if g.strip()})
                    if gene:
                        rule = "(" + " or ".join(gene) + ")" if len(gene) > 1 else f'( {gene[0]} )'

                        
                        if reaction.gene_reaction_rule != rule:
                            try:
                                reaction.gene_reaction_rule = rule
                            except Exception as e:
                                continue
                                

                    model.add_reactions([reaction])

            model.objective = objective_rxn
            # cleaned_model = clean_cobra_model(model)

            if flux_type == 'loopless':
                solution = loopless_solution(model)
                return jsonify({
                    "objective_value": solution.objective_value,
                    "fluxes": solution.fluxes.to_dict()
                })

            elif flux_type == 'pfba':
                solution = pfba(model)
                return jsonify({
                    "objective_value": solution.objective_value,
                    "fluxes": solution.fluxes.to_dict()
                })

            elif flux_type == 'fba':
                solution = model.optimize()
                return jsonify({
                    "objective_value": solution.objective_value,
                    "fluxes": solution.fluxes.to_dict()
                })
            
            elif flux_type == 'fva':
                # You can adjust fraction_of_optimum if needed (default: 1.0)
                fva_result = flux_variability_analysis(model, fraction_of_optimum=1.0)

                return jsonify({
                    "minimum_flux": fva_result['minimum'].to_dict(),
                    "maximum_flux": fva_result['maximum'].to_dict()
                })

            elif flux_type == 'srd':
                result = single_reaction_deletion(model)
                solution = model.optimize()
                return jsonify({
                    "srd": serialize_deletion_result(result),
                    "objective_value": solution.objective_value
                })

            elif flux_type == 'sgd':
                result = single_gene_deletion(model)
                solution = model.optimize()
                return jsonify({
                    "sgd": serialize_deletion_result(result),
                    "objective_value": solution.objective_value
                })

        except KeyError as ke:
                return jsonify({
                        'status': 'error',
                        'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                    }), 400
                
        except Exception as processing_error:
                
                return jsonify({
                        'status': 'error',
                        'message': 'Failed to process metabolic data'
                    }), 500

    except Exception as e:
        
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500


@app.route('/api/v1/calculate-centrality', methods=['POST'])
def calculateCentrality():
    try:
        if not request.is_json:
            return jsonify({'status': 'error', 'message': 'Request must be JSON'}), 400

        data = request.get_json()
        modelData = data.get('new_rxn')
        selectedCentralities = data.get('selectedCentralities')
        path_key = list(modelData.keys())[0]
        path_obj = modelData[path_key]

        firstmet = list(path_obj["metabolites"].keys())[0]
        

        db = check_kegg_bigg(firstmet)
        if(db == "BIGG"):
            cur_metabolites, smat, df, df2 = get_data(db)
        elif(db == "KEGG"):
            cur_metabolites, smat, df, df2 = get_data(db)
        else: 
            return jsonify({
                    'status': 'error',
                    'message': f'Metabolite should belong to only one database either KEGG or BiGG'
                }), 400
        
        def is_currency_metabolite(met):
            currency_keywords = [
                "h", "k", "pi", "cl", "o2", "na1", "h2o", "co2", "atp", "adp",
                "utp", "gtp", "gdp", "amp", "nad", "fad", "coa", "ppi", "nh4", "nh3",
                "acp", "thf", "crn", "nadh", "fadh", "nadp", "nadph"
                ]
            currency_keywords_final = cur_metabolites + currency_keywords
            return any(met.lower().startswith(cur.lower()) for cur in currency_keywords_final)
        
        try:
            model = Model('new_model')
            for path in modelData:
                pathData = modelData[path]
                metabolites = {}
                for met_id, arr in pathData['metabolites'].items():
                    name, formula, compt, crossref, weight = arr
                    crossrefdict = {"chebi": crossref}
                    metabolites[met_id] = Metabolite(id=met_id, name=name, compartment=met_id.split('_')[-1], formula=formula)
                    metabolites[met_id].annotation = crossrefdict
                all_edges = pathData['edges'] + pathData['currency_edges']
                currency_mets = set()
                for a, b in all_edges:
                    for met in [a, b]:
                        if is_currency_metabolite(met):
                            currency_mets.add(met)

                for met_id in currency_mets:
                    if met_id not in metabolites:
                        metabolites[met_id] = Metabolite(id=met_id, name=met_id, compartment=met_id.split('_')[-1])

                reaction_edges = defaultdict(list)
                for src, tgt in all_edges:
                    if src in pathData['enzymes']:  # enzyme → metabolite (product)
                        reaction_edges[src].append((None, tgt))
                    elif tgt in pathData['enzymes']:  # metabolite (substrate) → enzyme
                        reaction_edges[tgt].append((src, None))

                for enzyme_id, edge_list in reaction_edges.items():
                    reaction = Reaction(enzyme_id)
                    enzyme_info = pathData['enzymes'].get(enzyme_id, [])
                    reaction.name = enzyme_info[0] if len(enzyme_info) > 0 else enzyme_id
                    reaction.lower_bound = enzyme_info[2] 
                    reaction.upper_bound = enzyme_info[3] 
                    rxn_annotation = pathData["enzyme_crossref"][enzyme_id]
                    cobra_annotation = {key_map[k]: v for k, v in rxn_annotation.items() if k in key_map}
                    reaction.annotation = cobra_annotation
                    actual_stoichiometry = pathData["stoichiometry"][enzyme_id]
                    model_stoichiometry = {}
                    for src, tgt in edge_list:
                        if src:
                            model_stoichiometry[metabolites[src]] = actual_stoichiometry[src]
                        if tgt:
                            model_stoichiometry[metabolites[tgt]] = actual_stoichiometry[tgt]
                            
                    reaction.add_metabolites(model_stoichiometry)

                    reaction.subsystem = enzyme_info[4]
                    model.add_reactions([reaction])

            cleaned_model = clean_cobra_model(model)

        except KeyError as ke:
                return jsonify({
                        'status': 'error',
                        'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                    }), 400
                
        except Exception as processing_error:
                
                return jsonify({
                        'status': 'error',
                        'message': 'Failed to process metabolic data'
                    }), 500

        try:
            S = cobra.util.create_stoichiometric_matrix(cleaned_model)
            S_df = pd.DataFrame(S, index=[m.id for m in cleaned_model.metabolites],
                            columns=[r.id for r in cleaned_model.reactions])
            metabolites = list(S_df.index)
            filtered_metabolites = [
                    m for m in metabolites
                    if not is_currency_metabolite(m)
                ]
            filtered_smat = S_df.loc[filtered_metabolites]
            edges_by_enzyme = {}
            for reac in filtered_smat.columns:
                enzyme_edges = []
                for met in filtered_smat.index:
                    if (db == "BIGG"):
                        cleaned_metabolite = clean_met_name(met)
                        coef = filtered_smat.loc[met, reac]
                            
                        if coef < 0:
                            enzyme_edges.append((cleaned_metabolite, reac))
                        elif coef > 0:
                            enzyme_edges.append((reac, cleaned_metabolite))
                    elif (db == "KEGG"):
                        cleaned_metabolite = clean_met_name(met)
                        coef = filtered_smat.loc[met, reac]
                            
                        if coef < 0:
                            enzyme_edges.append((met, reac))
                        elif coef > 0:
                            enzyme_edges.append((reac, met))

                if enzyme_edges:
                    edges_by_enzyme[reac] = enzyme_edges

            final = {}
            rmn = []
            for enzyme, edges in edges_by_enzyme.items():
                try:
                    reactants = []
                    products = []
                        
                    for first, second in edges:
                        if first == enzyme:
                            products.append(second)
                        elif second == enzyme:
                            reactants.append(first)
                        
                    rxn_str = ' + '.join(reactants) + ' <==> ' + ' + '.join(products)
                    desc_row = df[df['Abbreviation'] == enzyme]
                    description = desc_row['Description'].iloc[0] if not desc_row.empty else enzyme
                    final[enzyme] = {
                            'edges': edges,
                            'reaction': rxn_str, 
                            'description': description
                        }
                    for r in reactants:
                        rmn.append([r, enzyme])
                    for p in products:
                        rmn.append([enzyme, p])
                except Exception as edge_error:
                    
                    continue

            G = nx.DiGraph()
            G.add_edges_from(rmn)
            metrics = {}

            if selectedCentralities == 'degree':
                metrics["degree"] = nx.degree_centrality(G)
            if selectedCentralities == 'betweenness':
                metrics["betweenness"] = nx.betweenness_centrality(G)
            if "closeness" in selectedCentralities == 'closeness':
                metrics["closeness"] = nx.closeness_centrality(G)
            if selectedCentralities == 'eigenvector':
                try:
                    metrics["eigenvector"] = nx.eigenvector_centrality(G, max_iter=1000, tol=1e-06)
                except nx.PowerIterationFailedConvergence:
                    metrics["eigenvector"] = {n: None for n in G.nodes()}
            if selectedCentralities == 'pagerank':
                metrics["pagerank"] = nx.pagerank(G)


            result = []
            for node in G.nodes():
                node_data = {"node": node}
                # for metric_name in selectedCentralities:
                #     node_data[metric_name] = metrics.get(metric_name, {}).get(node)
                node_data[selectedCentralities] = metrics.get(selectedCentralities, {}).get(node)
                result.append(node_data)

            
            return jsonify({
                    'status': 'success',
                    'result': result
                })

        except KeyError as ke:
            return jsonify({
                    'status': 'error',
                    'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                }), 400
            
        except Exception as processing_error:
            
            return jsonify({
                    'status': 'error',
                    'message': 'Failed to process metabolic data'
                }), 500

    except Exception as e:
        
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500


@app.route('/api/v1/download-edge-lists', methods=['POST'])
def downloadEdgeList():
    try:
        if not request.is_json:
            return jsonify({'status': 'error', 'message': 'Request must be JSON'}), 400

        data = request.get_json()
        modelData = data['modelData']
        path_key = list(modelData.keys())[0]
        path_obj = modelData[path_key]
        firstmet = list(path_obj["metabolites"].keys())[0]
        db = check_kegg_bigg(firstmet)
        if(db == "BIGG"):
            cur_metabolites, smat, df, df2 = get_data(db)
        elif(db == "KEGG"):
            cur_metabolites, smat, df, df2 = get_data(db)
        else: 
            return jsonify({
                    'status': 'error',
                    'message': f'Metabolite should belong to only one database either KEGG or BiGG'
                }), 400
        
        def is_currency_metabolite(met):
            currency_keywords = [
                "h", "k", "pi", "cl", "o2", "na1", "h2o", "co2", "atp", "adp",
                "utp", "gtp", "gdp", "amp", "nad", "fad", "coa", "ppi", "nh4","nh3",
                "acp", "thf", "crn", "nadh", "fadh", "nadp", "nadph"
                ]
            currency_keywords_final = cur_metabolites + currency_keywords
            return any(met.lower().startswith(cur.lower()) for cur in currency_keywords_final)
        
        try:
            model = Model('new_model')
            for path in modelData:
                pathData = modelData[path]
                metabolites = {}
                for met_id, arr in pathData['metabolites'].items():
                    name, formula, compt, crossref, weight = arr
                    crossrefdict = {"chebi": crossref}
                    metabolites[met_id] = Metabolite(id=met_id, name=name, compartment=met_id.split('_')[-1], formula=formula)
                    metabolites[met_id].annotation = crossrefdict
                all_edges = pathData['edges'] + pathData['currency_edges']
                currency_mets = set()
                for a, b in all_edges:
                    for met in [a, b]:
                        if is_currency_metabolite(met):
                            currency_mets.add(met)

                for met_id in currency_mets:
                    if met_id not in metabolites:
                        metabolites[met_id] = Metabolite(id=met_id, name=met_id, compartment=met_id.split('_')[-1])

                reaction_edges = defaultdict(list)
                for src, tgt in all_edges:
                    if src in pathData['enzymes']:  # enzyme → metabolite (product)
                        reaction_edges[src].append((None, tgt))
                    elif tgt in pathData['enzymes']:  # metabolite (substrate) → enzyme
                        reaction_edges[tgt].append((src, None))

                for enzyme_id, edge_list in reaction_edges.items():
                    reaction = Reaction(enzyme_id)
                    enzyme_info = pathData['enzymes'].get(enzyme_id, [])
                    

                    reaction.name = enzyme_info[0] if len(enzyme_info) > 0 else enzyme_id

                    reaction.lower_bound = enzyme_info[2] 
                    reaction.upper_bound = enzyme_info[3] 
                    rxn_annotation = pathData["enzyme_crossref"][enzyme_id]
                    cobra_annotation = {key_map[k]: v for k, v in rxn_annotation.items() if k in key_map}
                    reaction.annotation = cobra_annotation
                    actual_stoichiometry = pathData["stoichiometry"][enzyme_id]
                    model_stoichiometry = {}
                    for src, tgt in edge_list:
                        if src:
                            model_stoichiometry[metabolites[src]] = actual_stoichiometry[src]
                        if tgt:
                            model_stoichiometry[metabolites[tgt]] = actual_stoichiometry[tgt]
                            
                    reaction.add_metabolites(model_stoichiometry)

                    reaction.subsystem = enzyme_info[4]
                    model.add_reactions([reaction])

            cleaned_model = clean_cobra_model(model)

                
            
        except KeyError as ke:
                return jsonify({
                        'status': 'error',
                        'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                    }), 400
                
        except Exception as processing_error:
                
                return jsonify({
                        'status': 'error',
                        'message': 'Failed to process metabolic data'
                    }), 500

        try:
            S = cobra.util.create_stoichiometric_matrix(cleaned_model)
            S_df = pd.DataFrame(S, index=[m.id for m in cleaned_model.metabolites],
                            columns=[r.id for r in cleaned_model.reactions])
            metabolites = list(S_df.index)
            filtered_metabolites = [
                    m for m in metabolites
                    if not is_currency_metabolite(m)
                ]
            filtered_smat = S_df.loc[filtered_metabolites]
            edges_by_enzyme = {}
            for reac in filtered_smat.columns:
                enzyme_edges = []
                for met in filtered_smat.index:
                    cleaned_metabolite = clean_met_name(met)
                    coef = filtered_smat.loc[met, reac]
                        
                    if coef < 0:
                        enzyme_edges.append((cleaned_metabolite, reac))
                    elif coef > 0:
                        enzyme_edges.append((reac, cleaned_metabolite))
                    
                if enzyme_edges:
                    edges_by_enzyme[reac] = enzyme_edges

            final = {}
            rmn = []
            for enzyme, edges in edges_by_enzyme.items():
                try:
                    reactants = []
                    products = []
                        
                    for first, second in edges:
                        if first == enzyme:
                            products.append(second)
                        elif second == enzyme:
                            reactants.append(first)
                        
                    rxn_str = ' + '.join(reactants) + ' <==> ' + ' + '.join(products)
                    desc_row = df[df['Abbreviation'] == enzyme]
                    description = desc_row['Description'].iloc[0] if not desc_row.empty else enzyme
                    final[enzyme] = {
                            'edges': edges,
                            'reaction': rxn_str, 
                            'description': description
                        }
                    for r in reactants:
                        rmn.append([r, enzyme])
                    for p in products:
                        rmn.append([enzyme, p])
                except Exception as edge_error:
                    
                    continue
                
            reactions2 = {}
            reactions = {}

            for enz in final.keys():
                reactions2[enz] = []
                reactions[enz] = {"reactants": [], "products": []}
                
            for enz, obj in final.items():
                edges = obj['edges']
                rxn_products = set()
                rxn_reactants = set()
                actual_edges = set()
                for edg in edges:
                    first = edg[0]
                    second = edg[1]
                    if(first != enz):
                        rxn_reactants.add(first)
                        actual_edges.add(first)
                    if(second != enz):
                        rxn_products.add(second)
                        actual_edges.add(second)
                    
                edg_arr = []
                for edg in actual_edges:
                    edg_arr.append(edg)
                    
                reactions2[enz] = edg_arr

                for prod in rxn_products:
                    reactions[enz]["products"].append(prod)
                for reac in rxn_reactants:
                    reactions[enz]["reactants"].append(reac)

            mmn = []
            rrn = []

            for mets in reactions2.values():
                for i in range(len(mets)):
                    for j in range(i + 1, len(mets)):
                        mmn.append([mets[i], mets[j]])

            for r1, data1 in reactions.items():
                prods1 = set(data1["products"])
                react1 = set(data1["reactants"])
                
                for r2, data2 in reactions.items():
                    if r1 == r2:
                        continue
                    
                    react2 = set(data2["reactants"])
                    shares_product_to_reactant = len(prods1 & react2) > 0
                    shares_reactant = len(react1 & react2) > 0
                    if shares_product_to_reactant and not shares_reactant:
                        rrn.append((r1, r2))

            return jsonify({
                    'status': 'success',
                    'metabolite_network': mmn,
                    'reaction_network': rrn,
                    'reaction_metabolite_network' : rmn
                })

        except KeyError as ke:
                return jsonify({
                    'status': 'error',
                    'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                }), 400
            
        except Exception as processing_error:
                
                return jsonify({
                    'status': 'error',
                    'message': 'Failed to process metabolic data'
                }), 500

    except Exception as e:
       
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500

def perform_gsea(ranks_series, gmt_dict):
    pre_res = gp.prerank(
                rnk=ranks_series,
                gene_sets=gmt_dict,  
                outdir="GSEA_Results",
                permutation_num=1000,          
                seed=42,
                threads=1
    )
    return pre_res
@app.route("/api/v1/gene-set-enrichment-analysis", methods=["POST"])
def gsea():
    try:
        # data = request.get_json()
        # modelData = data['modelData']
        # also take the ranked_list file
        
        if not request.is_json:
            return jsonify({'status': 'error', 'message': 'Request must be JSON'}), 400

        data = request.get_json()
        modelData = data['modelData']
        ranksData = data['filedata']
        minsize = data["minsize"]
        maxsize = data["maxsize"]
        permutations = data["permutations"]

        ranks = pd.DataFrame(ranksData, columns=["Reaction", "Rank"])
        path_key = list(modelData.keys())[0]
        path_obj = modelData[path_key]

        firstmet = list(path_obj["metabolites"].keys())[0]
        db = check_kegg_bigg(firstmet)
        if(db == "BIGG"):
            cur_metabolites, smat, df, df2 = get_data(db)
        elif(db == "KEGG"):
            cur_metabolites, smat, df, df2 = get_data(db)
        else: 
            return jsonify({
                    'status': 'error',
                    'message': f'Metabolite should belong to only one database either KEGG or BiGG'
                }), 400
        
        def is_currency_metabolite(met):
            currency_keywords = [
                "h", "k", "pi", "cl", "o2", "na1", "h2o", "co2", "atp", "adp",
                "utp", "gtp", "gdp", "amp", "nad", "fad", "coa", "ppi", "nh4","nh3",
                "acp", "thf", "crn", "nadh", "fadh", "nadp", "nadph"
                ]
            currency_keywords_final = cur_metabolites + currency_keywords
            return any(met.lower().startswith(cur.lower()) for cur in currency_keywords_final)
        
        try:
            model = Model('new_model')
            for path in modelData:
                pathData = modelData[path]
                metabolites = {}
                for met_id, arr in pathData['metabolites'].items():
                    name, formula, compt, crossref, weight = arr
                    crossrefdict = {"chebi": crossref}
                    metabolites[met_id] = Metabolite(id=met_id, name=name, compartment=met_id.split('_')[-1], formula=formula)
                    metabolites[met_id].annotation = crossrefdict
                all_edges = pathData['edges'] + pathData['currency_edges']
                currency_mets = set()
                for a, b in all_edges:
                    for met in [a, b]:
                        if is_currency_metabolite(met):
                            currency_mets.add(met)

                for met_id in currency_mets:
                    if met_id not in metabolites:
                        metabolites[met_id] = Metabolite(id=met_id, name=met_id, compartment=met_id.split('_')[-1])

                reaction_edges = defaultdict(list)
                gene_list = pathData.get("genes", {})
                for src, tgt in all_edges:
                    if src in pathData['enzymes']:  # enzyme → metabolite (product)
                        reaction_edges[src].append((None, tgt))
                    elif tgt in pathData['enzymes']:  # metabolite (substrate) → enzyme
                        reaction_edges[tgt].append((src, None))

                for enzyme_id, edge_list in reaction_edges.items():
                    reaction = Reaction(enzyme_id)
                    enzyme_info = pathData['enzymes'].get(enzyme_id, [])
                    
                    reaction.name = enzyme_info[0] if len(enzyme_info) > 0 else enzyme_id

                    reaction.lower_bound = enzyme_info[2] 
                    reaction.upper_bound = enzyme_info[3] 
                    rxn_annotation = pathData["enzyme_crossref"][enzyme_id]
                    cobra_annotation = {key_map[k]: v for k, v in rxn_annotation.items() if k in key_map}
                    reaction.annotation = cobra_annotation
                    actual_stoichiometry = pathData["stoichiometry"][enzyme_id]
                    model_stoichiometry = {}
                    for src, tgt in edge_list:
                        if src:
                            model_stoichiometry[metabolites[src]] = actual_stoichiometry[src]
                        if tgt:
                            model_stoichiometry[metabolites[tgt]] = actual_stoichiometry[tgt]
                            
                    reaction.add_metabolites(model_stoichiometry)

                    reaction.subsystem = enzyme_info[4]
                    gene = list({g.strip() for g in gene_list.get(enzyme_id, []) if g.strip()})
                    if gene:
                        rule = "(" + " or ".join(gene) + ")" if len(gene) > 1 else f'( {gene[0]} )'

                        
                        if reaction.gene_reaction_rule != rule:
                            try:
                                reaction.gene_reaction_rule = rule
                            except Exception as e:
                                return jsonify({
                                    'status': 'error',
                                    'message': 'Gene Rule Error'
                                }), 500
                                

                    model.add_reactions([reaction])

        except KeyError as ke:
                return jsonify({
                        'status': 'error',
                        'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                    }), 400
                
        except Exception as processing_error:
                
                return jsonify({
                        'status': 'error',
                        'message': 'Failed to process metabolic data'
                    }), 500
        
       

        try:
            S = cobra.util.create_stoichiometric_matrix(model)
            S_df = pd.DataFrame(S, index=[m.id for m in model.metabolites],
                            columns=[r.id for r in model.reactions])
            metabolites = list(S_df.index)
            filtered_metabolites = [
                    m for m in metabolites
                    if not is_currency_metabolite(m)
                ]
            filtered_smat = S_df.loc[filtered_metabolites]
            edges_by_enzyme = {}
            for reac in filtered_smat.columns:
                enzyme_edges = []
                for met in filtered_smat.index:
                    cleaned_metabolite = clean_met_name(met)
                    coef = filtered_smat.loc[met, reac]
                        
                    if coef < 0:
                        enzyme_edges.append((cleaned_metabolite, reac))
                    elif coef > 0:
                        enzyme_edges.append((reac, cleaned_metabolite))
                    
                if enzyme_edges:
                    edges_by_enzyme[reac] = enzyme_edges

            final = {}
            rmn = []
            for enzyme, edges in edges_by_enzyme.items():
                try:
                    reactants = []
                    products = []
                        
                    for first, second in edges:
                        if first == enzyme:
                            products.append(second)
                        elif second == enzyme:
                            reactants.append(first)
                        
                    rxn_str = ' + '.join(reactants) + ' <==> ' + ' + '.join(products)
                    desc_row = df[df['Abbreviation'] == enzyme]
                    description = desc_row['Description'].iloc[0] if not desc_row.empty else enzyme
                    final[enzyme] = {
                            'edges': edges,
                            'reaction': rxn_str, 
                            'description': description
                        }
                    for r in reactants:
                        rmn.append([r, enzyme])
                    for p in products:
                        rmn.append([enzyme, p])
                except Exception as edge_error:
                    
                    continue
                
            reactions2 = {}
            reactions = {}

            for enz in final.keys():
                reactions2[enz] = []
                reactions[enz] = {"reactants": [], "products": []}
                
            for enz, obj in final.items():
                edges = obj['edges']
                rxn_products = set()
                rxn_reactants = set()
                actual_edges = set()
                for edg in edges:
                    first = edg[0]
                    second = edg[1]
                    if(first != enz):
                        rxn_reactants.add(first)
                        actual_edges.add(first)
                    if(second != enz):
                        rxn_products.add(second)
                        actual_edges.add(second)
                    
                edg_arr = []
                for edg in actual_edges:
                    edg_arr.append(edg)
                    
                reactions2[enz] = edg_arr

                for prod in rxn_products:
                    reactions[enz]["products"].append(prod)
                for reac in rxn_reactants:
                    reactions[enz]["reactants"].append(reac)

            mmn = []
            rrn = []

            for mets in reactions2.values():
                for i in range(len(mets)):
                    for j in range(i + 1, len(mets)):
                        mmn.append([mets[i], mets[j]])

            for r1, data1 in reactions.items():
                prods1 = set(data1["products"])
                react1 = set(data1["reactants"])
                
                for r2, data2 in reactions.items():
                    if r1 == r2:
                        continue
                    
                    react2 = set(data2["reactants"])
                    shares_product_to_reactant = len(prods1 & react2) > 0
                    shares_reactant = len(react1 & react2) > 0
                    if shares_product_to_reactant and not shares_reactant:
                        rrn.append((r1, r2))


            

            ## perform gsea here
            data_model = []
            for rxn in model.reactions:
                data_model.append({
                    "Reaction": rxn.id,                                  # Reaction abbreviation
                    "Subsystem": rxn.subsystem if rxn.subsystem else "", # Subsystem
                })

            gsea_df = pd.DataFrame(data_model)
            

            # Create GMT dictionary
            gmt_grouped = gsea_df.groupby("Subsystem")["Reaction"].apply(list)
            gmt_dict = gmt_grouped.to_dict()
            for pathway, genes in gmt_dict.items():
                gmt_dict[pathway] = [str(g) for g in genes]

            # Create ranks series (Reaction -> Rank)
            ranks_series = pd.Series(ranks.Rank.values, index=ranks.Reaction)
            ranks_series = pd.to_numeric(ranks_series, errors='coerce')
            ranks_series = ranks_series.sort_values(ascending=False)

            # Send as dict (preserve Reaction names)
            data_to_send = {
                "ranks": ranks_series.to_dict(),  
                "gmt": gmt_dict,
                "outdir": "GSEA_results",
                "permutation_num": permutations,
                "seed": 42,
                "threads": 4,
                "minsize": minsize,
                "maxsize": maxsize
            }

            proc = subprocess.run(
                [sys.executable, "run_gsea.py"],
                input=json.dumps(data_to_send),
                text=True,
                capture_output=True
            )

            if proc.returncode == 0:
                pre_res_json = json.loads(proc.stdout)
                # Convert back to DataFrame if needed
                pre_res_df = pd.DataFrame(pre_res_json)
                
            else:
                return jsonify({
                    'status': 'error',
                    'message': f'GSEA ERROR'
                }), 400
                
            G = nx.Graph()
            G.add_edges_from(rrn)

            return jsonify({
                'status': 'success',
                'gsea_df': pre_res_df.to_dict(orient='records'),  # convert DataFrame to list-of-dicts
                'nodes': list(G.nodes()),                        # convert NodeView to list
                'edges': list(G.edges())                         # convert EdgeView to list
            })

        except KeyError as ke:
                return jsonify({
                    'status': 'error',
                    'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                }), 400
            
        except Exception as processing_error:
                
                return jsonify({
                    'status': 'error',
                    'message': 'Failed to process metabolic data'
                }), 500

    except Exception as e:
        
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500
    
@app.route("/api/v1/over-representation-analysis", methods=["POST"])
def ora():
    try:
        # data = request.get_json()
        # modelData = data['modelData']
        # also take the ranked_list file
        
        if not request.is_json:
            return jsonify({'status': 'error', 'message': 'Request must be JSON'}), 400

        data = request.get_json()
        modelData = data['modelData']
        reactions = data['reactions']

        path_key = list(modelData.keys())[0]
        path_obj = modelData[path_key]

        firstmet = list(path_obj["metabolites"].keys())[0]
        

        db = check_kegg_bigg(firstmet)
        if(db == "BIGG"):
            cur_metabolites, smat, df, df2 = get_data(db)
        elif(db == "KEGG"):
            cur_metabolites, smat, df, df2 = get_data(db)
        else: 
            return jsonify({
                    'status': 'error',
                    'message': f'Metabolite should belong to only one database either KEGG or BiGG'
                }), 400
        
        def is_currency_metabolite(met):
            currency_keywords = [
                "h", "k", "pi", "cl", "o2", "na1", "h2o", "co2", "atp", "adp",
                "utp", "gtp", "gdp", "amp", "nad", "fad", "coa", "ppi", "nh4","nh3",
                "acp", "thf", "crn", "nadh", "fadh", "nadp", "nadph"
                ]
            currency_keywords_final = cur_metabolites + currency_keywords
            return any(met.lower().startswith(cur.lower()) for cur in currency_keywords_final)
        
        try:
            model = Model('new_model')
            for path in modelData:
                pathData = modelData[path]
                metabolites = {}
                for met_id, arr in pathData['metabolites'].items():
                    name, formula, compt, crossref, weight = arr
                    crossrefdict = {"chebi": crossref}
                    metabolites[met_id] = Metabolite(id=met_id, name=name, compartment=met_id.split('_')[-1], formula=formula)
                    metabolites[met_id].annotation = crossrefdict
                all_edges = pathData['edges'] + pathData['currency_edges']
                currency_mets = set()
                for a, b in all_edges:
                    for met in [a, b]:
                        if is_currency_metabolite(met):
                            currency_mets.add(met)

                for met_id in currency_mets:
                    if met_id not in metabolites:
                        metabolites[met_id] = Metabolite(id=met_id, name=met_id, compartment=met_id.split('_')[-1])

                reaction_edges = defaultdict(list)
                gene_list = pathData.get("genes", {})
                for src, tgt in all_edges:
                    if src in pathData['enzymes']:  # enzyme → metabolite (product)
                        reaction_edges[src].append((None, tgt))
                    elif tgt in pathData['enzymes']:  # metabolite (substrate) → enzyme
                        reaction_edges[tgt].append((src, None))

                for enzyme_id, edge_list in reaction_edges.items():
                    reaction = Reaction(enzyme_id)
                    enzyme_info = pathData['enzymes'].get(enzyme_id, [])
                    

                    reaction.name = enzyme_info[0] if len(enzyme_info) > 0 else enzyme_id

                    reaction.lower_bound = enzyme_info[2] 
                    reaction.upper_bound = enzyme_info[3] 
                    rxn_annotation = pathData["enzyme_crossref"][enzyme_id]
                    cobra_annotation = {key_map[k]: v for k, v in rxn_annotation.items() if k in key_map}
                    reaction.annotation = cobra_annotation
                    actual_stoichiometry = pathData["stoichiometry"][enzyme_id]
                    model_stoichiometry = {}
                    for src, tgt in edge_list:
                        if src:
                            model_stoichiometry[metabolites[src]] = actual_stoichiometry[src]
                        if tgt:
                            model_stoichiometry[metabolites[tgt]] = actual_stoichiometry[tgt]
                            
                    reaction.add_metabolites(model_stoichiometry)

                    reaction.subsystem = enzyme_info[4]
                    gene = list({g.strip() for g in gene_list.get(enzyme_id, []) if g.strip()})
                    if gene:
                        rule = "(" + " or ".join(gene) + ")" if len(gene) > 1 else f'( {gene[0]} )'

                        
                        if reaction.gene_reaction_rule != rule:
                            try:
                                reaction.gene_reaction_rule = rule
                            except Exception as e:
                                continue
                                

                    model.add_reactions([reaction])

            

                
            
        except KeyError as ke:
                return jsonify({
                        'status': 'error',
                        'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                    }), 400
                
        except Exception as processing_error:
                
                return jsonify({
                        'status': 'error',
                        'message': 'Failed to process metabolic data'
                    }), 500
        
        

        try:


            ## perform gsea here
            data_model = []
            for rxn in model.reactions:
                data_model.append({
                    "Reaction": rxn.id,                                  # Reaction abbreviation
                    "Subsystem": rxn.subsystem if rxn.subsystem else "", # Subsystem
                })

            gsea_df = pd.DataFrame(data_model)
            
            # Create GMT dictionary
            gmt_grouped = gsea_df.groupby("Subsystem")["Reaction"].apply(list)
            gmt_dict = gmt_grouped.to_dict()
            for pathway, genes in gmt_dict.items():
                gmt_dict[pathway] = [str(g) for g in genes]

            enr2 = gp.enrich(gene_list=reactions, 
                 gene_sets=gmt_dict, 
                 background=None, 
                 outdir=None,
                 verbose=True)
            
            results_df = enr2.results

            return jsonify({
                "status": "success",
                "results": results_df.to_dict(orient="records")
            })

        except KeyError as ke:
                return jsonify({
                    'status': 'error',
                    'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                }), 400
            
        except Exception as processing_error:
                
                return jsonify({
                    'status': 'error',
                    'message': 'Failed to process metabolic data'
                }), 500

    except Exception as e:
        
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500
    

@app.route('/api/v1/download-model-test', methods=['POST'])
def downloadModelTest():
    try:
        if not request.is_json:
                return jsonify({'status': 'error', 'message': 'Request must be JSON'}), 400

        data = request.get_json()
        modelData = data.get('new_rxn')
        file_type = data.get('file_type')
        objective = data.get('objective')
        path_key = list(modelData.keys())[0]
        path_obj = modelData[path_key]
        firstmet = list(path_obj["metabolites"].keys())[0]
        
        db = check_kegg_bigg(firstmet)
        if(db == "BIGG"):
            cur_metabolites, smat, df, df2 = get_data(db)
        elif(db == "KEGG"):
            cur_metabolites, smat, df, df2 = get_data(db)
        else: 
            return jsonify({
                    'status': 'error',
                    'message': f'Metabolite should belong to only one database either KEGG or BiGG'
                }), 400

        def is_currency_metabolite(met):
            currency_keywords = [
                "h", "k", "pi", "cl", "o2", "na1", "h2o", "co2", "atp", "adp",
                "utp", "gtp", "gdp", "amp", "nad", "fad", "coa", "ppi", "nh4", "nh3", 
                "acp", "thf", "crn", "nadh", "fadh", "nadp", "nadph"
                ]
            currency_keywords_final = cur_metabolites + currency_keywords
            return any(met.lower().startswith(cur.lower()) for cur in currency_keywords_final)
        
        try:
            model = Model('new_model')
            for path in modelData:
                pathData = modelData[path]
                metabolites = {}
                for met_id, arr in pathData['metabolites'].items():
                    name, formula, compt, crossref, weight = arr
                    crossrefdict = {"chebi": crossref}
                    metabolites[met_id] = Metabolite(id=met_id, name=name, compartment=met_id.split('_')[-1], formula=formula)
                    metabolites[met_id].annotation = crossrefdict

                all_edges = pathData['edges'] + pathData['currency_edges']
                currency_mets = set()
                for a, b in all_edges:
                    for met in [a, b]:
                        if is_currency_metabolite(met):
                            currency_mets.add(met)

                for met_id in currency_mets:
                    if met_id not in metabolites:
                        metabolites[met_id] = Metabolite(id=met_id, name=met_id, compartment=met_id.split('_')[-1])

                reaction_edges = defaultdict(list)
                for src, tgt in all_edges:
                    if src in pathData['enzymes']:  # enzyme → metabolite (product)
                        reaction_edges[src].append((None, tgt))
                    elif tgt in pathData['enzymes']:  # metabolite (substrate) → enzyme
                        reaction_edges[tgt].append((src, None))


                gene_list = pathData.get("genes", {})

                for enzyme_id, edge_list in reaction_edges.items():
                    reaction = Reaction(enzyme_id)
                    enzyme_info = pathData['enzymes'].get(enzyme_id, [])
            
                    reaction.name = enzyme_info[0] if len(enzyme_info) > 0 else enzyme_id
                    reaction.lower_bound = enzyme_info[2] 
                    reaction.upper_bound = enzyme_info[3] 
                    rxn_annotation = pathData["enzyme_crossref"][enzyme_id]
                    cobra_annotation = {key_map[k]: v for k, v in rxn_annotation.items() if k in key_map}
                    reaction.annotation = cobra_annotation
                    actual_stoichiometry = pathData["stoichiometry"][enzyme_id]
                    model_stoichiometry = {}
                    for src, tgt in edge_list:
                        if src:
                            model_stoichiometry[metabolites[src]] = actual_stoichiometry[src]
                        if tgt:
                            model_stoichiometry[metabolites[tgt]] = actual_stoichiometry[tgt]
                            
                    reaction.add_metabolites(model_stoichiometry)

                    reaction.subsystem = enzyme_info[4]

                    gene = list({g.strip() for g in gene_list.get(enzyme_id, []) if g.strip()})
                    if gene:
                        rule = "(" + " or ".join(gene) + ")" if len(gene) > 1 else f'( {gene[0]} )'

                        if reaction.gene_reaction_rule != rule:
                            try:
                                reaction.gene_reaction_rule = rule
                            except Exception as e:
                                continue

                    model.add_reactions([reaction])

            # cleaned_model = clean_cobra_model(model)
            if (objective != 'No Reaction'):
                model.objective = objective

            if(file_type == '.mat'):
                mat_dict = create_mat_dict(model)
                buffer = io.BytesIO()
                savemat(buffer, {"model": mat_dict}, appendmat=False, oned_as="column")
                buffer.seek(0)
                encoded = base64.b64encode(buffer.read()).decode('utf-8')
            elif (file_type == '.xml'):
                string_buffer = io.StringIO()
                write_sbml_model(model, string_buffer)
                bytes_buffer = io.BytesIO(string_buffer.getvalue().encode('utf-8'))
                bytes_buffer.seek(0)
                encoded = base64.b64encode(bytes_buffer.read()).decode('utf-8')

            elif file_type == '.json':
                json_buffer = io.StringIO()
                save_json_model(model, json_buffer)  # from cobra.io
                bytes_buffer = io.BytesIO(json_buffer.getvalue().encode('utf-8'))
                bytes_buffer.seek(0)
                encoded = base64.b64encode(bytes_buffer.read()).decode('utf-8')
            
            file_bytes = base64.b64decode(encoded)
            buffer = io.BytesIO(file_bytes)

            filename = f"model{file_type}"
            mimetype = {
                '.mat': 'application/octet-stream',
                '.xml': 'application/xml',
                '.json': 'application/json'
            }.get(file_type, 'application/octet-stream')
            
            return send_file(
                buffer,
                mimetype=mimetype,
                as_attachment=True,
                download_name=filename
            )
            
            
        except KeyError as ke:
                return jsonify({
                        'status': 'error',
                        'message': f'Invalid metabolite or enzyme reference: {str(ke)}'
                    }), 400
                
        except Exception as processing_error:
                return jsonify({
                        'status': 'error',
                        'message': 'Failed to process metabolic data'
                    }), 500

    except Exception as e:
        
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500

@app.route("/api/v1/download-gsea", methods=['GET'])
def download_gsea():
    try:
        folder_path = os.path.abspath('./GSEA_results')
        zip_path = os.path.join(os.path.dirname(folder_path), 'GSEA_results.zip')

        # Create a ZIP of the folder
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    abs_path = os.path.join(root, file)
                    rel_path = os.path.relpath(abs_path, os.path.dirname(folder_path))
                    zipf.write(abs_path, rel_path)

        # Send file and then delete folder + zip after sending
        response = send_file(zip_path, as_attachment=True, download_name='GSEA_results.zip')

        # Clean up after sending (delete the folder + zip)
        def cleanup_later():
            time.sleep(3)  # wait 3 seconds to ensure send_file finishes
            try:
                shutil.rmtree(folder_path)
                os.remove(zip_path)
                
            except Exception as e:
                return jsonify({"status": "error", "message": str(e)}), 500

        threading.Thread(target=cleanup_later, daemon=True).start()

        return response


    except Exception as e:
        
        return jsonify({"status": "error", "message": str(e)}), 500
    

if __name__ == "__main__":
    app.run(debug=True)