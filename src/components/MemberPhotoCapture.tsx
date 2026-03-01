import React, { useRef, useState } from "react";
import { Upload, Check, RefreshCw, User, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_PHOTO_SIZE_MB = 5;

interface MemberPhotoCaptureProps {
    onPhotoCaptured: (file: File | null) => void;
    existingPhotoUrl?: string | null;
    className?: string;
}

const MemberPhotoCapture = ({ onPhotoCaptured, existingPhotoUrl, className }: MemberPhotoCaptureProps) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(existingPhotoUrl || null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
            toast.error(`La foto no puede superar los ${MAX_PHOTO_SIZE_MB} MB`);
            e.target.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
            onPhotoCaptured(file);
        };
        reader.onerror = () => {
            toast.error("No se pudo leer la imagen. Intenta con otro archivo.");
        };
        reader.readAsDataURL(file);
    };

    const clearPhoto = () => {
        setPreviewUrl(null);
        onPhotoCaptured(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className={cn("relative group w-full max-w-[110px]", className)}>
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-secondary/20 ring-1 ring-border/50 group-hover:ring-primary/30 transition-all shadow-md flex items-center justify-center">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={previewUrl ? "filled" : "empty"}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
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
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground p-2 text-center cursor-pointer w-full h-full hover:bg-secondary/40 transition-colors"
                            >
                                <div className="p-2 rounded-full bg-secondary/50 group-hover:bg-primary/10 transition-colors">
                                    <Image className="h-6 w-6 opacity-30 group-hover:opacity-50 transition-opacity" />
                                </div>
                                <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">Subir</span>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="flex justify-start mt-2 w-full">
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-6 text-[8px] font-bold uppercase tracking-widest text-primary/50 hover:text-primary transition-all p-0"
                    onClick={() => fileInputRef.current?.click()}
                >
                    {previewUrl ? "Cambiar Foto" : "Seleccionar"}
                </Button>
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
