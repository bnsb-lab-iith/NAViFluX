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
import CanvasNode from './CanvasNode'
import 'reactflow/dist/style.css'
import toast from 'react-hot-toast'
import { reconstruction } from '../utils/reconstruction'
import EdgeContext from '../contexts/EdgeContext'
import { applyNodeChanges } from 'reactflow'
import { convertToGraphML } from '../utils/convertToGraphML'
import { convertToCytoscapeJsonFormat } from '../utils/convertToCytoscapeJsonFormat'
import { convertToCytoscapeCyjs } from '../utils/convertToCytoscapeCyjs'
import { useRef } from 'react'
import { toPng } from 'html-to-image'

const getId = () => `node_${Math.random().toString(36).slice(2, 9)}`

const CanvasEditor = forwardRef(
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
            onGraphChange,
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
        const [selectedEdgeId, setSelectedEdgeId] = useState(null)
        const [selectedEdge, setSelectedEdge] = useState(null)
        const [tempHandles, setTempHandles] = useState({
            sourceHandle: '',
            targetHandle: '',
        })
        const [viewport, setViewport] = useState(null)
        const imageRef = useRef(null)

        useEffect(() => {
            setNodes(initialNodes)
        }, [initialNodes])

        useEffect(() => {
            setEdges(initialEdges)
        }, [initialEdges])

        useEffect(() => {
            if (onGraphChange) {
                onGraphChange(nodes, edges)
            }
        }, [nodes, edges])

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
                        currentPositions[node.id] = node.position
                    })

                    for (const pathway of selectedPathways) {
                        if (!nodePositionCache.current[pathway]) {
                            nodePositionCache.current[pathway] = {}
                        }

                        for (const node of updated) {
                            if (node.id.startsWith(`${pathway}__`)) {
                                nodePositionCache.current[pathway][node.id] =
                                    node.position
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
                    <CanvasNode {...props} updateNodeData={updateNodeData} />
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
                if (node.data.color !== 'orange') {
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
                const connectedEdges = edges.filter(
                    (edg) => edg.source === node.id || edg.target === node.id
                )

                setRedoNodes([deletedNode])
                setRedoEdges(connectedEdges)
                setNodes((nds) => nds.filter((n) => n.id !== node.id))
                setEdges((eds) =>
                    eds.filter(
                        (e) => e.source !== node.id && e.target !== node.id
                    )
                )
                setPreviousNodes((nds) => nds.filter((n) => n.id !== node.id))
                setPreviousEdges((eds) =>
                    eds.filter(
                        (e) => e.source !== node.id && e.target !== node.id
                    )
                )
                setDeletingMode(null)
                toast.success('Node deleted')
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
            const rawData = { nodes, edges }
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

        const exportPNG = async () => {
            if (!imageRef.current) return

            const pngDataUrl = await toPng(imageRef.current, {
                backgroundColor: 'white',
                pixelRatio: 2,
            })

            const filename = 'graph.png'

            if ('showSaveFilePicker' in window) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [
                            {
                                description: 'PNG Image',
                                accept: {
                                    'image/png': ['.png'],
                                },
                            },
                        ],
                    })
                    const writable = await fileHandle.createWritable()
                    const response = await fetch(pngDataUrl)
                    const blob = await response.blob()
                    await writable.write(blob)
                    await writable.close()
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Save failed:', err)
                    }
                }
            } else {
                const a = document.createElement('a')
                a.href = pngDataUrl
                a.download = filename
                a.click()
                URL.revokeObjectURL(a.href)
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
            exportPNG,
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
                        nodes={visibleNodes}
                        edges={visibleEdges.map((edge) => {
                            const isSelected = edge.id === selectedEdgeId
                            return {
                                ...edge,
                                style: {
                                    ...(edge.style || {}),
                                    stroke: isSelected ? '#1A73E8' : '#222',
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
                            } else {
                                setSelectedEdgeId(edge.id)
                                setSelectedEdge(edge)
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
                        <Background />
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
                                    setTempHandles({
                                        ...tempHandles,
                                        sourceHandle: e.target.value,
                                    })
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
                                    setTempHandles({
                                        ...tempHandles,
                                        targetHandle: e.target.value,
                                    })
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
                                // 1. Update edges list
                                setEdges((eds) =>
                                    eds.map((edg) =>
                                        edg.id === selectedEdge.id
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

                                // 2. Save to cache
                                // Extract pathway from selected edge
                                const [sourcePathway] =
                                    selectedEdge.source.split('__')
                                const [targetPathway] =
                                    selectedEdge.target.split('__')
                                const handleKey = `${selectedEdge.source}-${selectedEdge.target}`

                                const handleData = {
                                    sourceHandle: tempHandles.sourceHandle,
                                    targetHandle: tempHandles.targetHandle,
                                }

                                // Save under source pathway
                                if (!edgeHandleCache.current[sourcePathway]) {
                                    edgeHandleCache.current[sourcePathway] = {}
                                }
                                edgeHandleCache.current[sourcePathway][
                                    handleKey
                                ] = handleData

                                // Save under target pathway if different
                                if (sourcePathway !== targetPathway) {
                                    if (
                                        !edgeHandleCache.current[targetPathway]
                                    ) {
                                        edgeHandleCache.current[targetPathway] =
                                            {}
                                    }
                                    edgeHandleCache.current[targetPathway][
                                        handleKey
                                    ] = handleData
                                }


                                toast.success(
                                    'Edge handles updated & persisted!'
                                )
                                setSelectedEdge(null)
                                setSelectedEdgeId(null)
                            }}
                            className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                        >
                            Apply
                        </button>

                        <button
                            onClick={() => {
                                setSelectedEdge(null)
                                setSelectedEdgeId(null)
                            }}
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
                                min={2}
                                max={20}
                                value={edgeThickness}
                                onChange={(e) =>
                                    setEdgeThickness(Number(e.target.value))
                                }
                                className="accent-blue-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                Edge Width: {edgeThickness}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min={60}
                                max={150}
                                value={boxSize}
                                onChange={(e) =>
                                    setBoxSize(Number(e.target.value))
                                }
                                className="accent-blue-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                Box Size: {boxSize}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min={60}
                                max={150}
                                value={circleSize}
                                onChange={(e) =>
                                    setCircleSize(Number(e.target.value))
                                }
                                className="accent-blue-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                Circle Size: {circleSize}
                            </span>
                        </div>
                    </div>
                )}
            </EdgeContext.Provider>
        )
    }
)

CanvasEditor.displayName = 'CanvasEditor'

export default CanvasEditor
