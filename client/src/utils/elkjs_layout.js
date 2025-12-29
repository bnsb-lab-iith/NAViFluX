import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

export const applyElkLayout = async (nodes, edges, layoutType = 'layered', direction = 'DOWN') => {
  const elkNodes = nodes.map((node) => ({
    id: node.id,
    width: node.width || 100,
    height: node.height || 50,
  }));

  const elkEdges = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': layoutType,
      'elk.direction': direction,
      'elk.spacing.nodeNode': '40',
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const result = await elk.layout(graph);

  const updatedNodes = result.children.map((n) => {
    const original = nodes.find((node) => node.id === n.id);
    return {
      ...original,
      position: { x: n.x, y: n.y },
    };
  });

  return { nodes: updatedNodes, edges };
};
