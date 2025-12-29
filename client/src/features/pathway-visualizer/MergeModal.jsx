import { Dialog } from '@headlessui/react'
import { useState } from 'react'
import { useModel } from '../../contexts/ModelContext'

function MergeModal({
    showMergePrompt,
    setShowMergePrompt,
    newPathwayName,
    setNewPathwayName,
    handleMerge
}) {
    const { selectedPathways } = useModel()

    return (
        <Dialog
            open={showMergePrompt}
            onClose={() => {}}
            className="relative z-50"
        >
            <div
                className="fixed inset-0 bg-black/50 transition-opacity"
                aria-hidden="true"
            />
            <div className="fixed inset-0 flex items-center justify-center">
                <Dialog.Panel
                    className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between">
                        <Dialog.Title className="text-base font-semibold">
                            Merge Selected Pathways
                        </Dialog.Title>
                        <button
                            onClick={() => setShowMergePrompt(false)}
                            className="text-xl text-gray-400 hover:text-black focus:outline-none"
                            aria-label="Close modal"
                        >
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>

                    <p className="mt-4 text-sm text-gray-600">
                        You have selected {selectedPathways.length}{' '}
                        {selectedPathways.length === 1 ? 'pathway' : 'pathways'}{' '}
                        to merge.
                    </p>

                    <label className="mt-5 block text-sm font-medium text-gray-700">
                        New pathway name
                    </label>
                    <input
                        type="text"
                        value={newPathwayName}
                        onChange={(e) => setNewPathwayName(e.target.value)}
                        placeholder="e.g., Combined_Pathway_1"
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={() => setShowMergePrompt(false)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleMerge}
                            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                            Merge
                        </button>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    )
}

export default MergeModal
