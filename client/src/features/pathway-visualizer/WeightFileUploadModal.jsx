import { useState } from 'react'
import { useModel } from '../../contexts/ModelContext'
import { Dialog } from '@headlessui/react'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card'
import { Upload } from 'lucide-react'
import { Label } from '../../ui/Label'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import toast from 'react-hot-toast'
import Spinner from '../../ui/Spinner'

function WeightFileUploadModal({
    openWeightFileModal,
    setIsOpenWeightFileModal,
}) {
    const {
        modelData,
        setModelData,
        setColorAction,
        setEdgeFormat,
        setLayout

    } = useModel()
    const [step, setStep] = useState('select')
    const [uploadedFile, setUploadedFile] = useState(null)

    function handleUpload() {
   
        if (!uploadedFile) return toast.error('File not uploaded')
        const reader = new FileReader()
        reader.onload = (event) => {
            const text = event.target.result
            const lines = text.trim().split('\n')
            const [header, ...rows] = lines

            if (!/^node\s*,\s*weights$/i.test(header.trim())) {
                setStep('select')
                toast.error(
                    'Invalid CSV format. Expected "node,weights" as header.'
                )
                return
            }
        
            const weights = {}
            for (const line of rows) {
                const [reaction, weightStr] = line.split(',')
                const weight = parseFloat(weightStr?.trim())
                if (!reaction || isNaN(weight)) {
                    toast.error(`Invalid row: "${line}"`)
                    return
                }
                weights[reaction.trim()] = weight
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
        
            setModelData(finalModelData)
            setColorAction('weight')
            setEdgeFormat('weight')
            setLayout("default")
        }
        reader.readAsText(uploadedFile)
        setStep('done')
    }

    return (
        <Dialog
            open={openWeightFileModal}
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
                                Upload Weight Files
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenWeightFileModal(false)
                                    setUploadedFile(null)
                                    setStep('select')
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Upload a Reaction Weight File (.csv) that contains two
                            columns (reactions, weights). Also note that the
                            weights will be applied to only reactions and any
                            reaction without any weight will be assigned to `NOT
                            ASSIGNED`
                        </p>
                    </div>

                    {step === 'select' && (
                        <div className="mt-4 flex flex-col gap-4">
                            <div className="mx-auto flex gap-4">
                                <label className="flex cursor-pointer items-center gap-2"></label>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-sm">
                                        <Upload className="h-3 w-3" />
                                        Upload Weight File
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="file-upload">
                                                Select File
                                            </Label>
                                            <Input
                                                id="file-upload"
                                                type="file"
                                                accept=".csv,text/csv"
                                                onChange={(e) =>
                                                    setUploadedFile(
                                                        e.target.files?.[0] ||
                                                            null
                                                    )
                                                }
                                                className="cursor-pointer"
                                            />
                                        </div>
                                        {uploadedFile && (
                                            <div className="text-muted-foreground bg-muted rounded text-sm">
                                                Selected: {uploadedFile.name}
                                            </div>
                                        )}
                                        <Button
                                            className="w-full text-center font-semibold"
                                            disabled={!uploadedFile}
                                            onClick={() => {
                                                setStep('loading')
                                                handleUpload()
                                            }}
                                        >
                                            Upload
                                        </Button>
                                    </>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {step === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-4">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Weight File Uploaded ✅. Applying weights.....
                            </p>
                        </div>
                    )}
                    {step === 'done' && (
                        <div className="mt-4 flex flex-col items-center">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
                                <span>✅</span>
                                <span>
                                    Your weight file applied successfully to the
                                    current model
                                </span>
                            </div>
                            <Button
                                className="mt-4 w-full text-center font-semibold"
                                onClick={() => {
                                    setStep('select')
                                    setIsOpenWeightFileModal(false)
                                    setUploadedFile(null)
                                }}
                            >
                                Back to session
                            </Button>
                        </div>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    )
}

export default WeightFileUploadModal
