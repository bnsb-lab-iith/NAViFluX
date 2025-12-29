import { useState } from 'react'

function NodeTable({ nodes }) {
    const itemsPerPage = 10
    const [currentPage, setCurrentPage] = useState(1)
    

    const totalPages = Math.max(1, Math.ceil(nodes.length / itemsPerPage))

    const paginatedNodes = nodes.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )
    return (
        <section className="border-t border-stone-300 bg-white px-6 py-10 md:px-16">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-stone-800">
                    Canvas Nodes
                </h3>
                <span className="text-sm text-stone-500">
                    {nodes.length} total nodes
                </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-stone-200 shadow-sm">
                <table className="min-w-full divide-y divide-stone-200 text-sm text-stone-800">
                    <thead className="bg-stone-50 text-stone-600">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">
                                ID
                            </th>
                            <th className="px-4 py-3 text-left font-semibold">
                                Abbreviation
                            </th>
                            <th className="px-4 py-3 text-left font-semibold">
                                Label
                            </th>
                            <th className="px-4 py-3 text-left font-semibold">
                                Type
                            </th>
                            <th className="px-4 py-3 text-left font-semibold">
                                X
                            </th>
                            <th className="px-4 py-3 text-left font-semibold">
                                Y
                            </th>
                            <th className="px-4 py-3 text-left font-semibold">
                                Pathway
                            </th>
                            
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                        {nodes.length === 0 && currentPage === 1 ? (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-4 text-center italic text-stone-500"
                                >
                                    No nodes available on canvas.
                                </td>
                            </tr>
                        ) : (
                            paginatedNodes.map((node) => (
                                <tr
                                    key={node.id}
                                    className="transition duration-150 hover:bg-stone-50"
                                >
                                    <td className="px-4 py-3 font-mono text-indigo-600">
                                        {node.id}
                                    </td>
                                    <td className="px-4 py-3">
                                        {node.data?.info || (
                                            <span className="italic text-stone-400">
                                                N/A
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {node.data?.abbreviation || (
                                            <span className="italic text-stone-400">
                                                N/A
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 capitalize">
                                        {node.type}
                                    </td>
                                    <td className="px-4 py-3">
                                        {Math.round(node.position.x)}
                                    </td>
                                    <td className="px-4 py-3">
                                        {Math.round(node.position.y)}
                                    </td>
                                    <td className="px-4 py-3">
                                        {node.data?.pathway || (
                                            <span className="italic text-stone-400">
                                                –
                                            </span>
                                        )}
                                    </td>
                                    
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                <div className="border-t-1  flex items-center justify-between border bg-stone-50 px-4 py-2 text-sm text-stone-600">
                    <span>
                        Page {currentPage} of {totalPages}
                    </span>
                    <div className="space-x-2">
                        <button
                            onClick={() =>
                                setCurrentPage((prev) => Math.max(prev - 1, 1))
                            }
                            disabled={currentPage === 1}
                            className="rounded border border-stone-300 bg-white px-3 py-1 disabled:opacity-40"
                        >
                            Prev
                        </button>
                        <button
                            onClick={() =>
                                setCurrentPage((prev) =>
                                    Math.min(prev + 1, totalPages)
                                )
                            }
                            disabled={currentPage === totalPages}
                            className="rounded border border-stone-300 bg-white px-3 py-1 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default NodeTable
