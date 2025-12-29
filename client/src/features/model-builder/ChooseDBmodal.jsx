import { Dialog } from '@headlessui/react'
import toast from 'react-hot-toast'
import { useBuilder } from '../../contexts/BuilderContext'
import { useState } from 'react'

function ChooseDBmodal({ isOpenDBModal, setIsOpenDBModal }) {
    const { setDatabase } = useBuilder()
    const [db, setDB] = useState('BIGG')
    return (
        <Dialog
            open={isOpenDBModal}
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
                                Database Selection
                            </Dialog.Title>
                        </div>
                        <p className="my-1 text-sm text-gray-600">
                            Select a database of your choice, from which
                            reactions will be added. NOTE that this is a one
                            time selection, if you wish to change the database
                            you ideally will have to restart from scratch
                        </p>
                    </div>

                    <div className="mt-4 flex flex-col gap-6">
                        <h2 className="text-sm font-medium">
                            Please select database type
                        </h2>
                        <div className="mx-auto grid grid-cols-2 gap-4">
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="radio"
                                    value="BIGG"
                                    checked={db === 'BIGG'}
                                    onChange={() => setDB('BIGG')}
                                />
                                BiGG Database
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="radio"
                                    value="KEGG"
                                    checked={db === 'KEGG'}
                                    onChange={() => setDB('KEGG')}
                                />
                                KEGG Database
                            </label>
                        </div>
                        <button
                            onClick={() => {
                                toast.success(`Selected ${db} Database`)
                                setDatabase(db)
                                setIsOpenDBModal(false)
                            }}
                            className="items-center gap-3 rounded-md border border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 hover:shadow"
                        >
                            Set Database and back to session
                        </button>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    )
}

export default ChooseDBmodal
