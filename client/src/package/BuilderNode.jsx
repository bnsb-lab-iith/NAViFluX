import React, { useState, useContext } from 'react'
import { Handle } from 'reactflow'
import toast from 'react-hot-toast'
import EdgeContext from '../contexts/EdgeContext'
import { useBuilder } from '../contexts/BuilderContext'

const BuilderNode = ({ id: nodeId, data, isConnectable, updateNodeData }) => {
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
        zoom,
        bringToFront,
        releaseNode,
        textPosition
    } = useContext(EdgeContext)
    const { circleSize, boxSize } = useBuilder()
    const zoomFactor = 1 / zoom
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
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
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
                        top: '50%',
                        left: '110%',
                        transform: 'translateY(-50%)',
                        backgroundColor: '#fff',
                        padding: `${Math.max(2, 5 * zoomFactor)}px ${Math.max(8, 7 * zoomFactor)}px`,
                        borderRadius: '10px',
                        border: '1px solid #ccc',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                        zIndex: 10,
                        width: Math.min(400, 300 * zoomFactor), // scale width
                        maxWidth: Math.min(500, 400 * zoomFactor),
                        fontSize: `${Math.min(Math.max(12 * zoomFactor, 10), 24)}px`, // scale font
                        whiteSpace: 'normal',
                        textAlign: 'left',
                    }}
                >
                    {data.info.split('\n').map((line, index) => (
                        <div key={index}>{line}</div>
                    ))}
                    {data?.subsystem !== null && data?.subsystem !== undefined && (
                        <div>
                            <strong>Subsystem: </strong>
                            {data.subsystem}
                        </div>
                    )}
                    {data?.flux !== null && data?.flux !== undefined && (
                        <div>
                            <strong>Weight: </strong>
                            {data.flux}
                        </div>
                    )}
                    {data?.lower_bound !== null &&
                        data?.lower_bound !== undefined && (
                            <div>
                                <strong>Lower Bound: </strong>
                                {data.lower_bound}
                            </div>
                        )}
                    {data?.upper_bound !== null &&
                        data?.upper_bound !== undefined && (
                            <div>
                                <strong>Upper Bound: </strong>
                                {data.upper_bound}
                            </div>
                        )}

                    {data?.formula && (
                        <div>
                            <strong>Formula:</strong> {data?.formula}
                        </div>
                    )}
                    {data?.compartment && (
                        <div>
                            <strong>Compartment:</strong> {data?.compartment}
                        </div>
                    )}
                </div>
            )}
        </>
    )

    if (isEditing || color === 'orange') {
        return (
            <div
                style={{
                    width: data.size || circleSize,
                    height: data.size || circleSize,
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: '2px solid #aaa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    textAlign: 'center',
                }}
                // onDoubleClick={() => !addingEdge && setIsEditing(true)}
                onMouseEnter={() => {
                    setShowTooltip(true)
                    bringToFront?.(nodeId)
                }}
                onMouseLeave={() => {
                    setShowTooltip(false)
                    releaseNode?.()
                }}
            >
                {sharedContent}

                {/* Abbreviation shown below the node */}
                {!isEditing && (
                    <div
                        style={{
                            position: 'absolute',
                            top:
                                textPosition === 'top'
                                    ? '-6px'
                                    : textPosition === 'bottom'
                                      ? '100%'
                                      : '50%',
                            left:
                                textPosition === 'left'
                                    ? '-25px'
                                    : textPosition === 'right'
                                      ? '100%'
                                      : '50%',
                            transform:
                                textPosition === 'top'
                                    ? 'translate(-50%, -100%)'
                                    : textPosition === 'bottom'
                                      ? 'translate(-50%, 0%)'
                                      : textPosition === 'left'
                                        ? 'translate(-100%, -50%)'
                                        : textPosition === 'right'
                                          ? 'translate(15%, -50%)'
                                          : 'translate(-50%, -50%)',
                            marginTop: textPosition === 'bottom' ? 6 : 0,
                            marginLeft: textPosition === 'right' ? 6 : 0,
                            fontWeight: 'bold',
                            fontSize: `${Math.min(Math.max(13 * zoomFactor, 10), 30)}px`,
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                        }}
                    >
                        {data.abbreviation}
                    </div>
                )}
            </div>
        )
    }

    // Circle shape for non-orange when not editing
    return (
        <div
            style={{
                width: boxSize,
                height: boxSize / 2,
                border: '1px solid #ccc',
                borderRadius: '5px',
                backgroundColor: color,
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
            }}
            // onDoubleClick={() => !addingEdge && setIsEditing(true)}
           onMouseEnter={() => {
                setShowTooltip(true)
                bringToFront?.(nodeId)
            }}
            onMouseLeave={() => {
                setShowTooltip(false)
                releaseNode?.()
            }}
        >
            {sharedContent}

            {/* Abbreviation shown below the node */}
           <div
                style={{
                    position: 'absolute',
                    top:
                        textPosition === 'top'
                            ? '-6px'
                            : textPosition === 'bottom'
                              ? '100%'
                              : '50%',
                    left:
                        textPosition === 'left'
                            ? '-25px'
                            : textPosition === 'right'
                              ? '100%'
                              : '50%',
                    transform:
                        textPosition === 'top'
                            ? 'translate(-50%, -100%)'
                            : textPosition === 'bottom'
                              ? 'translate(-50%, 0%)'
                              : textPosition === 'left'
                                ? 'translate(-100%, -50%)'
                                : textPosition === 'right'
                                  ? 'translate(15%, -50%)'
                                  : 'translate(-50%, -50%)',
                    marginTop: textPosition === 'bottom' ? 6 : 0,
                    marginLeft: textPosition === 'right' ? 6 : 0,
                    fontWeight: 'bold',
                    fontSize: `${Math.min(Math.max(13 * zoomFactor, 10), 30)}px`,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                }}
            >
                {data.abbreviation}
            </div>
        </div>
    )
}

export default BuilderNode
