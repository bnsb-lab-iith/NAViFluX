import { ChartNoAxesCombined, Database, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import ToolSection from '../ui/ToolSection'

export default function Homepage() {
    const navigate = useNavigate()

    return (
        <div className="min-h-screen font-sans text-stone-800">
            {/* ----------------------------------------------------- */}
            {/* Header */}
            {/* ----------------------------------------------------- */}
            <header className="flex w-full items-center justify-between border-b border-stone-200 bg-white/80 px-10 pb-4 shadow-sm backdrop-blur-md">
                <div className="flex items-center">
                    <img
                        src="/analysis_icon.png"
                        alt="NAViFluX Icon"
                        className="h-14 w-auto cursor-pointer"
                        onClick={() => navigate('/')}
                    />
                </div>

                <nav className="mt-2 flex items-center gap-8 text-stone-600">
                    <button className="transition hover:text-[#003399]">
                        Documentation
                    </button>

                    <button
                        onClick={() => navigate('/contact')}
                        className="transition hover:text-[#003399]"
                    >
                        Contact
                    </button>

                    <span className="text-sm font-medium opacity-60">
                        Release v1.0
                    </span>
                </nav>
            </header>

            {/* ----------------------------------------------------- */}
            {/* Hero Section */}
            {/* ----------------------------------------------------- */}
            <main className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-14 text-center">
                {/* Elegant Animated Gradient Background */}
                <div className="absolute inset-0 -z-10">
                    {/* Balanced soft base */}
                    <div className="absolute inset-0 bg-gradient-to-b from-[#f4f6ff] via-[#eef2ff] to-[#edf7ff] opacity-85" />

                    {/* Purple–pink glow (mildly lightened) */}
                    <div className="opacity-28 absolute left-[-10%] top-[-12%] h-[40rem] w-[40rem] rounded-full bg-gradient-to-br from-[#766dff] via-[#b28cff] to-[#ee9ec7] blur-[170px]" />

                    {/* Teal–blue glow (mildly lightened) */}
                    <div className="opacity-28 absolute bottom-[-5%] right-[-12%] h-[38rem] w-[38rem] rounded-full bg-gradient-to-tr from-[#67e3f3] via-[#7ab4ff] to-[#8ea1ff] blur-[180px]" />

                    {/* Violet glow (softened) */}
                    <div className="absolute left-[40%] top-[35%] h-[32rem] w-[32rem] rounded-full bg-gradient-to-tl from-[#dd96ff] via-[#bba4ff] to-[#9daeff] opacity-25 blur-[190px]" />
                </div>

                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                    className="max-w-4xl text-5xl font-extrabold leading-tight text-stone-800 md:text-6xl"
                >
                    <span className="text-[#003399]">NAViFluX</span>
                    <span className="font-bold text-stone-700">
                        : Metabolic <span className="text-[#003399]">N</span>
                        etwork <span className="text-[#003399]">A</span>nalysis
                        and <span className="text-[#003399]">Vi</span>
                        sualization of{' '}
                        <span className="text-[#003399]">FluX</span>
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.7 }}
                    className="mt-6 max-w-2xl text-lg leading-relaxed text-stone-700"
                >
                    An interactive platform for analyzing
                    <strong className="text-[#003399]"> BiGG</strong> and
                    <strong className="text-[#003399]"> KEGG</strong> metabolic
                    models, visualizing
                    <strong className="text-[#003399]"> pathways</strong>, and
                    constructing custom biochemical networks with intuitive
                    tooling.
                </motion.p>
            </main>

            {/* Existing Tool Section */}
            <ToolSection
                message="Start Exploring with Our Tools"
                current="none"
            />

            {/* ----------------------------------------------------- */}
            {/* About Sections */}
            {/* ----------------------------------------------------- */}
            <section className="flex flex-col gap-20 px-8 pb-14 pt-14 md:px-24">
                {/* Row 1 */}
                <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="space-y-4"
                    >
                        <h2 className="inline-flex items-center gap-2 border-b border-indigo-300 pb-2 text-3xl font-bold text-[#003399]">
                            <ChartNoAxesCombined /> What is NAViFluX?
                        </h2>

                        <ul className="list-inside list-disc space-y-4 leading-relaxed text-stone-700">
                            <li>
                                A systems biology framework for analyzing
                                <strong className="text-[#003399]">
                                    {' '}
                                    metabolic networks
                                </strong>
                                .
                            </li>
                            <li>
                                Built for working with
                                <strong className="text-[#003399]">
                                    {' '}
                                    genome-scale metabolic models (GEMs)
                                </strong>
                                .
                            </li>
                            <li>
                                Interactive exploration of biochemical pathways.
                            </li>
                        </ul>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="space-y-4"
                    >
                        <h2 className="inline-flex items-center gap-2 border-b border-indigo-300 pb-2 text-3xl font-bold text-[#003399]">
                            <Database /> Why use NAViFluX?
                        </h2>

                        <ul className="list-inside list-disc space-y-4 leading-relaxed text-stone-700">
                            <li>
                                Fine-grained analysis of curated
                                <strong className="text-stone-900">
                                    {' '}
                                    BiGG models
                                </strong>
                                .
                            </li>
                            <li>
                                Clean, intuitive graph visualizations with
                                customizable layouts.
                            </li>
                            <li>
                                Construct your own metabolic pathways via
                                <strong className="text-stone-900">
                                    {' '}
                                    drag-and-drop
                                </strong>
                                .
                            </li>
                        </ul>
                    </motion.div>
                </div>
            </section>

            {/* ----------------------------------------------------- */}
            {/* External Databases */}
            {/* ----------------------------------------------------- */}
            <section className="flex flex-col items-center gap-4 pb-10">
                <p className="text-sm text-stone-600">
                    Powered by curated metabolic databases
                </p>

                <div className="flex items-center gap-10">
                    {/* BiGG */}
                    <a
                        href="http://bigg.ucsd.edu/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-80 transition hover:opacity-100"
                    >
                        <img
                            src="/bigg_logo.png"
                            alt="BiGG Models Database"
                            className="h-10 w-auto"
                        />
                    </a>

                    {/* KEGG */}
                    <a
                        href="https://www.kegg.jp/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-80 transition hover:opacity-100"
                    >
                        <img
                            src="/KEGG_logo.gif"
                            alt="KEGG Database"
                            className="h-10 w-auto"
                        />
                    </a>
                </div>
            </section>

            {/* ----------------------------------------------------- */}
            {/* Footer */}
            {/* ----------------------------------------------------- */}
            <footer className="border-t border-stone-200 bg-stone-100 py-6 text-center text-sm text-stone-600">
                © 2025 NAViFluX — Biological Networks & Systems Biology Lab,
                IIT Hyderabad
            </footer>
        </div>
    )
}
