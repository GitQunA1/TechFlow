"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Copy, FolderOpen } from "lucide-react";
import { toast } from "sonner";

interface FileViewerModalProps {
  filePath: string | null;
  fileName: string;
  onClose: () => void;
  /** Production variant: requires viewing (copying path) before confirm */
  requireViewForConfirm?: boolean;
  onViewed?: () => void;
}

export function FileViewerModal({
  filePath,
  fileName,
  onClose,
  requireViewForConfirm,
  onViewed,
}: FileViewerModalProps) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  const handleCopyPath = async () => {
    if (!filePath) {
      toast.error("Không có đường dẫn để copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(filePath);
      toast.success("Đã copy thành công! Hãy nhấn phím Windows + R, dán đường dẫn và nhấn Enter để xem bản vẽ.", {
        duration: 5000,
      });
      if (onViewed) onViewed();
    } catch {
      // Fallback for non-secure context
      toast.error("Không thể copy tự động. Vui lòng copy thủ công đường dẫn bên dưới.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[580px] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-muted/30 border-b shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {fileName}
          </DialogTitle>
          <DialogDescription>
            {ext ? ext.toUpperCase() : "File"} • Bản vẽ kỹ thuật
            {requireViewForConfirm && (
              <span className="ml-2 text-xs text-amber-600 font-medium">
                — Hãy copy đường dẫn để xem bản vẽ trước khi xác nhận
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5 bg-background">
          {/* File info card */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
            {/* Tên file */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tên bản vẽ</p>
              <p className="text-sm font-semibold text-foreground break-all">{fileName}</p>
            </div>

            {/* Đường dẫn */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Đường dẫn đầy đủ</p>
              {filePath ? (
                <div className="flex items-start gap-2">
                  <FolderOpen className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm font-mono text-foreground break-all leading-relaxed">{filePath}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Chưa có đường dẫn</p>
              )}
            </div>
          </div>

          {/* Hướng dẫn */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/10 dark:border-blue-800 p-3 space-y-1">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Cách xem bản vẽ:</p>
            <ol className="text-xs text-blue-600 dark:text-blue-500 space-y-0.5 list-decimal list-inside">
              <li>Nhấn nút <strong>"📋 Copy Đường Dẫn"</strong> bên dưới</li>
              <li>Nhấn tổ hợp phím <strong>Windows + R</strong></li>
              <li>Dán đường dẫn vào ô Run và nhấn <strong>Enter</strong></li>
            </ol>
          </div>

          {/* Copy button */}
          <Button
            className="w-full h-11 text-base font-medium"
            onClick={handleCopyPath}
            disabled={!filePath}
          >
            <Copy className="w-4 h-4 mr-2" />
            📋 Copy Đường Dẫn
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
