export function batchExtractWithPositions(networkList) {
    const result = {}
  
    for (const network of networkList) {
        const { name, nodes, edges } = network

        const enzymes = {}
        const metabolites = {}

        for (const node of nodes) {
            const isMetabolite = node.data?.type === 'metabolite'
            if (isMetabolite) {
                metabolites[node.id] = node
            } else {
                enzymes[node.id] = node
            }
        }

        const final = { ...enzymes, ...metabolites }

        result[name] = {
            edges,
            final,
        }
    }

    return result
}
