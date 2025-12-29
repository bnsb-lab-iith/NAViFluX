import { useRef } from 'react'

export function useVisualizerRef() {
    const visualizerRef = useRef()
    return visualizerRef
}
