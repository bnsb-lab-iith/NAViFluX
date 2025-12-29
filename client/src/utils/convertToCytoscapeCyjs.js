export function convertToCytoscapeCyjs(data) {
    const nodes = (data.nodes || []).map((node) => {
        const position = node.position || { x: 0, y: 0 }
        const nodeData = {
            id: node.id,
            label: node.data?.label || node.data?.abbreviation || node.id,
            ...node.data,
        }
        return {
            data: nodeData,
            position,
        }
    })

    const edges = (data.edges || []).map((edge) => {
        return {
            data: {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                label: edge.id,
                directed: true,
            },
            classes: 'directed', // triggers arrow via style
        }
    })

    const style = [
        {
            selector: 'node',
            style: {
                label: 'data(label)',
                'background-color': '#3f51b5',
                color: '#fff',
                'text-valign': 'center',
                'text-halign': 'center',
                width: '50',
                height: '50',
                'font-size': '10px',
            },
        },
        {
            selector: 'edge',
            style: {
                'line-color': '#999',
                width: 2,
                'curve-style': 'bezier',
                'target-arrow-color': '#999',
            },
        },
        {
            selector: 'edge.directed',
            style: {
                'target-arrow-shape': 'triangle',
                'target-arrow-color': '#999',
            },
        },
    ]

    return {
        elements: { nodes, edges },
        style,
        layout: {
            name: 'preset',
        },
    }
}
