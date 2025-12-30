import React, { useEffect, useMemo, useRef, useState } from 'react'
import ModelHeader from '../features/model-builder/ModelHeader'
import ToolSection from '../ui/ToolSection'
import ModelToolbar from '../features/model-builder/ModelToolbar'
import toast from 'react-hot-toast'
import BuilderEditor from '../package/BuilderEditor'
import { useBuilder } from '../contexts/BuilderContext'
import AddFullReaction from '../features/model-builder/AddFullReaction'
import { createNodeAndEdges } from '../utils/createNodeAndEdges'
import FillMissingReaction from '../features/pathway-visualizer/FillMissingReaction'
import { computeForceLayout } from '../utils/computeForceLayout'
import { dagreLayout } from '../utils/dagreLayout'
import { applyElkLayout } from '../utils/elkjs_layout'
import { applyGraphvizLayout } from '../utils/applyGraphvizLayout'
import JSZip from 'jszip'
import { Download } from 'lucide-react'
import DownloadModal from '../features/model-builder/DownloadModalBuilder'
import FluxModelBuilder from '../features/model-builder/FluxModelBuilder'
import ExportAsImageModal from '../features/pathway-visualizer/ExportAsImageModal'
import AddSingleReaction from '../features/model-builder/AddSingleReaction'
import ChooseDBmodal from '../features/model-builder/ChooseDBmodal'

const createCanvas = (id) => ({
    id,
    ref: React.createRef(),
    nodes: [],
    edges: [],
    layout: 'default',
    edgeThickness: 1,
    circleSize: 40,
    boxSize: 100,
})

const toolButtons = [
    {
        name: 'downloadModel',
        label: 'Model',
        icon: Download,
        variant: 'secondary',
    },
    {
        name: 'exportGraph',
        label: 'Cytoscape JSON',
        icon: Download,
        variant: 'secondary',
    },
    // {
    //     name: 'exportPNG',
    //     label: 'Image',
    //     icon: Download,
    //     variant: 'secondary',
    // },
]

function ModelBuilder() {
    const {
        edgeThickness,
        setEdgeThickness,
        circleSize,
        setCircleSize,
        boxSize,
        setBoxSize,
        database,
    } = useBuilder()
    const [modelData, setModelData] = useState({})
    const [reactionSubsystems, setReactionSubsystems] = useState({})
    const [textPosition, setTextPosition] = useState('bottom')
    const nodePositionCache = useRef({})
    const edgeHandleCache = useRef({})
    const [canvasCount, setCanvasCount] = useState(2)
    const [canvases, setCanvases] = useState(() =>
        Array.from({ length: 2 }, (_, i) => createCanvas(`canvas-${i}`))
    )

    const [focusedId, setFocusedId] = useState(null)
    const [selectedIds, setSelectedIds] = useState([])
    const [mergeMode, setMergeMode] = useState(false)
    const existingSubsystems = Array.from(new Set(Object.keys(modelData || {})))
    const existingEnzymeIds = new Set(
        canvases.flatMap(
            (c) =>
                c.ref?.current?.getCurrentNodes?.().map((node) => node.id) || []
        )
    )
    const visualizerRef = canvases.find((c) =>
        focusedId !== null ? c.id === focusedId : null
    )?.ref
    const [undoBackup, setUndoBackup] = useState(null)
    const [isOpenDBModal, setIsOpenDBModal] = useState(true)

    const downloadGeneReactionMatrix = () => {
   
        const gene_rxn_obj = {}
        Object.entries(modelData).map(([path, enzymes]) => {
            Object.entries(enzymes).map(([enz, enzobj]) => {
                gene_rxn_obj[enz] = enzobj.genes
            })
        })
  
        const genes = [...new Set(Object.values(gene_rxn_obj).flat())]

        // build matrix
        const matrix = genes.map((gene) => {
            const row = { gene }
            for (const [rxn, geneList] of Object.entries(gene_rxn_obj)) {
                row[rxn] = geneList.includes(gene) ? 1 : 0
            }
            return row
        })

        const headers = Object.keys(matrix[0])
        const rows = []
        rows.push(headers.join(',')) // header row
        matrix.forEach((row) => {
            rows.push(headers.map((h) => row[h]).join(','))
        })

        const csvContent = rows.join('\n')
  
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'reaction_gene_matrix.csv')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    ////////states for adding full reaction
    const [isOpenAFRmodal, setIsOpenAFRmodal] = useState(false)
    const [addFullReactionData, setAddFullReactionData] = useState(null)
    const [stepAddFullReaction, setStepAddFullReaction] = useState('select')
    const [newReactions, setNewReactions] = useState([])
    const [reactionBounds, setReactionBounds] = useState({})
    const [isLoading, setIsLoading] = useState(false)
    const [loadingCanvasId, setLoadingCanvasId] = useState(null)
    const [fullReactionGenes, setFullReactionGenes] = useState({})
    const [tempInput, setTempInput] = useState({})
    const [AFRkeyword, setAFRkeyword] = useState('')
    const [query, setQuery] = useState('')

    const filteredAddFullReactionData = useMemo(() => {
   
        const keyword = AFRkeyword.toLowerCase()
        const searchTerms = keyword
            .split(/[, ]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        return Object.fromEntries(
            Object.entries(addFullReactionData || {}).filter(
                ([enz, enzobj]) => {
                    // Normalize
                    const enzId = enz.toLowerCase()
                    const description = enzobj?.description?.toLowerCase() || ''
                    const rxn =
                        enzobj?.reaction?.toLowerCase().replace(/\s+/g, ' ') ||
                        ''

                    // Extract metabolites from reaction string
                    const metabolites = rxn
                        .split(/<?-+>?/) // split left/right
                        .flatMap((side) => side.split('+'))
                        .map((m) => m.trim())

                    // Check if ALL search terms match somewhere (enzymeId, description, or metabolites)
                    return searchTerms.every(
                        (term) =>
                            enzId.includes(term) ||
                            description.includes(term) ||
                            metabolites.some((m) => m.includes(term))
                    )
                }
            )
        )
    }, [addFullReactionData, AFRkeyword])

    async function handleSubmitNewEdges(id) {
        if (!id) return

        setIsLoading(true)
        const targetCanvas = canvases.find((c) => c.id === id)
        if (!targetCanvas) return alert('Select a canvas')
        setLoadingCanvasId(id)

        //// call the next api here
        const res = await fetch(
            'http://127.0.0.1:5000/api/v1/add-full-reactions-v2',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    enzymes: newReactions,
                    database: database,
                }),
            }
        )
 
        const returned_data = await res.json()
    
        if (returned_data.status === 'error')
            throw new Error(returned_data.message)

        const enzymes_data = returned_data?.result

        const reactionList = {}
        newReactions.map((enz) => {
            const data = enzymes_data[enz]
            const bounds = reactionBounds[enz] || { lower: -1000, upper: 1000 }
            const subsystem = reactionSubsystems[enz] || 'Not Assigned'
            const genes = fullReactionGenes[enz] || []
            data.genes = genes
            data.bounds = bounds
            data.subsystem = subsystem
            reactionList[enz] = data
        })
 

        const { nodes, edges } = createNodeAndEdges(
            reactionList,
            nodePositionCache,
            edgeHandleCache,
            modelData
        )


        const editorRef = targetCanvas.ref?.current
        if (!editorRef) return alert('Editor not ready')

        const existingNodeIds = new Set(
            editorRef.getCurrentNodes().map((n) => n.id)
        )
        const existingEdgeIds = new Set(
            editorRef.getCurrentEdges().map((e) => e.id)
        )
        nodes.forEach((node) => {
            if (!existingNodeIds.has(node.id)) {
                editorRef.addNewNode(node)
            }
        })
        edges.forEach((edge) => {
            if (!existingEdgeIds.has(edge.id)) {
                editorRef.addEdge(edge)
            }
        })
        const updatedModelData = {}

        Object.entries(reactionList).forEach(([enzyme, reaction]) => {
            const subsystem = reaction.subsystem || 'Unassigned'
            if (!updatedModelData[subsystem]) {
                updatedModelData[subsystem] = {}
            }
            updatedModelData[subsystem][enzyme] = reaction
        })



        setModelData((prev) => {
            const newModelData = { ...prev }

            Object.entries(updatedModelData).forEach(
                ([subsystem, reactions]) => {
                    if (!newModelData[subsystem]) newModelData[subsystem] = {}
                    Object.assign(newModelData[subsystem], reactions)
                }
            )

            return newModelData
        })
        setReactionSubsystems({})
        setReactionBounds({})
        // setFullReactionGenes({})
        setStepAddFullReaction('select')
        setAddFullReactionData(null)
        setNewReactions([])
        setIsLoading(false)
        setLoadingCanvasId(null)
        setAFRkeyword('')
        setTempInput({})
    }

    function handleResetFullReaction() {
        setReactionSubsystems({})
        setReactionBounds({})
        // setFullReactionGenes({})
        setStepAddFullReaction('select')
        setAddFullReactionData(null)
        setNewReactions([])
        setIsLoading(false)
        setLoadingCanvasId(null)
        setAFRkeyword('')
        setTempInput({})
    }

    const handleCheckboxAddReactions = (enzyme) => {
        setNewReactions((prev) => {
            const isSelected = prev.includes(enzyme)

            // If deselected, also reset bounds
            if (isSelected) {
                setReactionBounds((prevBounds) => {
                    const updated = { ...prevBounds }
                    delete updated[enzyme]
                    return updated
                })
                return prev.filter((e) => e !== enzyme)
            } else {
                return [...prev, enzyme]
            }
        })
    }

    const handleAddFullReaction = () => {
        const target = canvases.find((c) => c.id === focusedId)
        if (!target) return alert('Select a canvas first')
        setIsOpenAFRmodal(true)
    }

    /////////////// states for filling missing reaction
    const [gapFillingNodes, setGapFillingNodes] = useState([])
    const [gapFillNodesForBackend, setGapFillNodesForBackend] = useState([])
    const [gapFillingMode, setGapFillingMode] = useState(false)
    const [isOpenGapFillModal, setIsOpenGapFillModal] = useState(false)
    const [gapFillingFullData, setGapFillingFullData] = useState(null)
    const [stepFillMissingReaction, setStepFillMissingReaction] =
        useState('select')
    const [selectedEnzyme, setSelectedEnzyme] = useState('')
    const [selectedTargetPathway, setSelectedTargetPathway] = useState('')
    const [gapFillBounds, setGapFillBounds] = useState({})
    const [gapFillSubsystems, setGapFillSubsystems] = useState({})
    const [gapFillingKeyword, setGapFillingKeyword] = useState('')
    const [gapFillingGenes, setGapFillingGenes] = useState({})

    const [isOpenSettings, setIsOpenSettings] = useState(false)

    const filteredGapFillingData = useMemo(() => {
        const keyword = gapFillingKeyword.toLowerCase()
        const searchTerms = keyword
            .split(/[, ]+/)
            .map((s) => s.trim())
            .filter(Boolean)

        return Object.fromEntries(
            Object.entries(gapFillingFullData || {}).filter(([enz, enzobj]) => {
                // Normalize
                const enzId = enz.toLowerCase()
                const description = enzobj?.description?.toLowerCase() || ''
                const rxn =
                    enzobj?.reaction?.toLowerCase().replace(/\s+/g, ' ') || ''

                // Extract metabolites from reaction string
                const metabolites = rxn
                    .split(/<?-+>?/) // split left/right
                    .flatMap((side) => side.split('+'))
                    .map((m) => m.trim())

                // ✅ AND logic: all search terms must match somewhere
                return searchTerms.every(
                    (term) =>
                        enzId.includes(term) ||
                        description.includes(term) ||
                        metabolites.some((m) => m.includes(term))
                )
            })
        )
    }, [gapFillingFullData, gapFillingKeyword])

    function handleAddMissingReaction(id) {

        const data = gapFillingFullData[selectedEnzyme]
        const lower_bound =
            gapFillBounds[selectedEnzyme].lower === ''
                ? -1000
                : parseFloat(gapFillBounds[selectedEnzyme].lower)
        const upper_bound =
            gapFillBounds[selectedEnzyme].upper === ''
                ? 1000
                : parseFloat(gapFillBounds[selectedEnzyme].upper)
        const bounds = { lower: lower_bound, upper: upper_bound }
        const subsystem = gapFillSubsystems[selectedEnzyme] || 'Not Assigned'
        data.bounds = bounds
        data.subsystem = subsystem
        data.genes = gapFillingGenes[selectedEnzyme] || []
        const reactionList = {}
        reactionList[selectedEnzyme] = data

        const { nodes, edges } = createNodeAndEdges(
            reactionList,
            nodePositionCache,
            edgeHandleCache
        )
     
        const targetCanvas = canvases.find((c) => c.id === id)
        if (!targetCanvas) return alert('Select a canvas')

        const editorRef = targetCanvas.ref?.current
        if (!editorRef) return alert('Editor not ready')

        const existingNodeIds = new Set(
            editorRef.getCurrentNodes().map((n) => n.id)
        )
        const existingEdgeIds = new Set(
            editorRef.getCurrentEdges().map((e) => e.id)
        )
        nodes.forEach((node) => {
            if (!existingNodeIds.has(node.id)) {
                editorRef.addNewNode(node)
            }
        })
        edges.forEach((edge) => {
            if (!existingEdgeIds.has(edge.id)) {
                editorRef.addEdge(edge)
            }
        })
        const updatedModelData = {}
        Object.entries(reactionList).forEach(([enzyme, reaction]) => {
            const subsystem = reaction.subsystem || 'Unassigned'
            if (!updatedModelData[subsystem]) {
                updatedModelData[subsystem] = {}
            }
            updatedModelData[subsystem][enzyme] = reaction
        })

        setModelData((prev) => {
            const newModelData = { ...prev }
            Object.entries(updatedModelData).forEach(
                ([subsystem, reactions]) => {
                    if (!newModelData[subsystem]) newModelData[subsystem] = {}
                    Object.assign(newModelData[subsystem], reactions)
                }
            )
            return newModelData
        })
        setGapFillBounds({})
        setGapFillSubsystems({})
        setGapFillingGenes({})
        setStepFillMissingReaction('select')
        setGapFillingFullData(null)
        setSelectedEnzyme('')
        setGapFillNodesForBackend([])
        setGapFillingKeyword('')
        setTempInput({})
    }

    function handleResetMissingReaction() {
        setGapFillBounds({})
        setGapFillSubsystems({})
        setGapFillingGenes({})
        setStepFillMissingReaction('select')
        setGapFillingFullData(null)
        setSelectedEnzyme('')
        setGapFillNodesForBackend([])
        setGapFillingKeyword('')
        setTempInput({})
    }

    function GapFill(selectedNodes) {
     
        setIsOpenGapFillModal(true)
        setGapFillNodesForBackend(selectedNodes)
        setGapFillingFullData(null)
        setStepAddFullReaction('select')
        setStepFillMissingReaction('select')
        toast.success(
            `Gap filling between ${selectedNodes[0].data.abbreviation} and ${selectedNodes[1].data.abbreviation}`
        )
    }

    async function handleGapFilling() {
        setGapFillingMode(true)
        setGapFillingNodes([])
        setGapFillNodesForBackend([])
       
        toast('Select two metabolites (orange nodes) for gap filling')
    }

    ///// for downloading the model
    const [isOpenDownloadModal, setIsOpenDownloadModal] = useState(false)
    const [stepDownloadModal, setStepDownloadModal] = useState('preview')
    const [isDownloadingEdgeList, setIsDownloadingEdgeList] = useState(false)

    const [stepFluxCalculation, setStepFluxCalculation] = useState('select')
    const [isOpenFluxModal, setIsOpenFluxModal] = useState(false)
    const [isOpenImageModal, setIsOpenImageModal] = useState(false)

    async function handleDownloadEdgeList() {
        const finalModelData = {}
        Object.keys(modelData).map(
            (path) =>
                (finalModelData[path] = {
                    currency_edges: [],
                    edges: [],
                    enzymes: {},
                    metabolites: {},
                    genes: {},
                })
        )

        Object.entries(modelData).map(([path, obj]) => {
            const pathObj = modelData[path] // from the old one
            const newPathObj = finalModelData[path] // new path obj
            Object.entries(pathObj).map(([enzyme, enzObj]) => {
                newPathObj.edges.push(...enzObj.edges)
                newPathObj.currency_edges.push(...enzObj.currency_edges)
                const lb = enzObj.bounds.lower || -1000.0
                const ub = enzObj.bounds.upper || 1000.0
                const desc = enzObj.description
                newPathObj.enzymes[enzyme] = [desc, 'Not calculated', lb, ub]
                Object.entries(enzObj.metabolites).map(([met, description]) => {
                    newPathObj.metabolites[met] = description
                })
                newPathObj.genes[enzyme] = enzObj.genes
            })
        })
     
        try {
            setIsDownloadingEdgeList(true)

            const submitRes = await fetch(
                'http://127.0.0.1:5000/api/v1/download-edge-lists',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        modelData: finalModelData,
                    }),
                }
            )

            if (!submitRes.ok) {
                throw new Error(submitRes.statusText)
            }

            const { task_id } = await submitRes.json()
       
            let timeoutId = null

            const pollTask = async () => {
                const statusRes = await fetch(
                    `http://127.0.0.1:5000/api/status/${task_id}`
                )
                if (!statusRes.ok) {
                    toast.error('Failed to get task status')
                    return
                }

                const { state, result } = await statusRes.json()

                if (state === 'PENDING' || state === 'PROGRESS') {
                    setIsDownloadingEdgeList(true)
                    timeoutId = setTimeout(pollTask, 10)
                } else if (state === 'SUCCESS') {
                
                    const {
                        reaction_network,
                        metabolite_network,
                        reaction_metabolite_network,
                    } = result

                    const formatEdges = (network) =>
                        network
                            .map(([src, dst]) => `${src} - ${dst}`)
                            .join('\n')

                    const zip = new JSZip()
                    zip.file(
                        'reaction_metabolite_network.txt',
                        formatEdges(reaction_metabolite_network)
                    )
                    zip.file(
                        'reaction_network.txt',
                        formatEdges(reaction_network)
                    )
                    zip.file(
                        'metabolite_network.txt',
                        formatEdges(metabolite_network)
                    )

                    const content = await zip.generateAsync({ type: 'blob' })
                    const mimeType = 'application/zip'
                    const fileName = 'edge-lists.zip'

                    if ('showSaveFilePicker' in window) {
                        try {
                            const fileHandle = await window.showSaveFilePicker({
                                suggestedName: fileName,
                                types: [
                                    {
                                        description: 'Zip Archive',
                                        accept: { [mimeType]: ['.zip'] },
                                    },
                                ],
                            })
                            const writable = await fileHandle.createWritable()
                            await writable.write(content)
                            await writable.close()
                            toast.success(`Zip file saved successfully`)
                        } catch (err) {
                            if (err.name !== 'AbortError') {
                                console.error('Save failed:', err)
                                toast.error('Failed to save file.')
                            }
                        }
                    } else {
                        const a = document.createElement('a')
                        a.href = URL.createObjectURL(content)
                        a.download = fileName
                        a.click()
                        toast.success(`${fileName} downloaded`)
                    }
                    setIsDownloadingEdgeList(false)
                    clearTimeout(timeoutId)
                } else if (state === 'FAILURE') {
                    toast.error('Task failed')
                    clearTimeout(timeoutId)
                    setIsDownloadingEdgeList(false)
                } else {
                    toast.error(`Unhandled task state: ${state}`)
                    clearTimeout(timeoutId)
                    setIsDownloadingEdgeList(false)
                }
            }

            pollTask()
        } catch (err) {
            toast.error(err.message)
        } finally {
            setIsDownloadingEdgeList(false)
        }
    }

    //// states for adding single reaction
    const [selectingActionNode, setSelectingActionNode] = useState(false)
    const [selectedNode, setSelectedNode] = useState(null)
    const [addSingleReactionData, setAddSingleReactionData] = useState(null)
    const [stepAddSingleReaction, setStepSingleReaction] = useState('selet')
    const [newSingleReactions, setNewSingleReactions] = useState([])
    const [singleReactionBounds, setSingleReactionBounds] = useState({})
    const [singlereactionSubsystems, setSingleReactionSubsystems] = useState({})
    const [isOpenSingleReactionModal, setIsOpenSingleReactionModal] =
        useState(false)
    const [singleReactionKeyword, setSingleReactionKeyword] = useState('')
    const [singleReactionGenes, setSingleReactionGenes] = useState({})

    const filteredSingleReactionData = useMemo(() => {
        const keyword = singleReactionKeyword.toLowerCase()
        const searchTerms = keyword
            .split(/[, ]+/)
            .map((s) => s.trim())
            .filter(Boolean)

        return Object.fromEntries(
            Object.entries(addSingleReactionData || {}).filter(
                ([enz, enzobj]) => {
                    // Normalize
                    const enzId = enz.toLowerCase()
                    const description = enzobj?.description?.toLowerCase() || ''
                    const rxn =
                        enzobj?.reaction?.toLowerCase().replace(/\s+/g, ' ') ||
                        ''

                    // Extract metabolites from reaction string
                    const metabolites = rxn
                        .split(/<?-+>?/) // split left/right
                        .flatMap((side) => side.split('+'))
                        .map((m) => m.trim())

                    // Check if ALL search terms match somewhere (enzymeId, description, or metabolites)
                    return searchTerms.every(
                        (term) =>
                            enzId.includes(term) ||
                            description.includes(term) ||
                            metabolites.some((m) => m.includes(term))
                    )
                }
            )
        )
    }, [addSingleReactionData, singleReactionKeyword])

    function handleSubmitSingleReactionEdges(id) {
        if (!id) return

        const reactionList = {}
        newSingleReactions.map((enz) => {
            const data = addSingleReactionData[enz]
            const bounds = singleReactionBounds[enz] || {
                lower: -1000,
                upper: 1000,
            }
            const subsystem = singlereactionSubsystems[enz] || 'Not Assigned'
            data.bounds = bounds
            data.subsystem = subsystem
            const genes = singleReactionGenes[enz] || []
            data.genes = genes
            reactionList[enz] = data
        })
       
        const { nodes, edges } = createNodeAndEdges(
            reactionList,
            nodePositionCache,
            edgeHandleCache
        )
     
        const targetCanvas = canvases.find((c) => c.id === id)
        if (!targetCanvas) return alert('Select a canvas')

        const editorRef = targetCanvas.ref?.current
        if (!editorRef) return alert('Editor not ready')

        const existingNodeIds = new Set(
            editorRef.getCurrentNodes().map((n) => n.id)
        )
        const existingEdgeIds = new Set(
            editorRef.getCurrentEdges().map((e) => e.id)
        )
        nodes.forEach((node) => {
            if (!existingNodeIds.has(node.id)) {
                editorRef.addNewNode(node)
            }
        })
        edges.forEach((edge) => {
            if (!existingEdgeIds.has(edge.id)) {
                editorRef.addEdge(edge)
            }
        })
        const updatedModelData = {}

        Object.entries(reactionList).forEach(([enzyme, reaction]) => {
            const subsystem = reaction.subsystem || 'Unassigned'
            if (!updatedModelData[subsystem]) {
                updatedModelData[subsystem] = {}
            }
            updatedModelData[subsystem][enzyme] = reaction
        })

        
        setModelData((prev) => {
            const newModelData = { ...prev }

            Object.entries(updatedModelData).forEach(
                ([subsystem, reactions]) => {
                    if (!newModelData[subsystem]) newModelData[subsystem] = {}
                    Object.assign(newModelData[subsystem], reactions)
                }
            )

            return newModelData
        })
        setSingleReactionSubsystems({})
        setSingleReactionBounds({})
        setSingleReactionGenes({})
        setTempInput({})
        setStepSingleReaction('select')
        setAddSingleReactionData(null)
        setNewSingleReactions([])
    }

    function handleResetSingleReaction() {
        setSingleReactionSubsystems({})
        setSingleReactionBounds({})
        setSingleReactionGenes({})
        setTempInput({})
        setStepSingleReaction('select')
        setAddSingleReactionData(null)
        setNewSingleReactions([])
    }

    const handleCheckboxAddSingleReactions = (enzyme) => {
        setNewSingleReactions((prev) => {
            const isSelected = prev.includes(enzyme)

            // If deselected, also reset bounds
            if (isSelected) {
                setSingleReactionBounds((prevBounds) => {
                    const updated = { ...prevBounds }
                    delete updated[enzyme]
                    return updated
                })
                return prev.filter((e) => e !== enzyme)
            } else {
                return [...prev, enzyme]
            }
        })
    }

    function handlePathwayAction() {
        toast('Please click a node to perform the action.')
        setSelectingActionNode(true)
    }

    const updateCanvasCount = (count) => {
        setCanvases((prev) => {
            const isNonEmpty = (canvas) => {
                const nodeCount =
                    canvas.ref.current?.getCurrentNodes?.().length || 0
                const edgeCount =
                    canvas.ref.current?.getCurrentEdges?.().length || 0
                return nodeCount > 0 || edgeCount > 0
            }

            const nonEmpty = prev.filter(isNonEmpty)
       

            if (count < nonEmpty.length) {
                toast.error(
                    `Cannot reduce below ${nonEmpty.length} — ${
                        nonEmpty.length === 1
                            ? '1 canvas has'
                            : 'some canvases have'
                    } data.`
                )
                return prev
            }

            const empty = prev.filter((c) => !isNonEmpty(c))
            const updated = [...nonEmpty, ...empty]

            if (count > updated.length) {
                const toAdd = count - updated.length
                const newCanvases = Array.from({ length: toAdd }, (_, i) =>
                    createCanvas(`canvas-${Date.now()}-${i}`)
                )
                return [...updated, ...newCanvases]
            }

            return updated.slice(0, count)
        })

        setCanvasCount(count)
        setFocusedId(null)
        setSelectedIds([])
    }

    const handleMergeClick = () => {
        setMergeMode(true)
        setSelectedIds([])
        setFocusedId(null)
        toast('Select two canvases to merge', { icon: '🔀' })
    }

    const addNodeToFocused = () => {
        const target = canvases.find((c) => c.id === focusedId)
        if (!target) return alert('Select a canvas first')
        target.ref.current?.addNode()
   
        const nodes = target?.ref.current?.getCurrentNodes()
        const edges = target?.ref.current?.getCurrentEdges()

     
    }

    const addEdgeToFocused = () => {
        const target = canvases.find((c) => c.id === focusedId)
        if (!target) return alert('Select a canvas first')
        target.ref.current?.startAddEdge()
    }

    const deleteReaction = () => {
        const target = canvases.find((c) => c.id === focusedId)
        if (!target) return alert('Select a canvas first')
        target.ref.current?.deleteModeNode()
    }

    const handleCanvasClick = (id) => {
        if (mergeMode) {
            setSelectedIds((prev) =>
                prev.includes(id)
                    ? prev.filter((cid) => cid !== id)
                    : prev.length < 2
                      ? [...prev, id]
                      : prev
            )
        } else {
            setFocusedId(id)
        }
    }

    const handleUndoMerge = () => {
        if (!undoBackup) {
            toast.error('Nothing to undo.')
            return
        }

        setCanvases((prev) =>
            undoBackup.map((backupCanvas) => {
                const ref = backupCanvas.ref.current

                if (ref?.updateLayout) {
                    ref.updateLayout(backupCanvas.nodes, backupCanvas.edges)
                }

                return {
                    ...backupCanvas,
                    nodes: backupCanvas.nodes,
                    edges: backupCanvas.edges,
                }
            })
        )

        setUndoBackup(null) // One-level undo only
        setFocusedId(null)
        setSelectedIds([])
        toast.success('Undo Merge Successful.')
    }

    const handleBackupForUndo = () => {
        const backup = canvases.map((canvas) => {
            const currentNodes = canvas.ref.current?.getCurrentNodes() || []
            const currentEdges = canvas.ref.current?.getCurrentEdges() || []

            return {
                ...canvas,
                nodes: JSON.parse(JSON.stringify(currentNodes)),
                edges: JSON.parse(JSON.stringify(currentEdges)),
            }
        })
    
        setUndoBackup(backup)
    }

    const mergeSelected = () => {
        if (selectedIds.length !== 2) {
            alert('Select exactly two canvases to merge.')
            return
        }

        handleBackupForUndo()
        // setUndoBackup(JSON.parse(JSON.stringify(canvases)))

        const [id1, id2] = selectedIds
        const c1 = canvases.find((c) => c.id === id1)
        const c2 = canvases.find((c) => c.id === id2)

        const getNodes = (ref) => ref.current?.getCurrentNodes?.() || []
        const getEdges = (ref) => ref.current?.getCurrentEdges?.() || []

        const nodes1 = getNodes(c1.ref)
        const edges1 = getEdges(c1.ref)
        const nodes2 = getNodes(c2.ref)
        const edges2 = getEdges(c2.ref)

        const existingNodeIds = new Set(nodes1.map((n) => n.id))

        // Maintain mapping for reused or new node IDs
        const nodeIdMap = {}

        const shiftedNodes = nodes2.flatMap((node) => {
            if (existingNodeIds.has(node.id)) {
                // Reuse existing node
                nodeIdMap[node.id] = node.id
                return []
            } else {
                const newId = `m-${node.id}`
                nodeIdMap[node.id] = newId
                return [
                    {
                        ...node,
                        id: newId,
                        position: {
                            x: node.position.x + 400,
                            y: node.position.y,
                        },
                    },
                ]
            }
        })

        const existingEdgePairs = new Set(
            edges1.map((e) => `${e.source}->${e.target}`)
        )

        const shiftedEdges = edges2.flatMap((edge) => {
            const newSource = nodeIdMap[edge.source] || edge.source
            const newTarget = nodeIdMap[edge.target] || edge.target
            const edgeKey = `${newSource}->${newTarget}`

            if (existingEdgePairs.has(edgeKey)) {
                return []
            }

            existingEdgePairs.add(edgeKey)
            return [
                {
                    ...edge,
                    id: `m-${edge.id}`,
                    source: newSource,
                    target: newTarget,
                },
            ]
        })

        const merged = createCanvas(`merged-${id1}-${id2}`)
        merged.nodes = [...nodes1, ...shiftedNodes]
        merged.edges = [...edges1, ...shiftedEdges]

        const newCanvas = createCanvas(`canvas-${Date.now()}`)
        setCanvases([merged, newCanvas])
        setFocusedId(merged.id)
        setSelectedIds([])
        setMergeMode(false)
    }

    const applyLayout = async (layout, nodes, edges) => {
        if (layout === 'default') {
            return { nodes, edges }
        } else if (layout === 'force') {
            const layoutedNodes = computeForceLayout(nodes, edges)
            return { nodes: layoutedNodes, edges: edges }
        } else if (layout === 'hierarchical-lr') {
            const layoutedNodes = dagreLayout(nodes, edges, 'LR')
            return { nodes: layoutedNodes, edges: edges }
        } else if (layout === 'hierarchical-bt') {
            const layoutedNodes = dagreLayout(nodes, edges, 'TB')
            return { nodes: layoutedNodes, edges: edges }
        } else if (layout === 'mrtree') {
            const { nodes: layoutedNodes } = await applyElkLayout(
                nodes,
                edges,
                'mrtree'
            )
            return { nodes: layoutedNodes, edges: edges }
        } else if (layout == 'box') {
            const { nodes: layoutedNodes } = await applyElkLayout(
                nodes,
                edges,
                'box'
            )
            return { nodes: layoutedNodes, edges: edges }
        } else if (layout == 'rectpacking') {
            const { nodes: layoutedNodes } = await applyElkLayout(
                nodes,
                edges,
                'rectpacking'
            )
            return { nodes: layoutedNodes, edges: edges }
        } else if (layout == 'stress') {
            const { nodes: layoutedNodes } = await applyElkLayout(
                nodes,
                edges,
                'stress'
            )
            return { nodes: layoutedNodes, edges: edges }
        } else if (layout == 'force-elkjs') {
            const { nodes: layoutedNodes } = await applyElkLayout(
                nodes,
                edges,
                'force'
            )
            return { nodes: layoutedNodes, edges: edges }
        } else if (layout === 'dot') {
            const graphVizNodes = await applyGraphvizLayout(nodes, edges, 'dot')
            return { nodes: graphVizNodes, edges: edges }
        } else if (layout === 'fdp') {
            const graphVizNodes = await applyGraphvizLayout(nodes, edges, 'fdp')
            return { nodes: graphVizNodes, edges: edges }
        } else if (layout === 'sfdp') {
            const graphVizNodes = await applyGraphvizLayout(
                nodes,
                edges,
                'sfdp'
            )
            return { nodes: graphVizNodes, edges: edges }
        } else if (layout === 'neato') {
            const graphVizNodes = await applyGraphvizLayout(
                nodes,
                edges,
                'neato'
            )
            return { nodes: graphVizNodes, edges: edges }
        } else if (layout === 'twopi') {
            const graphVizNodes = await applyGraphvizLayout(
                nodes,
                edges,
                'twopi'
            )
            return { nodes: graphVizNodes, edges: edges }
        } else if (layout === 'circo') {
            const graphVizNodes = await applyGraphvizLayout(
                nodes,
                edges,
                'circo'
            )
            return { nodes: graphVizNodes, edges: edges }
        }
    }

    const exportSelectedToolFile = async () => {
        if (!focusedId) return toast.error('Please select a canvas')
        const target = canvases.find((c) => c.id === focusedId)
        const nodes = target?.ref.current?.getCurrentNodes()
        const edges = target?.ref.current?.getCurrentEdges()
        const finalModelData = {}
        Object.keys(modelData).map(
            (path) =>
                (finalModelData[path] = {
                    currency_edges: [],
                    edges: [],
                    enzymes: {},
                    metabolites: {},
                    genes: {},
                    enzyme_crossref: {},
                })
        )

        Object.entries(modelData).map(([path, obj]) => {
            const pathObj = modelData[path] // from the old one
            const newPathObj = finalModelData[path] // new path obj
            Object.entries(pathObj).map(([enzyme, enzObj]) => {
              
                newPathObj.edges.push(...enzObj.edges)
                newPathObj.currency_edges.push(...enzObj.currency_edges)
                const lb = enzObj.bounds.lower || -1000.0
                const ub = enzObj.bounds.upper || 1000.0
                const desc = enzObj.description
                const subs = enzObj.subsystem
                newPathObj.enzymes[enzyme] = [
                    desc,
                    'Not calculated',
                    lb,
                    ub,
                    subs,
                ]
                Object.entries(enzObj.metabolites).map(([met, description]) => {
                    newPathObj.metabolites[met] = description
                })
                newPathObj.genes[enzyme] = enzObj.genes
                newPathObj.enzyme_crossref[enzyme] = {
                    BIGG: [],
                    EC: [],
                    KEGG: [],
                }
            })
        })
  
        const reactionIds = nodes
            .filter((node) => node.data?.type === 'reaction')
            .map((node) => node.id)
      
        let allCurrencyEdges = []

        for (const data of Object.values(finalModelData)) {
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
                toast.success(`File saved successfully`)
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

    const [windowHeight, setWindowHeight] = useState(window.innerHeight)

    useEffect(() => {
        const handleResize = () => setWindowHeight(window.innerHeight)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
        <div className="min-h-screen bg-stone-100 font-sans text-stone-800">
            <ModelHeader />
            <main className="mb-2 flex h-[calc(100vh-80px)] flex-col bg-stone-100">
                <ModelToolbar
                    selectedIds={selectedIds}
                    downloadGeneReactionMatrix={downloadGeneReactionMatrix}
                    handleMergeClick={handleMergeClick}
                    mergeSelected={mergeSelected}
                    addEdgeToFocused={addEdgeToFocused}
                    addNodeToFocused={addNodeToFocused}
                    handleAddFullReaction={handleAddFullReaction}
                    deleteReaction={deleteReaction}
                    handleGapFilling={handleGapFilling}
                    modelData={modelData}
                    handleDownloadEdgeList={handleDownloadEdgeList}
                    isDownloadingEdgeList={isDownloadingEdgeList}
                    exportSelectedToolFile={
                        exportSelectedToolFile
                    }
                    toolButtons={toolButtons}
                    visualizerRef={visualizerRef}
                    setIsOpenDownloadModal={setIsOpenDownloadModal}
                    setIsOpenFluxModal={setIsOpenFluxModal}
                    setIsOpenImageModal={setIsOpenImageModal}
                    handlePathwayAction={handlePathwayAction}
                    handleUndoMerge={handleUndoMerge}
                    isLoading={isLoading}
                    database={database}
                    isOpenSettings={isOpenSettings}
                    setIsOpenSettings={setIsOpenSettings}
                    handleResetFullReaction={handleResetFullReaction}
                    handleResetMissingReaction={handleResetMissingReaction}
                    handleResetSingleReaction={handleResetSingleReaction}
                />
                <FillMissingReaction
                    gapFillNodesForBackend={gapFillNodesForBackend}
                    isOpenGapFillModal={isOpenGapFillModal}
                    setIsOpenGapFillModal={setIsOpenGapFillModal}
                    setGapFillNodesForBackend={setGapFillNodesForBackend}
                    setStepFillMissingReaction={setStepFillMissingReaction}
                    stepFillMissingReaction={stepFillMissingReaction}
                    setGapFillingFullData={setGapFillingFullData}
                    gapFillingFullData={gapFillingFullData}
                    setSelectedEnzyme={setSelectedEnzyme}
                />
                <div className="relative flex-1 overflow-hidden px-6 py-4">
                    <div className="flex w-full flex-wrap gap-x-4 gap-y-6">
                        {canvases.map((canvas) => (
                            <div
                                key={canvas.id}
                                className="w-[calc(50%-0.5rem)]"
                            >
                                <div className="mb-2">
                                    <select
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={async (e) => {
                                            const newLayout = e.target.value
                                            setCanvases((prev) =>
                                                prev.map((c) =>
                                                    c.id === canvas.id
                                                        ? {
                                                              ...c,
                                                              layout: newLayout,
                                                          }
                                                        : c
                                                )
                                            )

                                            const ref = canvas.ref?.current
                                            if (
                                                !ref?.getCurrentNodes ||
                                                !ref?.getCurrentEdges
                                            )
                                                return

                                            const currentNodes =
                                                ref.getCurrentNodes()
                                            const currentEdges =
                                                ref.getCurrentEdges()

                                            const {
                                                nodes: newNodes,
                                                edges: newEdges,
                                            } = await applyLayout(
                                                newLayout,
                                                currentNodes,
                                                currentEdges
                                            )
                                            ref.updateLayout(newNodes, newEdges)
                                        }}
                                        value={canvas.layout}
                                        className="w-full cursor-pointer rounded-lg border border-gray-300 bg-gray-50 px-2 py-2 text-sm shadow-sm hover:bg-gray-100"
                                    >
                                        <option value="default">
                                            Default Layout
                                        </option>
                                        
                                        <option value="hierarchical-lr">
                                            Hierarchical LR
                                        </option>

                                        <option value="hierarchical-bt">
                                            Hierarchical BT
                                        </option>
                                        
                                        <option value="stress">
                                            Stress Layout
                                        </option>
                                        
                                        <option value="neato">
                                            Neato Layout
                                        </option>
                                        <option value="twopi">
                                            Twopi Layout
                                        </option>
                                        <option value="circo">
                                            Circo Layout
                                        </option>
                                    </select>
                                </div>

                                <div
                                    className={`rounded-lg border-2 bg-stone-100 shadow-sm transition-colors ${
                                        mergeMode
                                            ? selectedIds.includes(canvas.id)
                                                ? 'border-green-500'
                                                : 'border-gray-300'
                                            : focusedId === canvas.id
                                              ? 'border-blue-500'
                                              : 'border-gray-200'
                                    }`}
                                    onClick={() => handleCanvasClick(canvas.id)}
                                >
                                    {loadingCanvasId === canvas.id && (
                                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-stone-100/30 backdrop-blur-sm">
                                            {/* Text */}
                                            <span className="mb-3 text-lg font-semibold text-stone-700">
                                                Adding Reactions to Canvas
                                            </span>

                                            {/* Professional loader */}
                                            <div className="flex items-center space-x-2">
                                                <div
                                                    className="animate-bounceProfessional h-3 w-3 rounded-full bg-stone-500"
                                                    style={{
                                                        animationDelay: '0s',
                                                    }}
                                                ></div>
                                                <div
                                                    className="animate-bounceProfessional h-3 w-3 rounded-full bg-stone-500"
                                                    style={{
                                                        animationDelay: '0.2s',
                                                    }}
                                                ></div>
                                                <div
                                                    className="animate-bounceProfessional h-3 w-3 rounded-full bg-stone-500"
                                                    style={{
                                                        animationDelay: '0.4s',
                                                    }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}

                                    <BuilderEditor
                                        ref={canvas.ref}
                                        nodePositionCache={nodePositionCache}
                                        edgeHandleCache={edgeHandleCache}
                                        initialNodes={canvas.nodes}
                                        initialEdges={canvas.edges}
                                        height={windowHeight - 240}
                                        modelData={modelData}
                                        setModelData={setModelData}
                                        setIsOpenDownloadModal={
                                            setIsOpenDownloadModal
                                        }
                                        onNodeSelectAction={(node) => {
                                           
                                            if (node?.data?.color != 'orange') {
                                                toast.error(
                                                    'Please select a metabolite (orange color node)'
                                                )
                                                return
                                            }
                                            toast.success(
                                                `Selected node: ${node?.data?.abbreviation}`
                                            )
                                            setSelectedNode(node)
                                            setIsOpenSingleReactionModal(true)
                                            setStepSingleReaction('select')
                                            setSelectingActionNode(false)
                                        }}
                                        selectingActionNode={
                                            selectingActionNode
                                        }
                                        selectedPathways={[]}
                                        edgeThickness={edgeThickness}
                                        gapFillingMode={gapFillingMode}
                                        isOpenSettings={isOpenSettings}
                                        setIsOpenSettings={setIsOpenSettings}
                                        gapFillingNodes={gapFillingNodes}
                                        setGapFillingNodes={setGapFillingNodes}
                                        setGapFillingMode={setGapFillingMode}
                                        onGapFill={GapFill}
                                        setEdgeThickness={setEdgeThickness}
                                        circleSize={circleSize}
                                        setCircleSize={setCircleSize}
                                        boxSize={boxSize}
                                        setBoxSize={setBoxSize}
                                        textPosition={textPosition}
                                        setTextPosition={setTextPosition}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            {stepAddFullReaction === 'select-option' && (
                <section className="border-t border-stone-300 bg-white px-6 py-10 md:px-16">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex w-1/2 flex-col items-start justify-start gap-4 sm:flex-col sm:items-start md:flex-row md:items-center md:justify-start">
                            <h3 className="sm:ext-sm text-sm font-semibold text-stone-800 md:text-lg">
                                New Reactions for {query}
                            </h3>
                            <input
                                onChange={(e) => {
                                 
                                    setAFRkeyword(e.target.value)
                                }}
                                className="w-1/2 rounded-md border border-gray-300 bg-gray-100 p-2 text-sm transition-colors"
                                placeholder="Search by Abbreviation or description"
                            />
                        </div>
                        <span className="text-sm text-stone-500">
                            {
                                Object.keys(
                                    filteredAddFullReactionData || {}
                                ).filter(
                                    (enzyme) => !existingEnzymeIds.has(enzyme)
                                ).length
                            }{' '}
                            total reactions
                        </span>
                    </div>

                    <div className="mb-4 max-h-96 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 shadow-inner">
                        {Object.keys(filteredAddFullReactionData || {})
                            .length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                No reactions available for this metabolite.
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-stone-200 text-sm text-stone-800">
                                <thead className="sticky top-0 z-40 bg-stone-50 text-left text-stone-600">
                                    <tr>
                                        <th className="px-4 py-3">Select</th>
                                        <th className="px-4 py-3">Enzyme</th>
                                        <th className="px-4 py-3">
                                            Description
                                        </th>
                                        <th className="px-4 py-3">Reaction</th>
                                        <th className="px-4 py-3">
                                            Lower Bound
                                        </th>
                                        <th className="px-4 py-3">
                                            Upper Bound
                                        </th>
                                        <th className="px-4 py-3">Genes</th>
                                        <th className="px-4 py-3">Subsystem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.keys(filteredAddFullReactionData)
                                        .filter(
                                            (enzyme) =>
                                                !existingEnzymeIds.has(enzyme)
                                        )
                                        .map((enzyme) => (
                                            <tr
                                                key={enzyme}
                                                className={
                                                    newReactions.includes(
                                                        enzyme
                                                    )
                                                        ? 'bg-blue-100'
                                                        : 'hover:bg-blue-50'
                                                }
                                            >
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={newReactions.includes(
                                                            enzyme
                                                        )}
                                                        onChange={() =>
                                                            handleCheckboxAddReactions(
                                                                enzyme
                                                            )
                                                        }
                                                        className="scale-125 accent-blue-600"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-semibold">
                                                    {enzyme}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    {filteredAddFullReactionData?.[
                                                        enzyme
                                                    ]?.description ?? enzyme}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    {
                                                        filteredAddFullReactionData?.[
                                                            enzyme
                                                        ]?.reaction
                                                    }
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        defaultValue={-1000}
                                                        placeholder="-1000"
                                                        type="number"
                                                        className="w-24 rounded border border-stone-300 px-1 py-1 text-sm"
                                                        value={
                                                            reactionBounds[
                                                                enzyme
                                                            ]?.lower !==
                                                            undefined
                                                                ? reactionBounds[
                                                                      enzyme
                                                                  ].lower
                                                                : ''
                                                        }
                                                        onChange={(e) =>
                                                            setReactionBounds(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]: {
                                                                        ...(prev[
                                                                            enzyme
                                                                        ] ||
                                                                            {}),
                                                                        lower: parseFloat(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        ),
                                                                    },
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            !newReactions.includes(
                                                                enzyme
                                                            )
                                                        }
                                                    />
                                                </td>

                                                {/* Upper bound */}
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="number"
                                                        defaultValue={1000}
                                                        placeholder="1000"
                                                        className="w-24 rounded border border-stone-300 px-1 py-1 text-sm"
                                                        value={
                                                            reactionBounds[
                                                                enzyme
                                                            ]?.upper !==
                                                            undefined
                                                                ? reactionBounds[
                                                                      enzyme
                                                                  ].upper
                                                                : ''
                                                        }
                                                        onChange={(e) =>
                                                            setReactionBounds(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]: {
                                                                        ...(prev[
                                                                            enzyme
                                                                        ] ||
                                                                            {}),
                                                                        upper: parseFloat(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        ),
                                                                    },
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            !newReactions.includes(
                                                                enzyme
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        disabled={
                                                            !newReactions.includes(
                                                                enzyme
                                                            )
                                                        }
                                                        value={
                                                            tempInput[enzyme] ??
                                                            fullReactionGenes[
                                                                enzyme
                                                            ]?.join(',') ??
                                                            ''
                                                        }
                                                        onChange={(e) => {
                                                            setTempInput(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        e.target
                                                                            .value,
                                                                })
                                                            )
                                                        }}
                                                        onBlur={() => {
                                                            // split into array when the user leaves the input
                                                            const valuesArray =
                                                                (
                                                                    tempInput[
                                                                        enzyme
                                                                    ] || ''
                                                                )
                                                                    .split(',')
                                                                    .map((v) =>
                                                                        v.trim()
                                                                    )
                                                                    .filter(
                                                                        (v) =>
                                                                            v !==
                                                                            ''
                                                                    )
                                                            setFullReactionGenes(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        valuesArray,
                                                                })
                                                            )
                                                            setTempInput(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        undefined,
                                                                })
                                                            )
                                                        }}
                                                        className="w-24 rounded border border-stone-300 px-1 py-1 text-sm"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        className="mb-1 w-52 rounded border border-stone-300 px-1 py-1 text-sm"
                                                        value={
                                                            reactionSubsystems[
                                                                enzyme
                                                            ] || ''
                                                        }
                                                        onChange={(e) =>
                                                            setReactionSubsystems(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        e.target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            !newReactions.includes(
                                                                enzyme
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            -- Select existing
                                                            subsystem --
                                                        </option>
                                                        {existingSubsystems.map(
                                                            (subsys) => (
                                                                <option
                                                                    key={subsys}
                                                                    value={
                                                                        subsys
                                                                    }
                                                                >
                                                                    {subsys}
                                                                </option>
                                                            )
                                                        )}
                                                    </select>

                                                    <input
                                                        type="text"
                                                        className="w-full rounded border border-stone-300 px-1 py-1 text-sm"
                                                        placeholder="Or enter new subsystem"
                                                        value={
                                                            reactionSubsystems[
                                                                enzyme
                                                            ] || ''
                                                        }
                                                        onChange={(e) =>
                                                            setReactionSubsystems(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        e.target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            !newReactions.includes(
                                                                enzyme
                                                            )
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className="mb-2 flex items-center justify-between">
                        <button
                            onClick={() => {
                                if (!focusedId)
                                    return toast.error('Please select a canvas')
                                
                                setStepAddFullReaction('select')
                                handleSubmitNewEdges(focusedId)
                            }}
                            className="rounded-lg bg-indigo-600 px-2 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                            disabled={newReactions.length === 0}
                        >
                            Add Reaction to Pathway
                        </button>
                        <span className="text-sm text-green-500">
                            {newReactions.length} selected reactions
                        </span>
                    </div>
                </section>
            )}
            {stepFillMissingReaction === 'select-option' && (
                <section className="border-t border-stone-300 bg-white px-6 py-10 md:px-16">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex w-3/4 flex-col items-start justify-start gap-4 sm:flex-col sm:items-start md:flex-row md:items-center md:justify-start">
                            <h3 className="text-sm font-semibold text-stone-800 md:text-lg">
                                Possible reactions between{' '}
                                {gapFillNodesForBackend[0]?.data?.abbreviation}{' '}
                                and{' '}
                                {gapFillNodesForBackend[1]?.data?.abbreviation}
                            </h3>
                            <input
                                onChange={(e) =>
                                    setGapFillingKeyword(e.target.value)
                                }
                                className="w-1/2 rounded-md border border-gray-300 bg-gray-100 p-2 text-sm transition-colors"
                                placeholder="Search by Abbreviation or description"
                            />
                        </div>
                        <span className="text-sm text-stone-500">
                            {
                                Object.keys(
                                    filteredGapFillingData || {}
                                ).filter(
                                    (enzyme) => !existingEnzymeIds.has(enzyme)
                                ).length
                            }{' '}
                            total reactions
                        </span>
                    </div>
                    <div className="mb-4 max-h-96 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 shadow-inner">
                        <table className="min-w-full divide-y divide-stone-200 text-sm text-stone-800">
                            <thead className="sticky top-0 z-40 bg-stone-50 text-left text-stone-600">
                                <tr>
                                    <th className="px-4 py-3 text-left">
                                        Select
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Enzyme
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Description
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Reaction
                                    </th>
                                    <th className="px-4 py-3">Lower Bound</th>
                                    <th className="px-4 py-3">Upper Bound</th>
                                    <th className="px-4 py-3">Genes</th>
                                    <th className="px-4 py-3 text-left">
                                        Subsystem
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.keys(
                                    filteredGapFillingData || {}
                                ).filter(
                                    (enzyme) => !existingEnzymeIds.has(enzyme)
                                ).length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="4"
                                            className="px-4 py-6 text-center text-gray-500"
                                        >
                                            No reactions available for the
                                            selected metabolites.
                                        </td>
                                    </tr>
                                ) : (
                                    Object.keys(filteredGapFillingData)
                                        .filter(
                                            (enzyme) =>
                                                !existingEnzymeIds.has(enzyme)
                                        )
                                        .map((enzyme) => (
                                            <tr
                                                key={enzyme}
                                                className={`transition-colors ${
                                                    selectedEnzyme === enzyme
                                                        ? 'bg-blue-100'
                                                        : 'hover:bg-blue-50'
                                                }`}
                                            >
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        name="enzyme-selection"
                                                        value={enzyme}
                                                        checked={
                                                            selectedEnzyme ===
                                                            enzyme
                                                        }
                                                        className="scale-125 accent-blue-600"
                                                        onChange={() => {
                                                            if (
                                                                selectedEnzyme ===
                                                                enzyme
                                                            ) {
                                                                setSelectedEnzyme(
                                                                    ''
                                                                )
                                                                setGapFillBounds(
                                                                    (prev) => {
                                                                        const updated =
                                                                            {
                                                                                ...prev,
                                                                            }
                                                                        delete updated[
                                                                            enzyme
                                                                        ]
                                                                        return updated
                                                                    }
                                                                )
                                                            } else {
                                                                setSelectedEnzyme(
                                                                    enzyme
                                                                )
                                                                setGapFillBounds(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        [enzyme]:
                                                                            {
                                                                                lower: '',
                                                                                upper: '',
                                                                            },
                                                                    })
                                                                )
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-semibold">
                                                    {enzyme}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    {filteredGapFillingData?.[
                                                        enzyme
                                                    ]?.description ?? enzyme}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    {
                                                        filteredGapFillingData?.[
                                                            enzyme
                                                        ]?.reaction
                                                    }
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        defaultValue={-1000}
                                                        placeholder="-1000"
                                                        type="number"
                                                        value={
                                                            gapFillBounds[
                                                                enzyme
                                                            ]?.lower ?? ''
                                                        }
                                                        onChange={(e) =>
                                                            setGapFillBounds(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]: {
                                                                        ...prev[
                                                                            enzyme
                                                                        ],
                                                                        lower: e
                                                                            .target
                                                                            .value,
                                                                    },
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            selectedEnzyme !==
                                                            enzyme
                                                        }
                                                        className={`w-20 rounded border px-2 py-1 text-sm ${
                                                            selectedEnzyme !==
                                                            enzyme
                                                                ? 'bg-gray-200'
                                                                : 'bg-white'
                                                        }`}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        defaultValue={1000}
                                                        placeholder="1000"
                                                        value={
                                                            gapFillBounds[
                                                                enzyme
                                                            ]?.upper ?? ''
                                                        }
                                                        onChange={(e) =>
                                                            setGapFillBounds(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]: {
                                                                        ...prev[
                                                                            enzyme
                                                                        ],
                                                                        upper: e
                                                                            .target
                                                                            .value,
                                                                    },
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            selectedEnzyme !==
                                                            enzyme
                                                        }
                                                        className={`w-20 rounded border px-2 py-1 text-sm ${
                                                            selectedEnzyme !==
                                                            enzyme
                                                                ? 'bg-gray-200'
                                                                : 'bg-white'
                                                        }`}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        disabled={
                                                            selectedEnzyme !==
                                                            enzyme
                                                        }
                                                        value={
                                                            tempInput[enzyme] ??
                                                            gapFillingGenes[
                                                                enzyme
                                                            ]?.join(',') ??
                                                            ''
                                                        }
                                                        onChange={(e) => {
                                                            setTempInput(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        e.target
                                                                            .value,
                                                                })
                                                            )
                                                        }}
                                                        onBlur={() => {
                                                            // split into array when the user leaves the input
                                                            const valuesArray =
                                                                (
                                                                    tempInput[
                                                                        enzyme
                                                                    ] || ''
                                                                )
                                                                    .split(',')
                                                                    .map((v) =>
                                                                        v.trim()
                                                                    )
                                                                    .filter(
                                                                        (v) =>
                                                                            v !==
                                                                            ''
                                                                    )
                                                            setGapFillingGenes(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        valuesArray,
                                                                })
                                                            )
                                                            setTempInput(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        undefined,
                                                                })
                                                            )
                                                        }}
                                                        className="w-24 rounded border border-stone-300 px-1 py-1 text-sm"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        className="mb-1 w-full rounded border border-stone-300 px-1 py-1 text-sm"
                                                        value={
                                                            gapFillSubsystems[
                                                                enzyme
                                                            ] || ''
                                                        }
                                                        onChange={(e) =>
                                                            setGapFillSubsystems(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        e.target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            selectedEnzyme !==
                                                            enzyme
                                                        }
                                                    >
                                                        <option value="">
                                                            -- Select existing
                                                            subsystem --
                                                        </option>
                                                        {existingSubsystems.map(
                                                            (subsys) => (
                                                                <option
                                                                    key={subsys}
                                                                    value={
                                                                        subsys
                                                                    }
                                                                >
                                                                    {subsys}
                                                                </option>
                                                            )
                                                        )}
                                                    </select>

                                                    <input
                                                        type="text"
                                                        className="w-full rounded border border-stone-300 px-1 py-1 text-sm"
                                                        placeholder="Or enter new subsystem"
                                                        value={
                                                            gapFillSubsystems[
                                                                enzyme
                                                            ] || ''
                                                        }
                                                        onChange={(e) =>
                                                            setGapFillSubsystems(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        e.target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            selectedEnzyme !==
                                                            enzyme
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer: Button + count */}
                    <div className="mb-2 flex items-center justify-between">
                        <button
                            onClick={() => {
                                if (!focusedId)
                                    return toast('Please select a canvas')
                                setStepFillMissingReaction('select')
                                handleAddMissingReaction(focusedId)
                            }}
                            className="rounded-lg bg-indigo-600 px-2 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                            disabled={selectedEnzyme.length === 0}
                        >
                            Add Reaction (s) to Canvas
                        </button>
                        <span className="text-sm text-green-500">
                            {selectedEnzyme ? 1 : 0} selected reaction
                        </span>
                    </div>
                </section>
            )}
            {stepAddSingleReaction === 'select-option' && (
                <section className="border-t border-stone-300 bg-white px-6 py-10 md:px-16">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex w-1/2 flex-col items-start justify-start gap-4 sm:flex-col sm:items-start md:flex-row md:items-center md:justify-start">
                            <h3 className="text-sm font-semibold text-stone-800 sm:text-sm md:text-lg">
                                New Reactions for{' '}
                                {selectedNode?.data?.abbreviation}
                            </h3>
                            <input
                                onChange={(e) =>
                                    setSingleReactionKeyword(e.target.value)
                                }
                                className="w-1/2 rounded-md border border-gray-300 bg-gray-100 p-2 text-sm transition-colors"
                                placeholder="Search by Abbreviation or description"
                            />
                        </div>
                        <span className="text-sm text-stone-500">
                            {
                                Object.keys(filteredSingleReactionData).filter(
                                    (enzyme) => !existingEnzymeIds.has(enzyme)
                                ).length
                            }{' '}
                            total reactions
                        </span>
                    </div>

                    <div className="mb-4 max-h-96 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 shadow-inner">
                        {Object.keys(filteredSingleReactionData || {}).filter(
                            (enzyme) => !existingEnzymeIds.has(enzyme)
                        ).length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                No reactions available for this metabolite.
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-stone-200 text-sm text-stone-800">
                                <thead className="sticky top-0 z-40 bg-stone-50 text-left text-stone-600">
                                    <tr>
                                        <th className="px-4 py-3">Select</th>
                                        <th className="px-4 py-3">Enzyme</th>
                                        <th className="px-4 py-3">
                                            Description
                                        </th>
                                        <th className="px-4 py-3">Reaction</th>
                                        <th className="px-4 py-3">
                                            Lower Bound
                                        </th>
                                        <th className="px-4 py-3">
                                            Upper Bound
                                        </th>
                                        <th className="px-4 py-3">Genes</th>
                                        <th className="px-4 py-3">Subsystem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.keys(filteredSingleReactionData)
                                        .filter(
                                            (enzyme) =>
                                                !existingEnzymeIds.has(enzyme)
                                        )
                                        .map((enzyme) => (
                                            <tr
                                                key={enzyme}
                                                className={
                                                    newSingleReactions.includes(
                                                        enzyme
                                                    )
                                                        ? 'bg-blue-100'
                                                        : 'hover:bg-blue-50'
                                                }
                                            >
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={newSingleReactions.includes(
                                                            enzyme
                                                        )}
                                                        onChange={() =>
                                                            handleCheckboxAddSingleReactions(
                                                                enzyme
                                                            )
                                                        }
                                                        className="scale-125 accent-blue-600"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-semibold">
                                                    {enzyme}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    {addSingleReactionData?.[
                                                        enzyme
                                                    ]?.description ?? enzyme}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    {
                                                        addSingleReactionData?.[
                                                            enzyme
                                                        ]?.reaction
                                                    }
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="number"
                                                        defaultValue={-1000}
                                                        placeholder="-1000"
                                                        className="w-24 rounded border border-stone-300 px-1 py-1 text-sm"
                                                        value={
                                                            singleReactionBounds[
                                                                enzyme
                                                            ]?.lower !==
                                                            undefined
                                                                ? singleReactionBounds[
                                                                      enzyme
                                                                  ].lower
                                                                : ''
                                                        }
                                                        onChange={(e) =>
                                                            setSingleReactionBounds(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]: {
                                                                        ...(prev[
                                                                            enzyme
                                                                        ] ||
                                                                            {}),
                                                                        lower: parseFloat(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        ),
                                                                    },
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            !newSingleReactions.includes(
                                                                enzyme
                                                            )
                                                        }
                                                    />
                                                </td>

                                                {/* Upper bound */}
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="number"
                                                        placeholder="1000"
                                                        defaultValue={1000}
                                                        className="w-24 rounded border border-stone-300 px-1 py-1 text-sm"
                                                        value={
                                                            singleReactionBounds[
                                                                enzyme
                                                            ]?.upper !==
                                                            undefined
                                                                ? singleReactionBounds[
                                                                      enzyme
                                                                  ].upper
                                                                : ''
                                                        }
                                                        onChange={(e) =>
                                                            setSingleReactionBounds(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]: {
                                                                        ...(prev[
                                                                            enzyme
                                                                        ] ||
                                                                            {}),
                                                                        upper: parseFloat(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        ),
                                                                    },
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            !newSingleReactions.includes(
                                                                enzyme
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        disabled={
                                                            !newSingleReactions.includes(
                                                                enzyme
                                                            )
                                                        }
                                                        value={
                                                            tempInput[enzyme] ??
                                                            singleReactionGenes[
                                                                enzyme
                                                            ]?.join(',') ??
                                                            ''
                                                        }
                                                        onChange={(e) => {
                                                            setTempInput(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        e.target
                                                                            .value,
                                                                })
                                                            )
                                                        }}
                                                        onBlur={() => {
                                                            // split into array when the user leaves the input
                                                            const valuesArray =
                                                                (
                                                                    tempInput[
                                                                        enzyme
                                                                    ] || ''
                                                                )
                                                                    .split(',')
                                                                    .map((v) =>
                                                                        v.trim()
                                                                    )
                                                                    .filter(
                                                                        (v) =>
                                                                            v !==
                                                                            ''
                                                                    )
                                                            setSingleReactionGenes(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        valuesArray,
                                                                })
                                                            )
                                                            setTempInput(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        undefined,
                                                                })
                                                            )
                                                        }}
                                                        className="w-24 rounded border border-stone-300 px-1 py-1 text-sm"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        className="mb-1 w-full rounded border border-stone-300 px-1 py-1 text-sm"
                                                        value={
                                                            singlereactionSubsystems[
                                                                enzyme
                                                            ] || ''
                                                        }
                                                        onChange={(e) =>
                                                            setSingleReactionSubsystems(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        e.target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            !newSingleReactions.includes(
                                                                enzyme
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            -- Select existing
                                                            subsystem --
                                                        </option>
                                                        {existingSubsystems.map(
                                                            (subsys) => (
                                                                <option
                                                                    key={subsys}
                                                                    value={
                                                                        subsys
                                                                    }
                                                                >
                                                                    {subsys}
                                                                </option>
                                                            )
                                                        )}
                                                    </select>

                                                    <input
                                                        type="text"
                                                        className="w-full rounded border border-stone-300 px-1 py-1 text-sm"
                                                        placeholder="Or enter new subsystem"
                                                        value={
                                                            singlereactionSubsystems[
                                                                enzyme
                                                            ] || ''
                                                        }
                                                        onChange={(e) =>
                                                            setSingleReactionSubsystems(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [enzyme]:
                                                                        e.target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            !newSingleReactions.includes(
                                                                enzyme
                                                            )
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className="mb-2 flex items-center justify-between">
                        <button
                            onClick={() => {
                                if (!focusedId)
                                    return toast.error('Please select a canvas')
                               
                                setStepSingleReaction('select')
                                handleSubmitSingleReactionEdges(focusedId)
                            }}
                            className="rounded-lg bg-indigo-600 px-2 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                            disabled={newSingleReactions.length === 0}
                        >
                            Add Reaction to Pathway
                        </button>
                        <span className="text-sm text-green-500">
                            {newSingleReactions.length} selected reactions
                        </span>
                    </div>
                </section>
            )}
            

            <AddFullReaction
                isOpenAFRmodal={isOpenAFRmodal}
                setIsOpenAFRmodal={setIsOpenAFRmodal}
                setStepAddFullReaction={setStepAddFullReaction}
                stepAddFullReaction={stepAddFullReaction}
                setAddFullReactionData={setAddFullReactionData}
                query={query}
                setQuery={setQuery}
            />

            <DownloadModal
                isOpenDownloadModal={isOpenDownloadModal}
                setIsOpenDownloadModal={setIsOpenDownloadModal}
                setStepDownloadModal={setStepDownloadModal}
                stepDownloadModal={stepDownloadModal}
                modelData={modelData}
            />

            <FluxModelBuilder
                isOpenFluxModal={isOpenFluxModal}
                setIsOpenFluxModal={setIsOpenFluxModal}
                setStepFluxCalculation={setStepFluxCalculation}
                stepFluxCalculation={stepFluxCalculation}
                modelData={modelData}
            />
            <ExportAsImageModal
                isOpenImageModal={isOpenImageModal}
                setIsOpenImageModal={setIsOpenImageModal}
                visualizerRef={visualizerRef}
            />
            <AddSingleReaction
                isOpenSingleReactionModal={isOpenSingleReactionModal}
                setIsOpenSingleReactionModal={setIsOpenSingleReactionModal}
                selectedNode={selectedNode}
                setSelectedNode={setSelectedNode}
                setAddSingleReactionData={setAddSingleReactionData}
                setStepSingleReaction={setStepSingleReaction}
                stepAddSingleReaction={stepAddSingleReaction}
                addSingleReactionData={addSingleReactionData}
            />

            <ChooseDBmodal
                isOpenDBModal={isOpenDBModal}
                setIsOpenDBModal={setIsOpenDBModal}
            />

            <footer className="bg-stone-200 py-6 text-center text-sm text-stone-600">
                © 2025 NAViFluX, Biological Networks and Systems Biology Lab, IIT Hyderabad
                — All rights reserved.
            </footer>
        </div>
    )
}

export default ModelBuilder
