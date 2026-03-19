import { Mail, Phone, MapPin, Github } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function ContactPage() {
    const navigate = useNavigate()

    return (
        <div className="min-h-screen font-sans text-stone-800">
            {/* HEADER */}
            <header className="flex w-full items-center justify-between border-b border-stone-300 bg-white px-10 pb-3 shadow-sm">
                <img
                    src="/analysis_icon.png"
                    alt="NAViFluX Icon"
                    className="h-14 w-auto cursor-pointer object-contain"
                    onClick={() => navigate('/')}
                />
                <div className="flex items-center gap-6 text-stone-600">
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
                        className="cursor-pointer font-semibold text-[#003399]"
                    >
                        Contact
                    </h2>
                    <span className="text-sm font-medium opacity-70">
                        Release v1.0
                    </span>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
                {/* Background blobs */}
                <div className="absolute inset-0 -z-10">
                    <div className="animate-blob-slow absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-indigo-400 via-purple-400 to-pink-300 opacity-40 blur-3xl"></div>
                    <div className="animate-blob-slower absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-green-300 via-yellow-300 to-indigo-300 opacity-30 blur-3xl"></div>
                </div>

                <h2 className="mb-6 text-4xl font-extrabold tracking-tight text-stone-900 md:text-5xl">
                    Get in Touch with Us
                </h2>
                <p className="max-w-2xl text-lg leading-relaxed text-stone-700">
                    Have questions or facing any issues? Reach out to the{' '}
                    <strong className="text-[#003399]">NAViFluX</strong> team at
                    IIT Hyderabad. We’d love to hear from you!
                </p>

                {/* Contact Info Cards */}
                <div className="mt-16 grid gap-8 md:grid-cols-2">
                    <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg transition-transform hover:-translate-y-2 hover:shadow-2xl">
                        <Github className="mb-4 text-5xl text-[#003399]" />
                        <h3 className="text-lg font-semibold">Documentation</h3>
                        <a
                            href="https://bnsb-lab-iith.github.io/NAViFluX-Documentation/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 text-[#003399] hover:underline"
                        >
                            View on GitHub
                        </a>
                    </div>

                    <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg transition-transform hover:-translate-y-2 hover:shadow-2xl">
                        <Github className="mb-4 text-5xl text-[#003399]" />
                        <h3 className="text-lg font-semibold">Tool</h3>
                        <a
                            href="https://github.com/bnsb-lab-iith/NAViFluX"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 text-[#003399] hover:underline"
                        >
                            View on GitHub
                        </a>
                    </div>

                    <div className="md:col-span-2 flex flex-col items-center rounded-xl bg-white p-8 shadow-lg transition-transform hover:-translate-y-2 hover:shadow-2xl">
                        <MapPin className="mb-4 text-5xl text-[#003399]" />
                        <h3 className="text-lg font-semibold">Address</h3>
                        <p className="mt-2 max-w-xs text-stone-600">
                            Biological Networks and Systems Biology Lab, IIT
                            Hyderabad, Kandi, Telangana, India
                        </p>
                    </div>

                    
                </div>


                
            </main>

            {/* FOOTER */}
            <footer className="bg-stone-200 py-6 text-center text-sm text-stone-600">
                © 2025 NAViFluX, Biological Networks and Systems Biology Lab,
                IIT Hyderabad — All rights reserved.
            </footer>
        </div>
    )
}

export default ContactPage
