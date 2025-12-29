import { Dialog } from '@headlessui/react'
import { useState } from 'react'
import Spinner from '../../ui/Spinner'

function ExportAsImageModal({
    isOpenImageModal,
    setIsOpenImageModal,
    visualizerRef,
}) {
    const [imageType, setImageType] = useState('.png')
    const [stepImage, setStepImage] = useState('select')

    function handleImageDownload() {
        if (
            visualizerRef.current &&
            typeof visualizerRef.current.exportImage === 'function'
        ) {
            visualizerRef.current.exportImage(imageType)
        }
        setStepImage('done')
    }
    return (
        <Dialog
            open={isOpenImageModal}
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
                                Export Image
                            </Dialog.Title>
                            <button
                                onClick={() => {
                                    setIsOpenImageModal(false)
                                    setStepImage('select')
                                }}
                                className="text-xl text-gray-400 hover:text-black focus:outline-none"
                                aria-label="Close modal"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Select an option to export current visualisation as an image
                        </p>
                    </div>
                    {stepImage === 'select' && (
                        <div className="mt-4 flex flex-col gap-6">
                            <h2 className="text-sm font-medium">
                                Please select file type
                            </h2>
                            <div className="mx-auto flex gap-4">
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="tiff"
                                        checked={imageType === 'tiff'}
                                        onChange={() => setImageType('tiff')}
                                    />
                                    TIFF
                                </label>

                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="svg"
                                        checked={imageType === 'svg'}
                                        onChange={() => setImageType('svg')}
                                    />
                                    SVG
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="png"
                                        checked={imageType === 'png'}
                                        onChange={() => setImageType('png')}
                                    />
                                    PNG
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="radio"
                                        value="pdf"
                                        checked={imageType === 'pdf'}
                                        onChange={() => setImageType('pdf')}
                                    />
                                    PDF
                                </label>
                            </div>
                            <button
                                onClick={() => {
                                    setStepImage('loading')
                                    handleImageDownload()
                                }}
                                className="items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 hover:shadow"
                            >
                                Download Image
                            </button>
                        </div>
                    )}
                    {stepImage === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-6">
                            <Spinner />
                            <p className="mt-4 text-sm text-gray-600">
                                Downloading image...
                            </p>
                        </div>
                    )}
                    {stepImage === 'done' && (
                        <>
                            <div className="my-4 gap-2 text-center text-sm font-semibold text-green-700">
                                <span>✅</span>
                                <span>Image downloaded successfully !</span>
                            </div>
                            <button
                                onClick={() => {
                                    setStepImage('select')
                                    setIsOpenImageModal(false)
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

export default ExportAsImageModal
