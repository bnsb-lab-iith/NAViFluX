import React, { useState, useContext } from 'react'
import { Handle } from 'reactflow'
import toast from 'react-hot-toast'
import EdgeContext from '../contexts/EdgeContext'

const CanvasNode = ({ id: nodeId, data, isConnectable, updateNodeData }) => {
    const {
        addingEdge,
        selectionPhase,
        sourceNode,
        targetNode,
        handleHandleSelect,
        deletingMode,
        selectingActionNode,
        gapFillingMode,
        modelData,
    } = useContext(EdgeContext)

    const [isEditing, setIsEditing] = useState(false)
    const [abbr, setAbbr] = useState(data.abbreviation || '')
    const [info, setInfo] = useState(data.info || '')
    const [color, setColor] = useState(data.color || '#fff')
    const [showTooltip, setShowTooltip] = useState(false)
    const knownLabels = new Set()
   
    if (modelData) {
        Object.keys(modelData)?.map((path) => {
            const pathObj = modelData?.[path]
            const edgeArr = pathObj?.['edges']
            edgeArr?.map((pair) => {
                const first = pair?.[0]
                const second = pair?.[1]
                knownLabels.add(first)
                knownLabels.add(second)
            })
        })
    }
    

    const showHandleSelector =
        (nodeId === sourceNode && selectionPhase === 'sourceHandle') ||
        (nodeId === targetNode && selectionPhase === 'targetHandle')

    const handleSave = () => {
        if (!abbr.trim()) {
            toast.error('Abbreviation cannot be empty')
            return
        }
        if (abbr !== data.abbreviation && knownLabels.has(abbr)) {
            toast.error('This abbreviation already exists!')
            return
        }
        updateNodeData(nodeId, { abbreviation: abbr, info, color })
        setIsEditing(false)
    }

    const handleNodeClick = (e) => {
        if (
            addingEdge ||
            isEditing ||
            deletingMode ||
            selectingActionNode ||
            gapFillingMode
        )
            return
        e.stopPropagation()
        const newColor = color === 'orange' ? '#78a9ff' : 'orange'
        setColor(newColor)
        updateNodeData(nodeId, { color: newColor })
    }

    const sharedContent = (
        <>
            {showHandleSelector && (
                <div
                    style={{
                        position: 'absolute',
                        top: -35,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: 8,
                        zIndex: 20,
                    }}
                >
                    {['top', 'right', 'bottom', 'left'].map((pos) => (
                        <button
                            key={pos}
                            onClick={(e) => {
                                e.stopPropagation()
                                handleHandleSelect(pos)
                            }}
                            style={{
                                padding: '4px 8px',
                                fontSize: 12,
                                borderRadius: 4,
                                border: '1px solid #ccc',
                                background: '#fff',
                                cursor: 'pointer',
                            }}
                        >
                            {pos}
                        </button>
                    ))}
                </div>
            )}

            {isEditing ? (
                <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 8, backgroundColor: color, padding: 8, zIndex: 10 }}
                >
                    <input
                        value={abbr}
                        onChange={(e) => setAbbr(e.target.value)}
                        placeholder="Abbreviation"
                        autoFocus
                        style={{ textAlign: 'center' }}
                    />
                    <textarea
                        value={info}
                        onChange={(e) => setInfo(e.target.value)}
                        placeholder="Description"
                        rows={2}
                        style={{ resize: 'none' }}
                    />
                    <button
                        onClick={handleSave}
                        style={{ marginTop: 4 }}
                        className="bg-white"
                    >
                        Save
                    </button>
                </div>
            ) : (
                <div style={{ fontWeight: 'bold', fontSize: 18 }}>
                    {data.abbreviation}
                </div>
            )}

            {['top', 'right', 'bottom', 'left'].map((pos) => (
                <React.Fragment key={pos}>
                    <Handle
                        type="source"
                        position={pos}
                        id={pos}
                        isConnectable={isConnectable}
                    />
                    <Handle
                        type="target"
                        position={pos}
                        id={pos}
                        isConnectable={isConnectable}
                    />
                </React.Fragment>
            ))}

            {showTooltip && data.info && !isEditing && (
                <div
                    style={{
                        position: 'absolute',
                        top: 50,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#fff',
                        padding: '5px 10px',
                        borderRadius: '5px',
                        border: '1px solid #ccc',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        zIndex: 10,
                        maxWidth: 1000,
                        fontSize: 14,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {data.info}
                </div>
            )}
        </>
    )

    if (isEditing || color === 'orange') {
        return (
            <div
                style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    backgroundColor: 'orange',
                    border: '2px solid #aaa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    textAlign: 'center',
                    fontWeight: 'bold',
                }}
                onClick={handleNodeClick}
                onDoubleClick={() => !addingEdge && setIsEditing(true)}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                {sharedContent}
            </div>
        )
    }

    // Circle shape for non-orange when not editing
    return (
        <div
            style={{
                padding: '10px',
                border: '1px solid #ccc',
                borderRadius: '5px',
                backgroundColor: color,
                cursor: 'pointer',
                position: 'relative',
                minWidth: 80,
                textAlign: 'center',
            }}
            onClick={handleNodeClick}
            onDoubleClick={() => !addingEdge && setIsEditing(true)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            {sharedContent}
        </div>
    )
}

export default CanvasNode
