import { useRef } from 'react'

export function useFreeCanvasRef() {
    const freeCanvasRef = useRef()
    return freeCanvasRef
}
