import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter
} from 'd3-force'

export function computeForceLayout(nodes, edges, width = 800, height = 600) {
  // Clone to avoid mutating the original nodes/edges
  const simNodes = nodes.map(n => ({ ...n }))
  const simEdges = edges.map(e => ({
    ...e,
    source: typeof e.source === 'object' ? e.source.id : e.source,
    target: typeof e.target === 'object' ? e.target.id : e.target
  }))

  // Run the force-directed simulation
  const simulation = forceSimulation(simNodes)
  .force('link', forceLink(simEdges).id(d => d.id).distance(1000))
  .force('charge', forceManyBody().strength(-1200))
  .force('center', forceCenter(width / 2, height / 2))
  .alpha(1)
  .stop()

for (let i = 0; i < 300; i++) simulation.tick()


  // Copy final x/y into `position`
  const layoutedNodes = simNodes.map(n => ({
    ...n,
    position: { x: n.x, y: n.y }
  }))

  return layoutedNodes
}
