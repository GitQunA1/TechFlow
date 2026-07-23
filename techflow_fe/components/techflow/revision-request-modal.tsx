"use client";

import { useState } from "react";
import { Send, FileText, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createRevisionRequest } from "@/lib/api";

interface RevisionRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: number;
  fileName: string;
}

export function RevisionRequestModal({
  open,
  onOpenChange,
  fileId,
  fileName,
}: RevisionRequestModalProps) {
  const [sending, setSending] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (!v) setSending(false);
    onOpenChange(v);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await createRevisionRequest(fileId, { message: null });
      toast.success("Request sent to Staff!", {
        description: "Staff has been notified to revise and re-upload this file.",
      });
      handleOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to send request", { description: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-600" />
            Send Revision Request to Staff
          </DialogTitle>
          <DialogDescription>
            Notify the staff to revise and re-upload this file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File info */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                File:
              </span>
              <span className="font-medium">{fileName}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              This file was uploaded by a Staff member. Sending a request will notify them to revise and re-upload the file. Once they submit, you can review and approve to resume production.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Request to Staff
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
