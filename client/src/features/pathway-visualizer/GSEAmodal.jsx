import { useState } from 'react'
import { useModel } from '../../contexts/ModelContext'
import { Dialog } from '@headlessui/react'
import toast from 'react-hot-toast'
import Spinner from '../../ui/Spinner'
import { Card, CardContent, CardHeader, CardTitle } from './../../ui/Card'
import { Label } from '../../ui/Label'
import { Input } from '../../ui/Input'
import { Upload } from 'lucide-react'
import { Button } from '../../ui/Button'

function GSEAmodal({
    isOpenGSEAmodal,
    setIsOpenGSEAmodal,
    stepGSEA,
    setStepGSEA,
    setGSEAnodes,
    setGSEAedges,
    setGSEAtable,
    setSelectedColumn,
    selectedColumn,
}) {
    const { modelData, setLayout } = useModel()
    const [selectedFile, setSelectedFile] = useState(null)
    const [minsize, setMinSize] = useState(3)
    const [maxsize, setMaxSize] = useState(500)
    const [permutations, setPermuations] = useState(1000)
    const [cutoff, setCutOff] = useState(0.05)

    async function handleGSEA() {
        if (!selectedFile) return alert('Please select a file.')
        if (minsize < 0 || maxsize < 0 || permutations < 0) {
            setStepGSEA('upload')
            return alert('All paramters must be greater than 0')
        }
        if (maxsize < minsize) {
            setStepGSEA('upload')
            return alert('Max size must be greater than min size')
        }

        setGSEAedges(null)
        setGSEAnodes(null)
        setGSEAtable(null)

        console.log(minsize, maxsize, permutations)
    

        const reader = new FileReader()

        reader.onload = async (e) => {
            const text = e.target.result
    

            // Parse CSV -> array of rows
            const rows = text
                .trim()
                .split('\n')
                .slice(1) // skip header
                .map((row) =>
                    row.split(',').map((value) => {
                        // remove surrounding quotes if present
                        value = value.replace(/^"(.*)"$/, '$1')

                        // convert to float if it's a number
                        const num = parseFloat(value)
                        return isNaN(num) ? value : num
                    })
                )


            try {
                setStepGSEA('loading')
                const res = await fetch(
                    'http://127.0.0.1:5000/api/v1/gene-set-enrichment-analysis',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            filedata: rows, // send rows
                            modelData,
                            minsize,
                            maxsize,
                            permutations,
                        }),
                    }
                )

                const data = await res.json()
    
                if (data.status === 'error') throw new Error(data.message)
                const filtered_gsea = data?.gsea_df.filter(obj => obj[selectedColumn] < cutoff);

          

                try {
                    const response = await fetch('http://127.0.0.1:5000/api/v1/download-gsea'); 
                    if (!response.ok) throw new Error('Failed to download');

                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', 'GSEA_results.zip');
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                } catch (error) {
                    console.error('Download error:', error);
                }
                setGSEAtable(filtered_gsea)
                setGSEAnodes(data.nodes)
                setGSEAedges(data.edges)
                setStepGSEA('fetching-done')
                setLayout("default")
            } catch (err) {
                setStepGSEA('upload')
                toast.error(err.message)
            }
        }

        reader.readAsText(selectedFile)
    }

    return (
        <Dialog
            open={isOpenGSEAmodal}
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
                <Dialog.Panel className="relative w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
                    <div>
                        <div className="flex items-center justify-between">
                            <Dialog.Title className="text-md font-semibold">
                                Upload Weight File For RSEA
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenGSEAmodal(false)
                                    setSelectedFile(null)
                                    setStepGSEA('upload')
                                    setCutOff(0.05)
                                    setSelectedColumn("FDR q-val");
                                    setMinSize(3)
                                    setMaxSize(500)
                                    setPermuations(1000)
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Upload a ranked list CSV file which contains two columns (Reaction. Rank) to perform Pathway Enrichment. Reactions present in the CSV file but not in your current model will lead to an Error. 
                        </p>
                    </div>

                    {stepGSEA === 'upload' && (
                        <>
                            <h2 className="mt-4 text-md font-semibold text-gray-800">
                                RSEA Parameters
                            </h2>
                            <div className="mt-4 flex flex-col gap-4">
                                <div className="flex gap-2">
                                    <input
                                        onChange={(e) =>
                                            setPermuations(
                                                Number(e.target.value)
                                            )
                                        }
                                        type="number"
                                        placeholder="Permutations Default - 1000"
                                        className="w-1/2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                    />
                                    <input
                                        onChange={(e) =>
                                            setMinSize(Number(e.target.value))
                                        }
                                        type="number"
                                        placeholder="Min Size - 3"
                                        className="w-1/4 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                    />
                                    <input
                                        onChange={(e) =>
                                            setMaxSize(Number(e.target.value))
                                        }
                                        type="number"
                                        placeholder="Max Size - 500"
                                        className="w-1/4 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                    />
                                </div>

                                <div className="flex justify-between">
                                    <label>Threshold Column: </label>
                                    <select
                                        onChange={(e) =>
                                            setSelectedColumn(e.target.value)
                                        }
                                        className="w-2/3 rounded-lg border border-gray-300 bg-gray-50 px-3 py-1 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                    >
                                        <option value="FDR q-val">
                                            FDR q-val
                                        </option>
                                        
                                        <option value="FWER p-val">
                                            FWER p-val
                                        </option>
                                    </select>
                                </div>
                                <div className="flex justify-between">
                                    <label>Adjusted p-Value: </label>
                                    <select
                                        onChange={(e) =>
                                            setCutOff(Number(e.target.value))
                                        }
                                        className="w-2/3 rounded-lg border border-gray-300 bg-gray-50 px-3 py-1 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                    >
                                        <option value={0.05}>0.05</option>
                                        <option value={0.01}>0.01</option>
                                        
                                    </select>
                                </div>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-sm">
                                            <Upload className="h-3 w-3" />
                                            Upload File
                                        </CardTitle>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="file-upload">
                                                Select File
                                            </Label>
                                            <Input
                                                id="file-upload"
                                                type="file"
                                                accept=".csv"
                                                onChange={(e) =>
                                                    setSelectedFile(
                                                        e.target.files?.[0] ||
                                                            null
                                                    )
                                                }
                                                className="cursor-pointer"
                                            />
                                        </div>
                                        {selectedFile && (
                                            <div className="text-muted-foreground bg-muted rounded text-sm">
                                                Selected: {selectedFile.name}
                                            </div>
                                        )}
                                        <Button
                                            className="w-full text-center font-semibold"
                                            disabled={!selectedFile}
                                            onClick={() => {
                                                setStepGSEA('loading')
                                                handleGSEA()
                                            }}
                                        >
                                            Upload
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}

                    {stepGSEA === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-4">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Uploading completed ✅. performing GSEA.....
                            </p>
                        </div>
                    )}

                    {stepGSEA === 'fetching-done' && (
                        <div className="mt-4 flex flex-col items-center">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
                                <span>✅</span>
                                <span>GSEA completed Sucessfully</span>
                            </div>
                            <Button
                                className="mt-4 w-full text-center font-semibold"
                                onClick={() => {
                                    setStepGSEA('select')
                                    setIsOpenGSEAmodal(false)
                                    setSelectedFile(null)
                                    setMinSize(3)
                                    setMaxSize(500)
                                    setPermuations(1000)
                                    setCutOff(0.05)
                                }}
                            >
                                Visualize induced subgraphs of enriched pathways
                            </Button>
                        </div>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    )
}

export default GSEAmodal
