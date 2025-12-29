import React, { createContext, useRef, useContext } from 'react'

const BuilderRefContext = createContext(null)

export function BuilderRefProvider({ children }) {
    const builderRef = useRef(null)
    return (
        <BuilderRefContext.Provider value={builderRef}>
            {children}
        </BuilderRefContext.Provider>
    )
}

export function useBuilderRef() {
    const context = useContext(BuilderRefContext)
    if (!context) {
        throw new Error(
            'useBuilderRef must be used within a BuilderRefProvider'
        )
    }
    return context
}
