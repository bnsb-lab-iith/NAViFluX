export function normalizeBatchOutput(batchOutput) {
    const normalized = {}

    for (const [modelName, batch] of Object.entries(batchOutput)) {
        const newFinal = {}
        const final = batch.final || {}

        for (const [rawId, node] of Object.entries(final)) {
            const fullId = `${modelName}__${rawId}`
            const updatedNode = {
                ...node,
                id: fullId,
                data: {
                    ...node.data,
                    abbreviation: node.data?.abbreviation || rawId,
                },
            }

            newFinal[fullId] = updatedNode
        }

        normalized[modelName] = {
            ...batch,
            final: newFinal,
        }
    }

    return normalized
}
