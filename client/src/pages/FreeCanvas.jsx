import { useEffect, useState } from 'react'
import {
    Plus,
    GitBranch,
    Undo,
    Redo,
    Download,
    Trash2,
    RotateCcw,
} from 'lucide-react'
import 'reactflow/dist/style.css'
import CanvasHeader from '../features/free-canvas/CanvasHeader'
import NodeTable from '../features/free-canvas/NodeTable'
import ToolSection from '../ui/ToolSection'
import { useFreeCanvasRef } from './../hooks/FreeCanvasRefContext'
import { Button } from './../ui/Button'
import BuilderEditor from '../package/BuilderEditor'
import CanvasEditor from '../package/CanvasEditor'

const toolButtons = [
    { name: 'addNode', label: 'Add Node', icon: Plus, variant: 'default' },
    {
        name: 'startAddEdge',
        label: 'Start Edge',
        icon: GitBranch,
        variant: 'default',
    },
    { name: 'undoEdge', label: 'Undo Edge', icon: Undo, variant: 'outline' },
    { name: 'undoNode', label: 'Undo Node', icon: Undo, variant: 'outline' },
    { name: 'redoNode', label: 'Redo Node', icon: Redo, variant: 'outline' },
    {
        name: 'exportGraph',
        label: 'Export Graph',
        icon: Download,
        variant: 'secondary',
    },
    {
        name: 'deleteModeEdge',
        label: 'Delete Edge',
        icon: Trash2,
        variant: 'destructive',
    },
    {
        name: 'deleteModeNode',
        label: 'Delete Node',
        icon: Trash2,
        variant: 'destructive',
    },
    {
        name: 'resetGraph',
        label: 'Reset',
        icon: RotateCcw,
        variant: 'destructive',
    },
]

function FreeCanvas() {
    const freeCanvasRef = useFreeCanvasRef()
    const [canvasNodes, setCanvasNodes] = useState([])
    const [layout, setLayout] = useState('default')
    const [nodes, setNodes] = useState([])
    const [edges, setEdges] = useState([])

    return (
        <div className="min-h-screen bg-stone-100 font-sans text-stone-800">
            <CanvasHeader />
            <main className="mb-2 flex h-[calc(100vh-80px)] flex-col bg-stone-100">
                <div className="flex flex-wrap items-center gap-4 border-b border-stone-300 bg-stone-50 px-6 py-4 shadow-sm">
                    <select
                        onChange={(e) => {
                            console.log(e.target.value)
                            setLayout(e.target.value)
                        }}
                        value={layout}
                        className="cursor-pointer rounded-lg border border-gray-300 bg-gray-50 px-2 py-2 text-sm shadow-sm hover:bg-gray-100"
                    >
                        <option value="default">Default Layout</option>
                        <option value="force">Force Field</option>
                        <option value="hierarchical-lr">Hierarchical LR</option>
                        <option value="hierarchical-bt">Hierarchical BT</option>
                        <option value="mrtree">MRTree Layout</option>
                        <option value="box">Box Layout</option>
                        <option value="rectpacking">Rectangle Layout</option>
                        <option value="stress">Stress Layout</option>
                        <option value="force-elkjs">
                            Force Layout (ELKjs)
                        </option>
                        <option value="dot">Dot Layout</option>
                        <option value="fdp">
                            Force Directed Placement (fdp){' '}
                        </option>
                        <option
                            value="sfdp"
                            title="Scalable Force Directed Placement (sfdp)"
                        >
                            Scalable FDP (sfdp)
                        </option>
                        <option value="neato">Neato Layout</option>
                        <option value="twopi">Twopi Layout</option>
                        <option value="circo">Circo Layout</option>
                        <option value="osage">Osage Layout</option>
                        <option value="patchwork">Patchwork Layout</option>
                        <option value="">G6 Force Layout</option>
                    </select>
                    {toolButtons.map((btn) => (
                        <Button
                            key={btn.name}
                            variant={btn.variant}
                            onClick={() => {
                                if (
                                    freeCanvasRef.current &&
                                    typeof freeCanvasRef.current[btn.name] ===
                                        'function'
                                ) {
                                    freeCanvasRef.current[btn.name]()
                                }
                            }}
                        >
                            <btn.icon className="h-3 w-3" />
                            {btn.label}
                        </Button>
                    ))}
                </div>

                <div className="relative flex-1 overflow-hidden p-4">
                    <CanvasEditor
                        ref={freeCanvasRef}
                        height={650}
                        initialNodes={nodes}
                        initialEdges={edges}
                        onGraphChange={(nodes, edges) => {
                            setCanvasNodes(nodes)
                        }}
                        selectedPathways={[]}
                    />
                </div>
            </main>

            <NodeTable nodes={canvasNodes}/>
            <ToolSection
                message="Explore our other tools"
                current="free-canvas"
            />
        </div>
    )
}

export default FreeCanvas
