import { Dialog } from '@headlessui/react'
import toast from 'react-hot-toast'
import Spinner from '../../ui/Spinner'

function FillMissingReaction({
    isOpenGapFillModal,
    setIsOpenGapFillModal,
    gapFillNodesForBackend,
    setGapFillNodesForBackend,
    stepFillMissingReaction,
    setStepFillMissingReaction,
    setGapFillingFullData,
    gapFillingFullData,
    setSelectedEnzyme
}) {
    async function handleFetchOptions() {
        try {
       
            const input = []
            setSelectedEnzyme("")
            setStepFillMissingReaction('loading')
            input.push(gapFillNodesForBackend[0].data.abbreviation)
            input.push(gapFillNodesForBackend[1].data.abbreviation)
   

            const res = await fetch(
                'http://127.0.0.1:5000/api/v1/fill-missing',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        metabolite: input,
                    }),
                }
            )

            const data = await res.json();
   
            if(data.status === 'error')
                throw new Error(data.message)

            setGapFillingFullData(data?.result)
            setStepFillMissingReaction('fetching-done')

         
        } catch (err) {
            const errorMessage =
                err.response?.data?.message ||
                err.message ||
                'Failed to fetch reaction options'
            toast.error(`Error: ${errorMessage}`)
            setStepFillMissingReaction('select')
        }
    }
    return (
        <Dialog
            open={isOpenGapFillModal}
            onClose={() => {}}
            className="relative z-50"
        >
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
                            <Dialog.Title className="text-base font-semibold">
                                Fill missing reactions
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenGapFillModal(false)
                                    setGapFillNodesForBackend(null)
                                    setStepFillMissingReaction('select')
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-2 text-xs text-gray-600">
                            Select and fill missing reactions to your pathway. You
                            can fetch, review, and choose possible reactions for
                            the selected metabolites.
                        </p>
                    </div>
                    {stepFillMissingReaction === 'select' && (
                        <div className="flex flex-col gap-6">
                            <h2 className="text-sm font-medium">
                                You have selected the follwing nodes for filling
                                a missing reaction
                            </h2>
                            <ul className="space-y-2">
                                {gapFillNodesForBackend?.map((node, i) => (
                                    <li
                                        key={`${node?.data?.abbreviation}-${i}`}
                                        className="rounded-lg border border-stone-300 bg-gray-50 px-4 py-2 shadow-sm"
                                    >
                                        <div className="text-sm font-semibold text-stone-800">
                                            {node?.data?.abbreviation}
                                        </div>
                                        <div className="text-xs text-stone-600">
                                            {node?.data?.info ||
                                                'No additional info'}
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => {
                                    setStepFillMissingReaction('loading')
                                    handleFetchOptions()
                                }}
                                className="items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 hover:shadow"
                            >
                                Fetch possible reactions
                            </button>
                        </div>
                    )}
                    {stepFillMissingReaction === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-6">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Retrieving possible reactions...
                            </p>
                        </div>
                    )}
                    {stepFillMissingReaction === 'fetching-done' &&
                        (Object.keys(gapFillingFullData || {}).length !== 0 ? (
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
                                        setStepFillMissingReaction(
                                            'select-option'
                                        )
                                        setIsOpenGapFillModal(false)
                                    }}
                                    className="w-full gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 hover:shadow"
                                >
                                    Click here to view table of options
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="my-3 gap-2 text-center text-sm font-semibold text-green-700">
                                    <span>🔴</span>
                                    <span>
                                        No reactions for the selected metabolites
                                    </span>
                                </div>
                                <button
                                    onClick={() => {
                                        setStepFillMissingReaction(
                                            'select'
                                        )
                                        setIsOpenGapFillModal(false)
                                        setGapFillingFullData(null)
                                        setGapFillNodesForBackend([])
                                    }}
                                    className="w-full gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 hover:shadow"
                                >
                                    Try with new selections
                                </button>
                            </>
                        ))}
                </Dialog.Panel>
            </div>
        </Dialog>
    )
}

export default FillMissingReaction
