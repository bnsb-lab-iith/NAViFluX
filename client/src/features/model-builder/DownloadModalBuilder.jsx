import { Dialog } from '@headlessui/react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import Spinner from '../../ui/Spinner'

function DownloadModal({
    isOpenDownloadModal,
    setIsOpenDownloadModal,
    setStepDownloadModal,
    stepDownloadModal,
    modelData,
}) {
    const [selectedRxn, setSelectedRxn] = useState(null)
    const [query, setQuery] = useState('')

    const buildSearchList = (modelData) => {
            if (!modelData) return []
            const searchList = []
            
            Object.entries(modelData).map(([path, pathObj]) => {
                Object.entries(pathObj).map(([enz, enzObj]) => {
                    searchList.push({
                        abbr: enz,
                        description: enzObj.description,
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
    
    async function handleDownloadModel() {
        
        const finalModelData = {}
        Object.keys(modelData).map(
            (path) =>
                (finalModelData[path] = {
                    currency_edges: [],
                    edges: [],
                    enzymes: {},
                    metabolites: {},
                    genes: {},
                    enzyme_crossref: {},
                    stoichiometry: {}
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
                const subs = enzObj.subsystem
                newPathObj.enzymes[enzyme] = [desc, 'Not calculated', lb, ub, subs]
                Object.entries(enzObj.metabolites).map(([met, description]) => {
                    newPathObj.metabolites[met] = description
                })
                newPathObj.genes[enzyme] = enzObj.genes
                newPathObj.enzyme_crossref[enzyme] = {"BIGG": [], "EC": [], "KEGG": []}
                newPathObj.stoichiometry[enzyme] = enzObj.stoichiometry
            })
        })
        
        try {
            setStepDownloadModal('loading')
            const res = await fetch(
                'http://127.0.0.1:5000/api/v1/download-model-test',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        new_rxn: finalModelData,
                        file_type: fileType,
                        objective: selectedRxn || 'No objective'
                    }),
                }
            )

            if (!res.ok) {
                toast.error('Download failed')
                throw new Error('Download Failed')
            }
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.style.display = 'none'
            a.href = url
            a.download = `model${fileType}`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            setStepDownloadModal('done')
            setSelectedRxn('')
            setQuery('')
        } catch (err) {
            const errorMessage =
                err.response?.data?.message ||
                err.message ||
                'Failed to fetch reaction options'
            toast.error(`Error: ${errorMessage}`)
            setStepDownloadModal('preview')
        }
    }
    const [fileType, setFileType] = useState('.mat')
    return (
        <Dialog
            open={isOpenDownloadModal}
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
                                Review and download model
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenDownloadModal(false)
                                    setStepDownloadModal('preview')
                                    setSelectedRxn('')
                                    setQuery('')
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Please review your model and select an objective
                            function. maximization of the flux through one or
                            more reactions can conveniently be done by simply
                            assigning to the model.objective property. If not
                            mentioned, the first reaction in model.reactions
                            will be considered
                        </p>
                    </div>
                    {stepDownloadModal === 'preview' && (
                        <div className="mt-4 flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <h2 className="text-left text-sm font-medium">
                                    Select objective function
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
                                    <h2 className='mt-3'>
                                        You have selected:{' '}
                                        <strong>{selectedRxn}</strong>
                                    </h2>
                                )}
                            </div>
                            <h2 className="text-sm font-medium">
                                Please select file type
                            </h2>
                            <div className="mx-auto flex gap-4">
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value=".mat"
                                        checked={fileType === '.mat'}
                                        onChange={() => setFileType('.mat')}
                                    />
                                    MATLAB (.mat)
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value=".xml"
                                        checked={fileType === '.xml'}
                                        onChange={() => setFileType('.xml')}
                                    />
                                    SBML (.xml)
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value=".json"
                                        checked={fileType === '.json'}
                                        onChange={() => setFileType('.json')}
                                    />
                                    JSON (.json)
                                </label>
                            </div>
                            <button
                                onClick={() => {
                                    setStepDownloadModal('loading')
                                    handleDownloadModel()
                                }}
                                className="items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 hover:shadow"
                            >
                                Download Model
                            </button>
                        </div>
                    )}
                    {stepDownloadModal === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-6">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Downloading Model...
                            </p>
                        </div>
                    )}
                    {stepDownloadModal === 'done' && (
                        <>
                            <div className="my-4 gap-2 text-center text-sm font-semibold text-green-700">
                                <span>✅</span>
                                <span>Your Model downloaded successfully!</span>
                            </div>
                            <button
                                onClick={() => {
                                    setStepDownloadModal('preview')
                                    setIsOpenDownloadModal(false)
                                    setSelectedRxn('')
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

export default DownloadModal
