import { useState } from 'react'
import { Dialog } from '@headlessui/react'
import toast from 'react-hot-toast'
import Spinner from '../../ui/Spinner'

function FluxModelBuilder({
    stepFluxCalculation,
    setStepFluxCalculation,
    isOpenFluxModal,
    setIsOpenFluxModal,
    modelData
}) {
    
    const [fluxType, setFluxType] = useState('.mat')

    function downloadFluxesAsCSV(fluxes, filename = 'fluxes.csv') {
        const csvRows = ['reaction,flux']

        Object.entries(fluxes).forEach(([reaction, flux]) => {
            csvRows.push(`${reaction},${flux}`)
        })

        const csvContent = csvRows.join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const downloadCSV = (response, filename = 'srd_result.csv') => {
        const { columns, data } = response

        const csvRows = [
            columns.join(','),
            ...data.map((row) =>
                row
                    .map(
                        (cell) =>
                            Array.isArray(cell) ? cell.join('|') : (cell ?? '') // handle null
                    )
                    .join(',')
            ),
        ]

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    async function handleCalculateFlux() {
        const finalModelData = {}
        Object.keys(modelData).map(
            (path) =>
                (finalModelData[path] = {
                    currency_edges: [],
                    edges: [],
                    enzymes: {},
                    metabolites: {},
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
            })
        })
        
        try {
            const submitRes = await fetch(
                'http://127.0.0.1:5000/api/v1/calculate-flux',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        new_rxn: finalModelData,
                        flux_type: fluxType,
                    }),
                }
            )

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
                    setStepFluxCalculation('loading')
                    timeoutId = setTimeout(pollTask, 10)
                } else if (state === 'SUCCESS') {
                    
                    if (fluxType === 'loopless')
                        downloadFluxesAsCSV(result.fluxes, 'loopless_flux.csv')
                    else if (fluxType === 'pfba')
                        downloadFluxesAsCSV(result.fluxes, 'pfba_flux.csv')
                    else if (fluxType === 'fba')
                        downloadFluxesAsCSV(result.fluxes, 'fba_flux.csv')
                    else if (fluxType === 'srd') downloadCSV(result)
                    setStepFluxCalculation('done')
                    clearTimeout(timeoutId)
                } else if (state === 'FAILURE') {
                    toast.error('Task failed')
                    setStepFluxCalculation('select')
                    clearTimeout(timeoutId)
                } else {
                    toast.error(`Unhandled task state: ${state}`)
                    setStepFluxCalculation('select')
                    clearTimeout(timeoutId)
                }
            }

            pollTask()
        } catch (err) {
            const errorMessage =
                err.response?.data?.message ||
                err.message ||
                'Failed to fetch reaction options'
            toast.error(`Error: ${errorMessage}`)
            setStepFluxCalculation('select')
        }
    }
    return (
        <Dialog
            open={isOpenFluxModal}
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
                                Flux Calculation
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenFluxModal(false)
                                    setStepFluxCalculation('select')
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Select an option to perform flux analysis on your
                            current model
                        </p>
                    </div>
                    {stepFluxCalculation === 'select' && (
                        <div className="mt-4 flex flex-col gap-6">
                            <h2 className="text-sm font-medium">
                                Please select file type
                            </h2>
                            <div className="mx-auto grid grid-cols-2 gap-4">
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="loopless"
                                        checked={fluxType === 'loopless'}
                                        onChange={() => setFluxType('loopless')}
                                    />
                                    Loopless Solution
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="pfba"
                                        checked={fluxType === 'pfba'}
                                        onChange={() => setFluxType('pfba')}
                                    />
                                    pFBA
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="fba"
                                        checked={fluxType === 'fba'}
                                        onChange={() => setFluxType('fba')}
                                    />
                                    Standard FBA
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="srd"
                                        checked={fluxType === 'srd'}
                                        onChange={() => setFluxType('srd')}
                                    />
                                    Single Reaction Deletion
                                </label>
                            </div>
                            <button
                                onClick={() => {
                                    setStepFluxCalculation('loading')
                                    handleCalculateFlux()
                                }}
                                className="items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 hover:shadow"
                            >
                                Calculate and download results
                            </button>
                        </div>
                    )}
                    {stepFluxCalculation === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-6">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Calculating flux...
                            </p>
                        </div>
                    )}
                    {stepFluxCalculation === 'done' && (
                        <>
                            <div className="my-4 gap-2 text-center text-sm font-semibold text-green-700">
                                <span>✅</span>
                                <span>Flux calculated successfully !</span>
                            </div>
                            <button
                                onClick={() => {
                                    setStepFluxCalculation('select')
                                    setIsOpenFluxModal(false)
                                }}
                                className="w-full gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 hover:shadow"
                            >
                                Back to session...
                            </button>
                        </>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    )
}

export default FluxModelBuilder
