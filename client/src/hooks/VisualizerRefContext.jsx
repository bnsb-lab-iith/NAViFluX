import React, { createContext, useRef, useContext } from 'react'

const VisualizerRefContext = createContext(null)

export function VisualizerRefProvider({ children }) {
    const visualizerRef = useRef(null)
    return (
        <VisualizerRefContext.Provider value={visualizerRef}>
            {children}
        </VisualizerRefContext.Provider>
    )
}

export function useVisualizerRef() {
    const context = useContext(VisualizerRefContext)
    if (!context) {
        throw new Error(
            'useFreeCanvasRef must be used within a GraphRefProvider'
        )
    }
    return context
}
