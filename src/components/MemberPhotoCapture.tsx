import React, { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { Camera, Upload, X, Check, RefreshCw, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MemberPhotoCaptureProps {
    onPhotoCaptured: (file: File | null) => void;
    existingPhotoUrl?: string | null;
    className?: string;
    size?: "sm" | "md";
}

const MemberPhotoCapture = ({ onPhotoCaptured, existingPhotoUrl, className }: MemberPhotoCaptureProps) => {
    const [mode, setMode] = useState<"preview" | "camera" | "upload">("preview");
    const [previewUrl, setPreviewUrl] = useState<string | null>(existingPhotoUrl || null);
    const [isCapturing, setIsCapturing] = useState(false);
    const webcamRef = useRef<Webcam>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCapture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setPreviewUrl(imageSrc);
            setMode("preview");

            // Convert base64 to File
            fetch(imageSrc)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
                    onPhotoCaptured(file);
                });
        }
    }, [webcamRef, onPhotoCaptured]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
                setMode("preview");
                onPhotoCaptured(file);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearPhoto = () => {
        setPreviewUrl(null);
        onPhotoCaptured(null);
        setMode("preview");
    };

    return (
        <div className={cn("relative group w-full max-w-[180px] mx-auto", className)}>
            <div className="relative aspect-square w-full rounded-[2.5rem] overflow-hidden bg-secondary/30 ring-2 ring-border/50 group-hover:ring-primary/30 transition-all shadow-2xl">
                <AnimatePresence mode="wait">
                    {mode === "preview" && (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full flex items-center justify-center relative"
                        >
                            {previewUrl ? (
                                <>
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                    <button
                                        onClick={clearPhoto}
                                        className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                                    >
                                        <RefreshCw className="h-6 w-6 text-white" />
                                    </button>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-muted-foreground p-4 text-center">
                                    <div className="p-4 rounded-full bg-secondary/50">
                                        <User className="h-10 w-10 opacity-20" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Foto de Perfil</span>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {mode === "camera" && (
                        <motion.div
                            key="camera"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full bg-black relative"
                        >
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ facingMode: "user", aspectRatio: 1 }}
                                className="w-full h-full object-cover shrink-0"
                            />
                            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 px-2">
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60" onClick={() => setMode("preview")}>
                                    <X className="h-4 w-4" />
                                </Button>
                                <Button size="icon" className="h-8 w-8 rounded-full bg-primary text-primary-foreground glow-volt" onClick={handleCapture}>
                                    <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="flex justify-center gap-2 mt-4 w-full">
                {mode === "preview" && (
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 text-[10px] font-bold uppercase tracking-widest gap-2 border-border/40 bg-secondary/10 rounded-2xl hover:bg-secondary/20 transition-all"
                            onClick={() => setMode("camera")}
                        >
                            <Camera className="h-4 w-4 text-primary" />
                            Cámara
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 text-[10px] font-bold uppercase tracking-widest gap-2 border-border/40 bg-secondary/10 rounded-2xl hover:bg-secondary/20 transition-all"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="h-4 w-4 text-primary" />
                            Subir
                        </Button>
                    </>
                )}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />
        </div>
    );
};

export default MemberPhotoCapture;
