import {
    ChevronDown,
    Cog,
    Download,
    Edit,
    GitBranch,
    Merge,
    Plus,
    Settings,
    Trash,
    Undo,
    Upload,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import FluxLegendBar from './FluxLegendBar'
import toast from 'react-hot-toast'
import { useMemo, useState } from 'react'

function VizToolBar({
    layout,
    setLayout,
    toolButtons,
    modelData,
    visualizerRef,
    setIsOpenFileModal,
    minFlux,
    maxFlux,
    toggleDropdownPathways,
    pathwaysOpen,
    setPathwaysOpen,
    toggleSelectAllPathways,
    selectedPathways,
    handleCheckboxChangePathway,
    handlePathwayAction,
    handleGapFilling,
    setIsOpenSettings,
    isDownloadingEdgeList,
    handleDownloadEdgeList,
    isOpenSettings,
    setIsOpenFluxModal,
    setIsOpenImageModal,
    setShowMergePrompt,
    setIsOpenWeightFileModal,
    setIsOpenCentralityModel,
    handleReset,
    setIsOpenGSEAmodal,
    setLeadGenes,
    setStepGSEA,
    stepGSEA,
    setSelectedColumn,
    setStepFluxCalculation,
    undoMerge,
    deleteReaction,
    setIsOpenFluxWeightModal,
    setIsOpenMetabolomicsModal,
    uploadMode,
    resetAddReaction,
    resetFillMissingReaction,
    resetGSEA,
    isOpenORAmodal,
    setIsOpenORAmodal,
}) {
    const [uploadOpen, setUploadOpen] = useState(false)
    const [analysisOpen, setAnalysisOpen] = useState(false)
    const [downloadOpen, setDownloadOpen] = useState(false)
    const [searchedPathway, setSearchdPathway] = useState('')
    const [editOpen, setEditOpen] = useState(false)

    const allMetabolomicsValues = []

    Object.values(modelData || {})?.forEach((pathway) => {
        const metabolites = pathway.metabolites || {}
        Object.values(metabolites).forEach((metArr) => {
            // metArr is like ['Acetyl-CoA', 'C23H34N7O17P3S', 'Cytoplasm', [], 3771.55]
            const val = metArr[metArr.length - 1] // last element
            if (!isNaN(val)) allMetabolomicsValues.push(val)
        })
    })

    const filteredPaths = useMemo(() => {
        if (!modelData) return []

        const search = searchedPathway.toLowerCase()

        return Object.entries(modelData)
            .filter(([pathwayName, pathwayData]) => {
                // check pathway name
                if (pathwayName.toLowerCase().includes(search)) return true

                // check enzyme/reaction names
                if (pathwayData.enzymes) {
                    const enzymeMatch = Object.entries(
                        pathwayData.enzymes
                    ).some(
                        ([key, enzymeArr]) =>
                            key.toLowerCase().includes(search) || // check key
                            (Array.isArray(enzymeArr) &&
                                enzymeArr[0]?.toLowerCase().includes(search)) // check first value
                    )
                    if (enzymeMatch) return true
                }

                // Check metabolites: keys and values
                if (pathwayData.metabolites) {
                    const metaboliteMatch = Object.entries(
                        pathwayData.metabolites
                    ).some(
                        ([key, metArr]) =>
                            key.toLowerCase().includes(search) || // check key
                            (Array.isArray(metArr) &&
                                metArr[0]?.toLowerCase().includes(search)) // check first value
                    )
                    if (metaboliteMatch) return true
                }
                return false
            })
            .map(([pathwayName]) => pathwayName)
    }, [modelData, searchedPathway])

    return (
        <>
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-300 bg-stone-50 px-4 py-4 shadow-sm">
                <div className="relative inline-block">
                    <Button
                        variant="destructive"
                        onClick={() => setUploadOpen(!uploadOpen)}
                        className="w-44 justify-start"
                    >
                        <Upload className="h-3 w-3" />
                        Upload Options
                        <ChevronDown className="h-3 w-3" />
                    </Button>

                    {uploadOpen && (
                        <div className="absolute right-0 z-50 mt-2 w-[11rem] rounded-md border border-gray-200 bg-white shadow-lg">
                            <button
                                onClick={() => {
                                    setIsOpenFileModal(true)
                                    setUploadOpen(!uploadOpen)
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                            >
                                Model File
                            </button>
                            <div className="border-t border-gray-100" />
                            <button
                                disabled={modelData === null}
                                onClick={() => {
                                    setIsOpenWeightFileModal(true)
                                    setUploadOpen(!uploadOpen)
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Reaction Weight File
                            </button>
                            <div className="border-t border-gray-100" />
                            <button
                                disabled={modelData === null}
                                onClick={() => {
                                    setIsOpenMetabolomicsModal(true)
                                    setUploadOpen(!uploadOpen)
                                }}
                                className="gap-2 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Metabolite Weight File{' '}
                            </button>
                            <div className="border-t border-gray-100" />
                            <button
                                disabled={modelData === null}
                                onClick={() => {
                                    setIsOpenFluxWeightModal(true)
                                    setUploadOpen(!uploadOpen)
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Flux Weight File
                            </button>

                            <div className="border-t border-gray-100" />
                        </div>
                    )}
                </div>

                <div className="relative inline-block">
                    <button
                        className="inline-flex items-center gap-3 rounded-md border border-gray-300 bg-[#003399] px-3 py-2 text-sm text-white hover:bg-[#002680] hover:shadow"
                        onClick={() => setEditOpen(!editOpen)}
                    >
                        <Edit className="h-3 w-3" />
                        Model Editing Options
                        <ChevronDown className="h-3 w-3" />
                    </button>

                    {editOpen && (
                        <div className="absolute right-0 z-50 mt-2 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                            <button
                                disabled={modelData === null}
                                onClick={() => {
                                    handlePathwayAction()
                                    setEditOpen(!editOpen)
                                    resetFillMissingReaction()
                                    resetGSEA()
                                    setStepFluxCalculation('')
                                }}
                                className="flex w-full gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Select Metabolite For New Reaction
                            </button>
                            <button
                                disabled={modelData === null}
                                onClick={() => {
                                    handleGapFilling()
                                    setEditOpen(!editOpen)
                                    resetAddReaction()
                                    resetGSEA()
                                    setStepFluxCalculation('')
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Fill Missing Reaction
                            </button>

                            <div className="border-t border-gray-100" />
                        </div>
                    )}
                </div>
                {/* <button
                    disabled={modelData === null}
                    onClick={() => handlePathwayAction()}
                    className="inline-flex items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 hover:shadow"
                >
                    <Plus className="h-3 w-3" /> Select Metabolite For New
                    Reaction
                </button>
                <button
                    onClick={() => handleGapFilling()}
                    disabled={modelData === null}
                    className="inline-flex items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 hover:shadow"
                >
                    <GitBranch className="h-3 w-3" /> Fill Missing Reaction
                </button> */}

                <div className="relative inline-block">
                    <Button
                        variant="destructive"
                        onClick={() => setDownloadOpen(!downloadOpen)}
                    >
                        <Download className="h-3 w-3" />
                        Download Options
                        <ChevronDown className="h-3 w-3" />
                    </Button>

                    {downloadOpen && (
                        <div className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg">
                            {toolButtons.map((btn, idx) => (
                                <>
                                    <button
                                        disabled={modelData === null}
                                        onClick={() => {
                                            if (
                                                visualizerRef.current &&
                                                typeof visualizerRef.current[
                                                    btn.name
                                                ] === 'function'
                                            ) {
                                                visualizerRef.current[
                                                    btn.name
                                                ]()
                                            }
                                            setDownloadOpen(!downloadOpen)
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <btn.icon className="h-3 w-3" />
                                        {btn.label}
                                    </button>
                                    <div className="border-t border-gray-100" />
                                </>
                            ))}
                            <button
                                disabled={modelData === null}
                                onClick={() => {
                                    setIsOpenImageModal(true)
                                    setDownloadOpen(!downloadOpen)
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Download className="h-3 w-3" />
                                Image
                            </button>
                            <div className="border-t border-gray-100" />

                            <button
                                disabled={
                                    modelData === null || isDownloadingEdgeList
                                }
                                onClick={() => {
                                    handleDownloadEdgeList()
                                    setDownloadOpen(!downloadOpen)
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Download className="h-3 w-3" />
                                Edge Lists
                            </button>
                        </div>
                    )}
                </div>

                <div className="relative inline-block">
                    <Button
                        variant="destructive"
                        onClick={() => setAnalysisOpen(!analysisOpen)}
                    >
                        <Cog className="h-3 w-3" />
                        Analysis Options
                        <ChevronDown className="h-3 w-3" />
                    </Button>

                    {analysisOpen && (
                        <div className="absolute right-0 z-50 mt-2 w-44 rounded-md border border-gray-200 bg-white shadow-lg">
                            <button
                                disabled={modelData === null}
                                onClick={() => {
                                    toast('Scroll down to set parameters')
                                    setStepFluxCalculation('set-bounds')
                                    // setIsOpenFluxModal(true)
                                    setAnalysisOpen(!analysisOpen)
                                    resetAddReaction()
                                    resetGSEA()
                                    resetFillMissingReaction()
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Flux Analyses
                            </button>

                            <div className="border-t border-gray-100" />

                            <button
                                disabled={modelData === null}
                                onClick={() => {
                                    setIsOpenCentralityModel(true)
                                    resetAddReaction()
                                    resetGSEA()
                                    resetFillMissingReaction()
                                    setAnalysisOpen(!analysisOpen)
                                    setStepFluxCalculation('')
                                }}
                                className="px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Model Network Analyses
                            </button>

                            <div className="border-t border-gray-100" />

                            <div className="group relative">
                                {/* Parent */}
                                <div className="flex w-full cursor-default items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600">
                                    Functional Enrichment Analyses
                                    <span className="text-gray-400">›</span>
                                </div>

                                {/* Submenu */}
                                <div className="absolute left-full top-0 hidden w-56 rounded-md border border-gray-200 bg-white shadow-lg group-hover:block">
                                    {/* Pathway Enrichment */}
                                    <button
                                        disabled={modelData === null}
                                        onClick={() => {
                                            setSelectedColumn('NOM p-val')
                                            setStepGSEA('upload')
                                            setLeadGenes(null)
                                            setStepFluxCalculation('')
                                            setIsOpenGSEAmodal(true)
                                            resetAddReaction()
                                            resetFillMissingReaction()
                                            setAnalysisOpen(false)
                                        }}
                                        className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        RSEA
                                    </button>

                                    <div className="border-t border-gray-100" />

                                    {/* ORA */}
                                    <button
                                        disabled={modelData === null}
                                        onClick={() => {
                                            setStepFluxCalculation('')
                                            setIsOpenORAmodal(true)
                                            resetAddReaction()
                                            resetFillMissingReaction()
                                            setAnalysisOpen(false)
                                        }}
                                        className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Over-Representation Analysis
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {uploadMode === 'single' && (
                    <>
                        <button
                            disabled={selectedPathways.length < 2}
                            onClick={() => setShowMergePrompt(true)}
                            className="inline-flex items-center gap-3 rounded-md border border-gray-300 bg-[#003399] px-3 py-2 text-sm text-white hover:bg-[#002680] hover:shadow focus:outline-none disabled:cursor-not-allowed disabled:border-none disabled:bg-gray-200 disabled:text-gray-500"
                        >
                            <Merge className="h-3 w-3" />
                            Merge Selected Pathways
                        </button>
                        <button
                            // disabled={selectedPathways?.length < 2}
                            onClick={() => undoMerge()}
                            className="inline-flex items-center gap-3 rounded-md border border-gray-300 bg-[#003399] px-3 py-2 text-sm text-white hover:bg-[#002680] hover:shadow focus:outline-none disabled:cursor-not-allowed disabled:border-none disabled:bg-gray-200 disabled:text-gray-500"
                        >
                            <Undo className="h-3 w-3" />
                            Undo Merge
                        </button>
                    </>
                )}

                <Button
                    disabled={modelData === null}
                    onClick={() => handleReset()}
                    variant="destructive"
                >
                    <Undo className="h-3 w-3" />
                    Reset
                </Button>

                <Button
                    disabled={modelData === null}
                    onClick={deleteReaction}
                    variant="destructive"
                >
                    <Trash className="h-3 w-3" />
                    Delete Reaction
                </Button>
                <Button
                    disabled={modelData === null}
                    onClick={() => setIsOpenSettings((open) => !open)}
                    variant="secondary"
                >
                    <Settings className="h-3 w-3" />
                    Settings
                </Button>

                {minFlux !== Infinity && maxFlux !== -Infinity && modelData && (
                    <div className="flex items-center gap-6">
                        {/* Flux legend */}
                        <div className="flex items-center gap-6">
                            {/* Flux legend */}
                            <div className="flex items-center gap-2 rounded-xl border border-gray-500 bg-white/30 px-4 py-2 shadow-lg backdrop-blur-md">
                                <div className="text-xs font-bold text-gray-800">
                                    Weight
                                </div>
                                <div className="text-xs font-semibold text-gray-700">
                                    0
                                </div>
                                <div
                                    className="h-3 w-36 rounded-md"
                                    style={{
                                        background:
                                            'linear-gradient(to right, rgb(20,180,255), rgb(10,140,230), rgb(0,100,200))',
                                    }}
                                ></div>

                                <div className="text-xs font-semibold text-gray-700">
                                    {maxFlux.toFixed(2) || 1000}
                                </div>
                            </div>
                        </div>

                        {/* Enriched nodes legend */}
                        {stepGSEA === 'select' && (
                            <div className="flex items-center gap-2 rounded-xl border border-gray-500 bg-white/30 px-4 py-2 shadow-lg backdrop-blur-md">
                                <div className="text-xs font-bold text-gray-800">
                                    Enriched Reactions
                                </div>
                                <div
                                    className="h-3 w-12 rounded-md"
                                    style={{
                                        background: 'green',
                                    }}
                                ></div>
                            </div>
                        )}
                    </div>
                )}
                {allMetabolomicsValues?.length > 0 && modelData && (
                    <div className="flex items-center gap-6">
                        {/* Metabolite value legend */}
                        <div className="flex items-center gap-2 rounded-xl border border-gray-500 bg-white/30 px-4 py-2 shadow-lg backdrop-blur-md">
                            <div className="text-xs font-bold text-gray-800">
                                Metabolite
                            </div>
                            <div className="text-xs font-semibold text-gray-700">
                                0
                            </div>
                            <div
                                className="h-3 w-36 rounded-md"
                                style={{
                                    // Example orange gradient for metabolite values
                                    background:
                                        'linear-gradient(to right, rgb(255,200,150), rgb(255,150,75), rgb(255,100,0))',
                                }}
                            ></div>
                            <div className="text-xs font-semibold text-gray-700">
                                {Math.max(...allMetabolomicsValues).toFixed(2)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex items-start gap-4 px-6 py-4">
                {modelData ? (
                    <>
                        <div className="w-full md:w-1/3">
                            <select
                                onChange={(e) => {
                                    setLayout(e.target.value)
                                }}
                                value={layout}
                                className="w-full cursor-pointer rounded-lg border border-gray-300 bg-gray-50 px-2 py-2 text-sm shadow-sm hover:bg-gray-100"
                            >
                                <option value="default">Default Layout</option>
                                <option value="hierarchical-bt">
                                    Hierarchical BT
                                </option>

                                <option value="hierarchical-lr">
                                    Hierarchical LR
                                </option>

                                <option value="stress">Stress Layout</option>

                                <option value="neato">Neato Layout</option>
                                <option value="twopi">Twopi Layout</option>
                                <option value="circo">Circo Layout</option>
                            </select>
                        </div>
                        <div className="w-full md:w-1/3">
                            <input
                                onChange={(e) => {
                                    setPathwaysOpen(true)
                                    setSearchdPathway(e.target.value)
                                }}
                                className="w-full rounded-md border border-gray-300 bg-gray-100 p-2 text-sm transition-colors"
                                placeholder="Search Pathway, eg. Glycolysis"
                            />
                        </div>
                        <div className="w-full md:w-1/3">
                            {/* <FluxLegendBar
                                minFlux={minFlux}
                                maxFlux={maxFlux}
                            /> */}

                            <div className="space-y-4">
                                <div className="w-full">
                                    <div className="relative w-full">
                                        <div
                                            className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-gray-100 p-2 text-sm transition-colors hover:bg-gray-200 md:text-sm"
                                            onClick={toggleDropdownPathways}
                                            title={selectedPathways.join(', ')} // 👈 full list on hover
                                        >
                                            {pathwaysOpen
                                                ? 'Close selection'
                                                : selectedPathways.length === 0
                                                  ? 'Select pathways'
                                                  : selectedPathways
                                                        .join(', ')
                                                        .slice(0, 60) +
                                                    (selectedPathways.join(', ')
                                                        .length > 60
                                                        ? '…'
                                                        : '')}
                                            <span className="ml-2">
                                                &#9662;
                                            </span>
                                        </div>

                                        {pathwaysOpen && (
                                            <div className="absolute z-20 mt-2 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                                                <div
                                                    onClick={
                                                        toggleSelectAllPathways
                                                    }
                                                    className="cursor-pointer border-b border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-blue-100 md:text-sm"
                                                >
                                                    {selectedPathways.length ===
                                                    Object.keys(modelData || {})
                                                        .length
                                                        ? 'Deselect All'
                                                        : 'Select All Pathways in Model'}
                                                </div>
                                                {filteredPaths.map(
                                                    (pathway) => (
                                                        <label
                                                            key={pathway}
                                                            className="flex cursor-pointer items-center px-4 py-2 text-sm transition-colors hover:bg-blue-100 md:text-sm"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedPathways.includes(
                                                                    pathway
                                                                )}
                                                                onChange={() =>
                                                                    handleCheckboxChangePathway(
                                                                        pathway
                                                                    )
                                                                }
                                                                className="mr-2 accent-blue-500"
                                                            />
                                                            {pathway}
                                                        </label>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div>
                        Use the upload option to upload a COBRA model or a
                        NAViFluX Compatible File
                    </div>
                )}
            </div>
        </>
    )
}

export default VizToolBar
