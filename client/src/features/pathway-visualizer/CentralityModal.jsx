import { Dialog } from '@headlessui/react'
import { useState } from 'react'
import Spinner from '../../ui/Spinner'
import { useModel } from '../../contexts/ModelContext'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

function CentralityModal({ isOpenCentralityModal, setIsOpenCentralityModel }) {
    const [step, setStep] = useState('select')
    const { modelData, setModelData, setColorAction, setEdgeFormat, setLayout } = useModel()
    const [selectedCentralities, setSelectedCentralities] = useState('degree')

    const CENTRALITY_OPTIONS = [
        { value: 'degree', label: 'Degree Centrality' },
        { value: 'betweenness', label: 'Betweenness Centrality' },
        { value: 'closeness', label: 'Closeness Centrality' },
        { value: 'eigenvector', label: 'Eigenvector Centrality' },
        { value: 'pagerank', label: 'PageRank' },
    ]

    const toggleCentrality = (value) => {
        setSelectedCentralities((prev) =>
            prev.includes(value)
                ? prev.filter((v) => v !== value)
                : [...prev, value]
        )
    }

    async function handleCalculateCentrality() {
        
        try {
            setStep('loading')
            const res = await fetch(
                'http://127.0.0.1:5000/api/v1/calculate-centrality',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        new_rxn: modelData,
                        selectedCentralities: selectedCentralities,
                    }),
                }
            )

            const returned_data = await res.json()
            if(returned_data.status === 'error')
                throw new Error(returned_data.message)
            const data = returned_data?.result

            const rows = data
                        .filter(
                            (d) => d[selectedCentralities] !== null && d[selectedCentralities] !== undefined
                        )
                        .map((d) => `${d.node},${d[selectedCentralities]}`)
            
            const weights = {}
            data.map(obj => {
                weights[obj.node] = obj[selectedCentralities]
            })
           
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
                    if (enz in weights) {
                        updatedArr[1] = weights[enz]
                    } else {
                        updatedArr[1] = 'Not calculated'
                    }

                    updatedEnzymes[enz] = updatedArr
                })

                finalModelData[pathKey] = {
                    ...pathObj,
                    enzymes: updatedEnzymes,
                    metabolites: updatedMetabolites
                }
            })
            
            const csvContent = ['node,weights', ...rows].join('\n')
            const filename = selectedCentralities + '_centrality.csv'
            const blob = new Blob([csvContent], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
            URL.revokeObjectURL(url)

            const handleExport = async () => {
                const zip = new JSZip()

                const metrics = selectedCentralities

                

                metrics.forEach((metric) => {
                    const rows = data
                        .filter(
                            (d) => d[metric] !== null && d[metric] !== undefined
                        )
                        .map((d) => `${d.node},${d[metric]}`)

                    const csvContent = ['node,weights', ...rows].join('\n')

                    zip.file(`${metric}.csv`, csvContent)
                })

                const blob = await zip.generateAsync({ type: 'blob' })
                saveAs(blob, 'centrality_metrics.zip')
            }
            // handleExport()
            setSelectedCentralities('degree')
            setStep('done')
            setModelData(finalModelData)
            setColorAction('weight')
            setEdgeFormat('weight')
            setLayout("default")
        } catch (err) {
            const errorMessage =
                err.response?.data?.message ||
                err.message ||
                'Failed to fetch reaction options'
            toast.error(`Error: ${errorMessage}`)
            setStep('select')
        }
    }
    return (
        <Dialog
            open={isOpenCentralityModal}
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
                                Centrality Calculation
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenCentralityModel(false)
                                    setStep('select')
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Select an option to perform Centrality analysis on
                            your current model
                        </p>
                    </div>
                    {step === 'select' && (
                        <div className="mt-4 flex flex-col gap-6">
                            <h2 className="text-sm font-medium">
                                Please select centrality methods
                            </h2>
                            <div className="mx-auto grid grid-cols-2 gap-4">
                                {CENTRALITY_OPTIONS.map(({ value, label }) => (
                                    <label
                                        key={value}
                                        className="flex cursor-pointer items-center gap-2"
                                    >
                                        <input
                                            type="checkbox"
                                            value={value}
                                            checked={selectedCentralities === value}
                                            onChange={() => setSelectedCentralities(value)
                                            }
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>
                            <button
                                onClick={() => {
                                    setStep('loading')
                                    handleCalculateCentrality()
                                }}
                                className="items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 hover:shadow"
                            >
                                Calculate and download results
                            </button>
                        </div>
                    )}
                    {step === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-6">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Calculating centralities...
                            </p>
                        </div>
                    )}
                    {step === 'done' && (
                        <>
                            <div className="my-4 gap-2 text-center text-sm font-semibold text-green-700">
                                <span>✅</span>
                                <span>
                                    Centralities calculated successfully !
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    setStep('select')
                                    setIsOpenCentralityModel(false)
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

export default CentralityModal
