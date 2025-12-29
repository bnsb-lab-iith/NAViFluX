import sys
import json
import pandas as pd
import gseapy as gp
import os

def main():
    # Read JSON from stdin
    input_json = sys.stdin.read()
    data = json.loads(input_json)

    # Extract ranks and gmt dict
    ranks_dict = data["ranks"]
    genes_dict = data["gmt"]

    # Convert ranks back to Series with proper index
    ranks_series = pd.Series(ranks_dict).sort_values(ascending=False)
    ranks_series = pd.to_numeric(ranks_series, errors='coerce')

    # Ensure all gene names are strings
    for pathway, genes in genes_dict.items():
        genes_dict[pathway] = [str(g) for g in genes]

    # Output directory
    outdir = os.path.abspath(data.get("outdir", "GSEA_results"))
    os.makedirs(outdir, exist_ok=True)

    # Run prerank
    pre_res = gp.prerank(
        rnk=ranks_series,
        gene_sets=genes_dict,
        outdir=outdir,
        permutation_num=data.get("permutation_num", 1000),
        seed=data.get("seed", 42),
        threads=data.get("threads", 1),
        min_size=data.get("minsize", 3),
        max_size=data.get("maxsize", 500)
    )

    # Convert results DataFrame to JSON and print to stdout
    res_json = pre_res.res2d.reset_index().to_json(orient="records")
    print(res_json)

if __name__ == "__main__":
    main()
