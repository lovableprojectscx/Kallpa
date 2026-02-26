import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, CheckCircle2, XCircle, Loader2, Dumbbell } from "lucide-react";
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
    active: { label: "ACTIVO", icon: CheckCircle2, color: "#22c55e" },
    expired: { label: "VENCIDO", icon: XCircle, color: "#FF6B6B" },
    suspended: { label: "SUSPENDIDO", icon: XCircle, color: "#ef4444" },
    inactive: { label: "INACTIVO", icon: XCircle, color: "#6b7280" },
};

export function MemberCardModal({ member, gymName = "Kallpa", onClose }: MemberCardModalProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);

    if (!member) return null;

    const status = statusConfig[member.status || "active"] || statusConfig.active;
    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(member.id)}&size=200&margin=1&dark=1a1a2e&light=ffffff`;
    const memberId = member.id.toUpperCase().slice(-8);
    const planColor = member.planColor || "#7C3AED";

    const downloadCard = async () => {
        setDownloading(true);
        try {
            // @ts-ignore — html2canvas se carga dinámicamente
            const html2canvas = (await import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js" as any)).default;
            if (cardRef.current) {
                const canvas = await html2canvas(cardRef.current, {
                    backgroundColor: null,
                    scale: 3,
                    useCORS: true,
                    allowTaint: true,
                });
                const link = document.createElement("a");
                link.download = `carnet-${member.full_name.replace(/\s+/g, "-").toLowerCase()}.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
                toast.success("Carnet descargado");
            }
        } catch {
            // Fallback: open QR link
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
            <DialogContent className="sm:max-w-sm p-0 border-border/50 bg-transparent shadow-none overflow-visible">
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col gap-4"
                    >
                        {/* ── CARNET ── */}
                        <div
                            ref={cardRef}
                            className="relative w-full rounded-3xl overflow-hidden shadow-2xl select-none"
                            style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 60%, #16213e 100%)" }}
                        >
                            {/* Barra de color del plan en la parte superior */}
                            <div className="h-1.5 w-full" style={{ background: planColor }} />

                            {/* Fondo decorativo */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-10" style={{ background: planColor }} />
                                <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full opacity-5" style={{ background: planColor }} />
                                {/* Hexágono decorativo */}
                                <svg className="absolute top-4 right-4 opacity-5" width="80" height="80" viewBox="0 0 100 100">
                                    <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="white" />
                                </svg>
                            </div>

                            {/* Header del carnet */}
                            <div className="relative flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/10">
                                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${planColor}25`, border: `1.5px solid ${planColor}50` }}>
                                    <Dumbbell className="h-5 w-5" style={{ color: planColor }} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">PASE DE ACCESO</p>
                                    <p className="text-sm font-bold text-white">{gymName}</p>
                                </div>
                                <div className="ml-auto">
                                    <div
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                        style={{ background: `${status.color}20`, color: status.color, border: `1px solid ${status.color}40` }}
                                    >
                                        <status.icon className="h-2.5 w-2.5" />
                                        {status.label}
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="relative px-5 py-4 flex gap-4 items-start">
                                {/* Datos del miembro */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Miembro</p>
                                    <h2 className="text-xl font-display font-bold text-white leading-tight truncate">{member.full_name}</h2>

                                    {member.planName && (
                                        <div className="mt-3">
                                            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Plan</p>
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-2 w-2 rounded-full" style={{ background: planColor }} />
                                                <span className="text-sm font-semibold text-white">{member.planName}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-3">
                                        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">ID de Miembro</p>
                                        <p className="font-mono text-xs font-bold tracking-widest" style={{ color: planColor }}>
                                            #{memberId}
                                        </p>
                                    </div>
                                </div>

                                {/* QR Code */}
                                <div className="shrink-0">
                                    <div className="rounded-xl overflow-hidden p-1.5 bg-white shadow-lg" style={{ width: 80, height: 80 }}>
                                        <img
                                            src={qrUrl}
                                            alt="QR de acceso"
                                            width={74}
                                            height={74}
                                            className="w-full h-full object-contain"
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                    <p className="text-[8px] text-white/30 text-center mt-1 font-medium">Escanear en Terminal</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="relative px-5 pb-5">
                                <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                                    <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${planColor}40, transparent)` }} />
                                    <p className="text-[9px] text-white/20 font-mono uppercase tracking-wider">Válido con membresía activa</p>
                                    <div className="h-px flex-1" style={{ background: `linear-gradient(to left, ${planColor}40, transparent)` }} />
                                </div>
                            </div>
                        </div>

                        {/* ── ACCIONES ── */}
                        <div className="flex gap-2">
                            <Button
                                onClick={downloadCard}
                                disabled={downloading}
                                className="flex-1 gap-2 bg-card border border-border/50 text-foreground hover:bg-secondary"
                                variant="outline"
                            >
                                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                Descargar
                            </Button>
                            {member.phone && (
                                <Button
                                    onClick={shareWhatsApp}
                                    className="flex-1 gap-2 bg-[#25D366] text-white hover:bg-[#20b657]"
                                >
                                    <Share2 className="h-4 w-4" />
                                    WhatsApp
                                </Button>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}
