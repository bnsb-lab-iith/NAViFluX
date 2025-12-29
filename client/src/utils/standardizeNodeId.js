// utils/standardizeNodeId.ts
export function standardizeNodeId(
    pathway,
    rawId,
    knownLabels = new Set(),
    knownPathways = new Set()
) {
    const parts = rawId.split('__')

    // Strip known prefixes
    while (parts.length > 1 && knownPathways.has(parts[0])) {
        parts.shift()
    }

    // Match known label by suffix
    for (let i = 0; i < parts.length; i++) {
        const candidate = parts.slice(i).join('__')
        if (knownLabels.has(candidate)) {
            return `${pathway}__${candidate}`
        }
    }

    // Fallback to last part
    return `${pathway}__${parts[parts.length - 1]}`
}
