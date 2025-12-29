import { useRef } from 'react'

export function useBuilderRef() {
    const builderRef = useRef()
    return builderRef
}
