import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { QrCode, TrendingUp, Brain, Users, ArrowRight, ShieldCheck, Zap, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function Landing() {
    const { isAuthenticated, hasTenant, isLoading } = useAuth();
    const navigate = useNavigate();

    const handleCTA = () => {
        if (isLoading) return;
        if (isAuthenticated) {
            if (hasTenant) {
                navigate('/dashboard');
            } else {
                navigate('/onboarding');
            }
        } else {
            navigate('/register');
        }
    };

    const handleLogin = () => {
        if (isLoading) return;
        if (isAuthenticated) {
            if (hasTenant) {
                navigate('/dashboard');
            } else {
                navigate('/onboarding');
            }
        } else {
            navigate('/login');
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 10 } }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-[#D3FF24] selection:text-black font-sans overflow-x-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#050505]">
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 mix-blend-luminosity"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=3540&auto=format&fit=crop')" }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/60 via-[#050505]/80 to-[#050505]" />

                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="hidden md:block absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#D3FF24] blur-[150px] rounded-full"
                />
                <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.05, 0.1, 0.05] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="hidden md:block absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#7C3AED] blur-[150px] rounded-full"
                />

                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay" />
            </div>

            {/* Navbar Glassmorphism */}
            <nav className="fixed top-0 w-full z-50 bg-[#050505]/60 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Kallpa Logo" className="h-8 w-8 object-contain" />
                        <span className="font-display font-bold text-xl tracking-wider text-white">KALLPA</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleLogin}
                            className="hidden sm:inline-block px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
                        >
                            Ingresar
                        </button>
                        <Button
                            onClick={handleCTA}
                            className="bg-[#D3FF24] hover:bg-[#D3FF24]/90 text-black font-bold border-none shadow-[0_0_20px_rgba(211,255,36,0.2)] hover:shadow-[0_0_30px_rgba(211,255,36,0.4)] transition-all duration-300"
                        >
                            Comenzar Ahora <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 pt-32 pb-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                        className="text-center max-w-4xl mx-auto mt-20"
                    >
                        <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full border border-[#D3FF24]/30 bg-[#D3FF24]/10 backdrop-blur-md">
                            <Zap className="w-4 h-4 text-[#D3FF24]" />
                            <span className="text-xs font-medium text-[#D3FF24] uppercase tracking-wider">El Motor de tu Gimnasio</span>
                        </motion.div>

                        <motion.h1 variants={itemVariants} className="text-4xl md:text-7xl font-black tracking-tight mb-6 md:mb-8 leading-tight">
                            Control Total. <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D3FF24] to-emerald-400">
                                Escalabilidad Infinita.
                            </span>
                        </motion.h1>

                        <motion.p variants={itemVariants} className="text-base md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                            El único software que combina control de accesos QR ultrarrápido, inteligencia analítica y gestión financiera en un ecosistema impenetrable y brutalmente elegante.
                        </motion.p>

                        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
                            <Button
                                onClick={handleCTA}
                                size="lg"
                                className="w-full sm:w-auto bg-[#D3FF24] hover:bg-[#bce620] text-black font-bold h-14 px-8 rounded-xl shadow-[0_0_40px_rgba(211,255,36,0.25)] hover:shadow-[0_0_60px_rgba(211,255,36,0.4)] transition-all duration-300 transform hover:scale-105"
                            >
                                Inicia tu Gimnasio Hoy
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={handleLogin}
                                className="w-full sm:w-auto h-14 px-8 rounded-xl border-white/10 hover:bg-white/5 text-white bg-transparent"
                            >
                                Acceder a mi Panel
                            </Button>
                        </motion.div>
                    </motion.div>

                    {/* Bento Grid Features */}
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.7 }}
                        className="mt-24 md:mt-40 grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                        {/* Feature 1 - Gran impacto */}
                        <div className="md:col-span-2 relative group overflow-hidden rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.01] border border-white/10 p-10 hover:border-[#D3FF24]/30 transition-all duration-500">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                <QrCode className="w-32 h-32 text-[#D3FF24]" />
                            </div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-[#D3FF24]/10 flex items-center justify-center mb-6">
                                    <QrCode className="w-6 h-6 text-[#D3FF24]" />
                                </div>
                                <h3 className="text-2xl font-bold mb-3">Torno Virtual con QR</h3>
                                <p className="text-gray-400 max-w-md leading-relaxed">
                                    Recepción automatizada. Olvídate de los cuellos de botella; tus miembros ingresan mostrando su teléfono. Validación en menos de 1 segundo.
                                </p>
                            </div>
                        </div>

                        {/* Feature 2 */}
                        <div className="relative group overflow-hidden rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.01] border border-white/10 p-10 hover:border-[#D3FF24]/30 transition-all duration-500">
                            <div className="relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                                    <TrendingUp className="w-6 h-6 text-blue-400" />
                                </div>
                                <h3 className="text-2xl font-bold mb-3">Caja Transparente</h3>
                                <p className="text-gray-400 leading-relaxed">
                                    Métricas financieras en vivo, pagos registrados y predicción de ingresos sin tocar una sola celda de Excel.
                                </p>
                            </div>
                        </div>

                        {/* Feature 3 */}
                        <div className="relative group overflow-hidden rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.01] border border-white/10 p-10 hover:border-[#D3FF24]/30 transition-all duration-500">
                            <div className="relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                                    <Brain className="w-6 h-6 text-purple-400" />
                                </div>
                                <h3 className="text-2xl font-bold mb-3">Retención IA</h3>
                                <p className="text-gray-400 leading-relaxed">
                                    Sistema predictivo que te avisa exactamente quién está a punto de abandonar el gimnasio, permitiéndote recuperar mensualidades.
                                </p>
                            </div>
                        </div>

                        {/* Feature 4 */}
                        <div className="md:col-span-2 relative group overflow-hidden rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.01] border border-white/10 p-10 hover:border-[#D3FF24]/30 transition-all duration-500">
                            <div className="absolute bottom-0 right-10 opacity-10 group-hover:opacity-20 transition-opacity translate-y-1/4">
                                <ShieldCheck className="w-48 h-48 text-[#D3FF24]" />
                            </div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6">
                                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                                </div>
                                <h3 className="text-2xl font-bold mb-3">Seguridad y Empleados</h3>
                                <p className="text-gray-400 max-w-md leading-relaxed">
                                    Crea y controla múltiples cajeros y recepcionistas. Ellos operan la terminal, tú monitoreas los billetes desde tu casa. Evita robos de caja con bitácoras inmutables.
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Social Proof Bar */}
                    <div className="mt-20 md:mt-32 max-w-5xl mx-auto border-y border-white/10 py-12">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                            <div>
                                <Activity className="w-6 h-6 mx-auto mb-3 text-gray-500" />
                                <div className="text-3xl font-black mb-1">99.9%</div>
                                <div className="text-sm text-gray-500 uppercase tracking-widest">Uptime</div>
                            </div>
                            <div>
                                <Users className="w-6 h-6 mx-auto mb-3 text-gray-500" />
                                <div className="text-3xl font-black mb-1">Ilimitado</div>
                                <div className="text-sm text-gray-500 uppercase tracking-widest">Miembros</div>
                            </div>
                            <div>
                                <Zap className="w-6 h-6 mx-auto mb-3 text-gray-500" />
                                <div className="text-3xl font-black mb-1">&lt;1s</div>
                                <div className="text-sm text-gray-500 uppercase tracking-widest">Acceso QR</div>
                            </div>
                            <div>
                                <ShieldCheck className="w-6 h-6 mx-auto mb-3 text-gray-500" />
                                <div className="text-3xl font-black mb-1">0%</div>
                                <div className="text-sm text-gray-500 uppercase tracking-widest">Fugas de pago</div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom CTA */}
                    <div className="mt-24 md:mt-40 mb-20 text-center relative px-4">
                        <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-64 bg-[#D3FF24]/10 blur-[100px] rounded-full -z-10" />
                        <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-8">No administres. <br /> <span className="text-[#D3FF24]">Evoluciona.</span></h2>
                        <Button
                            onClick={handleCTA}
                            size="lg"
                            className="bg-[#D3FF24] hover:bg-[#bce620] text-black font-bold h-16 px-8 md:px-12 text-base md:text-lg rounded-2xl shadow-[0_0_50px_rgba(211,255,36,0.2)] hover:shadow-[0_0_80px_rgba(211,255,36,0.5)] transition-all duration-300 transform hover:scale-105 w-full sm:w-auto"
                        >
                            Eleva tu Gimnasio a Kallpa
                        </Button>
                    </div>

                </div>
            </main>

            {/* Footer Signature */}
            <footer className="relative z-10 border-t border-white/10 bg-[#030303] pt-16 pb-12 px-6 overflow-hidden">
                <div className="max-w-7xl mx-auto flex flex-col items-center">
                    {/* Logo & Copyright */}
                    <div className="flex flex-col items-center gap-4 mb-10 text-center">
                        <div className="flex items-center gap-2">
                            <img src="/logo.png" alt="Kallpa Logo" className="h-6 w-6 opacity-90" />
                            <span className="font-display font-bold tracking-[0.2em] text-white">KALLPA SYSTEMS</span>
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium max-w-sm leading-relaxed">
                            © {new Date().getFullYear()} El ecosistema definitivo para gimnasios de alto rendimiento.
                        </p>
                    </div>

                    <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent mb-10" />

                    {/* Agency Credit */}
                    <a
                        href="https://www.facebook.com/profile.php?id=61586273853555"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative flex flex-col items-center gap-2 bg-white/[0.02] p-6 rounded-2xl border border-white/5 hover:border-[#D3FF24]/20 transition-all duration-500 hover:shadow-[0_0_30px_rgba(211,255,36,0.05)]"
                    >
                        <span className="text-[9px] uppercase tracking-[0.6em] text-gray-400 font-bold group-hover:text-[#D3FF24] transition-colors">Estrategia & Desarrollo</span>
                        <div className="flex items-center gap-1 group-hover:scale-110 transition-transform duration-500">
                            <span className="text-2xl font-black tracking-tight text-white">IDENZA</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-[#D3FF24] animate-pulse" />
                        </div>

                        {/* Interactive underline */}
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#D3FF24] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
                    </a>
                </div>
            </footer>
        </div>
    );
}
