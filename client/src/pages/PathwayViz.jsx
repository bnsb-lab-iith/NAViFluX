import { Download, Plus } from 'lucide-react'
import { useVisualizerRef } from '../hooks/VisualizerRefContext'
import { useModel } from '../contexts/ModelContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import React from 'react'
import VisualizerHeader from '../features/pathway-visualizer/VisualizerHeader'
import FileUploadModal from '../features/pathway-visualizer/FileUploadModal'
import NetworkEditor from './../package/NetworkEditor'
import VizToolBar from '../features/pathway-visualizer/VizToolBar'
import { syncModelDataWithBatchOutput } from '../utils/syncModelDataWithBatchOutput'
import { computeForceLayout } from '../utils/computeForceLayout'
import { dagreLayout } from '../utils/dagreLayout'
import { applyElkLayout } from '../utils/elkjs_layout'
import { applyGraphvizLayout } from '../utils/applyGraphvizLayout'
import { generateReactFlowFromEdgeList } from '../utils/generateReactFlowFromEdgeList'
import ToolSection from '../ui/ToolSection'
import AddReaction from '../features/pathway-visualizer/AddReaction'
import FillMissingReaction from '../features/pathway-visualizer/FillMissingReaction'
import DownloadModal from '../features/pathway-visualizer/DownloadModal'
import FluxModal from '../features/pathway-visualizer/FluxModal'
import ExportAsImageModal from '../features/pathway-visualizer/ExportAsImageModal'
import MergeModal from '../features/pathway-visualizer/MergeModal'
import WeightFileUploadModal from '../features/pathway-visualizer/WeightFileUploadModal'
import CentralityModal from '../features/pathway-visualizer/CentralityModal'
import GSEAmodal from '../features/pathway-visualizer/GSEAmodal'
import CytoscapeComponent from 'react-cytoscapejs'
import FluxWeightFileUpload from '../features/pathway-visualizer/FluxWeightFileUpload'
import MetabolomicsFileUpload from '../features/pathway-visualizer/MetabolomicsFileUpload'
import ORAmodal from '../features/pathway-visualizer/ORAmodal'

const toolButtons = [
    {
        name: 'exportToolFile',
        label: 'NAViFluX File',
        icon: Download,
        variant: 'secondary',
    },
    {
        name: 'exportGraph',
        label: 'Cytoscape JSON',
        icon: Download,
        variant: 'secondary',
    },
    {
        name: 'downloadModel',
        label: 'Model',
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

function PathwayViz() {
    const visualizerRef = useVisualizerRef()
    const nodePositionCache = useRef({})
    const edgeHandleCache = useRef({})
    const undoStack = useRef([])
    const {
        selectedPathways,
        setSelectedPathways,
        pathwaysOpen,
        setPathwaysOpen,
        isLoadingModel,
        toggleDropdownPathways,
        handleCheckboxChangePathway,
        modelData,
        setModelData,
        uploadMode,
        batchOutput,
        setBatchOutput,
        layout,
        setLayout,
        setEdgeThickness,
        setCircleSize,
        setBoxSize,
        edgeThickness,
        circleSize,
        boxSize,
        setFontSize,
        fontSize,
        initialModelData,
        setInitialModelData,
        initialBatchOutputData,
        setInitialBatchOuptutData,
        database,
        colorAction,
        edgeFormat,
        setEdgeFormat,
    } = useModel()

    const existingEnzymes = new Set(
        modelData
            ? Object.values(modelData).flatMap((pathObj) =>
                  Object.keys(pathObj?.enzymes || {})
              )
            : []
    )

    const deleteReaction = () => {
        visualizerRef.current?.deleteModeNode()
    }

    function handleReset() {
        setModelData(JSON.parse(JSON.stringify(initialModelData)))
        toast.success('Reverted to initial model state.')
        setBatchOutput(JSON.parse(JSON.stringify(initialBatchOutputData)))
    }

    const existingSubsystems = Array.from(new Set(Object.keys(modelData || {})))
    const [nodes, setNodes] = useState([])
    const [edges, setEdges] = useState([])
    const [isOpen, setIsOpen] = useState(false)
    const [isOpenFileModal, setIsOpenFileModal] = useState(false)
    const [minFlux, setMinFlux] = useState(-1000)
    const [maxFlux, setMaxFlux] = useState(1000)

    /// states for adding reaction
    const [selectingActionNode, setSelectingActionNode] = useState(false)
    const [selectedNode, setSelectedNode] = useState(null)
    const [addReaactionFullData, setAddReactionFullData] = useState(null)
    const [stepAddReaction, setStepAddReaction] = useState('select')
    const [newReactions, setNewReactions] = useState([])
    const [reactionBounds, setReactionBounds] = useState({})
    const [reactionSubsystems, setReactionSubsystems] = useState({})
    const [addReactionKeyword, setAddReactionKeyword] = useState('')

    const filteredAddReactionData = useMemo(() => {
        const keyword = addReactionKeyword.toLowerCase()

        // Split into multiple search terms (comma/space separated)
        const searchTerms = keyword
            .split(/[, ]+/)
            .map((s) => s.trim())
            .filter(Boolean)

        return Object.fromEntries(
            Object.entries(addReaactionFullData || {}).filter(
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
    }, [addReaactionFullData, addReactionKeyword])

    function handleSubmitNewEdges() {
        const updatedModelData = { ...modelData }

        const reactionList = {}
        newReactions.map((enz) => {
            const data = addReaactionFullData[enz]
            const bounds = reactionBounds[enz] || { lower: -1000, upper: 1000 }
            const subsystem =
                reactionSubsystems[enz] ||
                selectedNode?.temp_id?.split('__')[0] ||
                'Not Assigned'
            data.bounds = bounds
            data.subsystem = subsystem
            reactionList[enz] = data
        })

        Object.entries(reactionList).map(([enz, obj]) => {
            const pathway =
                obj.subsystem || selectedNode?.temp_id?.split('__')[0] || ''
            if (!updatedModelData[pathway]) {
                updatedModelData[pathway] = { edges: [], enzymes: {} }
            }

            const pathwayObj = updatedModelData[pathway]
            pathwayObj.edges = pathwayObj.edges || []
            pathwayObj.enzymes = pathwayObj.enzymes || {}
            pathwayObj.metabolites = pathwayObj.metabolites || {}
            pathwayObj.currency_edges = pathwayObj.currency_edges || []
            pathwayObj.stoichiometry = pathwayObj.stoichiometry || {}

            const dataToBeAdded = {}
            const data = addReaactionFullData[enz]
            dataToBeAdded[enz] = data

            Object.entries(dataToBeAdded || {}).forEach(([enzyme, data]) => {
                const bounds = reactionBounds?.[enzyme] || {}
                const lower = bounds.lower ?? -1000
                const upper = bounds.upper ?? 1000
                if (!pathwayObj.enzymes[enzyme]) {
                    pathwayObj.enzymes[enzyme] = [
                        data.description,
                        'Not Calculated',
                        lower,
                        upper,
                        pathway,
                    ]
                }

                if (!pathwayObj.genes[enzyme]) {
                    pathwayObj.genes[enzyme] = []
                }

                if (!pathwayObj.enzyme_crossref[enzyme]) {
                    pathwayObj.enzyme_crossref[enzyme] = {
                        BIGG: [],
                        EC: [],
                        KEGG: [],
                    }
                }

                pathwayObj.stoichiometry[enz] =
                    dataToBeAdded[enzyme]['stoichiometry']

                if (Array.isArray(data.edges)) {
                    pathwayObj.edges.push(...data.edges)

                    pathwayObj.currency_edges.push(...data.currency_edges)
                    Object.entries(data.metabolites || {}).forEach(
                        ([metId, metName]) => {
                            if (!(metId in pathwayObj.metabolites)) {
                                pathwayObj.metabolites[metId] = metName
                            }
                        }
                    )
                    // finalSelectionRxn[enzyme] = data.edges
                }
            })
        })

        setModelData(updatedModelData)
        setNewReactions([])
        setAddReactionFullData(null)
        setSelectedNode(null)
        setReactionSubsystems({})
        setLayout('default')
    }

    function resetAddReaction() {
        setNewReactions([])
        setAddReactionFullData(null)
        setSelectedNode(null)
        setReactionSubsystems({})
        setStepAddReaction('select')
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

    //////////// states for "filling missing reactions"
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
    const [gapfillingKeyword, setGapFillingKeyword] = useState('')

    const filteredGapFillingData = useMemo(() => {
        const keyword = gapfillingKeyword.toLowerCase()

        // Split into multiple search terms (comma or space separated)
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
    }, [gapFillingFullData, gapfillingKeyword])

    function handleAddMissingReaction(path) {
        const updatedModelData = { ...modelData }
        const pathway = path
        if (!updatedModelData[pathway]) {
            updatedModelData[pathway] = { edges: [], enzymes: {} }
        }
        const pathwayObj = updatedModelData[pathway]
        pathwayObj.edges = pathwayObj.edges || []
        pathwayObj.enzymes = pathwayObj.enzymes || {}
        pathwayObj.metabolites = pathwayObj.metabolites || {}
        pathwayObj.currency_edges = pathwayObj.currency_edges || []
        pathwayObj.stoichiometry = pathwayObj.stoichiometry || {}

        const dataToBeAdded = {}
        const data = gapFillingFullData[selectedEnzyme]
        dataToBeAdded[selectedEnzyme] = data
        Object.entries(dataToBeAdded || {}).forEach(([enzyme, data]) => {
            const lb =
                gapFillBounds[enzyme]?.lower === '' ||
                gapFillBounds[enzyme]?.lower == null
                    ? -1000
                    : parseFloat(gapFillBounds[enzyme].lower)
            const ub =
                gapFillBounds[enzyme]?.upper === '' ||
                gapFillBounds[enzyme]?.upper == null
                    ? 1000
                    : parseFloat(gapFillBounds[enzyme].upper)

            if (!pathwayObj.enzymes[enzyme]) {
                pathwayObj.enzymes[enzyme] = [
                    data.description,
                    'Not Calculated',
                    lb,
                    ub,
                    pathway,
                ]
            }

            if (!pathwayObj.genes[enzyme]) {
                pathwayObj.genes[enzyme] = []
            }

            if (!pathwayObj.enzyme_crossref[enzyme]) {
                pathwayObj.enzyme_crossref[enzyme] = {
                    BIGG: [],
                    EC: [],
                    KEGG: [],
                }
            }

            pathwayObj.stoichiometry[enzyme] =
                dataToBeAdded[enzyme]['stoichiometry']

            if (Array.isArray(data.edges)) {
                pathwayObj.edges.push(...data.edges)
                pathwayObj.currency_edges.push(...data.currency_edges)
                Object.entries(data.metabolites || {}).forEach(
                    ([metId, metName]) => {
                        if (!(metId in pathwayObj.metabolites)) {
                            pathwayObj.metabolites[metId] = metName
                        }
                    }
                )
            }
        })

        setModelData(updatedModelData)
        setSelectedEnzyme('')
        setStepFillMissingReaction('select')
        setGapFillNodesForBackend([])
        setGapFillingFullData(null)
        setLayout('default')
    }

    function resetFillMissingReaction() {
        setSelectedEnzyme('')
        setStepFillMissingReaction('select')
        setGapFillNodesForBackend([])
        setGapFillingFullData(null)
    }

    async function handleGapFilling() {
        setGapFillingMode(true)
        setGapFillingNodes([])
        setGapFillNodesForBackend([])

        toast('Select two metabolites (orange nodes) for gap filling')
    }

    function GapFill(selectedNodes) {
        setIsOpenGapFillModal(true)
        setStepAddReaction('select')
        setGapFillNodesForBackend(selectedNodes)
        setGapFillingFullData(null)
        setStepFluxCalculation('')
        setStepFillMissingReaction('select')
        toast.success(
            `Gap filling between ${selectedNodes[0].data.abbreviation} and ${selectedNodes[1].data.abbreviation}`
        )
    }

    /////////////////// for downloading model
    const [isOpenDownloadModal, setIsOpenDownloadModal] = useState(false)
    const [stepDownloadModal, setStepDownloadModal] = useState('preview')
    const [isOpenSettings, setIsOpenSettings] = useState(false)
    const [isDownloadingEdgeList, setIsDownloadingEdgeList] = useState(false)
    const [isOpenFluxWeightFileModal, setIsOpenFluxWeightModal] =
        useState(false)
    const [stepFluxCalculation, setStepFluxCalculation] = useState('')
    const [isOpenFluxModal, setIsOpenFluxModal] = useState(false)
    const [isOpenImageModal, setIsOpenImageModal] = useState(false)
    const [reactionBoundsFlux, setReactionBoundsFlux] = useState({})
    const [fluxKeyword, setFluxKeyword] = useState('')

    const stoichToReactionString = (stoichObj, precision = 3) => {
        if (!stoichObj || typeof stoichObj !== 'object') return ''

        const reactants = []
        const products = []

        Object.entries(stoichObj).forEach(([met, coeff]) => {
            if (coeff === 0) return

            const abs = Math.abs(coeff)
            const formattedCoeff =
                abs === 1 ? '' : Number(abs.toFixed(precision)) + ' '

            const term = `${formattedCoeff}${met}`

            if (coeff < 0) reactants.push(term)
            else products.push(term)
        })

        return `${reactants.join(' + ')} <==> ${products.join(' + ')}`
    }

    const filteredModelData = useMemo(() => {
        if (modelData === null) return
        const keyword = fluxKeyword.toLowerCase().trim()
        console.log(modelData)
        const allEnzymes = Object.entries(modelData).flatMap(
            ([pathway, pathObj]) =>
                Object.entries(pathObj.enzymes).map(([enzyme, enzArr]) => ({
                    enzyme,
                    description: enzArr?.[0] || '',
                    pathway,
                    bounds: [enzArr?.[2], enzArr?.[3]],
                    reaction: stoichToReactionString(
                        pathObj.stoichiometry?.[enzyme]
                    ),
                }))
        )

        if (!keyword) return allEnzymes

        const searchTerms = keyword
            .split(/[, ]+/)
            .map((s) => s.trim())
            .filter(Boolean)

        return allEnzymes.filter(({ enzyme, description, pathway }) => {
            const p = pathway.toLowerCase()
            const e = enzyme.toLowerCase()
            const d = description.toLowerCase()

            return searchTerms.every(
                (term) =>
                    p.includes(term) || e.includes(term) || d.includes(term)
            )
        })
    }, [modelData, fluxKeyword])

    const [isOpenMetabolomicsModal, setIsOpenMetabolomicsModal] =
        useState(false)

    function handleFluxSubmit() {
        setStepFluxCalculation('select')
        setIsOpenFluxModal(true)
    }

    async function handleDownloadEdgeList() {
        try {
            setIsDownloadingEdgeList(true)

            const res = await fetch(
                'http://127.0.0.1:5000/api/v1/download-edge-lists',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ modelData }),
                }
            )

            const data = await res.json()
            if (data.status === 'error') throw new Error(data.message)

            const {
                reaction_network,
                metabolite_network,
                reaction_metabolite_network,
            } = data

            const formatEdges = (network) =>
                (network ?? [])
                    .map(([src, dst]) => `${src} - ${dst}`)
                    .join('\n')

            const zip = new JSZip()
            zip.file(
                'reaction_metabolite_network.txt',
                formatEdges(reaction_metabolite_network)
            )
            zip.file('reaction_network.txt', formatEdges(reaction_network))
            zip.file('metabolite_network.txt', formatEdges(metabolite_network))

            const content = await zip.generateAsync({ type: 'blob' })

            const fileName = 'edge-lists.zip'
            const a = document.createElement('a')
            a.href = URL.createObjectURL(content)
            a.download = fileName
            a.click()
            URL.revokeObjectURL(a.href) // cleanup

            toast.success(`${fileName} downloaded`)
        } catch (err) {
            console.error('Download failed:', err)
            toast.error(err.message)
        } finally {
            setIsDownloadingEdgeList(false)
        }
    }

    const toggleSelectAllPathways = () => {
        const allPathways = Object.keys(modelData || {})
        if (selectedPathways.length === allPathways.length) {
            // Deselect all
            setSelectedPathways([])
        } else {
            // Select all
            setSelectedPathways(allPathways)
        }
    }

    function handlePathwayAction() {
        toast('Please click a node to perform the action.')
        setSelectingActionNode(true)
    }

    const [showMergePrompt, setShowMergePrompt] = useState(false)
    const [newPathwayName, setNewPathwayName] = useState('')

    // state for adding weight files
    const [openWeightFileModal, setIsOpenWeightFileModal] = useState(false)
    const [isOpenCentralityModal, setIsOpenCentralityModel] = useState(false)
    const mergeObjects = (...objects) =>
        objects.reduce((acc, obj) => {
            for (const key in obj) {
                if (!acc[key]) {
                    acc[key] = obj[key]
                } else {
                    acc[key] = [...acc[key], ...obj[key]]
                }
            }
            return acc
        }, {})

    const handleMerge = () => {
        if (!newPathwayName.trim())
            return alert('Please enter a name for the new pathway.')

        undoStack.current.push({
            nodePositionCache: structuredClone(nodePositionCache.current),
            edgeHandleCache: structuredClone(edgeHandleCache.current),
            modelData: structuredClone(modelData),
            selectedPathways: [...selectedPathways],
        })

        const mergedNodes = selectedPathways.reduce((acc, p) => {
            return { ...acc, ...nodePositionCache.current[p] }
        }, {})

        // ✅ Merge all selected pathways' edges
        const mergedEdges = selectedPathways.reduce((acc, p) => {
            return { ...acc, ...edgeHandleCache.current[p] }
        }, {})

        // ✅ Remap node keys
        const finalNodes = Object.entries(mergedNodes).reduce(
            (acc, [path, obj]) => {
                const splitted = path.split('__')
                const finalKey = `${newPathwayName}__${splitted[1]}`
                acc[finalKey] = obj
                return acc
            },
            {}
        )

        // ✅ Remap edge keys
        const finalEdges = Object.entries(mergedEdges).reduce(
            (acc, [path, obj]) => {
                // const splitted = path.split('__')
                const further_split = path.split('-')
                const finalKey = `${further_split[0]}-${further_split[1]}`
                acc[finalKey] = obj
                return acc
            },
            {}
        )

        // Remove old entries
        selectedPathways.forEach((p) => {
            delete nodePositionCache.current[p]
            delete edgeHandleCache.current[p]
        })

        // Add merged entries
        nodePositionCache.current[newPathwayName] = finalNodes
        edgeHandleCache.current[newPathwayName] = finalEdges

        // ✅ Merge modelData for all selected pathways
        const merged = selectedPathways.reduce(
            (acc, p, idx) => {
                const pathwayData = modelData[p]

                acc.currency_edges = [
                    ...acc.currency_edges,
                    ...pathwayData.currency_edges,
                ]
                acc.edges = [...acc.edges, ...pathwayData.edges]
                if (Object.keys(acc.enzymes).length) {
                    acc.enzymes = mergeObjects(acc.enzymes, pathwayData.enzymes)
                } else {
                    acc.enzymes = { ...pathwayData.enzymes }
                }

                acc.enzymes = Object.fromEntries(
                    Object.entries(acc.enzymes).map(([enzyme, arr]) => {
                        const newArr = [...arr]
                        newArr[4] = newPathwayName
                        return [enzyme, newArr]
                    })
                )
                acc.metabolites = {
                    ...acc.metabolites,
                    ...pathwayData.metabolites,
                }
                acc.enzyme_crossref = {
                    ...acc.enzyme_crossref,
                    ...pathwayData.enzyme_crossref,
                }

                acc.stoichiometry = {
                    ...acc.stoichiometry,
                    ...pathwayData.stoichiometry,
                }

                return acc
            },
            {
                currency_edges: [],
                edges: [],
                enzymes: {},
                metabolites: {},
                enzyme_crossref: {},
                stoichiometry: {},
            }
        )

        setModelData((prev) => {
            const updated = { ...prev }
            selectedPathways.forEach((p) => delete updated[p])
            updated[newPathwayName] = merged
            return updated
        })

        setTimeout(() => {
            setSelectedPathways((prev) => {
                const updated = prev.filter(
                    (p) => !selectedPathways.includes(p)
                )
                return [...updated, newPathwayName]
            })
        }, 0)

        setShowMergePrompt(false)
    }

    const undoMerge = () => {
        if (undoStack.current.length === 0) {
            alert('Nothing to undo.')
            return
        }

        const lastState = undoStack.current.pop()

        nodePositionCache.current = lastState.nodePositionCache
        edgeHandleCache.current = lastState.edgeHandleCache
        setModelData(lastState.modelData)
        setSelectedPathways(lastState.selectedPathways)
    }

    //// states for GSEA
    const [isOpenGSEAmodal, setIsOpenGSEAmodal] = useState(false)
    const [stepGSEA, setStepGSEA] = useState('upload')
    const [gseaNodes, setGSEAnodes] = useState(null)
    const [gseaEdges, setGSEAedges] = useState(null)
    const [gseaTable, setGSEAtable] = useState(null)
    const [expandedRow, setExpandedRow] = useState(null)
    const [leadgenes, setLeadGenes] = useState(null)
    const [selectedColumn, setSelectedColumn] = useState('FDR q-val')

    const [isOpenORAmodal, setIsOpenORAmodal] = useState(false)

    function resetGSEA() {
        setGSEAtable(null)
        setGSEAnodes(null)
        setGSEAedges(null)
        setSelectedColumn('FDR q-val')
        setLeadGenes(null)
        setExpandedRow(null)
        setStepGSEA('upload')
    }

    const handleRowClick = (idx, genes) => {
        setExpandedRow((prev) => {
            const newExpanded = prev === idx ? null : idx
            setLeadGenes(newExpanded === null ? null : genes)
            return newExpanded
        })
    }

    // helper to get induced subgraph for given lead genes
    const getSubgraph = (leadGenes) => {
        const nodesSet = new Set(leadGenes)
        const subNodes = gseaNodes.filter((n) => nodesSet.has(n))
        const subEdges = gseaEdges.filter(
            (e) => nodesSet.has(e[0]) && nodesSet.has(e[1])
        )

        return { nodes: subNodes, edges: subEdges }
    }

    useEffect(() => {
        if (!modelData) return

        if (uploadMode === 'single') {
            const allFluxValues = []
            Object.values(modelData).forEach((pathway) => {
                Object.values(pathway.enzymes || {}).forEach(([_, flux]) => {
                    const val = parseFloat(flux)
                    if (!isNaN(val)) allFluxValues.push(val)
                })
            })

            const allMetabolomicsValues = []

            Object.values(modelData).forEach((pathway) => {
                const metabolites = pathway.metabolites || {}
                Object.values(metabolites).forEach((metArr) => {
                    // metArr is like ['Acetyl-CoA', 'C23H34N7O17P3S', 'Cytoplasm', [], 3771.55]
                    const val = metArr[metArr.length - 1] // last element
                    if (!isNaN(val)) allMetabolomicsValues.push(val)
                })
            })

            const min = Math.min(...allFluxValues)
            const max = Math.max(...allFluxValues)

            setMinFlux(min)
            setMaxFlux(max)
            const currentNodes =
                visualizerRef.current?.getCurrentNodes?.() || []
            const currentEdges =
                visualizerRef.current?.getCurrentEdges?.() || []

            // Save node positions pathway-wise
            currentNodes.forEach((node) => {
                const [pathway] = node.temp_id.split('__')
                if (!nodePositionCache.current[pathway]) {
                    nodePositionCache.current[pathway] = {}
                }
                nodePositionCache.current[pathway][node.temp_id] = node.position
            })

            // Save edge handle positions pathway-wise
            currentEdges.forEach((edge) => {
                const [sourcePathway] = edge.source_id.split('__')
                const [targetPathway] = edge.target_id.split('__')

                for (const pathway of new Set([sourcePathway, targetPathway])) {
                    if (!edgeHandleCache.current[pathway]) {
                        edgeHandleCache.current[pathway] = {}
                    }
                    const handleKey = `${edge.source}-${edge.target}`
                    edgeHandleCache.current[pathway][handleKey] = {
                        sourceHandle: edge.sourceHandle,
                        targetHandle: edge.targetHandle,
                    }
                }
            })

            // Prepare inputs
            const previousPositions = {}
            const edgeHandlePositions = {}

            selectedPathways.forEach((p) => {
                previousPositions[p] = nodePositionCache.current[p] || {}
                edgeHandlePositions[p] = edgeHandleCache.current[p] || {}
            })

            // Call the function
            const { nodes: newNodes, edges: newEdges } =
                generateReactFlowFromEdgeList(
                    selectedPathways,
                    modelData,
                    min,
                    max,
                    previousPositions,
                    edgeHandlePositions,
                    edgeThickness,
                    fontSize,
                    leadgenes,
                    colorAction,
                    allFluxValues,
                    edgeFormat,
                    allMetabolomicsValues
                )

            const applyLayout = async () => {
                if (layout === 'default') {
                    // NORMAL CASE
                    setNodes(newNodes)
                    setEdges(newEdges)
                } else if (layout === 'hierarchical-lr') {
                    // DAGRE HIERARCHICAL LR
                    const layoutedNodes = dagreLayout(newNodes, newEdges, 'LR') // 'TB' or 'LR'
                    setNodes(layoutedNodes)
                    setEdges(newEdges)
                } else if (layout === 'hierarchical-bt') {
                    // DAGRE HIERARCHICAL LR
                    const layoutedNodes = dagreLayout(newNodes, newEdges, 'TB') // 'TB' or 'LR'
                    setNodes(layoutedNodes)
                    setEdges(newEdges)
                } else if (layout === 'stress') {
                    const { nodes: layoutedNodes } = await applyElkLayout(
                        newNodes,
                        newEdges,
                        'stress'
                    )

                    setNodes(layoutedNodes)
                    setEdges(newEdges)
                } else if (layout === 'neato') {
                    const graphVizNodes = await applyGraphvizLayout(
                        newNodes,
                        newEdges,
                        'neato'
                    )

                    setNodes(graphVizNodes)
                    setEdges(newEdges)
                } else if (layout === 'twopi') {
                    const graphVizNodes = await applyGraphvizLayout(
                        newNodes,
                        newEdges,
                        'twopi'
                    )

                    setNodes(graphVizNodes)
                    setEdges(newEdges)
                } else if (layout === 'circo') {
                    const graphVizNodes = await applyGraphvizLayout(
                        newNodes,
                        newEdges,
                        'circo'
                    )

                    setNodes(graphVizNodes)
                    setEdges(newEdges)
                }
            }
            applyLayout()
        } else if (uploadMode === 'batch') {
            const currentNodes =
                visualizerRef.current?.getCurrentNodes?.() || []
            const currentEdges =
                visualizerRef.current?.getCurrentEdges?.() || []

            // Save node and edge data by unique ID (not relying on label)
            if (currentNodes.length > 0) {
                currentNodes.forEach((node) => {
                    const [pathway] = node.temp_id.split('__')
                    if (!nodePositionCache.current[pathway]) {
                        nodePositionCache.current[pathway] = {}
                    }
                    nodePositionCache.current[pathway][node.temp_id] =
                        node.position
                })
            }

            if (currentEdges.length > 0) {
                currentEdges.forEach((edge) => {
                    const [sourcePathway] = edge.source_id.split('__')
                    const [targetPathway] = edge.target_id.split('__')
                    const handleKey = `${edge.source}-${edge.target}`
                    const handleValue = {
                        sourceHandle: edge.sourceHandle,
                        targetHandle: edge.targetHandle,
                    }

                    // Save under source pathway
                    if (!edgeHandleCache.current[sourcePathway]) {
                        edgeHandleCache.current[sourcePathway] = {}
                    }
                    edgeHandleCache.current[sourcePathway][handleKey] =
                        handleValue

                    // Save under target pathway if different
                    if (targetPathway !== sourcePathway) {
                        if (!edgeHandleCache.current[targetPathway]) {
                            edgeHandleCache.current[targetPathway] = {}
                        }
                        edgeHandleCache.current[targetPathway][handleKey] =
                            handleValue
                    }
                })
            }

            const allFluxValues = []
            Object.values(modelData).forEach((pathway) => {
                Object.values(pathway.enzymes || {}).forEach(([_, flux]) => {
                    const val = parseFloat(flux)
                    if (!isNaN(val)) allFluxValues.push(val)
                })
            })

            const min = Math.min(...allFluxValues)
            const max = Math.max(...allFluxValues)

            const allMetabolomicsValues = []

            Object.values(modelData).forEach((pathway) => {
                const metabolites = pathway.metabolites || {}
                Object.values(metabolites).forEach((metArr) => {
                    // metArr is like ['Acetyl-CoA', 'C23H34N7O17P3S', 'Cytoplasm', [], 3771.55]
                    const val = metArr[metArr.length - 1] // last element
                    if (!isNaN(val)) allMetabolomicsValues.push(val)
                })
            })

            setMinFlux(min)
            setMaxFlux(max)

            const { nodes: newNodes, edges: newEdges } =
                syncModelDataWithBatchOutput(
                    modelData,
                    batchOutput,
                    selectedPathways,
                    nodePositionCache.current,
                    edgeHandleCache.current,
                    edgeThickness,
                    // fontSize,
                    colorAction,
                    min,
                    max,
                    edgeFormat,
                    allMetabolomicsValues
                )

            const applyLayout = async () => {
                if (layout === 'default') {
                    // NORMAL CASE

                    setNodes(newNodes)
                    setEdges(newEdges)
                } else if (layout === 'hierarchical-lr') {
                    // DAGRE HIERARCHICAL LR
                    const layoutedNodes = dagreLayout(newNodes, newEdges, 'LR') // 'TB' or 'LR'
                    setNodes(layoutedNodes)
                    setEdges(newEdges)
                } else if (layout === 'hierarchical-bt') {
                    // DAGRE HIERARCHICAL LR
                    const layoutedNodes = dagreLayout(newNodes, newEdges, 'TB') // 'TB' or 'LR'
                    setNodes(layoutedNodes)
                    setEdges(newEdges)
                } else if (layout === 'stress') {
                    const { nodes: layoutedNodes } = await applyElkLayout(
                        newNodes,
                        newEdges,
                        'stress'
                    )

                    setNodes(layoutedNodes)
                    setEdges(newEdges)
                } else if (layout === 'neato') {
                    const graphVizNodes = await applyGraphvizLayout(
                        newNodes,
                        newEdges,
                        'neato'
                    )

                    setNodes(graphVizNodes)
                    setEdges(newEdges)
                } else if (layout === 'twopi') {
                    const graphVizNodes = await applyGraphvizLayout(
                        newNodes,
                        newEdges,
                        'twopi'
                    )

                    setNodes(graphVizNodes)
                    setEdges(newEdges)
                } else if (layout === 'circo') {
                    const graphVizNodes = await applyGraphvizLayout(
                        newNodes,
                        newEdges,
                        'circo'
                    )

                    setNodes(graphVizNodes)
                    setEdges(newEdges)
                }
            }
            applyLayout()
        }
    }, [selectedPathways, modelData, uploadMode, layout])

    const [windowHeight, setWindowHeight] = useState(window.innerHeight)

    useEffect(() => {
        const handleResize = () => setWindowHeight(window.innerHeight)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
        <div className="min-h-screen bg-stone-100 font-sans text-stone-800">
            <VisualizerHeader />
            <main className="mb-2 flex h-screen flex-col bg-white">
                <VizToolBar
                    deleteReaction={deleteReaction}
                    layout={layout}
                    setLayout={setLayout}
                    toolButtons={toolButtons}
                    modelData={modelData}
                    visualizerRef={visualizerRef}
                    setIsOpenFileModal={setIsOpenFileModal}
                    minFlux={minFlux}
                    maxFlux={maxFlux}
                    pathwaysOpen={pathwaysOpen}
                    setPathwaysOpen={setPathwaysOpen}
                    selectedPathways={selectedPathways}
                    toggleDropdownPathways={toggleDropdownPathways}
                    toggleSelectAllPathways={toggleSelectAllPathways}
                    handleCheckboxChangePathway={handleCheckboxChangePathway}
                    handlePathwayAction={handlePathwayAction}
                    handleDownloadEdgeList={handleDownloadEdgeList}
                    handleGapFilling={handleGapFilling}
                    setIsOpenSettings={setIsOpenSettings}
                    isOpenSettings={isOpenSettings}
                    isDownloadingEdgeList={isDownloadingEdgeList}
                    setIsOpenFluxModal={setIsOpenFluxModal}
                    setIsOpenImageModal={setIsOpenImageModal}
                    setShowMergePrompt={setShowMergePrompt}
                    setIsOpenWeightFileModal={setIsOpenWeightFileModal}
                    setIsOpenFluxWeightModal={setIsOpenFluxWeightModal}
                    setIsOpenCentralityModel={setIsOpenCentralityModel}
                    setIsOpenMetabolomicsModal={setIsOpenMetabolomicsModal}
                    handleReset={handleReset}
                    undoMerge={undoMerge}
                    setIsOpenGSEAmodal={setIsOpenGSEAmodal}
                    setStepGSEA={setStepGSEA}
                    stepGSEA={stepGSEA}
                    setLeadGenes={setLeadGenes}
                    setSelectedColumn={setSelectedColumn}
                    setStepFluxCalculation={setStepFluxCalculation}
                    uploadMode={uploadMode}
                    resetAddReaction={resetAddReaction}
                    resetFillMissingReaction={resetFillMissingReaction}
                    resetGSEA={resetGSEA}
                    isOpenORAmodal={isOpenORAmodal}
                    setIsOpenORAmodal={setIsOpenORAmodal}
                />
                <div className="overflow-hidden px-6">
                    <NetworkEditor
                        height={windowHeight - 240}
                        ref={visualizerRef}
                        selectedPathways={selectedPathways}
                        nodePositionCache={nodePositionCache}
                        edgeHandleCache={edgeHandleCache}
                        modelData={modelData}
                        setModelData={setModelData}
                        initialNodes={nodes}
                        initialEdges={edges}
                        onNodeSelectAction={(node) => {
                            if (node?.data?.type != 'metabolite') {
                                toast.error(
                                    'Please select a metabolite (orange color node)'
                                )
                                return
                            }
                            toast.success(
                                `Selected node: ${node?.data?.abbreviation}`
                            )
                            setSelectedNode(node)
                            setIsOpen(true)
                            setStepFluxCalculation('')
                            setStepAddReaction('select')
                            setSelectingActionNode(false)
                        }}
                        selectingActionNode={selectingActionNode}
                        gapFillingMode={gapFillingMode}
                        gapFillingNodes={gapFillingNodes}
                        setGapFillingNodes={setGapFillingNodes}
                        setGapFillingMode={setGapFillingMode}
                        onGapFill={GapFill}
                        setIsOpenDownloadModal={setIsOpenDownloadModal}
                        setEdgeThickness={setEdgeThickness}
                        setFontSize={setFontSize}
                        fontSize={fontSize}
                        setCircleSize={setCircleSize}
                        setBoxSize={setBoxSize}
                        edgeThickness={edgeThickness}
                        circleSize={circleSize}
                        boxSize={boxSize}
                        isOpenSettings={isOpenSettings}
                        setIsOpenSettings={setIsOpenSettings}
                        setLayout={setLayout}
                    />
                </div>
            </main>
            {stepFluxCalculation === 'set-bounds' && (
                <section className="border-t border-stone-300 bg-white px-6 py-10 md:px-16">
                    {(() => {
                        return (
                            <>
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex gap-4">
                                        <h3 className="text-lg font-semibold text-stone-800">
                                            Set Parameters For model associated
                                            Reactions
                                        </h3>
                                        <input
                                            onChange={(e) =>
                                                setFluxKeyword(e.target.value)
                                            }
                                            className="w-1/4 rounded-md border border-gray-300 bg-gray-100 p-2 text-sm transition-colors"
                                            placeholder="Search by Abbreviation or description"
                                        />
                                    </div>
                                    <span className="text-sm text-stone-500">
                                        {filteredModelData.length} total
                                        reactions
                                    </span>
                                </div>
                                <div className="mb-4 max-h-96 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 shadow-inner">
                                    <table className="min-w-full divide-y divide-stone-200 text-sm text-stone-800">
                                        <thead className="sticky top-0 z-50 bg-stone-100 text-left text-stone-600">
                                            <tr>
                                                <th className="px-4 py-3 text-left">
                                                    Enzyme
                                                </th>
                                                <th className="px-4 py-3 text-left">
                                                    Reaction
                                                </th>
                                                <th className="px-4 py-3 text-left">
                                                    Description
                                                </th>
                                                <th className="px-4 py-3 text-left">
                                                    Pathway
                                                </th>
                                                <th className="px-4 py-3">
                                                    Lower Bound
                                                </th>
                                                <th className="px-4 py-3">
                                                    Upper Bound
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredModelData.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan="5"
                                                        className="px-4 py-6 text-center text-gray-500"
                                                    >
                                                        No reactions available
                                                        for the selected
                                                        metabolites.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredModelData.map(
                                                    (obj, idx) => (
                                                        <tr
                                                            key={idx}
                                                            className="transition-colors hover:bg-blue-50"
                                                        >
                                                            <td className="px-4 py-3">
                                                                {obj.enzyme}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {obj.reaction}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {
                                                                    obj.description
                                                                }
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {obj.pathway}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="number"
                                                                    onChange={(
                                                                        e
                                                                    ) => {
                                                                        const val =
                                                                            e
                                                                                .target
                                                                                .value // keep as string
                                                                        setReactionBoundsFlux(
                                                                            (
                                                                                prev
                                                                            ) => ({
                                                                                ...prev,
                                                                                [obj.enzyme]:
                                                                                    {
                                                                                        ...(prev[
                                                                                            obj
                                                                                                .enzyme
                                                                                        ] ||
                                                                                            {}),
                                                                                        lower: val, // store string for now
                                                                                    },
                                                                            })
                                                                        )
                                                                    }}
                                                                    value={
                                                                        reactionBoundsFlux[
                                                                            obj
                                                                                .enzyme
                                                                        ]
                                                                            ?.lower ??
                                                                        filteredModelData[
                                                                            idx
                                                                        ]
                                                                            .bounds[0]
                                                                    }
                                                                    className="w-24 rounded border border-stone-300 px-1 py-1 text-sm"
                                                                />
                                                            </td>

                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="number"
                                                                    onChange={(
                                                                        e
                                                                    ) => {
                                                                        const val =
                                                                            e
                                                                                .target
                                                                                .value // keep it as a string
                                                                        setReactionBoundsFlux(
                                                                            (
                                                                                prev
                                                                            ) => ({
                                                                                ...prev,
                                                                                [obj.enzyme]:
                                                                                    {
                                                                                        ...(prev[
                                                                                            obj
                                                                                                .enzyme
                                                                                        ] ||
                                                                                            {}),
                                                                                        upper: val, // don't parse yet
                                                                                    },
                                                                            })
                                                                        )
                                                                    }}
                                                                    value={
                                                                        reactionBoundsFlux[
                                                                            obj
                                                                                .enzyme
                                                                        ]
                                                                            ?.upper ??
                                                                        filteredModelData[
                                                                            idx
                                                                        ]
                                                                            .bounds[1]
                                                                    }
                                                                    className="w-24 rounded border border-stone-300 px-1 py-1 text-sm"
                                                                />
                                                            </td>
                                                        </tr>
                                                    )
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mb-2 flex items-center justify-between">
                                    <button
                                        onClick={() => handleFluxSubmit()}
                                        className="inline-flex items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 hover:shadow disabled:cursor-not-allowed"
                                    >
                                        Choose Flux Analysis
                                    </button>
                                </div>
                            </>
                        )
                    })()}
                </section>
            )}
            {stepFillMissingReaction === 'select-option' && (
                <section className="border-t border-stone-300 bg-white px-6 py-10 md:px-16">
                    {(() => {
                        const sourcePathway =
                            gapFillNodesForBackend[0]?.temp_id?.split(
                                '__'
                            )[0] || ''
                        const targetPathway =
                            gapFillNodesForBackend[1]?.temp_id?.split(
                                '__'
                            )[0] || ''
                        const differentPathways =
                            sourcePathway !== targetPathway
                        const availablePathways = differentPathways
                            ? [sourcePathway, targetPathway]
                            : [sourcePathway]

                        return (
                            <>
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex w-3/4 flex-col items-start justify-start gap-4 sm:flex-col sm:items-start md:flex-row md:items-center md:justify-start">
                                        <h3 className="text-sm font-semibold text-stone-800 md:text-lg">
                                            Possible reactions between{' '}
                                            {
                                                gapFillNodesForBackend[0]?.data
                                                    ?.abbreviation
                                            }{' '}
                                            and{' '}
                                            {
                                                gapFillNodesForBackend[1]?.data
                                                    ?.abbreviation
                                            }
                                        </h3>
                                        <input
                                            onChange={(e) =>
                                                setGapFillingKeyword(
                                                    e.target.value
                                                )
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
                                                (enzyme) =>
                                                    !existingEnzymes.has(enzyme)
                                            ).length
                                        }{' '}
                                        total reactions
                                    </span>
                                </div>
                                {availablePathways.length > 1 && (
                                    <div className="mb-4">
                                        <label className="mb-1 block text-sm font-medium text-stone-700">
                                            Choose a pathway to assign this
                                            reaction:
                                        </label>
                                        <select
                                            value={selectedTargetPathway}
                                            onChange={(e) =>
                                                setSelectedTargetPathway(
                                                    e.target.value
                                                )
                                            }
                                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                                        >
                                            <option value="">
                                                -- Select a pathway --
                                            </option>
                                            {availablePathways.map((path) => (
                                                <option key={path} value={path}>
                                                    {path}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="mb-4 max-h-96 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 shadow-inner">
                                    <table className="min-w-full divide-y divide-stone-200 text-sm text-stone-800">
                                        <thead className="sticky top-0 z-50 bg-stone-50 text-left text-stone-600">
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
                                                <th className="px-4 py-3">
                                                    Lower Bound
                                                </th>
                                                <th className="px-4 py-3">
                                                    Upper Bound
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.keys(
                                                gapFillingFullData || {}
                                            ).length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan="4"
                                                        className="px-4 py-6 text-center text-gray-500"
                                                    >
                                                        No reactions available
                                                        for the selected
                                                        metabolites.
                                                    </td>
                                                </tr>
                                            ) : (
                                                Object.keys(
                                                    filteredGapFillingData
                                                )
                                                    .filter(
                                                        (enzyme) =>
                                                            !existingEnzymes.has(
                                                                enzyme
                                                            )
                                                    )
                                                    .map((enzyme) => (
                                                        <tr
                                                            key={enzyme}
                                                            className={`transition-colors ${
                                                                selectedEnzyme ===
                                                                enzyme
                                                                    ? 'bg-blue-100'
                                                                    : 'hover:bg-blue-50'
                                                            }`}
                                                        >
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="checkbox"
                                                                    name="enzyme-selection"
                                                                    value={
                                                                        enzyme
                                                                    }
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
                                                                                (
                                                                                    prev
                                                                                ) => {
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
                                                                                (
                                                                                    prev
                                                                                ) => ({
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
                                                                ]
                                                                    ?.description ??
                                                                    enzyme}
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
                                                                    defaultValue={
                                                                        -1000
                                                                    }
                                                                    type="number"
                                                                    value={
                                                                        gapFillBounds[
                                                                            enzyme
                                                                        ]
                                                                            ?.lower ??
                                                                        ''
                                                                    }
                                                                    placeholder="-1000"
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setGapFillBounds(
                                                                            (
                                                                                prev
                                                                            ) => ({
                                                                                ...prev,
                                                                                [enzyme]:
                                                                                    {
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
                                                                    defaultValue={
                                                                        1000
                                                                    }
                                                                    value={
                                                                        gapFillBounds[
                                                                            enzyme
                                                                        ]
                                                                            ?.upper ??
                                                                        ''
                                                                    }
                                                                    placeholder="1000"
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setGapFillBounds(
                                                                            (
                                                                                prev
                                                                            ) => ({
                                                                                ...prev,
                                                                                [enzyme]:
                                                                                    {
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
                                            setStepFillMissingReaction('select')
                                            handleAddMissingReaction(
                                                differentPathways
                                                    ? selectedTargetPathway
                                                    : sourcePathway
                                            )
                                        }}
                                        className="inline-flex items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 hover:shadow disabled:cursor-not-allowed"
                                        disabled={
                                            selectedEnzyme.length === 0 ||
                                            (differentPathways &&
                                                selectedTargetPathway === '')
                                        }
                                    >
                                        <Plus className="h-3 w-3" /> Add
                                        Reaction to Pathway
                                    </button>
                                    <span className="text-sm text-green-500">
                                        {selectedEnzyme ? 1 : 0} selected
                                        reaction
                                    </span>
                                </div>
                            </>
                        )
                    })()}
                </section>
            )}

            {stepGSEA === 'select' && (
                <section className="border-t border-stone-300 bg-white px-6 py-10 md:px-16">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-stone-800">
                            Enriched Pathways
                        </h3>
                        <span className="text-sm text-stone-500">
                            Select a row to see induced subgraph
                        </span>
                    </div>

                    <div className="mb-4 max-h-[600px] overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 shadow-inner">
                        {gseaTable?.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                No reactions available for this metabolite.
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-stone-200 text-sm text-stone-800">
                                <thead className="sticky top-0 z-50 bg-stone-50 text-left text-stone-600">
                                    <tr>
                                        <th className="px-4 py-3">Pathway</th>
                                        <th className="px-4 py-3">ES</th>
                                        <th className="px-4 py-3">NES</th>

                                        <th className="px-4 py-3">NOM p-val</th>

                                        {selectedColumn === 'FDR q-val' && (
                                            <th className="px-4 py-3">
                                                FDR q-val
                                            </th>
                                        )}
                                        {selectedColumn === 'FWER p-val' && (
                                            <th className="px-4 py-3">
                                                FWER p-val
                                            </th>
                                        )}

                                        <th className="px-4 py-3">Gene %</th>
                                        <th className="px-4 py-3">Tag %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gseaTable?.map((row, idx) => {
                                        const subgraph = getSubgraph(
                                            row.Lead_genes.split(';')
                                        )
                                        return (
                                            <React.Fragment key={row.Term}>
                                                <tr
                                                    className="hover:cursor-pointer hover:bg-blue-50"
                                                    onClick={() => {
                                                        handleCheckboxChangePathway(
                                                            row.Term
                                                        )

                                                        handleRowClick(
                                                            idx,
                                                            row.Lead_genes.split(
                                                                ';'
                                                            )
                                                        )
                                                    }}
                                                >
                                                    <td className="px-4 py-2">
                                                        {row.Term}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {row.ES}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {row.NES}
                                                    </td>

                                                    <td className="px-4 py-2">
                                                        {row['NOM p-val']}
                                                    </td>

                                                    {selectedColumn ===
                                                        'FDR q-val' && (
                                                        <td className="px-4 py-2">
                                                            {row['FDR q-val']}
                                                        </td>
                                                    )}

                                                    {selectedColumn ===
                                                        'FWER p-val' && (
                                                        <td className="px-4 py-2">
                                                            {row['FWER p-val']}
                                                        </td>
                                                    )}

                                                    <td className="px-4 py-2">
                                                        {row['Gene %']}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {row['Tag %']}
                                                    </td>
                                                </tr>

                                                {expandedRow === idx && (
                                                    <tr>
                                                        <td
                                                            colSpan={6}
                                                            className="bg-stone-50 p-4"
                                                        >
                                                            <CytoscapeComponent
                                                                elements={[
                                                                    ...subgraph.nodes.map(
                                                                        (
                                                                            n
                                                                        ) => ({
                                                                            data: {
                                                                                id: n,
                                                                                label: n,
                                                                            },
                                                                        })
                                                                    ),
                                                                    ...subgraph.edges.map(
                                                                        (
                                                                            e
                                                                        ) => ({
                                                                            data: {
                                                                                source: e[0],
                                                                                target: e[1],
                                                                            },
                                                                        })
                                                                    ),
                                                                ]}
                                                                style={{
                                                                    width: '100%',
                                                                    height: '400px',
                                                                    backgroundColor:
                                                                        '#fff',
                                                                }}
                                                                layout={{
                                                                    name: 'cose',
                                                                    animate: true,
                                                                    animationDuration: 1000,
                                                                    padding: 30,
                                                                    nodeRepulsion: 800000,
                                                                    idealEdgeLength: 100,
                                                                    edgeElasticity: 100,
                                                                    gravity: 80,
                                                                }}
                                                                stylesheet={[
                                                                    {
                                                                        selector:
                                                                            'node',
                                                                        style: {
                                                                            'background-color':
                                                                                '#2563eb',
                                                                            label: 'data(label)',
                                                                            color: '#000',
                                                                            'text-valign':
                                                                                'center',
                                                                            'text-halign':
                                                                                'center',
                                                                            'font-size':
                                                                                '10px',
                                                                        },
                                                                    },
                                                                    {
                                                                        selector:
                                                                            'edge',
                                                                        style: {
                                                                            width: 1,
                                                                            'line-color':
                                                                                '#9ca3af',
                                                                        },
                                                                    },
                                                                ]}
                                                            />
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            )}

            {stepAddReaction === 'select-option' && (
                <section className="border-t border-stone-300 bg-white px-6 py-10 md:px-16">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex w-1/2 flex-col items-start justify-start gap-4 sm:flex-col sm:items-start md:flex-row md:items-center md:justify-start">
                            <h3 className="text-sm font-medium text-stone-800 sm:text-sm md:text-lg">
                                New Reactions for{' '}
                                <strong>
                                    {selectedNode?.data?.abbreviation}
                                </strong>
                            </h3>
                            <input
                                onChange={(e) =>
                                    setAddReactionKeyword(e.target.value)
                                }
                                className="w-1/2 rounded-md border border-gray-300 bg-gray-100 p-2 text-sm transition-colors"
                                placeholder="Search by Abbreviation or description"
                            />
                        </div>
                        <span className="text-sm text-stone-500">
                            {
                                Object.keys(
                                    filteredAddReactionData || {}
                                ).filter(
                                    (enzyme) => !existingEnzymes.has(enzyme)
                                ).length
                            }{' '}
                            total reactions from {database || ''}
                        </span>
                    </div>

                    <div className="mb-4 max-h-96 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 shadow-inner">
                        {Object.keys(filteredAddReactionData || {}).filter(
                            (enzyme) => !existingEnzymes.has(enzyme)
                        ).length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                No reactions available for this metabolite.
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-stone-200 text-sm text-stone-800">
                                <thead className="sticky top-0 z-50 bg-stone-50 text-left text-stone-600">
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
                                        <th className="px-4 py-3">Subsystem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.keys(filteredAddReactionData)
                                        .filter(
                                            (enzyme) =>
                                                !existingEnzymes.has(enzyme)
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
                                                    {filteredAddReactionData?.[
                                                        enzyme
                                                    ]?.description ?? enzyme}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    {
                                                        filteredAddReactionData?.[
                                                            enzyme
                                                        ]?.reaction
                                                    }
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="number"
                                                        defaultValue={-1000}
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
                                                        placeholder="-1000"
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
                                                        placeholder="1000"
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
                                                        {selectedPathways.map(
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
                                setStepAddReaction('select')
                                handleSubmitNewEdges()
                            }}
                            className="inline-flex items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 hover:shadow disabled:cursor-not-allowed"
                            disabled={newReactions.length === 0}
                        >
                            <Plus className="h-3 w-3" /> Add Reaction (s) to
                            Pathway
                        </button>
                        <span className="text-sm text-green-500">
                            {newReactions.length} selected reactions
                        </span>
                    </div>
                </section>
            )}

            <FileUploadModal
                isOpenFileModal={isOpenFileModal}
                setIsOpenFileModal={setIsOpenFileModal}
            />
            <MetabolomicsFileUpload
                isOpenMetabolomicsModal={isOpenMetabolomicsModal}
                setIsOpenMetabolomicsModal={setIsOpenMetabolomicsModal}
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
            <AddReaction
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                selectedNode={selectedNode}
                setSelectedNode={setSelectedNode}
                setAddReactionFullData={setAddReactionFullData}
                setStepAddReaction={setStepAddReaction}
                stepAddReaction={stepAddReaction}
                setNewReactions={setNewReactions}
            />

            <DownloadModal
                isOpenDownloadModal={isOpenDownloadModal}
                setIsOpenDownloadModal={setIsOpenDownloadModal}
                setStepDownloadModal={setStepDownloadModal}
                stepDownloadModal={stepDownloadModal}
            />

            <FluxModal
                isOpenFluxModal={isOpenFluxModal}
                setIsOpenFluxModal={setIsOpenFluxModal}
                setStepFluxCalculation={setStepFluxCalculation}
                stepFluxCalculation={stepFluxCalculation}
                reactionBoundsFlux={reactionBoundsFlux}
                setReactionBoundsFlux={setReactionBoundsFlux}
            />
            <ExportAsImageModal
                isOpenImageModal={isOpenImageModal}
                setIsOpenImageModal={setIsOpenImageModal}
                visualizerRef={visualizerRef}
            />
            <MergeModal
                showMergePrompt={showMergePrompt}
                setShowMergePrompt={setShowMergePrompt}
                newPathwayName={newPathwayName}
                setNewPathwayName={setNewPathwayName}
                handleMerge={handleMerge}
            />

            <WeightFileUploadModal
                openWeightFileModal={openWeightFileModal}
                setIsOpenWeightFileModal={setIsOpenWeightFileModal}
            />
            <CentralityModal
                isOpenCentralityModal={isOpenCentralityModal}
                setIsOpenCentralityModel={setIsOpenCentralityModel}
            />

            <GSEAmodal
                isOpenGSEAmodal={isOpenGSEAmodal}
                setIsOpenGSEAmodal={setIsOpenGSEAmodal}
                stepGSEA={stepGSEA}
                setStepGSEA={setStepGSEA}
                setGSEAnodes={setGSEAnodes}
                setGSEAedges={setGSEAedges}
                setGSEAtable={setGSEAtable}
                setSelectedColumn={setSelectedColumn}
                selectedColumn={selectedColumn}
            />

            <ORAmodal
                isOpenORAmodal={isOpenORAmodal}
                setIsOpenORAmodal={setIsOpenORAmodal}
            />

            <FluxWeightFileUpload
                isOpenFluxWeightFileModal={isOpenFluxWeightFileModal}
                setIsOpenFluxWeightModal={setIsOpenFluxWeightModal}
            />
            <footer className="bg-stone-200 py-6 text-center text-sm text-stone-600">
                © 2025 NAViFluX, Biological Networks and Systems Biology Lab,
                IIT Hyderabad — All rights reserved.
            </footer>
        </div>
    )
}

export default PathwayViz
