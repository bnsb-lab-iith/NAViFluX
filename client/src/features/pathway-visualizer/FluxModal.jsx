import { useMemo, useState } from 'react'
import { useModel } from '../../contexts/ModelContext'
import { Dialog } from '@headlessui/react'
import toast from 'react-hot-toast'
import Spinner from '../../ui/Spinner'

function FluxModal({
    stepFluxCalculation,
    setStepFluxCalculation,
    isOpenFluxModal,
    setIsOpenFluxModal,
    reactionBoundsFlux,
    setReactionBoundsFlux,
}) {
    const {
        modelData,
        setModelData,
        setColorAction,
        setEdgeFormat,
        setLayout,
    } = useModel()
    const [query, setQuery] = useState('')
    const [selectedRxn, setSelectedRxn] = useState(null)
    const [fluxType, setFluxType] = useState('loopless')

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

    function downloadSGDCSV(sgd, filename = 'sgd_result.csv') {
        const { columns, data } = sgd

        // Prepare CSV Header
        let csv = columns.join(',') + '\n'

        // Convert rows
        data.forEach((row) => {
            const gene = row[0][0] // ['b4152'] → "b4152"
            const growth = row[1]
            const status = row[2]

            csv += `${gene},${growth},${status}\n`
        })

        // Trigger download
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()

        URL.revokeObjectURL(url)
    }

    function downloadFluxesAsCSV(fluxes, bounds, filename = 'fluxes.csv') {
        const csvRows = ['reaction,flux,lb,ub']

        Object.entries(fluxes).forEach(([rxn, flux]) => {
            const lb = bounds[rxn]?.lb ?? ''
            const ub = bounds[rxn]?.ub ?? ''
            csvRows.push(`${rxn},${flux},${lb},${ub}`)
        })

        const blob = new Blob([csvRows.join('\n')], {
            type: 'text/csv;charset=utf-8;',
        })

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const downloadCSV = (
        response,
        bounds,
        objective_value,
        filename = 'srd_result.csv'
    ) => {
        if (!selectedRxn) {
            alert('Please select a reaction value first.')
            return
        }

        const { columns, data } = response

        const validGrowths = data
            .map((row) => row[1])
            .filter((val) => val != null && !isNaN(val))

        const minGrowth = Math.min(...validGrowths)
        const maxGrowth = Math.max(...validGrowths)

        const selectedValue = objective_value.toFixed(3)

        // Keep only the first two columns, modify the second as percentage
        const csvRows = [
            [columns[0], 'Percentage Reduction in Growth', 'lb', 'ub'].join(
                ','
            ),
            ...data.map((row) => {
                const id = row[0][0] // assuming your ID is in row[0][0]
                const growth = row[1]

                let percentage
                if (growth == null || isNaN(growth)) {
                    percentage = 100
                } else {
                    // Round growth to two decimals first
                    const roundedGrowth = Math.round(growth * 1000) / 1000

                    // Calculate percentage relative to selected value, also rounded
                    const res = (roundedGrowth / selectedValue) * 100
                    percentage = (100 - res).toFixed(3)
                    if (percentage > 100) percentage = 100
                    else if (percentage < 0) percentage = 0
                }
                const lb = bounds[id]?.lb ?? ''
                const ub = bounds[id]?.ub ?? ''

                return [id, percentage, lb, ub].join(',')
            }),
        ]

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    const downloadCSV2 = (
        response,
        bounds,
        objective_value,
        filename = 'sgd_result.csv'
    ) => {
        if (!selectedRxn) {
            alert('Please select a reaction value first.')
            return
        }

        const { columns, data } = response

        const validGrowths = data
            .map((row) => row[1])
            .filter((val) => val != null && !isNaN(val))

        const minGrowth = Math.min(...validGrowths)
        const maxGrowth = Math.max(...validGrowths)

        const selectedValue = objective_value.toFixed(3)

        // Keep only the first two columns, modify the second as percentage
        const csvRows = [
            [columns[0], 'Percentage Reduction in Growth'].join(
                ','
            ),
            ...data.map((row) => {
                const id = row[0][0] // assuming your ID is in row[0][0]
                const growth = row[1]

                let percentage
                if (growth == null || isNaN(growth)) {
                    percentage = 100
                } else {
                    // Round growth to two decimals first
                    const roundedGrowth = Math.round(growth * 1000) / 1000

                    // Calculate percentage relative to selected value, also rounded
                    const res = (roundedGrowth / selectedValue) * 100
                    percentage = (100 - res).toFixed(3)
                    if (percentage > 100) percentage = 100
                    else if (percentage < 0) percentage = 0
                }
    

                return [id, percentage].join(',')
            }),
        ]

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    function getReactionBounds(modelData) {
        const bounds = {}

        Object.values(modelData).forEach((pathObj) => {
            Object.entries(pathObj.enzymes).forEach(([rxn, arr]) => {
                const lb = arr[2] // lower bound
                const ub = arr[3] // upper bound
                bounds[rxn] = { lb, ub }
            })
        })

        return bounds
    }

    async function handleCalculateFlux() {
        if (selectedRxn === null || selectedRxn.length === '') {
            alert('Select an objective function')
            setStepFluxCalculation('select') // 👈 close modal here
            return // 👈 make sure we exit early, no loading
        }
        setStepFluxCalculation('loading')
        const updatedModelData = JSON.parse(JSON.stringify(modelData))

        for (const [enzyme, bounds] of Object.entries(reactionBoundsFlux)) {
            for (const [path, pathObj] of Object.entries(updatedModelData)) {
                if (pathObj.enzymes[enzyme]) {
                    const enzarr = pathObj.enzymes[enzyme]

                    if ('lower' in bounds) enzarr[2] = parseFloat(bounds.lower)
                    if ('upper' in bounds) enzarr[3] = parseFloat(bounds.upper)
                }
            }
        }

        const bounds = getReactionBounds(updatedModelData)

        try {
            const res = await fetch(
                'http://127.0.0.1:5000/api/v1/calculate-flux',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        new_rxn: updatedModelData,
                        flux_type: fluxType,
                        objective: selectedRxn,
                    }),
                }
            )

            const data = await res.json()
            if (data.status === 'error') throw new Error(data.message)
            console.log(data)

            let fluxes = null
            if (fluxType === 'srd') {
                const flux_obj = {}
                const returned_data = data?.srd?.data

                // Round selected value to 1 decimal
                const selectedValue = parseFloat(
                    data.objective_value.toFixed(3)
                )

                returned_data.forEach((fl) => {
                    const enz = fl[0][0]
                    const val = fl[1]

                    if (val === null || isNaN(val)) {
                        flux_obj[enz] = 100
                    } else {
                        // Round to 1 decimal
                        const roundedGrowth = Math.round(val * 1000) / 1000

                        const res = (roundedGrowth / selectedValue) * 100
                        let percentage = (100 - res).toFixed(3)

                        if (percentage > 100) percentage = 100
                        else if (percentage < 0) percentage = 0

                        flux_obj[enz] = percentage
                    }
                })

                fluxes = flux_obj
            } else if (fluxType === 'sgd') {
                const flux_obj = {}
                const returned_data = data?.sgd?.data

                // Round selected value to 1 decimal
                const selectedValue = parseFloat(
                    data.objective_value.toFixed(3)
                )

                returned_data.forEach((fl) => {
                    const enz = fl[0][0]
                    const val = fl[1]

                    if (val === null || isNaN(val)) {
                        flux_obj[enz] = 100
                    } else {
                        // Round to 1 decimal
                        const roundedGrowth = Math.round(val * 1000) / 1000

                        const res = (roundedGrowth / selectedValue) * 100
                        let percentage = (100 - res).toFixed(3)

                        if (percentage > 100) percentage = 100
                        else if (percentage < 0) percentage = 0

                        flux_obj[enz] = percentage
                    }
                })

                fluxes = flux_obj
            } else if (fluxType !== 'fva' && fluxType !== 'sgd') {
                fluxes = data.fluxes
            } else {
                fluxes = {}
                const bounds = getReactionBounds(updatedModelData)

                Object.keys(bounds).forEach((rxn) => {
                    fluxes[rxn] = 0
                })
            }

            const finalModelData = {}
            Object.entries(modelData).forEach(([pathKey, pathObj]) => {
                const enzymes = pathObj.enzymes
                const updatedEnzymes = {}
                const metabolites = pathObj.metabolites
                const updatedMetabolites = {}

                Object.entries(metabolites).forEach(([met, arr]) => {
                    const updatedArr = [...arr]
                    updatedArr[4] = 'No weight'

                    updatedMetabolites[met] = updatedArr
                })

                Object.entries(enzymes).forEach(([enz, arr]) => {
                    const updatedArr = [...arr]
                    if (enz in fluxes) {
                        updatedArr[1] = fluxes[enz]
                    }

                    updatedEnzymes[enz] = updatedArr
                })

                finalModelData[pathKey] = {
                    ...pathObj,
                    enzymes: updatedEnzymes,
                    metabolites: updatedMetabolites,
                }
            })

            setModelData(finalModelData)

            if (fluxType === 'loopless') {
                downloadFluxesAsCSV(data.fluxes, bounds, 'cycle_free_flux.csv')
                setEdgeFormat('flux')
                setColorAction('flux')
            } else if (fluxType === 'sgd') {
                // downloadSGDCSV(data.sgd, 'sgd_result.csv')
                downloadCSV2(data.sgd, bounds, data.objective_value, "sgd_results.csv")
                setEdgeFormat('weight')
                setColorAction('weight')
            } else if (fluxType === 'fva') {
                const { minimum_flux, maximum_flux } = data

                const reactions = Object.keys(maximum_flux)

                let csv = 'reaction,minimum_flux,maximum_flux,lb,ub\n'

                reactions.forEach((rxn) => {
                    const min = minimum_flux[rxn]
                    const max = maximum_flux[rxn]
                    const lb = bounds[rxn]?.lb ?? ''
                    const ub = bounds[rxn]?.ub ?? ''

                    csv += `${rxn},${min},${max},${lb},${ub}\n`
                })

                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)

                const a = document.createElement('a')
                a.href = url
                a.download = 'fva_results.csv'
                a.click()
                URL.revokeObjectURL(url)

                setEdgeFormat('flux')
                setColorAction('flux')
            } else if (fluxType === 'pfba') {
                downloadFluxesAsCSV(data.fluxes, bounds, 'pfba_flux.csv')
                setEdgeFormat('flux')
                setColorAction('flux')
            } else if (fluxType === 'fba') {
                downloadFluxesAsCSV(data.fluxes, bounds, 'fba_flux.csv')
                setEdgeFormat('flux')
                setColorAction('flux')
            } else if (fluxType === 'srd') {
                downloadCSV(data.srd, bounds, data.objective_value)
                setEdgeFormat('weight')
                setColorAction('weight')
            }
            setStepFluxCalculation('done')
            setReactionBoundsFlux({})
            setSelectedRxn(null)
            setQuery('')
            setLayout('default')
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
                                    setStepFluxCalculation('')
                                    setSelectedRxn(null)
                                    setQuery('')
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
                            <div className="flex flex-col gap-2">
                                <h2 className="text-left text-sm font-medium">
                                    Select cellular objective
                                </h2>
                                <div className="relative">
                                    <input
                                        value={query}
                                        onChange={(e) =>
                                            setQuery(e.target.value)
                                        }
                                        className="w-full rounded border border-stone-300 px-1 py-1 text-sm"
                                        type="text"
                                        placeholder="Reaction Name..."
                                    />
                                    {query && (
                                        <ul className="absolute left-0 right-0 z-[100] mt-2 max-h-40 overflow-y-auto rounded-lg border bg-white opacity-90 shadow-lg">
                                            {filtered &&
                                            filtered?.length === 0 ? (
                                                <li className="px-3 py-2 text-gray-500">
                                                    No results
                                                </li>
                                            ) : (
                                                filtered?.map((r) => (
                                                    <li
                                                        key={r.abbr}
                                                        className="cursor-pointer px-3 py-2 hover:bg-gray-100"
                                                        onClick={() => {
                                                            setSelectedRxn(
                                                                r.abbr
                                                            )
                                                            setQuery('')
                                                        }}
                                                    >
                                                        <span className="font-semibold">
                                                            {r.abbr} -{' '}
                                                            {r.description}
                                                        </span>{' '}
                                                        <span className="text-xs">
                                                            {r.pathway}
                                                        </span>
                                                    </li>
                                                ))
                                            )}
                                        </ul>
                                    )}
                                </div>
                                {selectedRxn && (
                                    <h2>
                                        You have selected:{' '}
                                        <strong>{selectedRxn}</strong>
                                    </h2>
                                )}
                            </div>
                            <h2 className="text-sm font-medium">
                                Please select type of analysis
                            </h2>
                            <div className="mx-auto grid grid-cols-2 gap-4">
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="fba"
                                        checked={fluxType === 'fba'}
                                        onChange={() => setFluxType('fba')}
                                    />
                                    FBA
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="pfba"
                                        checked={fluxType === 'pfba'}
                                        onChange={() => setFluxType('pfba')}
                                    />
                                    Parsimonous FBA
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="fva"
                                        checked={fluxType === 'fva'}
                                        onChange={() => setFluxType('fva')}
                                    />
                                    FVA
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="loopless"
                                        checked={fluxType === 'loopless'}
                                        onChange={() => setFluxType('loopless')}
                                    />
                                    cFBA
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="sgd"
                                        checked={fluxType === 'sgd'}
                                        onChange={() => setFluxType('sgd')}
                                    />
                                    Single Gene Deletion
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
                                    setStepFluxCalculation('')
                                    setIsOpenFluxModal(false)
                                    setSelectedRxn(null)
                                    setQuery('')
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

export default FluxModal
