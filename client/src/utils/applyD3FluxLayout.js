import {
    forceSimulation,
    forceLink,
    forceManyBody,
    forceCenter,
    forceCollide,
} from 'd3-force'

export const applyD3FluxLayout = async (
    nodes,
    edges,
    {
        width = 1000,
        height = 800,
        linkDistance = 120,
        chargeStrength = -350,
        collidePadding = 20,
        iterations = 300,
    } = {}
) => {
    // Clone nodes for d3 mutation safety
    const simNodes = nodes.map((n) => ({
        ...n,
        x: n.position?.x ?? Math.random() * width,
        y: n.position?.y ?? Math.random() * height,
    }))

    // Convert edges
    const simLinks = edges.map((e) => ({
        source: e.source,
        target: e.target,
    }))

    const simulation = forceSimulation(simNodes)
        .force(
            'link',
            forceLink(simLinks)
                .id((d) => d.id)
                .distance(linkDistance)
                .strength(1)
        )
        .force('charge', forceManyBody().strength(chargeStrength))
        .force('center', forceCenter(width / 2, height / 2))
        .force(
            'collide',
            forceCollide((d) => (d.width || 100) / 2 + collidePadding)
        )
        .stop()

    // Run synchronously (like ELK)
    for (let i = 0; i < iterations; i++) {
        simulation.tick()
    }

    // Map back to React Flow nodes
    const updatedNodes = simNodes.map((n) => {
        const original = nodes.find((node) => node.id === n.id)
        return {
            ...original,
            position: {
                x: n.x,
                y: n.y,
            },
        }
    })

    return {
        nodes: updatedNodes,
        edges,
    }
}
