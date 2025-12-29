import { Dialog } from '@headlessui/react'
import { useState } from 'react'
import Spinner from '../../ui/Spinner'
import toast from 'react-hot-toast'
import { useBuilder } from '../../contexts/BuilderContext'

function AddFullReaction({
    isOpenAFRmodal,
    setIsOpenAFRmodal,
    setStepAddFullReaction,
    stepAddFullReaction,
    setAddFullReactionData,
    query, setQuery
}) {
    
    const { database } = useBuilder()

    async function handleFetchOptions() {
        try {
            
            setStepAddFullReaction('loading')
           
            const res = await fetch(
                'http://127.0.0.1:5000/api/v1/serve-query-table',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: query,
                        database: database,
                    }),
                }
            )
            const data = await res.json()
            if (data.status === 'error') throw new Error(data.message)
            
            setAddFullReactionData(data?.result)
            setStepAddFullReaction('fetching-done')
            
        } catch (err) {
            
            const errorMessage =
                err.response?.data?.message ||
                err.message ||
                'Failed to fetch reaction options'
            toast.error(`Error: ${errorMessage}`)
            setStepAddFullReaction('select')
        }
    }
    return (
        <Dialog
            open={isOpenAFRmodal}
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
                            <Dialog.Title className="text-sm font-semibold">
                                Add Full Reaction
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenAFRmodal(false)
                                    setQuery('')
                                    setStepAddFullReaction('select')
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Select and add new reactions to your selected canvas. You can
                            fetch, review, and choose possible reactions for
                            query.
                        </p>
                    </div>

                    {stepAddFullReaction === 'select' && (
                        <div className="mt-4 flex flex-col gap-6">
                            <input
                                onChange={(e) => setQuery(e.target.value)}
                                className="rounded-md border border-gray-300 py-2 pl-4 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Search for an reaction by its abbreviation, full name or its metabolites"
                            />
                            <button
                                onClick={() => {
                                    if (query.length < 4) {
                                        alert(
                                            'Query cannot be less than 4 characters'
                                        )
                                        return
                                    }
                                    setStepAddFullReaction('loading')
                                    handleFetchOptions()
                                }}
                                className="items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 hover:shadow"
                            >
                                Fetch possible reactions to add
                            </button>
                        </div>
                    )}

                    {stepAddFullReaction === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-6">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Retrieving possible reactions...
                            </p>
                        </div>
                    )}

                    {stepAddFullReaction === 'fetching-done' && (
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
                                    setStepAddFullReaction('select-option')
                                    setIsOpenAFRmodal(false)
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

export default AddFullReaction
