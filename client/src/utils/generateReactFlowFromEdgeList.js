import { MarkerType } from 'reactflow'
import { standardizeNodeId } from './standardizeNodeId'

export function generateReactFlowFromEdgeList(
    selectedPathways,
    pathwayData,
    minFlux,
    maxFlux,
    previousPositions = {},
    edgeHandlePositions = {},
    edgeThickness,
    fontSize,
    leadgenes,
    colorAction,
    allFluxValues,
    edgeFormat,
    allMetabolomicsValues
) {
    // console.log(leadgenes)
    const obj = {} // enzyme metadata
    const meta_obj = {} // metabolite info
    const rawEdges = []
    const knownPathways = new Set(selectedPathways)
    // console.log(fontSize)

    const minMetaboliteVal = Math.min(...allMetabolomicsValues)
    const maxMetaboliteVal = Math.max(...allMetabolomicsValues)

    const normalize = (val) => {
        // minFlux and maxFlux should be absolute values
        const absMin = Math.min(...allFluxValues.map((f) => Math.abs(f)))
        const absMax = Math.max(...allFluxValues.map((f) => Math.abs(f)))

        if (absMax === absMin) return 0.5 // avoid divide-by-zero

        return (val - absMin) / (absMax - absMin) // 0..1
    }

    function getNodeType(label) {
        return Object.keys(obj).includes(label) ? 'enzyme' : 'metabolite'
    }

    const knownLabels = new Set()
    selectedPathways.forEach((path) => {
        console.log(pathwayData[path])
        if (pathwayData[path]) {
            const {
                enzymes = {},
                edges = [],
                metabolites = {},
                genes = {},
                enzyme_crossref = {},
                stoichiometry = {},
            } = pathwayData[path]

            console.log(stoichiometry)

            const enzymesWithSubsystem = {}
            for (const [enzyme, arr] of Object.entries(enzymes)) {
                enzymesWithSubsystem[enzyme] = [
                    ...arr,
                    genes[enzyme],
                    enzyme_crossref[enzyme],
                    stoichiometry[enzyme]
                ]
                knownLabels.add(enzyme)
            }

            console.log(enzymesWithSubsystem)

            for (const metId of Object.keys(metabolites)) {
                knownLabels.add(metId)
            }

            Object.assign(obj, enzymesWithSubsystem)
            Object.assign(meta_obj, metabolites)
            rawEdges.push(...edges)
        }
    })

    console.log(meta_obj)

    console.log(obj)

    const nodesMap = new Map()
    const nodes = []
    const edges = []
    const placedLabels = new Set()

    const spacingX = 200
    const spacingY = 120

    const getNodeId = (label) => {
        if (!nodesMap.has(label)) {
            const pathway =
                selectedPathways.find(
                    (p) =>
                        pathwayData[p]?.enzymes?.[label] ||
                        pathwayData[p]?.metabolites?.[label]
                ) || selectedPathways[0]

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

    const getFluxColor = (flux) => {
        const parsed = Math.abs(parseFloat(flux)) // absolute value
        if (isNaN(parsed) || parsed === 0) return '#e0e0e0' // gray for zero flux

        // Normalize absolute flux between 0 and 1
        const range = Math.max(Math.abs(minFlux), Math.abs(maxFlux)) || 1
        const norm = Math.min(1, parsed / range)

        // Low flux = more intense light red, high flux = deep red
        const r = Math.round(20 * (1 - norm))
        const g = Math.round(180 - 100 * norm) // now starts at 150 instead of 200
        const b = Math.round(255 - 60 * norm)

        return `rgb(${r}, ${g}, ${b})`
    }

    const getMetaboliteColor = (val) => {
        const parsed = Math.abs(parseFloat(val)) // absolute value

        // Guard clause: if NaN or 0, return default orange
        if (isNaN(parsed) || parsed === 0) return '#FFA500' // default orange

        // Normalize absolute metabolite value between 0 and 1
        const range =
            Math.max(Math.abs(minMetaboliteVal), Math.abs(maxMetaboliteVal)) ||
            1
        const norm = Math.min(1, parsed / range)

        // Shades of orange: light orange → deep orange
        // Light orange ~ rgb(255, 200, 150), Deep orange ~ rgb(255, 100, 0)
        const r = 255 // red is full
        const g = Math.round(200 - 100 * norm) // from 200 → 100
        const b = Math.round(150 - 150 * norm) // from 150 → 0

        return `rgb(${r}, ${g}, ${b})`
    }

    const getEdgeThickness = (flux) => {
        const parsed = parseFloat(flux)
        if (isNaN(parsed) || parsed === 0) return 2 // default small thickness

        const abs_flux = Math.abs(parsed)
        const norm = normalize(abs_flux) // normalized 0..1

        const minWidth = 2
        const maxWidth = 20
        return minWidth + norm * (maxWidth - minWidth)
    }

    const placeNode = (label, type) => {
        const id = getNodeId(label)
        const [pathway] = id.split('__')

        if (!placedLabels.has(label)) {
            const index = nodes.length
            const position = previousPositions?.[pathway]?.[id] || {
                x: (index % 5) * spacingX,
                y: Math.floor(index / 5) * spacingY,
            }

            if (obj[label]) {
                const [
                    desc,
                    flux,
                    lower_bound,
                    upper_bound,
                    subsystem,
                    gene,
                    crossref,
                    stoich,
                ] = obj[label]
                const baseSize = 40
                const maxSize = 120
                const size = baseSize + normalize(flux) * (maxSize - baseSize)

                nodes.push({
                    id: label,
                    temp_id: id,
                    type: 'custom',
                    position,
                    data: {
                        abbreviation: label,
                        info: desc || label,
                        // info: `${desc || label}\nFlux: ${
                        //     flux != null ? flux : 'Not calculated'
                        // }\nlb=${lower_bound}\nub=${upper_bound}`,
                        flux: flux != null ? flux : 'Not calculated',
                        subsystem: subsystem || 'Not Assigned',
                        lower_bound,
                        upper_bound,
                        color:
                            leadgenes && leadgenes.includes(label)
                                ? 'green'
                                : getFluxColor(flux),
                        fontSize: fontSize,
                        size: size,
                        gene: gene,
                        type: 'reaction',
                        BIGG_crossref: crossref?.['BIGG'] || [],
                        KEGG_crossref: crossref?.['KEGG'] || [],
                        EC_crossref: crossref?.['EC'] || [],
                        stoichiometry: stoich
                    },
                })
            } else if (meta_obj[label]) {
                nodes.push({
                    id: label,
                    temp_id: id,
                    type: 'custom',
                    position,
                    data: {
                        abbreviation: label,
                        info: meta_obj[label][0],
                        formula: meta_obj[label][1],
                        compartment: meta_obj[label][2],
                        crossref: meta_obj[label][3],
                        weight: meta_obj[label][4],
                        color: getMetaboliteColor(meta_obj[label][4]),
                        fontSize: fontSize,
                        type: 'metabolite',
                    },
                })
            }

            placedLabels.add(label)
        }
    }

    // Group edges by enzyme so we can infer direction
    const groupedEdges = {}
    rawEdges.forEach(([source, target]) => {
        if (
            getNodeType(source) === 'metabolite' &&
            getNodeType(target) === 'enzyme'
        ) {
            // substrate -> enzyme
            groupedEdges[target] = groupedEdges[target] || {
                substrates: [],
                products: [],
            }
            groupedEdges[target].substrates.push(source)
        } else if (
            getNodeType(source) === 'enzyme' &&
            getNodeType(target) === 'metabolite'
        ) {
            // enzyme -> product
            groupedEdges[source] = groupedEdges[source] || {
                substrates: [],
                products: [],
            }
            groupedEdges[source].products.push(target)
        }
    })

    // Build nodes and directional edges based on bounds
    for (const enzyme of Object.keys(groupedEdges)) {
        const substrates = groupedEdges[enzyme].substrates || []
        const products = groupedEdges[enzyme].products || []
        // console.log(substrates, products)
        // console.log(obj[enzyme])
        const [desc, flux, lb, ub, path] = obj[enzyme] || []

        const enzymeId = getNodeId(enzyme)
        placeNode(enzyme, 'enzyme')

        substrates.forEach((s) => placeNode(s, 'metabolite'))
        products.forEach((p) => placeNode(p, 'metabolite'))
        const isNumber = (x) => typeof x === 'number' && !isNaN(x)
        const forward = lb < 0 && ub > 0 ? true : lb >= 0
        const reverse = lb < 0 && ub > 0 ? true : ub <= 0
        const hasLBUB = isNumber(lb) && isNumber(ub)
        // If flux is present, use it to refine direction
        const parsedFlux = parseFloat(flux)
        const hasFlux = !isNaN(parsedFlux)
        // console.log(
        //     `Enzyme: ${enzyme}, lb=${lb}, ub=${ub}, flux=${flux}, hasFlux=${hasFlux}, forward=${forward}, reverse=${reverse}`
        // )
        // console.log(enzyme, substrates, products)
        if (hasFlux && flux > 0 && edgeFormat === 'flux') {
            // Case: Forward flux
            substrates.forEach((s) =>
                edges.push(
                    makeMonoEdge(
                        s,
                        enzyme, 
                        getNodeId(s),
                        enzymeId,
                        parsedFlux,
                        colorAction
                    )
                )
            )
            products.forEach((p) =>
                edges.push(
                    makeMonoEdge(
                        enzyme,
                        p,
                        enzymeId,
                        getNodeId(p),
                        parsedFlux,
                        colorAction
                    )
                )
            )
        } else if (hasFlux && flux < 0 && edgeFormat === 'flux') {
            // Case: Reverse flux
            products.forEach((p) =>
                edges.push(
                    makeMonoEdge(
                        p, 
                        enzyme,
                        getNodeId(p),
                        enzymeId,
                        parsedFlux,
                        colorAction
                    )
                )
            )
            substrates.forEach((s) =>
                edges.push(
                    makeMonoEdge(
                        enzyme, 
                        s,
                        enzymeId,
                        getNodeId(s),
                        parsedFlux,
                        colorAction
                    )
                )
            )
        } else if (hasLBUB && lb < 0 && ub > 0) {
            // Case: Reversible, no flux
            substrates.forEach((s) =>
                edges.push(
                    makeBidirectionalEdge(
                        s, 
                        enzyme,
                        getNodeId(s),
                        enzymeId,

                        parsedFlux,
                        colorAction
                    )
                )
            )
            products.forEach((p) =>
                edges.push(
                    makeBidirectionalEdge(
                        enzyme, 
                        p, 
                        enzymeId,
                        getNodeId(p),

                        parsedFlux,
                        colorAction
                    )
                )
            )
        } else if (hasLBUB && lb >= 0 && ub > 0) {
            // Forward-only
            substrates.forEach((s) =>
                edges.push(
                    makeMonoEdge(
                        s, 
                        enzyme,
                        getNodeId(s),
                        enzymeId,
                        parsedFlux,
                        colorAction
                    )
                )
            )
            products.forEach((p) =>
                edges.push(
                    makeMonoEdge(
                        enzyme, 
                        p, 
                        enzymeId,
                        getNodeId(p),
                        parsedFlux,
                        colorAction
                    )
                )
            )
        } else if (hasLBUB && lb < 0 && ub <= 0) {
            // Backward-only
            products.forEach((p) =>
                edges.push(
                    makeMonoEdge(
                        p, 
                        enzyme, 
                        getNodeId(p),
                        enzymeId,
                        parsedFlux,
                        colorAction
                    )
                )
            )
            substrates.forEach((s) =>
                edges.push(
                    makeMonoEdge(
                        enzyme, 
                        s, 
                        enzymeId,
                        getNodeId(s),
                        parsedFlux,
                        colorAction
                    )
                )
            )
        } else {
            // Default to forward
            substrates.forEach((s) =>
                edges.push(
                    makeMonoEdge(
                        s, 
                        enzyme, 
                        getNodeId(s),
                        enzymeId,
                        parsedFlux,
                        colorAction
                    )
                )
            )
            products.forEach((p) =>
                edges.push(
                    makeMonoEdge(
                        enzyme, 
                        p, 
                        enzymeId,
                        getNodeId(p),
                        parsedFlux,
                        colorAction
                    )
                )
            )
        }
    }

    return { nodes, edges }

    function makeMonoEdge(actual_source, actual_target, source, target, flux, colorAction) {
        const sourcePathway = source.split('__')[0]
        const handleKey = `${actual_source}-${actual_target}`
        const edgeHandle =
            edgeHandlePositions?.[sourcePathway]?.[handleKey] || {}

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
                // markerUnits: 'userSpaceOnUse',
                color:
                    colorAction === 'flux'
                        ? !isNaN(flux) && flux !== 0
                            ? getFluxColor(flux)
                            : '#222'
                        : '#222',
            },
            style: {
                strokeWidth: edgeThickness,
                stroke:
                    colorAction === 'flux'
                        ? !isNaN(flux) && flux !== 0
                            ? getFluxColor(flux)
                            : '#222'
                        : '#222',
            },
        }
    }

    function makeBidirectionalEdge(actual_source, actual_target, source, target, flux, colorAction) {
        const sourcePathway = source.split('__')[0]
        const handleKey = `${actual_source}-${actual_target}`
        const edgeHandle =
            edgeHandlePositions?.[sourcePathway]?.[handleKey] || {}

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
                // markerUnits: 'userSpaceOnUse',
                color:
                    colorAction === 'flux'
                        ? !isNaN(flux) && flux !== 0
                            ? getFluxColor(flux)
                            : '#222'
                        : '#222',
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                // markerUnits: 'userSpaceOnUse',
                color:
                    colorAction === 'flux'
                        ? !isNaN(flux) && flux !== 0
                            ? getFluxColor(flux)
                            : '#222'
                        : '#222',
            },
            style: {
                strokeWidth: edgeThickness,
                stroke:
                    colorAction === 'flux'
                        ? !isNaN(flux) && flux !== 0
                            ? getFluxColor(flux)
                            : '#222'
                        : '#222',
            },
        }
    }
}
