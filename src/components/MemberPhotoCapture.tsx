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

const MemberPhotoCapture = ({ onPhotoCaptured, existingPhotoUrl, className, size = "md" }: MemberPhotoCaptureProps) => {
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
        <div className={cn("relative group", className)}>
            <div className={cn(
                "relative aspect-square mx-auto rounded-3xl overflow-hidden bg-secondary/30 ring-2 ring-border/50 group-hover:ring-primary/30 transition-all",
                size === "sm" ? "w-20 rounded-2xl" : "w-32"
            )}>
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
                                <div className="flex flex-col items-center gap-1 text-muted-foreground p-2 text-center">
                                    <User className={cn("opacity-10", size === "sm" ? "h-6 w-6" : "h-10 w-10")} />
                                    <span className={cn("font-bold uppercase tracking-wider opacity-30", size === "sm" ? "text-[7px]" : "text-[9px]")}>
                                        {size === "sm" ? "Foto" : "Foto Opcional"}
                                    </span>
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

            <div className={cn(
                "flex justify-center gap-2 mt-3 w-full",
                size === "sm" && "mt-1.5"
            )}>
                {mode === "preview" && (
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                                "flex-1 font-bold uppercase tracking-wider gap-1.5 border-border/40 bg-secondary/5 rounded-xl",
                                size === "sm" ? "h-7 text-[8px] px-1" : "h-9 text-[10px]"
                            )}
                            onClick={() => setMode("camera")}
                        >
                            <Camera className={cn("text-primary", size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} />
                            Cámara
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                                "flex-1 font-bold uppercase tracking-wider gap-1.5 border-border/40 bg-secondary/5 rounded-xl",
                                size === "sm" ? "h-7 text-[8px] px-1" : "h-9 text-[10px]"
                            )}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className={cn("text-primary", size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} />
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
