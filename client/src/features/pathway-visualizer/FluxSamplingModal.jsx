import { useMemo, useState } from 'react'
import { useModel } from '../../contexts/ModelContext'
import { Dialog } from '@headlessui/react'
import toast from 'react-hot-toast'
import Spinner from '../../ui/Spinner'
import { Button } from '../../ui/Button'

function FluxSamplingModal({
    isOpenFluxSamplingModal,
    setIsOpenFluxSamplingModal,
    stepFluxSampling,
    setStepFluxSampling,
}) {
    const {
        modelData,
    } = useModel()
    const [permutations, setPermuations] = useState(1000)
    const [query, setQuery] = useState('')
    const [selectedRxn, setSelectedRxn] = useState(null)

    const buildSearchList = (modelData) => {
        if (!modelData) return []
        const searchList = []

        Object.entries(modelData).map(([path, pathObj]) => {
            const enz_obj = pathObj['enzymes']

            Object.entries(enz_obj).map(([enz, enzarr]) => {
                searchList.push({
                    abbr: enz,
                    description: enzarr[0],
                    pathway: path,
                })
            })
        })

        return searchList
    }

    const searchList = useMemo(() => {
        return buildSearchList(modelData)
    }, [modelData])

    const filtered = searchList?.filter(
        (r) =>
            r.abbr.toLowerCase().includes(query.toLowerCase()) ||
            r.description.toLowerCase().includes(query.toLowerCase())
    )

    async function handleGSEA() {
        try {
            setStepFluxSampling('loading')
            const res = await fetch(
                'http://127.0.0.1:5000/api/v1/flux-sampling',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        new_rxn: modelData,
                        permutations: permutations,
                        objective: selectedRxn,
                    }),
                }
            )

            const data = await res.json()

            if (data.status === 'error') throw new Error(data.message)
            const samples = data.samples

            // Download samples as CSV
            const headers = Object.keys(samples[0])
            const csvRows = [
                headers.join(','),
                ...samples.map((row) => headers.map((h) => row[h]).join(',')),
            ]

            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `flux_sampling_(${permutations}-samples).csv`
            a.click()
            URL.revokeObjectURL(url)

            setStepFluxSampling('fetching-done')
        } catch (err) {
            setStepFluxSampling('upload')
            toast.error(err.message)
        }
    }

    return (
        <Dialog
            open={isOpenFluxSamplingModal}
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
                <Dialog.Panel className="relative w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl">
                    <div>
                        <div className="flex items-center justify-between">
                            <Dialog.Title className="text-md font-semibold">
                                Flux Sampling
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenFluxSamplingModal(false)
                                    setStepFluxSampling('upload')
                                    setPermuations(1000)
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Flux sampling generates multiple feasible flux
                            distributions that satisfy model constraints and the
                            selected objective, enabling analysis of reaction
                            variability and correlations across the metabolic
                            network.
                        </p>
                    </div>

                    {stepFluxSampling === 'upload' && (
                        <>
                            <div className="mt-5 flex flex-col gap-5">
                                {/* Reaction selection */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Select Cellular Objective
                                    </label>

                                    <div className="relative">
                                        <input
                                            value={query}
                                            onChange={(e) =>
                                                setQuery(e.target.value)
                                            }
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                            type="text"
                                            placeholder="Search reaction name..."
                                        />

                                        {query && (
                                            <ul className="absolute left-0 right-0 z-[100] mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                                                {filtered &&
                                                filtered.length === 0 ? (
                                                    <li className="px-4 py-2 text-sm text-gray-500">
                                                        No reactions found
                                                    </li>
                                                ) : (
                                                    filtered?.map((r) => (
                                                        <li
                                                            key={r.abbr}
                                                            className="cursor-pointer px-4 py-2 transition hover:bg-blue-50"
                                                            onClick={() => {
                                                                setSelectedRxn(
                                                                    r.abbr
                                                                )
                                                                setQuery('')
                                                            }}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-gray-800">
                                                                    {r.abbr}
                                                                </span>

                                                                <span className="text-xs text-gray-600">
                                                                    {
                                                                        r.description
                                                                    }
                                                                </span>

                                                                <span className="text-xs text-blue-600">
                                                                    {r.pathway}
                                                                </span>
                                                            </div>
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        )}
                                    </div>

                                    {selectedRxn && (
                                        <div className="mt-1 px-3 py-2 text-sm text-blue-800">
                                            Selected reaction:{' '}
                                            <span className="font-semibold">
                                                {selectedRxn}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Permutations */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Number of Samples
                                    </label>

                                    <input
                                        onChange={(e) =>
                                            setPermuations(
                                                Number(e.target.value)
                                            )
                                        }
                                        type="number"
                                        placeholder="Default: 1000"
                                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                    />
                                </div>

                                {/* Button */}
                                <Button
                                    className="w-full py-2 font-semibold flex items-center justify-center"
                                    onClick={() => {
                                        setStepFluxSampling('loading')
                                        handleGSEA()
                                    }}
                                >
                                    Run Flux Sampling
                                </Button>
                            </div>
                        </>
                    )}

                    {stepFluxSampling === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-4">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Performing flux sampling.....
                            </p>
                        </div>
                    )}

                    {stepFluxSampling === 'fetching-done' && (
                        <div className="mt-4 flex flex-col items-center">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
                                <span>✅</span>
                                <span>Flux sampling completed successfully</span>
                            </div>
                            <Button
                                className="mt-4 w-full font-semibold flex items-center justify-center"
                                onClick={() => {
                                    setStepFluxSampling('upload')
                                    setIsOpenFluxSamplingModal(false)
                                    setPermuations(1000)
                                }}
                            >
                                Close
                            </Button>
                        </div>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    )
}

export default FluxSamplingModal
