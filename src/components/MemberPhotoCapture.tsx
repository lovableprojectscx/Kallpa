import React, { useRef, useState } from "react";
import { Upload, Check, RefreshCw, User, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
                onPhotoCaptured(file);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearPhoto = () => {
        setPreviewUrl(null);
        onPhotoCaptured(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className={cn("relative group w-full max-w-[180px] mx-auto", className)}>
            <div className="relative aspect-square w-full rounded-[2.5rem] overflow-hidden bg-secondary/30 ring-2 ring-border/50 group-hover:ring-primary/30 transition-all shadow-2xl">
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
                                className="flex flex-col items-center gap-3 text-muted-foreground p-4 text-center cursor-pointer w-full h-full hover:bg-secondary/40 transition-colors"
                            >
                                <div className="p-4 rounded-full bg-secondary/50 group-hover:bg-primary/10 transition-colors">
                                    <Image className="h-10 w-10 opacity-20 group-hover:opacity-40 transition-opacity" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Subir Foto</span>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="flex justify-center gap-2 mt-4 w-full">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10 text-[10px] font-bold uppercase tracking-widest gap-2 border-border/40 bg-secondary/10 rounded-2xl hover:bg-secondary/20 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="h-4 w-4 text-primary" />
                    {previewUrl ? "Cambiar Foto" : "Seleccionar Foto"}
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
