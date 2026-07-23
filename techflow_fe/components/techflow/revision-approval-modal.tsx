"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, FileText, Loader2, Eye, Upload, AlertTriangle } from "lucide-react";
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
import { approveRevision, rejectRevision, API_BASE } from "@/lib/api";
import type { StaffRevisionRequestDto } from "@/lib/api";

interface RevisionApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revision: StaffRevisionRequestDto | null;
}

export function RevisionApprovalModal({
  open,
  onOpenChange,
  revision,
}: RevisionApprovalModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const reset = () => {
    setSubmitting(false);
    setShowRejectForm(false);
    setRejectReason("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleApprove = async () => {
    if (!revision) return;
    setSubmitting(true);
    try {
      await approveRevision(revision.id);
      toast.success("Revision approved! File resumed and departments notified.", {
        description: `Staff's update note has been forwarded to all departments.`,
      });
      handleOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to approve revision", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!revision || !rejectReason.trim()) return;
    setSubmitting(true);
    try {
      await rejectRevision(revision.id, { reason: rejectReason.trim() });
      toast.success("Revision rejected", {
        description: "Staff has been notified to revise the file again.",
      });
      handleOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to reject revision", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!revision) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600 shrink-0" />
            Review Staff Revision
          </DialogTitle>
          <DialogDescription>
            Staff has submitted a revised file. Approve to resume this file for all departments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File info */}
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
            {/* File name — stacked layout to avoid overflow */}
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-4 h-4 shrink-0" />
                File:
              </span>
              <span className="font-medium break-all pl-5">{revision.fileName}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Submitted by:</span>
              <span className="font-medium">{revision.assignedStaffName ?? "Staff"}</span>
            </div>
            {revision.submittedAt && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Submitted at:</span>
                <span className="font-medium">{new Date(revision.submittedAt).toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Submitted file:</span>
              <Badge variant="secondary" className="max-w-[200px] truncate" title={revision.submittedFileName ?? ""}>
                {revision.submittedFileName ?? "—"}
              </Badge>
            </div>
          </div>

          {/* Staff's update note */}
          {revision.submittedNote && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                📝 Staff&apos;s Update Note
              </p>
              <div className="max-h-32 overflow-y-auto">
                <p className="text-sm text-blue-900 dark:text-blue-200 whitespace-pre-wrap break-words">
                  {revision.submittedNote}
                </p>
              </div>
              <p className="text-xs text-blue-500 border-t border-blue-200/60 pt-2">
                This note will be forwarded to all departments upon approval.
              </p>
            </div>
          )}

          {/* Preview link */}
          {revision.submittedFileUrl && (
            <a
              href={`${API_BASE}${revision.submittedFileUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Eye className="w-4 h-4 shrink-0" />
              Preview submitted file
            </a>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Approving will create a new file version and resume distribution to all previously stopped departments. All departments must re-confirm.
            </p>
          </div>

          {/* Actions */}
          {!showRejectForm ? (
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleApprove}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Approve &amp; Resume
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setShowRejectForm(true)}
                disabled={submitting}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t mt-2">
              <div className="space-y-1">
                <Label>Lý do từ chối (bắt buộc)</Label>
                <Textarea
                  placeholder="Vui lòng nhập lý do để Staff chỉnh sửa lại..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  disabled={submitting}
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex gap-2">
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
                  Xác nhận Reject
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowRejectForm(false)}
                  disabled={submitting}
                >
                  Quay lại
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
