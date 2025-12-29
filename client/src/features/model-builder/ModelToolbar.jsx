import {
    Download,
    GitBranch,
    Merge,
    Plus,
    Trash,
    Undo,
    ChevronDown,
    Settings,
    Edit,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { useState } from 'react'

function ModelToolbar({
    mergeSelected,
    handleMergeClick,
    selectedIds,
    handleAddFullReaction,
    deleteReaction,
    handleGapFilling,
    modelData,
    handleDownloadEdgeList,
    isDownloadingEdgeList,
    exportSelectedToolFile,
    toolButtons,
    visualizerRef,
    setIsOpenImageModal,
    handlePathwayAction,
    handleUndoMerge,
    isLoading,
    database,
    downloadGeneReactionMatrix,
    isOpenSettings,
    setIsOpenSettings,
    handleResetFullReaction,
    handleResetMissingReaction,
    handleResetSingleReaction
}) {
    const [downloadOpen, setDownloadOpen] = useState(false)
    const [modelEditOpen, setModelEditOpen] = useState(false)
    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-300 bg-stone-50 px-6 py-4 shadow-sm">
            <div className="relative inline-block">
                <Button
                    variant="destructive"
                    onClick={() => setModelEditOpen(!modelEditOpen)}
                    className="w-80 justify-between"
                >
                    <Edit className="h-3 w-3" />
                    Model Editing Options
                    <ChevronDown className="h-3 w-3" />
                </Button>
                {modelEditOpen && (
                    <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border border-gray-200 bg-white shadow-lg">
                        <button
                            disabled={
                                
                                isLoading == true
                            }
                            onClick={() => {
                                handleAddFullReaction()
                                handleResetMissingReaction()
                                handleResetSingleReaction()
                                handleResetFullReaction()
                                setModelEditOpen(!modelEditOpen)
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Plus className="h-3 w-3" />
                            Add Full Reaction
                        </button>

                        <div className="border-t border-gray-100" />

                        <button
                            disabled={Object.keys(modelData).length === 0 || isLoading == true}
                            onClick={() => {
                                handlePathwayAction()
                                handleResetFullReaction()
                                handleResetMissingReaction()
                                setModelEditOpen(!modelEditOpen)
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Plus className="h-3 w-3" />
                            Select Metabolite to Add New Reaction
                        </button>

                        <div className="border-t border-gray-100" />

                        <button
                            disabled={
                                Object.keys(modelData).length === 0 ||
                                isLoading == true
                            }
                            onClick={() => {
                                handleGapFilling()
                                handleResetFullReaction()
                                handleResetSingleReaction()
                                setModelEditOpen(!modelEditOpen)
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <GitBranch className="h-3 w-3" />
                            Fill Missing Reaction
                        </button>
                    </div>
                )}
            </div>

            {selectedIds.length !== 2 ? (
                <button
                    disabled={isLoading === true}
                    onClick={handleMergeClick}
                    className="inline-flex items-center gap-3 rounded-md border border-gray-300 bg-[#003399] px-3 py-2 text-sm text-white hover:bg-[#002680] hover:shadow"
                >
                    <Merge className="h-3 w-3" /> Merge Canvas
                </button>
            ) : (
                <button
                    onClick={mergeSelected}
                    className="inline-flex items-center gap-3 rounded-md border border-gray-300 bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 hover:shadow"
                >
                    <Merge className="h-3 w-3" /> Merge selected canvas
                </button>
            )}

            <button
                disabled={isLoading === true}
                onClick={handleUndoMerge}
                className="inline-flex items-center gap-3 rounded-md border border-gray-300 bg-[#003399] px-3 py-2 text-sm text-white hover:bg-[#002680] hover:shadow"
            >
                <Undo className="h-3 w-3" /> Undo Merge
            </button>

            <Button
                variant="destructive"
                disabled={
                    Object.keys(modelData).length === 0 || isLoading == true
                }
                onClick={deleteReaction}
            >
                <Trash className="h-3 w-3" />
                Delete Reaction
            </Button>

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
                        <button
                            disabled={
                                Object.keys(modelData).length === 0 ||
                                isLoading == true
                            }
                            onClick={() => {
                                exportSelectedToolFile()
                                setDownloadOpen(!downloadOpen)
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Download className="h-3 w-3" />
                            NAViFlux file
                        </button>
                        {toolButtons.map((btn) => (
                            <>
                                <button
                                    disabled={
                                        Object.keys(modelData).length === 0 ||
                                        isLoading === true
                                    }
                                    onClick={() => {
                                        if (
                                            visualizerRef.current &&
                                            typeof visualizerRef.current[
                                                btn.name
                                            ] === 'function'
                                        ) {
                                            visualizerRef.current[btn.name]()
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
                            disabled={
                                Object.keys(modelData).length === 0 ||
                                isLoading == true
                            }
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
                                Object.keys(modelData).length === 0 ||
                                isDownloadingEdgeList ||
                                isLoading == true
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
                        <div className="border-t border-gray-100" />
                        <button
                            disabled={
                                Object.keys(modelData).length === 0 ||
                                isLoading == true
                            }
                            onClick={() => {
                                downloadGeneReactionMatrix()
                                setDownloadOpen(!downloadOpen)
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Download className="h-3 w-3" />
                            Gene-Reaction Matrix
                        </button>
                    </div>
                )}
            </div>

            <Button
                variant="secondary"
                onClick={() => setIsOpenSettings(!isOpenSettings)}
            >
                <Settings className="h-3 w-3" />
                {isOpenSettings ? 'Close' : 'Node'} Settings
            </Button>

            {database && (
                <div className="text-sm text-gray-700">
                    <span className="font-semibold">Database:</span> {database}
                </div>
            )}
        </div>
    )
}

export default ModelToolbar
