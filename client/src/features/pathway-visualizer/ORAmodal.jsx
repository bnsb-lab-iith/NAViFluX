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

function ORAmodal({ isOpenORAmodal, setIsOpenORAmodal }) {
    const { modelData, setLayout } = useModel()
    const [stepORA, setStepORA] = useState('upload')
    const [cutoff, setCutoff] = useState(0.05)
    // "upload", "loading", "done"
    const [selectedFile, setSelectedFile] = useState(null)

    async function handleORA() {
        if (!selectedFile) return alert('Please select a file.')

        const reader = new FileReader()

        reader.onload = async (e) => {
            const text = e.target.result.trim()
            const lines = text.split('\n')

            // Parse CSV -> array of rows
            const header = lines[0].split(',').map((h) => h.trim())

            if (header.length !== 1 || header[0] !== 'Reaction') {
                alert(
                    "Invalid CSV. The file must contain exactly one column named 'Reaction'."
                )
                return
            }

            // ---- Parse reactions ----
            const reactions = lines
                .slice(1) // skip header
                .map((row) => row.trim()) // each row is a reaction name
                .filter((r) => r.length > 0) // remove empty lines
                .map((r) => r.replace(/^"(.*)"$/, '$1')) // remove quotes if present

            try {
                setStepORA('loading')
                const res = await fetch(
                    'http://127.0.0.1:5000/api/v1/over-representation-analysis',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            reactions: reactions,
                            modelData,
                        }),
                    }
                )

                const data = await res.json()

                const results = data.results
                if (!results || results.length === 0) {
                    alert('No results to export')
                    return
                }

                // Extract headers (keys)
                const headers = Object.keys(results[0])

                const firstColKey = headers[0]
                

                // Filter rows where first column value < cutoff
                const filteredResults = results.filter(
                    (row) => Number(row[firstColKey]) < cutoff
                )

                // Convert to CSV string
                const csvRows = [
                    headers.join(','), // header row
                    ...filteredResults.map((obj) =>
                        headers
                            .map((h) => JSON.stringify(obj[h] ?? ''))
                            .join(',')
                    ),
                ]
                const csvString = csvRows.join('\n')

                // Create file blob
                const blob = new Blob([csvString], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)

                // Create hidden download link
                const a = document.createElement('a')
                a.href = url
                a.download = 'over-representation-analysis.csv'
                a.click()

                URL.revokeObjectURL(url)
                setStepORA('done')
                setLayout('default')
            } catch (err) {
                setStepORA('upload')
                toast.error(err.message)
            }
        }

        reader.readAsText(selectedFile)
    }
    return (
        <Dialog
            open={isOpenORAmodal}
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
                                Over Representation Analysis
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenORAmodal(false)
                                    setSelectedFile(null)
                                    setStepORA('upload')
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Upload a CSV file which contains one columns
                            (Reaction) to perform Over Representation Analysis.
                        </p>
                    </div>

                    {stepORA === 'upload' && (
                        <>
                            <div className="mt-4 flex flex-col gap-4">
                                <div className="flex justify-between">
                                    <label className="font-medium">
                                        Adjusted p-Value:{' '}
                                    </label>
                                    <select
                                        onChange={(e) =>
                                            setCutoff(Number(e.target.value))
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
                                                setStepORA('loading')
                                                handleORA()
                                            }}
                                        >
                                            Upload
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}

                    {stepORA === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-4">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Uploading completed ✅. performing Analysis.....
                            </p>
                        </div>
                    )}

                    {stepORA === 'done' && (
                        <div className="mt-4 flex flex-col items-center">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
                                <span>✅</span>
                                <span>Analysis completed Sucessfully</span>
                            </div>
                            <Button
                                className="mt-4 w-full text-center font-semibold"
                                onClick={() => {
                                    setStepORA('upload')
                                    setIsOpenORAmodal(false)
                                    setSelectedFile(null)
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

export default ORAmodal
