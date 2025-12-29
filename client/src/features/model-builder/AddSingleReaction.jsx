import { Dialog } from '@headlessui/react'
import toast from 'react-hot-toast'
import Spinner from '../../ui/Spinner'

function AddSingleReaction({
    isOpenSingleReactionModal,
    setIsOpenSingleReactionModal,
    selectedNode,
    setSelectedNode,
    setAddSingleReactionData,
    addSingleReactionData,
    setStepSingleReaction,
    stepAddSingleReaction,
}) {
    async function handleFetchOptions() {
        try {
            
            setStepSingleReaction('loading')
            setAddSingleReactionData([])
            const res = await fetch(
                'http://127.0.0.1:5000/api/v1/add-reactions',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        metabolite: selectedNode?.data?.abbreviation,
                    }),
                }
            )

            const data = await res.json();
            if(data.status === 'error')
                throw new Error(data.message)

            setAddSingleReactionData(data?.result)
            setStepSingleReaction('fetching-done')
            
        } catch (err) {
            const errorMessage =
                err.response?.data?.message ||
                err.message ||
                'Failed to fetch reaction options'
            toast.error(`Error: ${errorMessage}`)
            setStepSingleReaction('select')
        }
    }
    return (
        <Dialog open={isOpenSingleReactionModal} onClose={() => {}} className="relative z-50">
            <div
                className="fixed inset-0 bg-black/50 transition-opacity"
                aria-hidden="true"
            />
            <div
                className="fixed inset-0 flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
            >
                <Dialog.Panel className="relative w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl">
                    <div>
                        <div className="flex items-center justify-between">
                            <Dialog.Title className="text-sm font-semibold">
                                Add Reaction
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenSingleReactionModal(false)
                                    setSelectedNode(null)
                                    setStepSingleReaction('select')
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Select and add new reactions to your selected canvas. You
                            can fetch, review, and choose possible reactions for
                            the selected metabolite.
                        </p>
                    </div>
                    {stepAddSingleReaction === 'select' && (
                        <div className="mt-4 flex flex-col gap-6">
                            <h2 className="text-sm font-medium">
                                You have selected:{' '}
                                <span className="font-bold text-blue-700">
                                    {selectedNode?.data?.abbreviation}
                                </span>
                            </h2>
                            <button
                                onClick={() => {
                                    setStepSingleReaction('loading')
                                    handleFetchOptions()
                                }}
                                className="items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 hover:shadow"
                            >
                                Fetch possible reactions to add
                            </button>
                        </div>
                    )}
                    {stepAddSingleReaction === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-6">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Retrieving possible reactions...
                            </p>
                        </div>
                    )}
                    {stepAddSingleReaction === 'fetching-done' && (
                        <>
                            <div className="my-3 gap-2 text-center text-sm font-semibold text-green-700">
                                <span>✅</span>
                                <span>
                                    Your choices retrieved successfully!
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    toast('Scroll down to view the options')
                                    setStepSingleReaction('select-option')
                                    setIsOpenSingleReactionModal(false)
                                }}
                                className="w-full gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 hover:shadow"
                            >
                                Click here to view table of options
                            </button>
                        </>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    )
}

export default AddSingleReaction
