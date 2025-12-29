// import { MarkerType } from 'reactflow'
// import { standardizeNodeId } from './standardizeNodeId'

// export function syncModelDataWithBatchOutput(
//     modelData,
//     batchOutput,
//     selectedPathways,
//     previousPositions = {},
//     edgeHandlePositions = {}
// ) {
//     const allNodes = []
//     const allEdges = []
//     const placedLabels = new Set()
//     const knownPathways = new Set(selectedPathways)
//     const knownLabels = new Set()

//     Object.keys(modelData).map((path) => {
//         const pathObj = modelData?.[path]
//         const edgeArr = pathObj?.['edges']
//         edgeArr?.map((pair) => {
//             const first = pair?.[0]
//             const second = pair?.[1]
//             knownLabels.add(first)
//             knownLabels.add(second)
//         })
//     })

//     selectedPathways.forEach((pathway) => {
//         const model = modelData?.[pathway]
//         const batch = batchOutput?.[pathway]
//         if (!model) return

//         const enzymes = model.enzymes || {}
//         const edgePairs = model.edges || []

//         const labelToId = new Map()
//         const idToNode = {}

//         const getNodeId = (label) => {
//             if (!labelToId.has(label)) {
//                 labelToId.set(
//                     label,
//                     standardizeNodeId(
//                         pathway,
//                         label,
//                         knownLabels,
//                         knownPathways
//                     )
//                 )
//             }
//             return labelToId.get(label)
//         }

//         // Preload batch-generated nodes (with positions)
//         if (batch?.final) {
//             for (const [oldId, node] of Object.entries(batch.final)) {
//                 const newId = standardizeNodeId(
//                     pathway,
//                     oldId,
//                     knownLabels,
//                     knownPathways
//                 )
//                 const newNode = {
//                     ...node,
//                     id: newId,
//                     position:
//                         previousPositions?.[pathway]?.[newId] || node.position,
//                 }

//                 idToNode[newId] = newNode
//                 labelToId.set(node.data.abbreviation, newId)
//                 placedLabels.add(node.data.abbreviation)
//             }
//         }

//         const uniqueLabels = new Set(edgePairs.flat())

//         let i = 0
//         for (const label of uniqueLabels) {
//             const id = getNodeId(label)

//             if (idToNode[id]) {
//                 allNodes.push(idToNode[id])
//                 continue
//             }

//             const defaultPos = {
//                 x: (i % 5) * 200,
//                 y: Math.floor(i / 5) * 120,
//             }

//             const position = previousPositions?.[pathway]?.[id] || defaultPos
//             const enzymeInfo = enzymes[label]

//             const data = {
//                 abbreviation: label,
//                 info: enzymeInfo
//                     ? `${enzymeInfo[0] || label}\nFlux: ${enzymeInfo[1] ?? 'Not calculated'}`
//                     : label,
//                 subsystem: pathway || 'Unknown',
//                 color: enzymeInfo ? 'blue' : 'orange',
//                 ...(enzymeInfo && {
//                     lower_bound:
//                         Array.isArray(enzymeInfo) && enzymeInfo.length > 2
//                             ? enzymeInfo[2]
//                             : -1000,
//                     upper_bound:
//                         Array.isArray(enzymeInfo) && enzymeInfo.length > 3
//                             ? enzymeInfo[3]
//                             : 1000,
//                 }),
//             }

//             const node = {
//                 id,
//                 type: 'custom',
//                 position,
//                 data,
//             }

//             allNodes.push(node)
//             placedLabels.add(label)
//             i++
//         }

//         edgePairs.forEach(([src, tgt]) => {
//             const source = getNodeId(src)
//             const target = getNodeId(tgt)
//             const id = `${pathway}__edge_${src}_${tgt}`

//             const handleKey = `${source}-${target}`
//             const [sourcePathway] = source.split('__')
//             const [targetPathway] = target.split('__')

//             const handleMap =
//                 edgeHandlePositions?.[sourcePathway]?.[handleKey] ||
//                 edgeHandlePositions?.[targetPathway]?.[handleKey] ||
//                 {}

//             const batchEdge = batch?.edges?.find(
//                 (e) =>
//                     getNodeId(e.source) === source &&
//                     getNodeId(e.target) === target
//             )

//             allEdges.push({
//                 id,
//                 source,
//                 target,
//                 sourceHandle:
//                     handleMap.sourceHandle ||
//                     batchEdge?.sourceHandle ||
//                     'right',
//                 targetHandle:
//                     handleMap.targetHandle || batchEdge?.targetHandle || 'left',
//                 type: batchEdge?.type || 'default',
//                 markerEnd: {
//                     type: MarkerType.ArrowClosed,
//                     width: 10,
//                     height: 10,
//                     color: '#222',
//                 },
//                 style: {
//                     strokeWidth: 2,
//                     stroke: '#222',
//                 },
//             })
//         })
//     })

//     return { nodes: allNodes, edges: allEdges }
// }

import { MarkerType } from 'reactflow'
import { standardizeNodeId } from './standardizeNodeId'

export function syncModelDataWithBatchOutput(
    modelData,
    batchOutput,
    selectedPathways,
    previousPositions = {},
    edgeHandlePositions = {},
    edgeThickness,
    colorAction,
    min,
    max,
    edgeFormat,
    allMetabolomicsValues
) {
    const allNodes = []
    const allEdges = []
    const placedLabels = new Set()
    const knownPathways = new Set(selectedPathways)
    const knownLabels = new Set()
    const minMetaboliteVal = Math.min(...allMetabolomicsValues)
    const maxMetaboliteVal = Math.max(...allMetabolomicsValues)
    console.log(modelData, batchOutput, previousPositions)
    console.log(allMetabolomicsValues)

    Object.keys(modelData).forEach((path) => {
        const pathObj = modelData?.[path]
        const edgeArr = pathObj?.['edges']
        edgeArr?.forEach((pair) => {
            const [first, second] = pair
            knownLabels.add(first)
            knownLabels.add(second)
        })
    })
    const normalize = (val) => {
        // console.log(min, max)

        if (max === min) return 1 // avoid divide-by-zero
        return (val - min) / (max - min) // 0 to 1 range
    }

    const getFluxColor = (flux) => {
        const parsed = Math.abs(parseFloat(flux)) // absolute value
        if (isNaN(parsed) || parsed === 0) return '#e0e0e0' // gray for zero flux

        // Normalize absolute flux between 0 and 1
        const range = Math.max(Math.abs(min), Math.abs(max)) || 1
        const norm = Math.min(1, parsed / range)

        // Low flux = light blue, high flux = deep blue
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
        const norm = normalize(abs_flux) // 0..1
        const minWidth = 1
        const maxWidth = 15
        return minWidth + norm * (maxWidth - minWidth)
    }

    selectedPathways.forEach((pathway) => {
        const model = modelData?.[pathway]
        const batch = batchOutput?.[pathway]
        if (!model) return
        console.log(model)
        const enzymes = model.enzymes || {}
        const metabolites = model.metabolites || {}
        const edgePairs = model.edges || []
        const batchNodes = {}

        function getNodeType(label) {
            return Object.keys(enzymes).includes(label)
                ? 'enzyme'
                : 'metabolite'
        }

        const labelToId = new Map()
        const idToNode = {}

        const getNodeId = (label) => {
            if (!labelToId.has(label)) {
                labelToId.set(
                    label,
                    standardizeNodeId(
                        pathway,
                        label,
                        knownLabels,
                        knownPathways
                    )
                )
            }
            return labelToId.get(label)
        }
        console.log(batch)
        // Batch-preloaded node positions
        if (batch?.final) {
            for (const [oldId, node] of Object.entries(batch.final)) {
                const newId = standardizeNodeId(
                    pathway,
                    oldId,
                    knownLabels,
                    knownPathways
                )
                console.log(
                    oldId,
                    newId,
                    previousPositions?.[pathway]?.[newId],
                    node.position,
                    node
                )
                const newNode = {
                    ...node,
                    // id: newId,
                    temp_id: newId,
                    position:
                        previousPositions?.[pathway]?.[newId] || node.position,
                    height: node.height,
                    width: node.width,
                }
                batchNodes[newId] = newNode
                idToNode[newId] = newNode
                labelToId.set(node.data.abbreviation, newId)
                placedLabels.add(node.data.abbreviation)
            }
        }
        console.log(batchNodes)
        // Add missing nodes
        const uniqueLabels = new Set(edgePairs.flat())
        console.log(uniqueLabels)
        console.log(previousPositions)
        let i = 0
        for (const label of uniqueLabels) {
            const enzymeInfo = enzymes[label]
            const metaboliteInfo = metabolites[label]
            let pathway = null

            const id = getNodeId(label)

            const existing_pos = Object.entries(batchNodes)
                .filter(([nd_id]) => nd_id === id)
                .map(([_, nd]) => nd.position)[0]

            console.log(existing_pos)

            // if (idToNode[id]) {
            //     allNodes.push(idToNode[id])
            //     continue
            // }

            const defaultPos = {
                x: (i % 5) * 200,
                y: Math.floor(i / 5) * 120,
            }

            const position =
                previousPositions?.[pathway]?.[id] || existing_pos || defaultPos

            console.log(label, enzymeInfo, metaboliteInfo, position)

            let data = null
            if (enzymeInfo) {
                data = {
                    abbreviation: label,
                    type: 'reaction',
                    info: Array.isArray(enzymeInfo) ? enzymeInfo[0] : label,
                    flux: Array.isArray(enzymeInfo)
                        ? enzymeInfo[1]
                        : 'Not Calculated',
                    subsystem: pathway || 'Unknown',
                    color: Array.isArray(enzymeInfo)
                        ? getFluxColor(enzymeInfo[1])
                        : 'orange',
                    ...(enzymeInfo && {
                        lower_bound:
                            Array.isArray(enzymeInfo) && enzymeInfo.length > 2
                                ? enzymeInfo[2]
                                : -1000,
                        upper_bound:
                            Array.isArray(enzymeInfo) && enzymeInfo.length > 3
                                ? enzymeInfo[3]
                                : 1000,
                    }),
                }
            }
            if (metaboliteInfo) {
                data = {
                    abbreviation: label,
                    info: Array.isArray(metaboliteInfo)
                        ? metaboliteInfo[0]
                        : label,
                    type: 'metabolite',
                    formula: Array.isArray(metaboliteInfo)
                        ? metaboliteInfo[1]
                        : 'None',
                    compartment: Array.isArray(metaboliteInfo)
                        ? metaboliteInfo[2]
                        : 'None',
                    crossref: Array.isArray(metaboliteInfo)
                        ? metaboliteInfo[3]
                        : [],
                    weight: Array.isArray(metaboliteInfo)
                        ? metaboliteInfo[4]
                        : 'No weight',
                    color: Array.isArray(metaboliteInfo)
                        ? getMetaboliteColor(metaboliteInfo[4])
                        : 'orange',
                }
            }

            const node = {
                id: label,
                temp_id: id,
                type: 'custom',
                position,
                data,
            }

            allNodes.push(node)
            placedLabels.add(label)
            i++
        }

        // Add edges with bounds logic
        const groupedEdges = {}

        edgePairs.forEach(([source, target]) => {
            const srcType = getNodeType(source)
            const tgtType = getNodeType(target)

            if (srcType === 'metabolite' && tgtType === 'enzyme') {
                groupedEdges[target] = groupedEdges[target] || {
                    substrates: [],
                    products: [],
                }
                groupedEdges[target].substrates.push(source)
            } else if (srcType === 'enzyme' && tgtType === 'metabolite') {
                groupedEdges[source] = groupedEdges[source] || {
                    substrates: [],
                    products: [],
                }
                groupedEdges[source].products.push(target)
            }
        })

        // console.log('grouped edges', groupedEdges)

        for (const enzyme of Object.keys(groupedEdges)) {
            const substrates = groupedEdges[enzyme].substrates || []
            const products = groupedEdges[enzyme].products || []

            const enzymeNode = enzymes?.[enzyme]
            const enzymeData = enzymeNode

            const flux = parseFloat(enzymeData[1])
            const lb = parseFloat(enzymeData[2])
            const ub = parseFloat(enzymeData[3])

            const isNumber = (x) => typeof x === 'number' && !isNaN(x)
            const hasFlux = isNumber(flux)
            const hasLBUB = isNumber(lb) && isNumber(ub)
            console.log(`Enzyme: ${enzyme}`, enzymeNode, enzymeData)
            // console.log(
            //     `Enzyme: ${enzyme}, lb=${lb}, ub=${ub}, hasLB=${hasLBUB}, flux=${flux}, hasFlux=${hasFlux}`
            // )

            const marker = {
                type: MarkerType.ArrowClosed,
                width: 10,
                height: 10,
                color:
                    colorAction === 'flux'
                        ? !isNaN(flux) && flux !== 0
                            ? getFluxColor(flux)
                            : '#222'
                        : '#222',
            }

            const makeEdge = (
                actual_source,
                actual_target,
                source,
                target,
                colorAction,
                bidirectional = false
            ) => {
                // const id = `${pathway}__edge_${source}_${target}`
                const id = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
                const handleKey = `${source}-${target}`
                const [sourcePathway] = source.split('__')
                const [targetPathway] = target.split('__')

                const handleMap =
                    edgeHandlePositions?.[sourcePathway]?.[handleKey] ||
                    edgeHandlePositions?.[targetPathway]?.[handleKey] ||
                    {}

                const batchEdge = batch?.edges?.find(
                    (e) =>
                        getNodeId(e.source) === source &&
                        getNodeId(e.target) === target
                )

                const baseEdge = {
                    id,
                    source_id: source,
                    target_id: target,
                    source: actual_source,
                    target: actual_target,
                    sourceHandle:
                        handleMap.sourceHandle ||
                        batchEdge?.sourceHandle ||
                        'right',
                    targetHandle:
                        handleMap.targetHandle ||
                        batchEdge?.targetHandle ||
                        'left',
                    type: batchEdge?.type || 'default',
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

                if (bidirectional) {
                    return {
                        ...baseEdge,
                        markerStart: marker,
                        markerEnd: marker,
                    }
                } else {
                    return {
                        ...baseEdge,
                        markerEnd: marker,
                    }
                }
            }

            const enzNode = getNodeId(enzyme)

            if (hasFlux && flux > 0 && edgeFormat === 'flux') {
                // Case: Forward flux
                substrates.forEach((s) =>
                    allEdges.push(
                        makeEdge(s, enzyme, getNodeId(s), enzNode, colorAction)
                    )
                )
                products.forEach((p) =>
                    allEdges.push(
                        makeEdge(enzyme, p, enzNode, getNodeId(p), colorAction)
                    )
                )
            } else if (hasFlux && flux < 0 && edgeFormat === 'flux') {
                // Case: Reverse flux
                products.forEach((p) =>
                    allEdges.push(
                        makeEdge(p, enzyme, getNodeId(p), enzNode, colorAction)
                    )
                )
                substrates.forEach((s) =>
                    allEdges.push(
                        makeEdge(enzyme, s, enzNode, getNodeId(s), colorAction)
                    )
                )
            } else if (hasLBUB && lb < 0 && ub > 0) {
                // Case: Reversible, no flux
                substrates.forEach((s) =>
                    allEdges.push(
                        makeEdge(
                            s,
                            enzyme,
                            getNodeId(s),
                            enzNode,
                            colorAction,
                            true
                        )
                    )
                )
                products.forEach((p) =>
                    allEdges.push(
                        makeEdge(
                            enzyme,
                            p,
                            enzNode,
                            getNodeId(p),
                            colorAction,
                            true
                        )
                    )
                )
            } else if (hasLBUB && lb >= 0 && ub > 0) {
                // Forward-only
                substrates.forEach((s) =>
                    allEdges.push(
                        makeEdge(s, enzyme, getNodeId(s), enzNode, colorAction)
                    )
                )
                products.forEach((p) =>
                    allEdges.push(
                        makeEdge(enzyme, p, enzNode, getNodeId(p), colorAction)
                    )
                )
            } else if (hasLBUB && lb < 0 && ub <= 0) {
                // Backward-only
                products.forEach((p) =>
                    allEdges.push(
                        makeEdge(p, enzyme, getNodeId(p), enzNode, colorAction)
                    )
                )
                substrates.forEach((s) =>
                    allEdges.push(
                        makeEdge(enzyme, s, enzNode, getNodeId(s), colorAction)
                    )
                )
            } else {
                // Default to forward
                substrates.forEach((s) =>
                    allEdges.push(
                        makeEdge(s, enzyme, getNodeId(s), enzNode, colorAction)
                    )
                )
                products.forEach((p) =>
                    allEdges.push(
                        makeEdge(enzyme, p, enzNode, getNodeId(p), colorAction)
                    )
                )
            }
        }
    })

    return { nodes: allNodes, edges: allEdges }
}
