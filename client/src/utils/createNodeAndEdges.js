import { MarkerType } from 'reactflow'
import { standardizeNodeId } from './standardizeNodeId'

export function createNodeAndEdges(
    reactionList,
    previousPositions = {},
    edgeHandlePositions = {},
    edgeThickness = 2,
    modelData
) {
    const enzymeMap = {}
    const metaboliteMap = {}
    const rawEdges = []

    const updatedModelData = {}
    Object.entries(reactionList).forEach(([enzyme, reaction]) => {
        const subsystem = reaction.subsystem || 'Unassigned'
        if (!updatedModelData[subsystem]) {
            updatedModelData[subsystem] = {}
        }
        updatedModelData[subsystem][enzyme] = reaction
    })


    const finalModelData = {}
    Object.keys(updatedModelData).map(
        (path) =>
            (finalModelData[path] = {
                currency_edges: [],
                edges: [],
                enzymes: {},
                metabolites: {},
                genes: {},
                enzyme_crossref: {},
            })
    )

    Object.entries(updatedModelData).map(([path, obj]) => {
        const pathObj = updatedModelData[path] // from the old one
        const newPathObj = finalModelData[path] // new path obj
        Object.entries(pathObj).map(([enzyme, enzObj]) => {
     
            newPathObj.edges.push(...enzObj.edges)
            newPathObj.currency_edges.push(...enzObj.currency_edges)
            const lb = enzObj.bounds.lower || -1000.0
            const ub = enzObj.bounds.upper || 1000.0
            const desc = enzObj.description
            newPathObj.enzymes[enzyme] = [desc, 'Not calculated', lb, ub, path]
            Object.entries(enzObj.metabolites).map(([met, description]) => {
                newPathObj.metabolites[met] = description
            })
            newPathObj.genes[enzyme] = enzObj.genes
            newPathObj.enzyme_crossref[enzyme] = { BIGG: [], EC: [], KEGG: [] }
        })
    })


    for (const [rxnId, rxn] of Object.entries(reactionList)) {
        enzymeMap[rxnId] = [
            rxn.description,
            rxn.flux,
            rxn.bounds?.lower,
            rxn.bounds?.upper,
            rxn.subsystem,
            rxn.genes
        ]

        Object.entries(rxn.metabolites || {}).forEach(([id, label]) => {
            metaboliteMap[id] = label
        })

        rawEdges.push(...(rxn.edges || []))
    }


    const knownLabels = new Set([
        ...Object.keys(metaboliteMap),
        ...Object.keys(enzymeMap),
    ])
    const knownPathways = new Set(Object.keys(finalModelData))

    const nodesMap = new Map()
    const nodes = []
    const edges = []
    const placedLabels = new Set()

    const spacingX = 200
    const spacingY = 120

    // function getNodeId(label) {
    //     if (!nodesMap.has(label)) {
    //         const id = label
    //         nodesMap.set(label, id)
    //     }
    //     return nodesMap.get(label)
    // }

    const getNodeId = (label) => {
        if (!nodesMap.has(label)) {
            const subsystems = []

            Object.entries(finalModelData).forEach(([path, obj]) => {
                const enzymes = Object.keys(obj.enzymes || {})
                const metabolites = Object.keys(obj.metabolites || {})

                if (enzymes.includes(label) || metabolites.includes(label)) {
                    subsystems.push(path)
                }
            })

            
           

            const pathway = subsystems[0]

            const id = standardizeNodeId(
                pathway,
                label,
                knownLabels,
                knownPathways
            )
            nodesMap.set(label, id)
        }
        return nodesMap.get(label)
    }

    function getFluxColor(flux) {
        const parsed = parseFloat(flux)
        if (isNaN(parsed) || parsed === 0) return '#cfe2ff'
        const norm = Math.min(1, Math.max(0, (parsed + 10) / 20))
        const lightness = 85 - norm * 50
        return `hsl(217, 100%, ${lightness}%)`
    }

    function placeNode(label) {
        const id = getNodeId(label)

        if (!placedLabels.has(label)) {
            const index = nodes.length
            const position = previousPositions?.[id] || {
                x: (index % 5) * spacingX,
                y: Math.floor(index / 5) * spacingY,
            }

            if (enzymeMap[label]) {
                const [desc, flux, lb, ub, subsystem, genes] = enzymeMap[label]
                nodes.push({
                    id: label,
                    temp_id: id,
                    type: 'custom',
                    position,
                    data: {
                        abbreviation: label,
                        // info: `${desc || label}\nSubsystem: ${
                        //     subsystem ?? 'Not Assigned'
                        // }\n lb=${lb}, ub=${ub}`,
                        info: `${desc || label}`,
                        subsystem: subsystem || 'Not Assigned',
                        lower_bound: lb,
                        upper_bound: ub,
                        flux: 'Not Calculated',
                        type: 'reaction',
                        color: getFluxColor(flux),
                        BIGG_crossref: [],
                        KEGG_crossref: [],
                        EC_crossref: [],
                        gene: genes
                    },
                })
            } else if (metaboliteMap[label]) {
                nodes.push({
                    id: label,
                    temp_id: id,
                    type: 'custom',
                    position,
                    data: {
                        abbreviation: label,
                        info: metaboliteMap[label][0],
                        formula: metaboliteMap[label][1],
                        compartment: metaboliteMap[label][2],
                        weight: metaboliteMap[label][3],
                        crossref: [],
                        type: 'metabolite',
                        color: 'orange',
                    },
                })
            }

            placedLabels.add(label)
        }
    }

    const groupedEdges = {}
    rawEdges.forEach(([source, target]) => {
        if (!(source in enzymeMap)) {
            // substrate -> enzyme
            groupedEdges[target] = groupedEdges[target] || {
                substrates: [],
                products: [],
            }
            groupedEdges[target].substrates.push(source)
        } else {
            // enzyme -> product
            groupedEdges[source] = groupedEdges[source] || {
                substrates: [],
                products: [],
            }
            groupedEdges[source].products.push(target)
        }
    })

    for (const enzyme of Object.keys(groupedEdges)) {
        const substrates = groupedEdges[enzyme].substrates || []
        const products = groupedEdges[enzyme].products || []

        const [desc, flux, lb, ub, genes] = enzymeMap[enzyme] || []

        placeNode(enzyme)
        substrates.forEach(placeNode)
        products.forEach(placeNode)

        const parsedFlux = parseFloat(flux)
        const hasFlux = !isNaN(parsedFlux)
        const forward = lb < 0 && ub > 0 ? true : lb >= 0
        const reverse = lb < 0 && ub > 0 ? true : ub <= 0

        if (lb < 0 && ub > 0) {
            substrates.forEach((s) =>
                edges.push(
                    makeBidirectionalEdge(
                        s,
                        enzyme,
                        getNodeId(s),
                        getNodeId(enzyme)
                    )
                )
            )
            products.forEach((p) =>
                edges.push(
                    makeBidirectionalEdge(
                        enzyme,
                        p,
                        getNodeId(enzyme),
                        getNodeId(p)
                    )
                )
            )
        } else if (lb >= 0) {
            substrates.forEach((s) =>
                edges.push(
                    makeMonoEdge(s, enzyme, getNodeId(s), getNodeId(enzyme))
                )
            )
            products.forEach((p) =>
                edges.push(
                    makeMonoEdge(enzyme, p, getNodeId(enzyme), getNodeId(p))
                )
            )
        } else {
            products.forEach((p) =>
                edges.push(
                    makeMonoEdge(p, enzyme, getNodeId(p), getNodeId(enzyme))
                )
            )
            substrates.forEach((s) =>
                edges.push(
                    makeMonoEdge(enzyme, s, getNodeId(enzyme), getNodeId(s))
                )
            )
        }
    }

    return { nodes, edges }

    function makeMonoEdge(actual_source, actual_target, source, target) {
        const handleKey = `${source}-${target}`
        const edgeHandle = edgeHandlePositions?.[handleKey] || {}

        return {
            id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            source_id: source,
            target_id: target,
            source: actual_source,
            target: actual_target,
            sourceHandle: edgeHandle.sourceHandle || 'right',
            targetHandle: edgeHandle.targetHandle || 'left',
            type: 'default',
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 10,
                height: 10,
                color: '#222',
            },
            style: {
                strokeWidth: edgeThickness,
                stroke: '#222',
            },
        }
    }

    function makeBidirectionalEdge(
        actual_source,
        actual_target,
        source,
        target
    ) {
        const handleKey = `${source}-${target}`
        const edgeHandle = edgeHandlePositions?.[handleKey] || {}

        return {
            id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            source_id: source,
            target_id: target,
            source: actual_source,
            target: actual_target,
            sourceHandle: edgeHandle.sourceHandle || 'right',
            targetHandle: edgeHandle.targetHandle || 'left',
            type: 'default',
            markerStart: {
                type: MarkerType.ArrowClosed,
                width: 10,
                height: 10,
                color: '#222',
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 10,
                height: 10,
                color: '#222',
            },
            style: {
                strokeWidth: edgeThickness,
                stroke: '#222',
            },
        }
    }
}
