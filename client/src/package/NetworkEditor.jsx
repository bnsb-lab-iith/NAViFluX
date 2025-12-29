import React, {
    useState,
    useMemo,
    createContext,
    useCallback,
    useImperativeHandle,
    forwardRef,
    useEffect,
} from 'react'
import { useReactFlow } from 'reactflow'
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    addEdge,
    useNodesState,
    useEdgesState,
    MarkerType,
} from 'reactflow'
import CustomNode from './CustomNode'
import 'reactflow/dist/style.css'
import toast from 'react-hot-toast'
import { reconstruction } from '../utils/reconstruction'
import EdgeContext from '../contexts/EdgeContext'
import { applyNodeChanges } from 'reactflow'
import { convertToGraphML } from '../utils/convertToGraphML'
import { convertToCytoscapeJsonFormat } from '../utils/convertToCytoscapeJsonFormat'
import { convertToCytoscapeCyjs } from '../utils/convertToCytoscapeCyjs'
import { useRef } from 'react'
import { toPng, toSvg } from 'html-to-image'
import jsPDF from 'jspdf'
import UTIF from 'utif'

const getId = () => `node_${Math.random().toString(36).slice(2, 9)}`

const NetworkEditor = forwardRef(
    (
        {
            initialNodes = [],
            initialEdges = [],
            height = 750,
            width = '100%',
            onNodeSelectAction,
            selectingActionNode,
            modelData,
            setModelData,
            gapFillingMode,
            gapFillingNodes,
            setGapFillingNodes,
            setGapFillingMode,
            onGapFill,
            nodePositionCache,
            edgeHandleCache,
            selectedPathways,
            setIsOpenDownloadModal,
            setEdgeThickness,
            setCircleSize,
            setBoxSize,
            edgeThickness,
            circleSize,
            boxSize,
            isOpenSettings,
            setIsOpenSettings,
            setFontSize,
            fontSize,
            setLayout,
        },
        ref
    ) => {
        const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
        const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
        const [previousNodes, setPreviousNodes] = useState([...initialNodes])
        const [previousEdges, setPreviousEdges] = useState([...initialEdges])
        const [redoNodes, setRedoNodes] = useState([])
        const [redoEdges, setRedoEdges] = useState([])
        const [addingEdge, setAddingEdge] = useState(false)
        const [sourceNode, setSourceNode] = useState(null)
        const [sourceHandle, setSourceHandle] = useState(null)
        const [targetNode, setTargetNode] = useState(null)
        const [selectionPhase, setSelectionPhase] = useState(null)
        const [deletingMode, setDeletingMode] = useState(null) // 'node' | 'edge' | null
        const [selectedEdgeIds, setSelectedEdgeIds] = useState([])
        const [tempHandles, setTempHandles] = useState({
            sourceHandle: '',
            targetHandle: '',
        })

        const [viewport, setViewport] = useState(null)
        const imageRef = useRef(null)
        const [textPosition, setTextPosition] = useState('bottom')

        const bringToFront = (id) => {
            setNodes((nds) =>
                nds.map((n) =>
                    n.id === id
                        ? { ...n, selected: true }
                        : { ...n, selected: false }
                )
            )
        }

        const releaseNode = () => {
            setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
        }

        useEffect(() => {
            setNodes(initialNodes)
        }, [initialNodes])

        useEffect(() => {
            setEdges(initialEdges)
        }, [initialEdges])

        const isInViewport = (position) => {
            if (
                !viewport ||
                !position ||
                typeof position.x !== 'number' ||
                typeof position.y !== 'number'
            ) {
                return false
            }

            const buffer = 0
            const viewX = -viewport.x / viewport.zoom
            const viewY = -viewport.y / viewport.zoom
            const width = window.innerWidth / viewport.zoom
            const height = window.innerHeight / viewport.zoom

            return (
                position.x >= viewX - buffer &&
                position.x <= viewX + width + buffer &&
                position.y >= viewY - buffer &&
                position.y <= viewY + height + buffer
            )
        }

        const handleNodesChange = useCallback(
            (changes) => {
                setNodes((nds) => {
                    const updated = applyNodeChanges(changes, nds)

                    const currentPositions = {}
                    updated.forEach((node) => {
                        currentPositions[node.temp_id] = node.position
                    })

                    for (const pathway of selectedPathways) {
                        if (!nodePositionCache.current[pathway]) {
                            nodePositionCache.current[pathway] = {}
                        }

                        for (const node of updated) {
                            if (node.temp_id.startsWith(`${pathway}__`)) {
                                nodePositionCache.current[pathway][
                                    node.temp_id
                                ] = node.position
                            }
                        }
                    }

                    return updated
                })
            },
            [selectedPathways, nodePositionCache, setNodes]
        )

        const nodeTypes = useMemo(
            () => ({
                custom: (props) => (
                    <CustomNode {...props} updateNodeData={updateNodeData} />
                ),
            }),
            []
        )

        const updateNodeData = useCallback(
            (id, newData) => {
                setNodes((nds) =>
                    nds.map((node) =>
                        node.id === id
                            ? { ...node, data: { ...node.data, ...newData } }
                            : node
                    )
                )
            },
            [setNodes]
        )

        const handleHandleSelect = (handlePosition) => {
            if (selectionPhase === 'sourceHandle') {
                setSourceHandle(handlePosition)
                setSelectionPhase('target')
                toast.success('Source side selected. Now select target node.')
            } else if (selectionPhase === 'targetHandle') {
                createEdge(handlePosition)
            }
        }

        const createEdge = (finalTargetHandle) => {
            if (!sourceNode || !sourceHandle || !targetNode) {
                toast.error(
                    'Edge creation failed: missing source or target info'
                )
                resetEdgeCreation()
                return
            }
            if (sourceNode === targetNode) {
                toast.error('Cannot connect node to itself.')
                resetEdgeCreation()
                return
            }

            const newEdge = {
                id: `edge_${Date.now()}`,
                source: sourceNode,
                sourceHandle,
                target: targetNode,
                targetHandle: finalTargetHandle,
                type: 'default',
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 10,
                    height: 10,
                    color: '#222',
                },
                style: { strokeWidth: 2, stroke: '#222' },
            }

            setPreviousEdges([...edges, newEdge])
            setEdges((eds) => addEdge(newEdge, eds))
            toast.success('Edge added!')
            resetEdgeCreation()
        }

        const resetEdgeCreation = () => {
            setAddingEdge(false)
            setSourceNode(null)
            setSourceHandle(null)
            setTargetNode(null)
            setSelectionPhase(null)
        }

        const onNodeClick = (event, node) => {
            if (gapFillingMode) {
                if (node.data.type !== 'metabolite') {
                    toast.error(
                        'Please select a metabolite (orange color node)'
                    )
                    return
                }
                if (gapFillingNodes.find((n) => n.id === node.id)) {
                    toast.error('Node already selected')
                    return
                }
                const newSelection = [...gapFillingNodes, node]
                
                setGapFillingNodes(newSelection)
                toast.success(`Selected node: ${node.data.abbreviation}`)

                if (newSelection.length === 2) {
                    setGapFillingMode(false)
                    setGapFillingNodes([])
                    onGapFill(newSelection)
                }
                return
            }

            if (selectingActionNode) {
                event.stopPropagation()
                onNodeSelectAction?.(node)
                return
            }
            if (deletingMode === 'node') {
                const deletedNode = nodes.find((nd) => nd.id === node.id)

      
                if (deletedNode?.data?.type === 'metabolite') {
                    toast.error('Please select an enzyme (blue)')
                    return
                }
                const id = deletedNode.id
                const subsystem = deletedNode.data.subsystem
                const enzymeEdges = edges.filter(
                    (e) => e.source === id || e.target === id
                )
                const connectingNodeIds = new Set(
                    enzymeEdges.map((e) =>
                        e.source === id ? e.target : e.source
                    )
                )
                const newEdges = edges.filter(
                    (e) => e.source !== id && e.target !== id
                )
                const safeToDeleteNode = Array.from(connectingNodeIds).filter(
                    (nodeId) => {
                        const otherEdges = newEdges.filter(
                            (e) => e.source === nodeId || e.target === nodeId
                        )
                        return otherEdges.length === 0
                    }
                )
                const newNodes = nodes.filter(
                    (node) =>
                        node.id !== id && !safeToDeleteNode.includes(node.id)
                )
                setRedoNodes([
                    node,
                    ...nodes.filter((n) => safeToDeleteNode.includes(n.id)),
                ])
                setRedoEdges(enzymeEdges)
                
                setLayout('default')
                setModelData((prev) => {
                    const subsystemData = prev[subsystem]
                    if (!subsystemData) return prev

                    const enzymeId = deletedNode.data.abbreviation // e.g. "Anaplerotic reactions__PPCK" → "PPCK"

                    // 1. Filter edges and currency_edges to remove any connected to this enzyme
                    const newEdges = subsystemData.edges.filter(
                        ([src, tgt]) => src !== enzymeId && tgt !== enzymeId
                    )
                    const newCurrencyEdges =
                        subsystemData.currency_edges.filter(
                            ([src, tgt]) => src !== enzymeId && tgt !== enzymeId
                        )

                    // 2. Remove enzyme + its gene mapping
                    const { [enzymeId]: _, ...newEnzymes } =
                        subsystemData.enzymes
                    const { [enzymeId]: _g, ...newGenes } = subsystemData.genes
                    const { [enzymeId]: _c, ...newEnzymeCrossRef } =
                        subsystemData.enzyme_crossref

                    // 3. Clean up metabolites — only remove those not present in any remaining edges
                    const metabolitesInUse = new Set(
                        newEdges.flat().concat(newCurrencyEdges.flat())
                    )
                    const newMetabolites = Object.fromEntries(
                        Object.entries(subsystemData.metabolites).filter(
                            ([met]) => metabolitesInUse.has(met)
                        )
                    )

                    return {
                        ...prev,
                        [subsystem]: {
                            ...subsystemData,
                            edges: newEdges,
                            currency_edges: newCurrencyEdges,
                            enzymes: newEnzymes,
                            genes: newGenes,
                            metabolites: newMetabolites,
                            enzyme_crossref: newEnzymeCrossRef,
                        },
                    }
                })

                setNodes(newNodes)
                setEdges(newEdges)
                setPreviousNodes(newNodes)
                setPreviousEdges(newEdges)
                setDeletingMode(null)
                setDeletingMode(null)

                toast.success(`${deletedNode.id} reaction deleted`)
                return
            }

            if (!addingEdge) return

            if (selectionPhase === null) {
                setSourceNode(node.id)
                setSelectionPhase('sourceHandle')
                toast.success(
                    'Source node selected. Please select source side.'
                )
            } else if (selectionPhase === 'target') {
                setTargetNode(node.id)
                setSelectionPhase('targetHandle')
                toast.success(
                    'Target node selected. Please select target side.'
                )
            }
        }

        const addNode = () => {
            const newNode = {
                id: getId(),
                type: 'custom',
                position: { x: Math.random() * 250, y: Math.random() * 250 },
                data: {
                    abbreviation: 'New',
                    info: '',
                    color: '#fff',
                    subsystem: 'Not Assigned',
                },
            }
            setPreviousNodes([...nodes, newNode])
            setNodes((nds) => [...nds, newNode])
            toast.success('Node added!')
        }

        const startAddEdge = () => {
            setAddingEdge(true)
            setSelectionPhase(null)
            setSourceNode(null)
            setSourceHandle(null)
            setTargetNode(null)
            toast('Click source node to start edge')
        }

        const undoNode = () => {
            if (previousNodes.length > 0) {
                const lastNode = previousNodes[previousNodes.length - 1]
                setNodes((prev) => prev.slice(0, -1))
                setEdges((eds) =>
                    eds.filter(
                        (e) =>
                            e.source !== lastNode.id && e.target !== lastNode.id
                    )
                )
                setPreviousNodes((prev) => prev.slice(0, -1))
                setPreviousEdges((prev) =>
                    prev.filter(
                        (e) =>
                            e.source !== lastNode.id && e.target !== lastNode.id
                    )
                )
            } else {
                toast('No more nodes to undo')
            }
        }

        const undoEdge = () => {
            if (previousEdges.length > 0) {
                setEdges((prev) => prev.slice(0, -1))
                setPreviousEdges((prev) => prev.slice(0, -1))
            } else {
                toast.error('No more edges to undo')
            }
        }

        const redoNode = () => {
            if (redoNodes.length === 0) {
                toast.error('No nodes to redo')
                return
            }

            const node = redoNodes[0]
            const edgesToRestore = redoEdges

            setNodes((nds) => [...nds, node])
            setEdges((edg) => [...edg, ...edgesToRestore])
            setPreviousNodes((nds) => [...nds, node])
            setPreviousEdges((eds) => [...eds, ...edgesToRestore])
            setRedoNodes([])
            setRedoEdges([])
            toast.success('Node and edges restored')
        }

        const exportToolFile = async () => {
         
            const reactionIds = nodes
                .filter((node) => node.data?.type === 'reaction')
                .map((node) => node.id)
      
            let allCurrencyEdges = []

            for (const data of Object.values(modelData)) {
                if (!data.currency_edges) continue

                for (const rid of reactionIds) {
                    const matches = data.currency_edges.filter(
                        ([a, b]) => a === rid || b === rid
                    )
                    allCurrencyEdges.push(...matches)
                }
            }

  

            const rawData = { nodes, edges, currency_edges: allCurrencyEdges }
            const fileName = 'reactflow_graph.json'
            const mimeType = 'application/json'
            const outputStr = JSON.stringify(rawData, null, 2)
     

            if ('showSaveFilePicker' in window) {
                try {
                    const extension = fileName.split('.').pop()
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [
                            {
                                description: 'Export File',
                                accept: {
                                    [mimeType]: ['.' + extension],
                                },
                            },
                        ],
                    })
                    const writable = await fileHandle.createWritable()
                    await writable.write(outputStr)
                    await writable.close()
                    toast.success(`${fileName} saved successfully`)
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Save failed:', err)
                        toast.error('Failed to save file.')
                    }
                }
            } else {
                const blob = new Blob([outputStr], { type: mimeType })
                const a = document.createElement('a')
                a.download = fileName
                a.href = URL.createObjectURL(blob)
                a.click()
                toast.success(`${fileName} downloaded`)
            }
        }

        const exportGraph = async (format = 'cytoscape-json') => {
            const rawData = { nodes, edges }

            let fileName, mimeType, outputStr

            if (format === 'graphml') {
                fileName = 'cytoscape_graph.graphml'
                mimeType = 'application/xml'
                outputStr = convertToGraphML(rawData)
            } else if (format === 'cytoscape-json') {
                fileName = 'cytoscape_compatible.json'
                mimeType = 'application/json'
                outputStr = JSON.stringify(
                    convertToCytoscapeJsonFormat(rawData),
                    null,
                    2
                )
            } else if (format === 'cyjs') {
                fileName = 'network.cyjs'
                mimeType = 'application/json'
                outputStr = JSON.stringify(
                    convertToCytoscapeCyjs(rawData),
                    null,
                    2
                )
            }

            if ('showSaveFilePicker' in window) {
                try {
                    const extension = fileName.split('.').pop()
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [
                            {
                                description: 'Export File',
                                accept: {
                                    [mimeType]: ['.' + extension],
                                },
                            },
                        ],
                    })
                    const writable = await fileHandle.createWritable()
                    await writable.write(outputStr)
                    await writable.close()
                    toast.success(`saved successfully`)
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Save failed:', err)
                        toast.error('Failed to save file.')
                    }
                }
            } else {
                const blob = new Blob([outputStr], { type: mimeType })
                const a = document.createElement('a')
                a.download = fileName
                a.href = URL.createObjectURL(blob)
                a.click()
                toast.success(`${fileName} downloaded`)
            }
        }

        const exportImage = async (format = 'png') => {
            if (!imageRef.current) return

            try {
                let dataUrl
                let blob
                const filename = `graph.${format}`

                if (format === 'svg') {
                    dataUrl = await toSvg(imageRef.current, {
                        backgroundColor: 'white',
                        pixelRatio: 4,
                    })

                    const svgText = decodeURIComponent(dataUrl.split(',')[1])
                    const svgBlob = new Blob([svgText], {
                        type: 'image/svg+xml;charset=utf-8',
                    })
                    blob = svgBlob
                }

                if (format === 'tiff') {
                    // Step 1: Export PNG using html-to-image
                    const pngDataUrl = await toPng(imageRef.current, {
                        backgroundColor: 'white',
                        pixelRatio: 4,
                    })

                    // Step 2: Convert PNG DataURL → ImageData
                    const imgBlob = await (await fetch(pngDataUrl)).blob()
                    const bitmap = await createImageBitmap(imgBlob)

                    const canvas = document.createElement('canvas')
                    canvas.width = bitmap.width
                    canvas.height = bitmap.height

                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(bitmap, 0, 0)

                    const imageData = ctx.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    )

                    // Step 3: Convert ImageData → TIFF using UTIF.js
                    const tiffBuffer = UTIF.encodeImage(
                        imageData.data,
                        canvas.width,
                        canvas.height
                    )

                    // Step 4: Create TIFF blob
                    blob = new Blob([tiffBuffer], { type: 'image/tiff' })
                }

                if (format === 'pdf') {
                    const pngDataUrl = await toPng(imageRef.current, {
                        backgroundColor: 'white',
                        pixelRatio: 4,
                    })
                    const pdf = new jsPDF()
                    const img = new Image()
                    img.src = pngDataUrl
                    img.onload = () => {
                        pdf.addImage(img, 'PNG', 10, 10, 180, 0)
                        pdf.save(filename)
                    }
                    return
                }

                if (format === 'png') {
                    dataUrl = await toPng(imageRef.current, {
                        backgroundColor: 'white',
                        pixelRatio: 4,
                    })
                    const res = await fetch(dataUrl)
                    blob = await res.blob()
                }

                // Save logic
                if ('showSaveFilePicker' in window) {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [
                            {
                                description: `${format.toUpperCase()} File`,
                                accept: {
                                    [format === 'svg'
                                        ? 'image/svg+xml'
                                        : `image/${format}`]: [`.${format}`],
                                },
                            },
                        ],
                    })
                    const writable = await fileHandle.createWritable()
                    await writable.write(blob)
                    await writable.close()
                } else {
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = filename
                    a.click()
                    URL.revokeObjectURL(url)
                }
            } catch (err) {
                console.error('Export failed:', err)
            }
        }

        const resetGraph = () => {
            setNodes(initialNodes)
            setEdges(initialEdges)
            setPreviousNodes([...initialNodes])
            setPreviousEdges([...initialEdges])
        }

        const deleteModeEdge = () => {
            setDeletingMode('edge')
            toast('Click edge to delete')
        }

        const deleteModeNode = () => {
            setDeletingMode('node')
            toast('Click node to delete')
        }

        const downloadModel = () => {
            toast('Download Button Clicked')
            setIsOpenDownloadModal(true)
        }

        useImperativeHandle(ref, () => ({
            addNode,
            startAddEdge,
            undoEdge,
            undoNode,
            redoNode,
            exportGraph,
            deleteModeEdge,
            deleteModeNode,
            resetGraph,
            downloadModel,
            getCurrentNodes: () => nodes,
            getCurrentEdges: () => edges,
            exportToolFile,
            exportImage,
        }))

        const visibleNodes = useMemo(() => {
            return nodes.filter((n) => isInViewport(n.position))
        }, [nodes, viewport])

        const visibleNodeIds = useMemo(
            () => new Set(visibleNodes.map((n) => n.id)),
            [visibleNodes]
        )

        const visibleEdges = useMemo(() => {
            return edges.filter(
                (e) =>
                    visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
            )
        }, [edges, visibleNodeIds])

        const selectedEdge = visibleEdges.find((e) =>
            selectedEdgeIds.includes(e.id)
        )


        return (
            <EdgeContext.Provider
                value={{
                    addingEdge,
                    selectionPhase,
                    sourceNode,
                    targetNode,
                    handleHandleSelect,
                    deletingMode,
                    selectingActionNode,
                    gapFillingMode,
                    modelData,
                    edgeThickness,
                    boxSize,
                    circleSize,
                    zoom: viewport?.zoom || 1,
                    bringToFront,
                    releaseNode,
                    textPosition,
                }}
            >
                <div
                    ref={imageRef}
                    style={{
                        height,
                        width,
                        border: '1px dashed #888',
                        borderRadius: '10px',
                    }}
                >
                    <ReactFlow
                        nodes={nodes}
                        edges={edges.map((edge) => {
                            const isSelected = selectedEdgeIds.includes(edge.id)
                            return {
                                ...edge,
                                style: {
                                    ...(edge.style || {}),
                                    stroke: isSelected
                                        ? '#1A73E8'
                                        : edge.style.stroke,
                                    strokeWidth: edgeThickness,
                                    strokeDasharray: isSelected ? '6 4' : '0',
                                    animation: isSelected
                                        ? 'dashmove 1s linear infinite'
                                        : 'none',
                                },
                            }
                        })}
                        onMove={(event, viewport) => setViewport(viewport)}
                        onNodesChange={handleNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeClick={onNodeClick}
                        onEdgeClick={(event, edge) => {
                            event.stopPropagation()

                            if (deletingMode === 'edge') {
                                setEdges((eds) =>
                                    eds.filter((e) => e.id !== edge.id)
                                )
                                setPreviousEdges((eds) =>
                                    eds.filter((e) => e.id !== edge.id)
                                )
                                setDeletingMode(null)
                                toast.success('Edge deleted')
                            } else if (event.ctrlKey) {
                                const allEdgeIds = edges.map((e) => e.id)
                                setSelectedEdgeIds(allEdgeIds)
                                const allHandles = {}
                                edges.forEach((e) => {
                                    allHandles[e.id] = {
                                        sourceHandle: e.sourceHandle || 'right',
                                        targetHandle: e.targetHandle || 'left',
                                    }
                                })
                                setTempHandles(allHandles)
                            } else {
                                setSelectedEdgeIds(
                                    (prev) =>
                                        prev.includes(edge.id)
                                            ? prev.filter(
                                                  (id) => id !== edge.id
                                              ) // deselect
                                            : [...prev, edge.id] // select
                                )
                                setTempHandles({
                                    sourceHandle: edge.sourceHandle || 'right',
                                    targetHandle: edge.targetHandle || 'left',
                                })
                            }
                        }}
                        nodeTypes={nodeTypes}
                        connectionMode="loose"
                        snapToGrid
                        snapGrid={[15, 15]}
                        minZoom={0.01}
                        fitView
                    >
                        <Controls />
                        
                    </ReactFlow>
                </div>
                {selectedEdge && (
                    <div className="fixed bottom-4 left-4 z-50 rounded border border-gray-300 bg-white p-4 shadow-md">
                        <div className="mb-2 font-semibold">
                            Edit Edge Handles
                        </div>

                        <div className="mb-2">
                            <label className="mr-2">Source Handle:</label>
                            <select
                                value={tempHandles.sourceHandle}
                                onChange={(e) =>
                                    setTempHandles((prev) => ({
                                        ...prev,
                                        sourceHandle: e.target.value,
                                    }))
                                }
                            >
                                {['left', 'right', 'top', 'bottom'].map(
                                    (pos) => (
                                        <option key={pos} value={pos}>
                                            {pos}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <div className="mb-2">
                            <label className="mr-2">Target Handle:</label>
                            <select
                                value={tempHandles.targetHandle}
                                onChange={(e) =>
                                    setTempHandles((prev) => ({
                                        ...prev,
                                        targetHandle: e.target.value,
                                    }))
                                }
                            >
                                {['left', 'right', 'top', 'bottom'].map(
                                    (pos) => (
                                        <option key={pos} value={pos}>
                                            {pos}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <button
                            onClick={() => {
                                setEdges((eds) =>
                                    eds.map((edg) =>
                                        selectedEdgeIds.includes(edg.id)
                                            ? {
                                                  ...edg,
                                                  sourceHandle:
                                                      tempHandles.sourceHandle,
                                                  targetHandle:
                                                      tempHandles.targetHandle,
                                              }
                                            : edg
                                    )
                                )

                                selectedEdgeIds.forEach((id) => {
                                    const edge = visibleEdges.find(
                                        (e) => e.id === id
                                    )
                                    if (!edge) return

                                    const [sourcePathway] =
                                        edge.source_id.split('__')
                                    const [targetPathway] =
                                        edge.target_id.split('__')
                                    const handleKey = `${edge.source}-${edge.target}`
                                    const handleData = {
                                        sourceHandle: tempHandles.sourceHandle,
                                        targetHandle: tempHandles.targetHandle,
                                    }

                                    if (
                                        !edgeHandleCache.current[sourcePathway]
                                    ) {
                                        edgeHandleCache.current[sourcePathway] =
                                            {}
                                    }
                                    edgeHandleCache.current[sourcePathway][
                                        handleKey
                                    ] = handleData

                                    if (sourcePathway !== targetPathway) {
                                        if (
                                            !edgeHandleCache.current[
                                                targetPathway
                                            ]
                                        ) {
                                            edgeHandleCache.current[
                                                targetPathway
                                            ] = {}
                                        }
                                        edgeHandleCache.current[targetPathway][
                                            handleKey
                                        ] = handleData
                                    }
                                })

                                toast.success(
                                    'Edge handles updated for selected edges!'
                                )
                                setSelectedEdgeIds([])
                            }}
                            className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                        >
                            Apply
                        </button>

                        <button
                            onClick={() => setSelectedEdgeIds([])}
                            className="ml-2 rounded bg-gray-300 px-3 py-1 hover:bg-gray-400"
                        >
                            Cancel
                        </button>
                    </div>
                )}
                {isOpenSettings && (
                    <div className="fixed bottom-4 right-4 z-50 rounded border border-gray-300 bg-white p-4 shadow-md">
                        <div className="mb-2 font-semibold">Settings</div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min={50}
                                max={300}
                                value={boxSize}
                                onChange={(e) =>
                                    setBoxSize(Number(e.target.value))
                                }
                                className="accent-blue-600"
                            />
                            <span className="text-sm text-black">
                                Box Size: {boxSize}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min={2}
                                max={40}
                                value={fontSize}
                                onChange={(e) =>
                                    setFontSize(Number(e.target.value))
                                }
                                className="accent-blue-600"
                            />
                            <span className="text-sm text-black">
                                Font Size: {fontSize}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min={2}
                                max={20}
                                value={edgeThickness}
                                onChange={(e) => {
                                    setEdgeThickness(Number(e.target.value))
                                }}
                                className="accent-blue-600"
                            />
                            <span className="text-sm text-gray-700">
                                Edge Width: {edgeThickness}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min={10}
                                max={150}
                                value={circleSize}
                                onChange={(e) =>
                                    setCircleSize(Number(e.target.value))
                                }
                                className="accent-blue-600"
                            />
                            <span className="text-sm text-black">
                                Circle Size: {circleSize}
                            </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-sm text-black">
                                Text Position:
                            </span>
                            {['top', 'right', 'bottom', 'left'].map((pos) => (
                                <button
                                    key={pos}
                                    onClick={() => setTextPosition(pos)}
                                    className={`rounded border px-2 py-1 text-sm ${
                                        textPosition === pos
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white'
                                    }`}
                                >
                                    {pos}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </EdgeContext.Provider>
        )
    }
)

NetworkEditor.displayName = 'NetworkEditor'

export default NetworkEditor
