import { useState } from 'react'
import { Dialog } from '@headlessui/react'
import Spinner from '../../ui/Spinner'
import { useModel } from '../../contexts/ModelContext'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useMemo } from 'react'

function DeleteGenesModal({ isOpenDeleteGeneModal, setIsOpenDeleteGeneModal }) {
    const [step, setStep] = useState('select')
    const { modelData, setModelData, setLayout } = useModel()
    const [selectedFile, setSelectedFile] = useState(null)
    const [query, setQuery] = useState('')
    const [selectedRxn, setSelectedRxn] = useState(null)
    const [stats, setStats] = useState(null)
    const [choice, setChoice] = useState('temporary')

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

    function parseGeneCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()

            reader.onload = (e) => {
                const text = e.target.result

                const rows = text
                    .split('\n')
                    .map((r) => r.trim())
                    .filter(Boolean)

                const genes = rows.slice(1) // skip header

                resolve(genes)
            }

            reader.onerror = reject

            reader.readAsText(file)
        })
    }

    function sanityCheckGenes(modelData, inputGenes) {
        const modelGenes = new Set()

        Object.values(modelData).forEach((pathway) => {
            const genesObj = pathway.genes || {}

            Object.values(genesObj).forEach((geneArray) => {
                geneArray.forEach((g) => modelGenes.add(g))
            })
        })

        const missingGenes = inputGenes.filter((g) => !modelGenes.has(g))

        return {
            validGenes: inputGenes.filter((g) => modelGenes.has(g)),
            missingGenes,
        }
    }

    async function handleDeleteGenesFromModel() {
        try {
            if (!selectedFile) {
                toast.error('Please upload a CSV file')
                return
            }

            setStep('loading')
            const genesToDelete = await parseGeneCSV(selectedFile)
            console.log(genesToDelete)
            // sanity check
            // check if the genes entered are present in the model or not
            const { validGenes, missingGenes } = sanityCheckGenes(
                modelData,
                genesToDelete
            )

            if (missingGenes.length > 0) {
                toast.error(
                    `Genes not found in model: ${missingGenes.join(', ')}`
                )
                setStep('select')
                return
            }

            if (validGenes.length === 0) {
                toast.error('None of the uploaded genes exist in the model')
                setStep('select')
                return
            }

            const res = await fetch(
                'http://127.0.0.1:5000/api/v1/delete-genes',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        new_rxn: modelData,
                        delete_genes: validGenes,
                        objective: selectedRxn,
                        choice: choice
                    }),
                }
            )

            const returned_data = await res.json()
            console.log(returned_data)
            if (returned_data.status === 'error')
                throw new Error(returned_data.message)

            const geneReactionTable = returned_data.gene_reaction_table

            const genesLookup = {}
            const gprLookup = {}

            geneReactionTable.forEach((row) => {
                genesLookup[row.reaction] = row.gene
                gprLookup[row.reaction] = row.gene_reaction_rule
            })
            const finalModelData = {}

            Object.entries(modelData).forEach(([pathKey, pathObj]) => {
                const enzymes = pathObj.enzymes
                const metabolites = pathObj.metabolites

                const updatedEnzymes = {}
                const updatedMetabolites = {}
                const updatedGenes = {}
                const updatedGPR = {}

                Object.entries(metabolites).forEach(([met, arr]) => {
                    const updatedArr = [...arr]
                    updatedArr[4] = 'No weight'
                    updatedMetabolites[met] = updatedArr
                })

                Object.entries(enzymes).forEach(([enz, arr]) => {
                    const updatedArr = [...arr]
                    updatedArr[1] = 'Not calculated'
                    updatedEnzymes[enz] = updatedArr
                    if (genesLookup[enz]) {
                        updatedGenes[enz] = genesLookup[enz]
                    }
                    if (gprLookup[enz]) {
                        updatedGPR[enz] = gprLookup[enz]
                    }
                })

                finalModelData[pathKey] = {
                    ...pathObj,
                    enzymes: updatedEnzymes,
                    metabolites: updatedMetabolites,
                    genes: updatedGenes,
                    gpr: updatedGPR,
                }
            })

            setModelData(finalModelData)
            setStats(returned_data?.result)
            setLayout('default')
            setStep('done')
        } catch (err) {
            const errorMessage =
                err.response?.data?.message ||
                err.message ||
                'Failed to delete genes'

            toast.error(`Error: ${errorMessage}`)
            setStep('select')
        }
    }

    return (
        <Dialog
            open={isOpenDeleteGeneModal}
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
                                Delete Genes From Model
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenDeleteGeneModal(false)
                                    setStep('select')
                                    setStats(null)
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Upload A CSV File with one column (Genes) and the
                            rows containing the gene names
                        </p>
                    </div>
                    {step === 'select' && (
                        <div className="mt-4 flex flex-col gap-3">
                            {/* OBJECTIVE SELECTION */}
                            <div className="flex flex-col gap-2">
                                <h2 className="text-sm font-semibold text-gray-800">
                                    Select Cellular Objective
                                </h2>

                                <div className="relative">
                                    <input
                                        value={query}
                                        onChange={(e) =>
                                            setQuery(e.target.value)
                                        }
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        type="text"
                                        placeholder="Search reaction..."
                                    />

                                    {query && (
                                        <ul className="absolute left-0 right-0 z-[100] mt-1 max-h-44 overflow-y-auto rounded-md border bg-white shadow-lg">
                                            {filtered?.length === 0 ? (
                                                <li className="px-3 py-2 text-sm text-gray-500">
                                                    No results
                                                </li>
                                            ) : (
                                                filtered?.map((r) => (
                                                    <li
                                                        key={r.abbr}
                                                        className="cursor-pointer px-3 py-2 text-sm hover:bg-indigo-50"
                                                        onClick={() => {
                                                            setSelectedRxn(
                                                                r.abbr
                                                            )
                                                            setQuery('')
                                                        }}
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-gray-800">
                                                                {r.abbr} —{' '}
                                                                {r.description}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
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
                                    <div className="mt-1 text-sm text-green-700">
                                        Selected reaction:{' '}
                                        <span className="font-semibold">
                                            {selectedRxn}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 flex flex-col gap-3">
                                <h2 className="text-sm font-medium">
                                    Choose how the gene deletion should be
                                    applied
                                </h2>
                                <div className="mx-auto grid grid-cols-2 gap-4">
                                    <label className="flex cursor-pointer items-center gap-2">
                                        <input
                                            type="radio"
                                            value="temporary"
                                            checked={choice === 'temporary'}
                                            onChange={() =>
                                                setChoice('temporary')
                                            }
                                        />
                                        Temporary Gene Knockout
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2">
                                        <input
                                            type="radio"
                                            value="permanent"
                                            checked={choice === 'permanent'}
                                            onChange={() =>
                                                setChoice('permanent')
                                            }
                                        />
                                        Permanent Gene Removal
                                    </label>
                                </div>
                            </div>

                            {/* FILE UPLOAD */}
                            <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <h2 className="text-sm font-semibold text-gray-800">
                                    Upload Gene Knockout File
                                </h2>

                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) =>
                                        setSelectedFile(e.target.files[0])
                                    }
                                    className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-1 file:text-white hover:file:bg-indigo-700"
                                />

                                {selectedFile && (
                                    <span className="text-xs text-gray-600">
                                        {selectedFile.name}
                                    </span>
                                )}
                            </div>

                            {/* ACTION BUTTON */}

                            <button
                                disabled={!selectedFile}
                                onClick={() => {
                                    setStep('loading')
                                    handleDeleteGenesFromModel()
                                }}
                                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                            >
                                Delete Genes From Model
                            </button>
                        </div>
                    )}
                    {step === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-6">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Deleting genes from model...
                            </p>
                        </div>
                    )}
                    {step === 'done' && stats && (
                        <div className="flex flex-col gap-4">
                            <div className="mt-2 text-center text-sm font-semibold text-green-700">
                                ✅ Gene deletion completed successfully
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded border bg-gray-50 p-3">
                                    <p className="text-gray-500">
                                        Objective Before
                                    </p>
                                    <p className="font-semibold">
                                        {stats.objective_before?.toFixed(4)}
                                    </p>
                                </div>

                                <div className="rounded border bg-gray-50 p-3">
                                    <p className="text-gray-500">
                                        Objective After
                                    </p>
                                    <p className="font-semibold">
                                        {stats.objective_after?.toFixed(4)}
                                    </p>
                                </div>

                                <div className="rounded border bg-gray-50 p-3">
                                    <p className="text-gray-500">
                                        Change in Objective
                                    </p>
                                    <p className="font-semibold">
                                        {stats.change_in_objective?.toFixed(4)}
                                    </p>
                                </div>

                                <div className="rounded border bg-gray-50 p-3">
                                    <p className="text-gray-500">
                                        Percent Change
                                    </p>
                                    <p className="font-semibold">
                                        {stats.percent_change?.toFixed(2)} %
                                    </p>
                                </div>

                                <div className="rounded border bg-gray-50 p-3">
                                    <p className="text-gray-500">
                                        Blocked Reactions Before
                                    </p>
                                    <p className="font-semibold">
                                        {stats.blocked_reactions_before}
                                    </p>
                                </div>

                                <div className="rounded border bg-gray-50 p-3">
                                    <p className="text-gray-500">
                                        Blocked Reactions After
                                    </p>
                                    <p className="font-semibold">
                                        {stats.blocked_reactions_after}
                                    </p>
                                </div>

                                <div className="col-span-2 rounded border bg-gray-50 p-3">
                                    <p className="text-gray-500">
                                        Newly Blocked Reactions
                                    </p>
                                    <p className="font-semibold text-red-600">
                                        +{stats.blocked_reactions_change}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setStep('select')
                                    setIsOpenDeleteGeneModal(false)
                                }}
                                className="mt-2 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                            >
                                Back to session
                            </button>
                        </div>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    )
}

export default DeleteGenesModal
