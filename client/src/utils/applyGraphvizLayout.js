import { Graphviz } from '@hpcc-js/wasm';

export async function applyGraphvizLayout(nodes, edges, layout = 'dot') {
  const graphviz = await Graphviz.load();

  const undirectedLayouts = ['neato', 'fdp', 'sfdp', 'twopi', 'circo', 'osage', 'patchwork'];
  const isUndirected = undirectedLayouts.includes(layout);
  const connector = isUndirected ? '--' : '->';
  const graphType = isUndirected ? 'graph' : 'digraph';

  // layout options for graphviz
  const layoutOptions = {
    dot: `
      ranksep=1.0;
      nodesep=1.5;
    `,
    neato: `
      overlap=scale;
      sep=1.0;
    `,
    fdp: `
      overlap=scale;
      sep=0.5;
    `,
    sfdp: `
      overlap=scale;
      sep=0.1;
    `,
    twopi: `
      ranksep=2.0;
      overlap=scale;
    `,
    circo: `
      overlap=scale;
      sep=1.0;
    `,
    osage: `
    pack=true;
    overlap=false;
    margin=30;
    nodesep=1.0;
    ranksep=1.2;
  `,
    patchwork: `
      margin=10;
    `
  };


  let dot = `${graphType} G {
    ${layoutOptions[layout] || ''}
  `;

  for (const node of nodes) {
    dot += `  "${node.id}";\n`;
  }
  for (const edge of edges) {
    dot += `  "${edge.source}" ${connector} "${edge.target}";\n`;
  }
  dot += '}';

  const svg = graphviz.layout(dot, 'svg', layout);

  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  const positioned = {};

  const spacingFactor = 1.0; 

  doc.querySelectorAll('g.node').forEach(g => {
    const id = g.querySelector('title')?.textContent;
    const ellipse = g.querySelector('ellipse');
    const text = g.querySelector('text');

    const x = parseFloat(ellipse?.getAttribute('cx') || text?.getAttribute('x') || 0);
    const y = parseFloat(ellipse?.getAttribute('cy') || text?.getAttribute('y') || 0);

    if (id) {
      positioned[id] = {
        x: x * spacingFactor,
        y: -y * spacingFactor, 
      };
    }
  });

  // Return updated nodes for reactflow
  return nodes.map(node => {
    const pos = positioned[node.id];
    return pos
      ? { ...node, position: { x: pos.x, y: pos.y } }
      : { ...node };
  });
}