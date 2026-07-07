"use client";

import { useState, useEffect } from "react";
import { History, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { rollbackVersion } from "@/lib/api";
import { toast } from "sonner";

interface RollbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: number;
  versionId: number;
  fileName: string;
  versionNumber: number;
}

export function RollbackModal({
  open,
  onOpenChange,
  fileId,
  versionId,
  fileName,
  versionNumber,
}: RollbackModalProps) {
  const [changeReason, setChangeReason] = useState("");
  const [uploading, setUploading] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setChangeReason("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!changeReason.trim()) return;

    setUploading(true);
    try {
      await rollbackVersion(fileId, versionId, { changeReason });
      toast.success("Rollback successful!", {
        description: `${fileName} has been rolled back to v${versionNumber}. All departments have been notified.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Rollback failed", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] flex flex-col p-0 overflow-hidden gap-0 border-none shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 bg-muted/30 border-b shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Rollback Version
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Rolling back{" "}
            <span className="font-semibold text-foreground">{fileName}</span>{" "}
            to <Badge variant="secondary">v{versionNumber}</Badge>
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="p-6 space-y-5 bg-background">
          {/* Warning banner */}
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              A new version will be created using the file from{" "}
              <strong>v{versionNumber}</strong>. All departments that previously
              received this file will be required to re-confirm.
            </p>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Reason for Rollback{" "}
              <span className="text-destructive">*</span>
            </label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-y"
              style={{ minHeight: "96px", maxHeight: "240px" }}
              placeholder="Describe why you are rolling back to this version..."
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This reason will be sent to all departments as a change note.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 bg-muted/10 border-t shrink-0 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            disabled={!changeReason.trim() || uploading}
            onClick={handleSubmit}
            className="min-w-[140px]"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Rolling
                back...
              </>
            ) : (
              <>
                <History className="w-4 h-4 mr-2" /> Confirm Rollback
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
