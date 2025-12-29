import dagre from 'dagre'

export function dagreLayout(nodes, edges, direction = 'TB') {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: direction }) // 'TB' = top-to-bottom, 'LR' = left-to-right
  g.setDefaultEdgeLabel(() => ({}))

  // Define node size (can be customized)
  nodes.forEach(node => {
    g.setNode(node.id, { width: 150, height: 50 })
  })

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  return nodes.map(node => {
    const pos = g.node(node.id)
    return {
      ...node,
      position: {
        x: pos.x - 75, // Centering adjustment
        y: pos.y - 25
      }
    }
  })
}
