import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, CheckCircle2, XCircle, Loader2, Dumbbell, Zap, Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MemberCardModalProps {
    member: {
        id: string;
        full_name: string;
        plan?: string;
        planName?: string;
        planColor?: string;
        status?: string;
        phone?: string;
        access_code?: string;
    } | null;
    gymName?: string;
    onClose: () => void;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
    active: { label: "ACTIVO", icon: CheckCircle2, color: "#10b981" },
    expired: { label: "VENCIDO", icon: XCircle, color: "#f43f5e" },
    suspended: { label: "SUSPENDIDO", icon: XCircle, color: "#f59e0b" },
    inactive: { label: "INACTIVO", icon: XCircle, color: "#94a3b8" },
};

export function MemberCardModal({ member, gymName = "Kallpa", onClose }: MemberCardModalProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);

    if (!member) return null;

    const status = statusConfig[member.status || "active"] || statusConfig.active;
    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(member.id)}&size=200&margin=1&dark=ffffff&light=00000000`;
    const memberIdShort = member.id.toUpperCase().slice(-8);
    const planColor = member.planColor || "#7C3AED";

    const downloadCard = async () => {
        setDownloading(true);
        try {
            await new Promise<void>((resolve, reject) => {
                if ((window as any).html2canvas) { resolve(); return; }
                const s = document.createElement("script");
                s.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
                s.onload = () => resolve();
                s.onerror = reject;
                document.head.appendChild(s);
            });
            if (cardRef.current) {
                const canvas = await (window as any).html2canvas(cardRef.current, {
                    backgroundColor: null,
                    scale: 3,
                    useCORS: true,
                    allowTaint: true,
                });
                const link = document.createElement("a");
                link.download = `carnet-${member.full_name.replace(/\s+/g, "-").toLowerCase()}.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
                toast.success("Carnet digital guardado");
            }
        } catch {
            window.open(qrUrl, "_blank");
            toast.info("Abriendo QR en nueva pestaña");
        } finally {
            setDownloading(false);
        }
    };

    const shareWhatsApp = () => {
        const portalUrl = `${window.location.origin}/portal/${member.id}`;
        const nombre = member.full_name.split(" ")[0];
        const codigo = member.access_code ? `\n\n🔑 *Tu código de acceso:* \`${member.access_code}\`` : "";
        const text = `¡Hola ${nombre}! 🎉 Ya tienes acceso a tu portal de miembro.\n\nDesde aquí puedes ver tu carnet, plan activo, vigencia y renovar tu membresía:\n👉 ${portalUrl}${codigo}\n\n¡Nos vemos en el gym! 💪`;
        const phone = member.phone ? member.phone.replace(/\D/g, "") : "";
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
    };

    return (
        <Dialog open={!!member} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md p-0 border-none bg-transparent shadow-none overflow-visible">
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="flex flex-col gap-6"
                    >
                        {/* ── PREMIUM CARNET ── */}
                        <div
                            ref={cardRef}
                            className="relative w-full aspect-[16/10] rounded-[32px] overflow-hidden shadow-2xl flex flex-col p-8 group/card select-none"
                            style={{ background: "linear-gradient(135deg, #0d0d15 0%, #1a1a2e 50%, #0d0d15 100%)" }}
                        >
                            {/* Shimmer Effect */}
                            <div className="absolute inset-x-0 top-0 h-[200%] w-full bg-gradient-to-b from-white/5 via-transparent to-transparent -rotate-45 -translate-y-[50%] animate-shimmer pointer-events-none" />

                            {/* Animated mesh accent */}
                            <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/10 blur-[60px] rounded-full pointer-events-none" />
                            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-violet-600/10 blur-[60px] rounded-full pointer-events-none" />

                            <div className="flex justify-between items-start relative z-10">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-lg bg-primary/20 flex items-center justify-center">
                                            <Dumbbell className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <p className="text-[9px] font-black tracking-[.3em] text-primary uppercase">Carnet Digital</p>
                                    </div>
                                    <h3 className="text-lg font-bold text-white/90">{gymName}</h3>
                                </div>
                                <div className="h-10 w-14 bg-white/5 rounded-lg border border-white/10 backdrop-blur-md flex items-center justify-center overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                                    <Sparkles className="h-4 w-4 text-amber-400/30" />
                                </div>
                            </div>

                            <div className="mt-auto relative z-10 flex items-end justify-between">
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-white/30 tracking-widest uppercase">Titular del Pase</p>
                                        <p className="text-2xl font-bold tracking-tight text-white leading-tight">{member.full_name}</p>
                                    </div>
                                    <div className="flex items-center gap-5">
                                        <div>
                                            <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Member ID</p>
                                            <p className="text-xs font-mono font-bold text-primary">#{memberIdShort}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Plan Activo</p>
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: planColor }} />
                                                <p className="text-xs font-bold text-white/80">{member.planName || "Básico"}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Estado</p>
                                            <p className="text-[10px] font-bold" style={{ color: status.color }}>{status.label}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-2 bg-white rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] ring-4 ring-black/5">
                                    <img src={qrUrl} alt="QR" className="h-16 w-16" crossOrigin="anonymous" />
                                </div>
                            </div>
                        </div>

                        {/* ── ACTIONS ── */}
                        <div className="flex gap-3 px-1">
                            <Button
                                onClick={downloadCard}
                                disabled={downloading}
                                className="flex-1 h-14 gap-3 bg-white/[0.05] border border-white/10 text-white hover:bg-white/[0.08] backdrop-blur-xl rounded-2xl transition-all active:scale-[0.98]"
                                variant="outline"
                            >
                                {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5 text-primary" />}
                                <span className="font-bold flex flex-col items-start leading-none">
                                    <span>Descargar</span>
                                    <span className="text-[10px] opacity-40 font-medium">Formato PNG</span>
                                </span>
                            </Button>
                            {member.phone && (
                                <Button
                                    onClick={shareWhatsApp}
                                    className="flex-1 h-14 gap-3 bg-[#25D366] text-white hover:bg-[#20b657] shadow-xl shadow-[#25D366]/20 rounded-2xl transition-all active:scale-[0.98]"
                                >
                                    <Share2 className="h-5 w-5" />
                                    <span className="font-bold flex flex-col items-start leading-none">
                                        <span>WhatsApp</span>
                                        <span className="text-[10px] opacity-60 font-medium">Enviar Portal</span>
                                    </span>
                                </Button>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </DialogContent>

            <style>{`
                @keyframes shimmer {
                    0% { transform: translate(-100%, -100%) rotate(-45deg); opacity: 0; }
                    50% { opacity: 0.1; }
                    100% { transform: translate(100%, 100%) rotate(-45deg); opacity: 0; }
                }
                .animate-shimmer {
                    animation: shimmer 5s infinite;
                }
            `}</style>
        </Dialog>
    );
}
