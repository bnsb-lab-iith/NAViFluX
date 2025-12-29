import { Dialog } from '@headlessui/react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import Spinner from '../../ui/Spinner'
import { useModel } from '../../contexts/ModelContext'
import { Card, CardContent, CardHeader, CardTitle } from './../../ui/Card'
import { Label } from '../../ui/Label'
import { Input } from '../../ui/Input'
import { Upload } from 'lucide-react'
import { Button } from '../../ui/Button'
import { formatModelData } from '../../utils/formatModelData'
import { batchExtractWithPositions } from '../../utils/batchExtractWithPositions'

function FileUploadModal({ isOpenFileModal, setIsOpenFileModal }) {
    const [step, setStep] = useState('select')
    const [selectedFile, setSelectedFile] = useState(null)
    const [networkFiles, setNetworkFiles] = useState([])
    const [nameFile, setNameFile] = useState(null)
    const [upload_type, setUploadType] = useState('single')
    const {
        setModelData,
        setIsLoadingModel,
        setSession_id,
        setUploadMode,
        uploadMode,
        setBatchOutput,
        setSelectedPathways,
        setLayout,
        setInitialModelData,
        setInitialBatchOuptutData,
        handleCheckboxChangePathway,
        database,
        setDatabase,
        colorAction,
        setColorAction,
        edgeFormat, setEdgeFormat
    } = useModel()

    async function handleUpload() {
        if (!selectedFile) return alert('Please select a file.')
        setModelData(null)
        setUploadMode('single')
        setInitialModelData(null)
        setSelectedPathways([])
        setBatchOutput(null)
        setInitialBatchOuptutData(null)
        setDatabase(null)
        const formData = new FormData()
        formData.append('file', selectedFile)
        try {
            setIsLoadingModel(true)
            const res = await fetch(
                'http://127.0.0.1:5000/api/v1/cobra-model',
                {
                    method: 'POST',
                    body: formData,
                }
            )

            const data = await res.json()

            if (data.status === 'error') throw new Error(data.message)

            setModelData(data?.result)
            setDatabase(data?.database)
            const first_pathway = Object.keys(data?.result)[0]
            handleCheckboxChangePathway(first_pathway)
            setInitialModelData(JSON.parse(JSON.stringify(data?.result)))
            setSession_id(data?.session_id)
            setLayout('hierarchical-lr')
            setColorAction('flux')
            setStep('done')
            setEdgeFormat('flux')
            setIsLoadingModel(false)
        } catch (err) {
            toast.error(err.message)
            setStep('select')
        } finally {
            setIsLoadingModel(false)
        }
    }

    const handleBatchUpload = async () => {
        if (!networkFiles.length) {
            alert('Please select JSON network files.')
            return
        }
        setUploadMode('batch')
        setModelData(null)
        setInitialModelData(null)
        setLayout('default')
        setBatchOutput(null)
        setInitialBatchOuptutData(null)
        setSelectedPathways([])

        const files = Array.from(networkFiles)
        const contents = await Promise.all(
            files.map((file) => file.text().then((text) => JSON.parse(text)))
        )

        const names = files.map((file) => file.name.replace(/\.json$/i, ''))

        const inputList = contents.map((net, idx) => ({
            name: names[idx],
            nodes: net.nodes,
            edges: net.edges,
            cur_edges: net.currency_edges
        }))
    
        const result = batchExtractWithPositions(inputList)

        const result2 = formatModelData(inputList)

      
        setModelData(result2)

        setInitialModelData(JSON.parse(JSON.stringify(result2)))
        // setInitialModelData(result)
        setBatchOutput(result)
        setInitialBatchOuptutData(JSON.parse(JSON.stringify(result)))
        setSession_id(crypto.randomUUID())
        setEdgeFormat('flux')
        setStep('done')
    }

    return (
        <Dialog
            open={isOpenFileModal}
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
                            <Dialog.Title className="text-sm font-semibold">
                                Upload Files
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenFileModal(false)
                                    setSelectedFile(null)
                                    setNetworkFiles([])
                                    setNameFile(null)
                                    setStep('select')
                                    setColorAction('flux')
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Upload a COBRA model (.mat, .XML, .json) or NAViFlux JSON
                            file (s). Once uploaded, we will analyse your model
                            and provide pathway wise visualisations
                        </p>
                    </div>

                    {step === 'select' && (
                        <div className="mt-4 flex flex-col gap-4">
                            <div className="mx-auto flex gap-4">
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="single"
                                        checked={upload_type === 'single'}
                                        onChange={() => setUploadType('single')}
                                    />
                                    COBRA Model Upload
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="batch"
                                        checked={upload_type === 'batch'}
                                        onChange={() => setUploadType('batch')}
                                    />
                                    NAViFlux JSON Upload
                                </label>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-sm">
                                        <Upload className="h-3 w-3" />
                                        {upload_type === 'single'
                                            ? 'Upload Model'
                                            : 'Upload Multiple NAViFlux files'}
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    {upload_type === 'single' ? (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="file-upload">
                                                    Select File
                                                </Label>
                                                <Input
                                                    id="file-upload"
                                                    type="file"
                                                    onChange={(e) =>
                                                        setSelectedFile(
                                                            e.target
                                                                .files?.[0] ||
                                                                null
                                                        )
                                                    }
                                                    className="cursor-pointer"
                                                />
                                            </div>
                                            {selectedFile && (
                                                <div className="text-muted-foreground bg-muted rounded text-sm">
                                                    Selected:{' '}
                                                    {selectedFile.name}
                                                </div>
                                            )}
                                            <Button
                                                className="w-full text-center font-semibold"
                                                disabled={!selectedFile}
                                                onClick={() => {
                                                    setStep('loading')
                                                    handleUpload()
                                                }}
                                            >
                                                Upload
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="batch-files">
                                                    Select JSON Files
                                                </Label>
                                                <Input
                                                    id="batch-files"
                                                    type="file"
                                                    multiple
                                                    accept=".json"
                                                    onChange={(e) =>
                                                        setNetworkFiles(
                                                            e.target.files
                                                        )
                                                    }
                                                    className="cursor-pointer"
                                                />
                                            </div>

                                            <Button
                                                className="w-full text-center font-semibold"
                                                onClick={() => {
                                                    setStep('loading')
                                                    handleBatchUpload()
                                                }}
                                            >
                                                Upload NAViFlux file(s)
                                            </Button>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {step === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-4">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Uploading completed ✅. Analysing model.....
                            </p>
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="mt-4 flex flex-col items-center">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
                                <span>✅</span>
                                <span>
                                    Your{' '}
                                    {upload_type === 'single'
                                        ? 'Model'
                                        : 'JSON file (s)'}{' '}
                                    analyzed successfully!
                                </span>
                            </div>
                            <Button
                                className="mt-4 w-full text-center font-semibold"
                                onClick={() => {
                                    setStep('select')
                                    setIsOpenFileModal(false)
                                    setSelectedFile(null)
                                    setNetworkFiles([])
                                    setNameFile(null)
                                }}
                            >
                                Visualize pathways
                            </Button>
                        </div>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    )
}

export default FileUploadModal
