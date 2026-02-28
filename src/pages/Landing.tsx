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
                <img
                    src="/gym-kallpa-bg.png"
                    alt="Sistema de gestión para gimnasios Kallpa - Control de accesos y administración financiera profesional"
                    className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity"
                    loading="eager"
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
                        <img
                            src="/logo.png"
                            alt="Kallpa Systems - Software de Gestión para Gimnasios en la Nube"
                            title="Kallpa Systems"
                            className="h-8 w-8 object-contain"
                        />
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
            <main className="relative z-10 pt-24 pb-12 md:pt-32 md:pb-20 px-4 md:px-6">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                        className="text-center max-w-4xl mx-auto mt-14 md:mt-20"
                    >
                        <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 mb-6 md:mb-8 rounded-full border border-[#D3FF24]/30 bg-[#D3FF24]/10 backdrop-blur-md">
                            <Zap className="w-3 h-3 md:w-4 md:h-4 text-[#D3FF24]" />
                            <span className="text-[10px] md:text-xs font-medium text-[#D3FF24] uppercase tracking-wider">Sistema Operativo para Gimnasios</span>
                        </motion.div>

                        <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight mb-4 md:mb-6 leading-[1.1]">
                            El Software que hace <br className="hidden sm:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D3FF24] to-lime-400">
                                Crecer tu Gimnasio.
                            </span>
                        </motion.h1>

                        <motion.p variants={itemVariants} className="text-sm sm:text-base md:text-xl text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed px-4">
                            Automatiza accesos, predice abandonos y recupera socios por WhatsApp. Kallpa es tu gerente virtual 24/7.
                        </motion.p>

                        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full px-4">
                            <Button
                                onClick={handleCTA}
                                size="lg"
                                className="w-full sm:w-auto bg-[#D3FF24] hover:bg-[#e1ff63] text-black font-bold h-12 md:h-14 px-8 rounded-xl shadow-[0_0_30px_rgba(211,255,36,0.2)] transition-all duration-300 transform hover:scale-105"
                            >
                                Empieza Gratis <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </motion.div>
                    </motion.div>

                    {/* How It Works Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.5 }}
                        className="mt-20 md:mt-32 max-w-5xl mx-auto"
                    >
                        <div className="text-center mb-10 md:mb-16">
                            <h2 className="text-2xl md:text-4xl font-black mb-2 md:mb-4">¿Cómo funciona Kallpa?</h2>
                            <p className="text-sm md:text-base text-gray-400">Implementación en menos de 10 minutos.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8 relative">
                            {/* Step 1 */}
                            <div className="relative group p-5 md:p-8 rounded-2xl md:rounded-3xl bg-white/[0.02] border border-white/5 hover:border-[#D3FF24]/30 transition-all duration-500 text-center">
                                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-xl md:rounded-2xl bg-[#D3FF24]/10 flex items-center justify-center mb-4 md:mb-6">
                                    <span className="text-xl md:text-2xl font-black text-[#D3FF24]">1</span>
                                </div>
                                <h3 className="text-lg md:text-xl font-bold mb-2">Configura</h3>
                                <p className="text-xs md:text-sm text-gray-400">Crea tus planes y horarios en la nube.</p>
                            </div>

                            {/* Step 2 */}
                            <div className="relative group p-5 md:p-8 rounded-2xl md:rounded-3xl bg-white/[0.02] border border-white/5 hover:border-[#D3FF24]/30 transition-all duration-500 text-center">
                                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-xl md:rounded-2xl bg-[#D3FF24]/10 flex items-center justify-center mb-4 md:mb-6">
                                    <span className="text-xl md:text-2xl font-black text-[#D3FF24]">2</span>
                                </div>
                                <h3 className="text-lg md:text-xl font-bold mb-2">Acceso QR</h3>
                                <p className="text-xs md:text-sm text-gray-400">Los socios entran con su QR digital rápido.</p>
                            </div>

                            {/* Step 3 */}
                            <div className="relative group p-5 md:p-8 rounded-2xl md:rounded-3xl bg-white/[0.02] border border-white/5 hover:border-[#D3FF24]/30 transition-all duration-500 text-center">
                                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-xl md:rounded-2xl bg-[#D3FF24]/10 flex items-center justify-center mb-4 md:mb-6">
                                    <span className="text-xl md:text-2xl font-black text-[#D3FF24]">3</span>
                                </div>
                                <h3 className="text-lg md:text-xl font-bold mb-2">Retención</h3>
                                <p className="text-xs md:text-sm text-gray-400">Recupera inactivos con alertas de WhatsApp.</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Features Deep Dive */}
                    <div className="mt-24 md:mt-40 space-y-20 md:space-y-32 max-w-6xl mx-auto">
                        {/* Feature: Retention */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col lg:flex-row items-center gap-8 lg:gap-20"
                        >
                            <div className="flex-1 space-y-4 md:space-y-6">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">
                                    <Brain className="w-3 h-3 md:w-4 md:h-4" /> Centro de Retención
                                </div>
                                <h2 className="text-2xl md:text-5xl font-black leading-tight">
                                    Recupera socios automáticamente.
                                </h2>
                                <p className="text-sm md:text-lg text-gray-400 leading-relaxed">
                                    El algoritmo analiza la asistencia y te alerta qué miembros están a punto de abandonar tu gimnasio.
                                </p>
                                <ul className="space-y-3 md:space-y-4 pt-2">
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#D3FF24]/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#D3FF24]" />
                                        </div>
                                        <span className="text-sm md:text-base text-gray-300"><strong>Detección:</strong> Alertas a los 7 días de inactividad.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#D3FF24]/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#D3FF24]" />
                                        </div>
                                        <span className="text-sm md:text-base text-gray-300"><strong>WhatsApp:</strong> Envía mensajes persuasivos en 1 clic.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="flex-1 relative w-full aspect-[4/3] rounded-2xl md:rounded-3xl border border-white/10 md:shadow-[0_0_100px_rgba(211,255,36,0.15)] overflow-hidden group">
                                <img
                                    src="/feature-retention-real.jpg"
                                    alt="Sistema de gestión y retención de socios para gimnasios mediante WhatsApp automático por Kallpa"
                                    title="Recupera socios de tu gimnasio con mensajes de WhatsApp automáticos"
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    loading="lazy"
                                />
                            </div>
                        </motion.div>

                        {/* Feature: Terminal QR */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col lg:flex-row-reverse items-center gap-8 lg:gap-20"
                        >
                            <div className="flex-1 space-y-4 md:space-y-6">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#D3FF24]/30 bg-[#D3FF24]/10 text-[#D3FF24] text-[10px] md:text-xs font-bold uppercase tracking-wider">
                                    <QrCode className="w-3 h-3 md:w-4 md:h-4" /> Torno Virtual
                                </div>
                                <h2 className="text-2xl md:text-5xl font-black leading-tight">
                                    Accesos en 1 segundo.
                                </h2>
                                <p className="text-sm md:text-lg text-gray-400 leading-relaxed">
                                    Olvídate de las tarjetas o biometría lenta. Transforma cualquier tablet en un terminal de acceso QR dinámico.
                                </p>
                                <ul className="space-y-3 md:space-y-4 pt-2">
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#D3FF24]/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#D3FF24]" />
                                        </div>
                                        <span className="text-sm md:text-base text-gray-300"><strong>Rachas:</strong> Cuenta visitas seguidas para motivar.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#D3FF24]/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#D3FF24]" />
                                        </div>
                                        <span className="text-sm md:text-base text-gray-300"><strong>En Vivo:</strong> Mira quién entra en tiempo real.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="flex-1 relative w-full aspect-[4/3] rounded-2xl md:rounded-3xl border border-white/10 md:shadow-[0_0_100px_rgba(211,255,36,0.15)] overflow-hidden group bg-[#0A0A0A]">
                                <img
                                    src="/feature-terminal-real.jpg"
                                    alt="Torno virtual y control de acceso por código QR para gimnasios y centros fitness"
                                    title="Control de acceso con código QR ultrarrápido y seguro para gimnasios"
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    loading="lazy"
                                />
                            </div>
                        </motion.div>
                    </div>

                    {/* Pricing Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.5 }}
                        className="mt-28 md:mt-40 max-w-5xl mx-auto"
                    >
                        <div className="text-center mb-10 md:mb-16">
                            <h2 className="text-2xl md:text-5xl font-black mb-3 md:mb-4">Precios Transparentes, <br className="hidden sm:block" /><span className="text-[#D3FF24]">Retorno Inmediato.</span></h2>
                            <p className="text-sm md:text-lg text-gray-400">Cobra una cuota más y el software se paga solo.</p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
                            {/* Monthly Plan */}
                            <div className="relative p-6 md:p-10 rounded-2xl md:rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all duration-300">
                                <h3 className="text-xl md:text-2xl font-bold mb-2">Mensual</h3>
                                <div className="mb-6">
                                    <span className="text-4xl md:text-5xl font-black">S/ 35</span>
                                    <span className="text-sm md:text-base text-gray-500">/mes</span>
                                </div>
                                <ul className="space-y-3 md:space-y-4 mb-8 text-sm md:text-base">
                                    <li className="flex items-center gap-3 text-gray-300"><ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-[#D3FF24]" /> Socios ilimitados</li>
                                    <li className="flex items-center gap-3 text-gray-300"><ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-[#D3FF24]" /> Control de acceso QR</li>
                                    <li className="flex items-center gap-3 text-gray-300"><ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-[#D3FF24]" /> Centro de Retención</li>
                                </ul>
                                <Button onClick={handleCTA} className="w-full bg-white text-black hover:bg-gray-200 font-bold h-12 rounded-xl">
                                    Empezar Mensual
                                </Button>
                            </div>

                            {/* Annual Plan (Featured) */}
                            <div className="relative p-6 md:p-10 rounded-2xl md:rounded-[2rem] bg-gradient-to-br from-[#D3FF24]/10 to-transparent border border-[#D3FF24]/50 shadow-[0_0_30px_rgba(211,255,36,0.1)] transition-all overflow-hidden">
                                <div className="absolute top-0 right-0 bg-[#D3FF24] text-black text-[10px] md:text-xs font-black uppercase tracking-wider py-1 px-3 md:px-4 rounded-bl-xl origin-top-right">
                                    Mejor Valor
                                </div>
                                <h3 className="text-xl md:text-2xl font-bold mb-2 text-[#D3FF24]">Anual</h3>
                                <div className="mb-6">
                                    <span className="text-4xl md:text-5xl font-black">S/ 279</span>
                                    <span className="text-sm md:text-base text-gray-500">/año</span>
                                    <div className="text-xs md:text-sm font-medium text-[#D3FF24] mt-1">Ahorra S/ 141 (33% dscto)</div>
                                </div>
                                <ul className="space-y-3 md:space-y-4 mb-8 text-sm md:text-base">
                                    <li className="flex items-center gap-3 text-gray-200"><ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-[#D3FF24]" /> Todo lo del plan Mensual</li>
                                    <li className="flex items-center gap-3 text-gray-200"><ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-[#D3FF24]" /> Acceso a nuevas funciones</li>
                                </ul>
                                <Button onClick={handleCTA} className="w-full bg-[#D3FF24] text-black hover:bg-[#e1ff63] font-bold h-12 rounded-xl shadow-[0_0_20px_rgba(211,255,36,0.2)]">
                                    Empezar Anual
                                </Button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Social Proof Bar */}
                    <div className="mt-20 md:mt-40 max-w-5xl mx-auto border-y border-white/10 py-8 md:py-12">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
                            <div>
                                <Activity className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-2 md:mb-3 text-gray-500" />
                                <div className="text-2xl md:text-3xl font-black mb-1">99.9%</div>
                                <div className="text-[10px] md:text-sm text-gray-500 uppercase tracking-widest">Uptime</div>
                            </div>
                            <div>
                                <Users className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-2 md:mb-3 text-gray-500" />
                                <div className="text-2xl md:text-3xl font-black mb-1"><span className="text-[#D3FF24]">∞</span></div>
                                <div className="text-[10px] md:text-sm text-gray-500 uppercase tracking-widest">Miembros</div>
                            </div>
                            <div>
                                <Zap className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-2 md:mb-3 text-gray-500" />
                                <div className="text-2xl md:text-3xl font-black mb-1">&lt;1s</div>
                                <div className="text-[10px] md:text-sm text-gray-500 uppercase tracking-widest">Acceso QR</div>
                            </div>
                            <div>
                                <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-2 md:mb-3 text-gray-500" />
                                <div className="text-2xl md:text-3xl font-black mb-1">100%</div>
                                <div className="text-[10px] md:text-sm text-gray-500 uppercase tracking-widest">Seguridad</div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom CTA */}
                    <div className="mt-20 md:mt-32 mb-16 md:mb-20 text-center relative px-4">
                        <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-64 bg-[#D3FF24]/10 blur-[100px] rounded-full -z-10" />
                        <h2 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight mb-6 md:mb-8">Digitalízate. <br className="sm:hidden" /> <span className="text-[#D3FF24]">O quédate atrás.</span></h2>
                        <Button
                            onClick={handleCTA}
                            size="lg"
                            className="bg-[#D3FF24] hover:bg-[#e1ff63] text-black font-bold h-14 md:h-16 px-6 md:px-12 text-sm md:text-lg rounded-xl md:rounded-2xl shadow-[0_0_30px_rgba(211,255,36,0.2)] hover:shadow-[0_0_50px_rgba(211,255,36,0.4)] transition-all duration-300 w-full sm:w-auto"
                        >
                            Crear Cuenta Gratis Ahora
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
                            <img src="/logo.png" alt="Kallpa Systems Logo" className="h-6 w-6 opacity-90" />
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
