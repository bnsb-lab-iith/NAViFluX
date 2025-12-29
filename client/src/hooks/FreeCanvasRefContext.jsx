import React, { createContext, useRef, useContext } from 'react'

const FreeCanvasRefContext = createContext(null)

export function FreeCanvasRefProvider({ children }) {
    const freeCanvasRef = useRef(null)
    return (
        <FreeCanvasRefContext.Provider value={freeCanvasRef}>
            {children}
        </FreeCanvasRefContext.Provider>
    )
}

export function useFreeCanvasRef() {
    const context = useContext(FreeCanvasRefContext)
    if (!context) {
        throw new Error(
            'useFreeCanvasRef must be used within a GraphRefProvider'
        )
    }
    return context
}
