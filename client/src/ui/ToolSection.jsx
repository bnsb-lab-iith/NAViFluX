import { useNavigate } from 'react-router-dom'

function ToolSection({ message, current }) {
    const navigate = useNavigate()

    const tools = [
        {
            title: 'Pathway Visualizer',
            description:
                'Load curated BiGG pathways and explore interactive metabolic networks. Navigate reactions, compounds, and annotations effortlessly.',
            route: '/pathway-visualizer',
        },
        {
            title: 'Model Builder',
            description:
                'Build custom genome-scale models by selecting reactions, adjusting stoichiometry, and exporting SBML or JSON files.',
            route: '/model-builder',
        },
    ]

    return (
        <section className="bg-stone-50 px-8 py-14 md:px-24">
            <h2 className="mb-12 text-center text-3xl font-bold text-stone-900">
                {message}
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-2">
                {tools.map((tool, index) => (
                    <div
                        key={index}
                        className="flex transform flex-col justify-between rounded-xl bg-white p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl"
                    >
                        <div>
                            <h3 className="mb-3 text-xl font-semibold text-[#003399]">
                                {tool.title}
                            </h3>
                            <p className="text-stone-700">{tool.description}</p>
                        </div>
                        <button
                            onClick={() => navigate(tool.route)}
                            className="mt-6 w-fit rounded-md bg-[#003399] px-5 py-2 text-sm font-medium text-white transition"
                        >
                            {tool.title.includes('Visualizer')
                                ? 'Visualize Pathways'
                                : 'Build a Model'}
                        </button>
                    </div>
                ))}
            </div>
        </section>
    )
}

export default ToolSection
