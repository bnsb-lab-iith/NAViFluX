export function reconstruction(nodes, edges) {
  const pathwayData = {};

  // Step 1: Group enzyme nodes by their subsystem
  nodes.forEach((node) => {
    const { abbreviation, info, color, subsystem } = node.data;
    const isEnzyme = color !== "orange";
    const [descLine, fluxLine] = info.split("\n");
    const description = descLine || abbreviation;
    const flux = fluxLine?.replace("Flux: ", "") || "Not calculated";

    if (isEnzyme) {
      const path = subsystem || "Unknown";

      if (!pathwayData[path]) {
        pathwayData[path] = { enzymes: {}, edges: [] };
      }

      pathwayData[path].enzymes[abbreviation] = [description, flux];
    }
  });

  // Step 2: Reconstruct edges and assign them to appropriate subsystem (enzyme owner)
  edges.forEach((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    if (sourceNode && targetNode) {
      const sourceLabel = sourceNode.data.abbreviation;
      const targetLabel = targetNode.data.abbreviation;

      // Try to find which enzyme this edge belongs to
      const subsystem =
        sourceNode.data.subsystem || targetNode.data.subsystem || "Unknown";

      if (!pathwayData[subsystem]) {
        pathwayData[subsystem] = { enzymes: {}, edges: [] };
      }

      pathwayData[subsystem].edges.push([sourceLabel, targetLabel]);
    }
  });

  return pathwayData;
}
