export function formatModelData(networkList) {
    const result = {}

    for (const network of networkList) {
        const { name, nodes, edges, cur_edges } = network

        const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]))
        const idToAbbreviation = Object.fromEntries(
            nodes.map((n) => [n.id, n.data?.abbreviation || n.id])
        )
        const abbreviationToInfo = Object.fromEntries(
            nodes.map((n) => [n.data?.abbreviation, n])
        )

        const simplifiedEdges = edges.map((edge) => [
            idToAbbreviation[edge.source],
            idToAbbreviation[edge.target],
        ])

        const enzymes = {}
 
        const metabolites = {}
        const currency_edges = cur_edges
        const genes = {}
        const enzyme_crossref = {}
        const stoichiometry = {}

        for (const node of nodes) {
            if (
                node.data?.type !== 'metabolite' &&
                node.data?.abbreviation &&
                node.data?.info
            ) {
                const abbr = node.data.abbreviation
                const name = node.data?.info
                const flux = node.data?.flux
                const subs = node.data?.subsystem
                const stoich = node.data?.stoichiometry
                enzymes[abbr] = [
                    name,
                    flux,
                    node.data?.lower_bound,
                    node.data?.upper_bound,
                    subs
                ]
                genes[abbr] = node.data.gene
                enzyme_crossref[abbr] = {"BIGG": node.data.BIGG_crossref, "KEGG": node.data.KEGG_crossref, "EC": node.data.EC_crossref}
                stoichiometry[abbr] = stoich
            } else {
                const abbr = node.data.abbreviation
                const info = node.data.info
                const formula = node.data.formula
                const compt = node.data.compartment
                const crossref = node.data.crossref
                const weight = node.data.weight

                metabolites[abbr] = [info, formula, compt, crossref, weight]
            }
        }

        result[name] = {
            edges: simplifiedEdges,
            enzymes,
            metabolites,
            currency_edges,
            genes,
            enzyme_crossref,
            stoichiometry
        }
    }

    return result
}
