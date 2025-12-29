import { createContext, useState, useContext } from 'react'

const ModelContext = createContext()

export function ModelProvider({ children }) {
    const [pathwaysOpen, setPathwaysOpen] = useState(false)
    const [selectedPathways, setSelectedPathways] = useState([])
    const [isLoadingModel, setIsLoadingModel] = useState(false)
    const [uploadMode, setUploadMode] = useState('single')
    const [batchOutput, setBatchOutput] = useState(null)
    const [database, setDatabase] = useState(null)

    const toggleDropdownPathways = () => setPathwaysOpen(!pathwaysOpen)

    const handleCheckboxChangePathway = (pathway) => {
        setSelectedPathways((prev) =>
            prev.includes(pathway)
                ? prev.filter((p) => p !== pathway)
                : [...prev, pathway]
        )
    }
    const [modelData, setModelData] = useState(null)
    const [initialModelData, setInitialModelData] = useState(null)
    const [initialBatchOutputData, setInitialBatchOuptutData] = useState(null)
    const [session_id, setSession_id] = useState(null)
    const [layout, setLayout] = useState('default')

    const [edgeThickness, setEdgeThickness] = useState(2)
    const [circleSize, setCircleSize] = useState(30)
    const [boxSize, setBoxSize] = useState(80)
    const [fontSize, setFontSize] = useState(8)

    const [colorAction, setColorAction] = useState('flux') /// flux or weight
    // if flux then color is red
    // if weight then color is black

    // const [edgeAction, setEdgeAction] = useState('uploaded')
    // if uploaded --> then use edgeThickness function
    // else if change in node settings ---> then that value, the uploaded value is reset

    const [edgeFormat, setEdgeFormat] = useState('flux')
    // if 'flux' ---> use both flux and bounds
    // if 'weight' ---> use only bounds

    return (
        <ModelContext.Provider
            value={{
                setEdgeThickness,
                setCircleSize,
                setFontSize,
                fontSize,
                setBoxSize,
                edgeThickness,
                circleSize,
                boxSize,
                selectedPathways,
                setUploadMode,
                layout,
                setLayout,
                setBatchOutput,
                batchOutput,
                uploadMode,
                setSelectedPathways,
                setSession_id,
                session_id,
                setIsLoadingModel,
                isLoadingModel,
                pathwaysOpen,
                setPathwaysOpen,
                toggleDropdownPathways,
                handleCheckboxChangePathway,
                modelData,
                setModelData,
                initialModelData,
                setInitialModelData,
                initialBatchOutputData,
                setInitialBatchOuptutData,
                database,
                setDatabase,
                colorAction,
                setColorAction,
                edgeFormat,
                setEdgeFormat,
            }}
        >
            {children}
        </ModelContext.Provider>
    )
}

export function useModel() {
    return useContext(ModelContext)
}
