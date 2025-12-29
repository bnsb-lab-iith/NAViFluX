import { useLocation, useNavigate } from 'react-router-dom'

function CanvasHeader() {
    const navigate = useNavigate()
    const location = useLocation()

    const isActive = (path) => location.pathname === path
    return (
        <header className="flex w-full items-center justify-between border-b border-stone-300 bg-white px-8 py-5 shadow-sm">
            <h1 className="text-2xl font-bold tracking-wide text-indigo-600">
                SysBioCanvas
            </h1>
            <div className="flex items-center gap-6 text-stone-600">
                <h2
                    onClick={() => navigate('/free-canvas')}
                    className={`cursor-pointer rounded-md px-3 py-2 transition hover:text-indigo-600 ${
                        isActive('/free-canvas')
                            ? 'border border-indigo-200 bg-indigo-100 text-indigo-600'
                            : ''
                    }`}
                >
                    Free Canvas
                </h2>
                <h2
                    onClick={() => navigate('/pathway-visualizer')}
                    className={`cursor-pointer transition hover:text-indigo-600 ${
                        isActive('/pathway-visualizer')
                            ? 'border-b-2 border-indigo-600 text-indigo-600'
                            : ''
                    }`}
                >
                    Pathway Visualizer
                </h2>
                <h2
                    onClick={() => navigate('/model-builder')}
                    className={`cursor-pointer transition hover:text-indigo-600 ${
                        isActive('/model-builder')
                            ? 'border-b-2 border-indigo-600 text-indigo-600'
                            : ''
                    }`}
                >
                    Model Builder
                </h2>
                <h2 className="cursor-pointer transition hover:text-indigo-600">
                    Documentation
                </h2>
                <h2 className="cursor-pointer transition hover:text-indigo-600">
                    Contact
                </h2>
                <span className="text-sm font-medium opacity-70">
                    Release v1.0
                </span>
            </div>
        </header>
    )
}

export default CanvasHeader
