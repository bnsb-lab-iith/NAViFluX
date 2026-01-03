import { useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X } from 'lucide-react' // nice lightweight icons

function VisualizerHeader() {
    const navigate = useNavigate()
    const location = useLocation()
    const [menuOpen, setMenuOpen] = useState(false)

    const isActive = (path) => location.pathname === path

    return (
        <header className="flex w-full items-center justify-between border-b border-stone-300 bg-white px-6 pb-3 shadow-sm">
            {/* Logo */}
            <img
                src="/analysis_icon.png"
                alt="NAViFluX Icon"
                className="h-14 w-auto cursor-pointer object-contain"
                onClick={() => navigate('/')}
            />

            {/* Desktop Nav */}
            <div className="hidden items-center gap-6 text-stone-600 lg:flex">
                <h2
                    onClick={() => navigate('/pathway-visualizer')}
                    className={`cursor-pointer px-3 py-2 transition hover:text-[#003399] ${
                        isActive('/pathway-visualizer')
                            ? 'border-b-2 border-[#003399] text-[#003399]'
                            : ''
                    }`}
                >
                    Pathway Visualizer
                </h2>
                <h2
                    onClick={() => navigate('/model-builder')}
                    className={`cursor-pointer transition hover:text-[#003399] ${
                        isActive('/model-builder')
                            ? 'border-b-2 border-indigo-600 text-[#003399]'
                            : ''
                    }`}
                >
                    Model Builder
                </h2>
                <h2
                    onClick={() =>
                        window.open(
                            'https://bnsb-lab-iith.github.io/NAViFluX-Documentation/',
                            '_blank'
                        )
                    }
                    className="cursor-pointer transition hover:text-[#003399]"
                >
                    Documentation
                </h2>
                <h2
                    onClick={() => navigate('/contact')}
                    className="cursor-pointer transition hover:text-[#003399]"
                >
                    Contact
                </h2>
                <span className="text-sm font-medium opacity-70">
                    Release v1.0
                </span>
            </div>

            {/* Mobile Menu Button */}
            <button
                className="p-2 text-stone-600 hover:text-[#003399] lg:hidden"
                onClick={() => setMenuOpen((prev) => !prev)}
            >
                {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Mobile Menu Drawer */}
            {menuOpen && (
                <div className="absolute right-4 top-16 z-50 w-48 rounded-lg border border-stone-200 bg-white shadow-lg lg:hidden">
                    <div className="flex flex-col items-start gap-3 p-4 text-stone-700">
                        <h2
                            onClick={() => {
                                navigate('/pathway-visualizer')
                                setMenuOpen(false)
                            }}
                            className={`w-full cursor-pointer px-2 py-1 transition hover:text-[#003399] ${
                                isActive('/pathway-visualizer')
                                    ? 'border-b-2 border-indigo-600 text-[#003399]'
                                    : ''
                            }`}
                        >
                            Pathway Visualizer
                        </h2>
                        <h2
                            onClick={() => {
                                navigate('/model-builder')
                                setMenuOpen(false)
                            }}
                            className={`w-full cursor-pointer rounded-md px-2 py-1 transition hover:bg-indigo-50 ${
                                isActive('/model-builder')
                                    ? 'bg-indigo-100 text-[#003399]'
                                    : ''
                            }`}
                        >
                            Model Builder
                        </h2>
                        <h2 className="w-full cursor-pointer rounded-md px-2 py-1 transition hover:bg-indigo-50">
                            Documentation
                        </h2>
                        <h2 className="w-full cursor-pointer rounded-md px-2 py-1 transition hover:bg-indigo-50">
                            Contact
                        </h2>
                        <span className="mt-2 text-xs font-medium opacity-70">
                            Release v1.0
                        </span>
                    </div>
                </div>
            )}
        </header>
    )
}

export default VisualizerHeader
