"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, FileText, Loader2, Eye, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { reviewDraft, API_BASE } from "@/lib/api";
import type { DraftFileDto, DepartmentDto } from "@/lib/api";

interface DraftReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: DraftFileDto | null;
  departments: DepartmentDto[];
  onReviewed: () => void;
}

export function DraftReviewModal({
  open,
  onOpenChange,
  draft,
  departments,
  onReviewed,
}: DraftReviewModalProps) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setRejectMode(false);
    setRejectReason("");
    setSubmitting(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleApprove = async () => {
    if (!draft) return;
    setSubmitting(true);
    try {
      await reviewDraft(draft.id, { approve: true });
      toast.success("Draft approved! File is now published to departments.");
      onReviewed();
      handleOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to approve draft", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!draft) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a reject reason.");
      return;
    }
    setSubmitting(true);
    try {
      await reviewDraft(draft.id, { approve: false, rejectReason });
      toast.success("Draft rejected. Staff has been notified.");
      onReviewed();
      handleOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to reject draft", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) return null;

  const draftDepts = departments.filter((d) => draft.departmentIds.includes(d.id));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Review Staff Draft
          </DialogTitle>
          <DialogDescription>
            Review and approve or reject this file submitted by staff.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File info */}
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">File:</span>
              <span className="font-medium">{draft.fileName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Folder:</span>
              <span className="font-medium">
                {draft.parentFolderName ? `${draft.parentFolderName} / ` : ""}{draft.folderName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Category:</span>
              <span className="font-medium">{draft.categoryName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Uploaded by:</span>
              <span className="font-medium">{draft.uploadedBy}</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Departments:</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {draftDepts.length > 0 ? (
                  draftDepts.map((d) => (
                    <Badge key={d.id} variant="outline" className="text-xs">
                      {d.code}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs">
                    {draft.departmentIds.length} department(s)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* File preview link */}
          {draft.fileUrl && (
            <a
              href={`${API_BASE}${draft.fileUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Eye className="w-4 h-4" />
              Preview file
            </a>
          )}

          {/* Reject reason textarea */}
          {rejectMode && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Please provide a reason for rejection</span>
              </div>
              <Label htmlFor="reject-reason">Reject Reason</Label>
              <Textarea
                id="reject-reason"
                placeholder="Explain why this draft is rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                disabled={submitting}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {!rejectMode ? (
              <>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleApprove}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setRejectMode(true)}
                  disabled={submitting}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleReject}
                  disabled={submitting || !rejectReason.trim()}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Confirm Reject
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectMode(false)}
                  disabled={submitting}
                >
                  Back
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
