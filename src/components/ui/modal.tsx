"use client";
import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";

interface ModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}

export function Modal({
    open,
    onOpenChange,
    title,
    description,
    children,
    className = ""
}: ModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`max-h-[90vh] max-w-2xl w-full overflow-hidden flex flex-col ${className}`}>
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>{title}</DialogTitle>
                    {description && (
                        <DialogDescription>{description}</DialogDescription>
                    )}
                </DialogHeader>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
}