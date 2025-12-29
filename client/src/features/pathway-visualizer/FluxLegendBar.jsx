function FluxLegendBar({ minFlux, maxFlux }) {
    return (
        <div className="absolute right-6 top-56 z-10 flex flex-col items-center rounded-xl border border-white/40 bg-white/30 p-3 shadow-lg backdrop-blur-md">
            <div className="mb-2 text-xs font-bold text-gray-800">Flux</div>
            <div className="mb-2 text-xs font-semibold text-gray-700">
                {minFlux.toFixed(2)}
            </div>
            <div
                className="h-36 w-4 rounded-md"
                style={{
                    background:
                        'linear-gradient(to bottom, rgb(255,0,0), white, rgb(0,0,255))',
                }}
            ></div>
            <div className="mt-2 text-xs font-semibold text-gray-700">
                {maxFlux.toFixed(2)}
            </div>
        </div>
    )
}

export default FluxLegendBar
