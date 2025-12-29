export function convertToCytoscapeJsonFormat(data) {
    const newNodes = (data.nodes || []).map((node) => {
        const nodeData = { ...node.data, id: node.id }
        for (const key in node) {
            if (
                ![
                    'id',
                    'data',
                    'position',
                    'width',
                    'height',
                    'selected',
                    'dragging',
                    'positionAbsolute',
                ].includes(key)
            ) {
                nodeData[key] = node[key]
            }
        }
        const newNode = { data: nodeData }
        if (node.position) newNode.position = node.position
        return newNode
    })

    const newEdges = (data.edges || []).map((edge) => {
        const edgeData = {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            directed: true, // ✅ this is the key addition
        }
        for (const key in edge) {
            if (
                ![
                    'id',
                    'source',
                    'target',
                    'style',
                    'markerEnd',
                    'sourceHandle',
                    'targetHandle',
                    'type',
                ].includes(key)
            ) {
                edgeData[key] = edge[key]
            }
        }
        return {
            data: edgeData,
            classes: 'directed',
        }
    })

    return { elements: { nodes: newNodes, edges: newEdges } }
}
