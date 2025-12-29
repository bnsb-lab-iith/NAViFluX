export function convertToGraphML(data) {
    const { nodes, edges } = data

    const header = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns"
         xmlns:y="http://www.yworks.com/xml/graphml"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns 
         http://www.yworks.com/xml/schema/graphml/1.1/ygraphml.xsd">

  <!-- Key declarations required by Cytoscape -->
  <key id="label" for="node" attr.name="label" attr.type="string"/>
  <key id="graphics" for="node" yfiles.type="nodegraphics"/>

  <graph edgedefault="directed">
`

    const nodeStr = nodes
        .map((n) => {
            const label = n.data?.abbreviation || n.id
            const x = n.position?.x || 0
            const y = n.position?.y || 0
            const width = n.width || 80
            const height = n.height || 40

            return `    <node id="${n.id}">
      <data key="label">${label}</data>
      <data key="graphics">
        <y:ShapeNode>
          <y:Geometry x="${x}" y="${y}" width="${width}" height="${height}"/>
          <y:Fill color="#FFCC00" transparent="false"/>
          <y:BorderStyle color="#000000" type="line" width="1.0"/>
          <y:NodeLabel>${label}</y:NodeLabel>
          <y:Shape type="rectangle"/>
        </y:ShapeNode>
      </data>
    </node>`
        })
        .join('\n')

    const edgeStr = edges
        .map((e) => {
            return `    <edge id="${e.id}" source="${e.source}" target="${e.target}">
      <data key="label">${e.id}</data>
    </edge>`
        })
        .join('\n')

    const footer = `
  </graph>
</graphml>`

    return header + nodeStr + '\n' + edgeStr + footer
}
