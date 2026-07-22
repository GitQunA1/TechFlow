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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setMessage("");
    setSubmitting(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error("Please provide a message for the staff.");
      return;
    }
    
    setSubmitting(true);
    try {
      await createRevisionRequest(fileId, { message });
      toast.success("Revision requested!", {
        description: "The staff has been notified to revise this file."
      });
      handleOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to request revision", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-600" />
            Request Staff Revision
          </DialogTitle>
          <DialogDescription>
            Send a request to the staff to revise this file.
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
              Because this file was uploaded by a Staff member, you must request them to revise it instead of resuming it directly.
            </p>
          </div>

          {/* Message textarea */}
          <div className="space-y-2">
            <Label htmlFor="revision-message">Revision Notes / Instructions</Label>
            <Textarea
              id="revision-message"
              placeholder="Explain what needs to be changed..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              disabled={submitting}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send to Staff
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
