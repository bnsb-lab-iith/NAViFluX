import { createContext, useState, useContext } from 'react'

const BuilderContext = createContext()

export function BuilderProvider({ children }) {
    const [edgeThickness, setEdgeThickness] = useState(2)
    const [circleSize, setCircleSize] = useState(30)
    const [boxSize, setBoxSize] = useState(80)
    const [database, setDatabase] = useState('BIGG')

    return (
        <BuilderContext.Provider
            value={{
                edgeThickness,
                setEdgeThickness,
                circleSize,
                setCircleSize,
                boxSize,
                setBoxSize,
                database,
                setDatabase,
            }}
        >
            {children}
        </BuilderContext.Provider>
    )
}

export function useBuilder() {
    return useContext(BuilderContext)
}
