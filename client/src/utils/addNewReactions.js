import { MarkerType } from 'reactflow';
export function addNewReactions(selectedEnzymes, newData, selectedNode){
    function getNodeType(label) {
        return selectedEnzymes.includes(label) ? "enzyme" : "metabolite";
    }

    const rawEdges = []
    selectedEnzymes.map(enz => {
        const { edges } = newData[enz]
        rawEdges.push(...edges)
    })

    const edgeList = rawEdges.map(([source, target]) => ({
        sourceLabel: source,
        sourceType: getNodeType(source),
        targetLabel: target,
        targetType: getNodeType(target)
    }));


    const nodesMap = new Map();
    nodesMap.set(selectedNode?.data?.abbreviation, selectedNode?.id)
    const nodes = [];
    const edges = [];
    const spacingX = 300;
     const spacingY = 300;

    const getNodeId = (label) => {
    if (!nodesMap.has(label)) {
        const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`;
        nodesMap.set(label, id);
        }
        return nodesMap.get(label);
    };

    const getColor = (type) =>
    type === "enzyme" ? "#2b5d9b" : type === "metabolite" ? "red" : "#ccc";

    const placedLabels = new Set();
    placedLabels.add(selectedNode?.data?.abbreviation)
    const placeNode = (label, type) => {
        const id = getNodeId(label);
        if (!placedLabels.has(label)) {
        
        const index = nodes.length;
        const position = {
            x: (index % 5) * spacingX,
            y: Math.floor(index / 5) * spacingY,
        };

        if(selectedEnzymes.includes(label)){
            nodes.push({
            id,
            type: "custom",
            position,
            data: {
            abbreviation: label,
            info: `${label}`,
            color: getColor(type),
            },
            });
        } else {
            nodes.push({
            id,
            type: "custom",
            position,
            data: {
            abbreviation: label,
            info: label,
            color: getColor(type),
            },
        });
        }
        
        placedLabels.add(label);
        }
    };

    edgeList.forEach(({ sourceLabel, sourceType, targetLabel, targetType }) => {
        placeNode(sourceLabel, sourceType);
        placeNode(targetLabel, targetType);

        edges.push({
        id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        source: getNodeId(sourceLabel),
        target: getNodeId(targetLabel),
        sourceHandle: "right",
        targetHandle: "left",
        type: "default",
        markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 10,
            height: 10,
            color: "#222",
        },
        style: {
            strokeWidth: 2,
            stroke: "#222",
        },
        });
    });

    return {nodes, edges}
}