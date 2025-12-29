import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Homepage from './pages/Homepage'
import FreeCanvas from './pages/FreeCanvas'
import { FreeCanvasRefProvider } from './hooks/FreeCanvasRefContext'
import { Toaster } from 'react-hot-toast'
import PathwayViz from './pages/PathwayViz'
import { VisualizerRefProvider } from './hooks/VisualizerRefContext'
import { ModelProvider } from './contexts/ModelContext'
import ModelBuilder from './pages/ModelBuilder'
import { BuilderRefProvider } from './hooks/BuilderRefContext'
import { BuilderProvider } from './contexts/BuilderContext'
import ContactPage from './pages/ContactPage'

function App() {
    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Homepage />} />
                    <Route
                        path="/free-canvas"
                        element={
                            <FreeCanvasRefProvider>
                                <FreeCanvas />
                            </FreeCanvasRefProvider>
                        }
                    />
                    <Route
                        path="/pathway-visualizer"
                        element={
                            <VisualizerRefProvider>
                                <ModelProvider>
                                    <PathwayViz />
                                </ModelProvider>
                            </VisualizerRefProvider>
                        }
                    />
                    <Route
                        path="/model-builder"
                        element={
                            <BuilderRefProvider>
                                <BuilderProvider>
                                    <ModelBuilder />
                                </BuilderProvider>
                            </BuilderRefProvider>
                        }
                    />
                    <Route path="/contact" element={<ContactPage />} />
                </Routes>
            </BrowserRouter>
            <Toaster
                position="top-center"
                gutter={12}
                containerStyle={{ margin: '8px' }}
                toastOptions={{
                    success: { duration: 3000 },
                    error: { duration: 5000 },
                    style: {
                        fontSize: '16px',
                        maxWidth: '500px',
                        padding: '16px 24px',
                        backgroundColor: 'bg-white',
                        color: 'var(--color-grey-700)',
                    },
                }}
            />
        </>
    )
}

export default App
