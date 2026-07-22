"use client";

import { useState } from "react";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitRevision } from "@/lib/api";
import type { StaffRevisionRequestDto } from "@/lib/api";

interface RevisionSubmitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revision: StaffRevisionRequestDto | null;
  onSubmitted: () => void;
}

const VALID_EXTS = [".png", ".jpg", ".jpeg", ".pdf", ".dwg"];

export function RevisionSubmitModal({
  open,
  onOpenChange,
  revision,
  onSubmitted,
}: RevisionSubmitModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelectedFile(null);
    setFileError(null);
    setSubmitting(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!VALID_EXTS.includes(ext)) {
      setFileError("Only .png, .jpg, .jpeg, .pdf, or .dwg files are allowed.");
      setSelectedFile(null);
      return;
    }
    setFileError(null);
    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!revision || !selectedFile) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      await submitRevision(revision.id, fd);
      toast.success("Revised file submitted! Waiting for leader approval.");
      onSubmitted();
      handleOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to submit revision", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!revision) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Upload Revised File
          </DialogTitle>
          <DialogDescription>
            Upload the revised file as requested by the leader.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File info */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <FileText className="w-4 h-4 text-muted-foreground" />
              {revision.fileName}
            </div>
            <div className="text-muted-foreground text-xs">
              {revision.folderName} · {revision.categoryName}
            </div>
          </div>

          {/* Leader message */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 space-y-1">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-semibold uppercase tracking-wide">
              <AlertCircle className="w-3.5 h-3.5" />
              Leader's note
            </div>
            <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
              {revision.message}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              — {revision.requestedBy}
            </p>
          </div>

          {/* File picker */}
          <div className="space-y-2">
            <label
              htmlFor="revision-file"
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
                selectedFile
                  ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
            >
              <Upload className={cn("w-8 h-8", selectedFile ? "text-green-500" : "text-muted-foreground")} />
              {selectedFile ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Click to select file
                  </p>
                  <p className="text-xs text-muted-foreground">
                    .png, .jpg, .jpeg, .pdf, .dwg
                  </p>
                </div>
              )}
              <input
                id="revision-file"
                type="file"
                accept=".png,.jpg,.jpeg,.pdf,.dwg"
                className="hidden"
                onChange={handleFileChange}
                disabled={submitting}
              />
            </label>
            {fileError && (
              <p className="text-xs text-destructive">{fileError}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!selectedFile || submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Submit Revised File
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
