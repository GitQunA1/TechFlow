"use client";

import { useState, useEffect } from "react";
import { Upload, FileText, Loader2, AlertCircle, AlertTriangle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitRevision, getDepartments } from "@/lib/api";
import type { StaffRevisionRequestDto, DepartmentDto, DepartmentNoteRequest } from "@/lib/api";
import { useLanguage } from "@/lib/i18n-context";

interface RevisionSubmitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revision: StaffRevisionRequestDto | null;
  onSubmitted: () => void;
}

const VALID_EXTS = [".png", ".jpg", ".jpeg", ".pdf", ".dwg"];

type DeptNoteState = { note: string; isAffected: boolean };

export function RevisionSubmitModal({
  open,
  onOpenChange,
  revision,
  onSubmitted,
}: RevisionSubmitModalProps) {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [allDeptsList, setAllDeptsList] = useState<DepartmentDto[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [deptNotes, setDeptNotes] = useState<Record<number, DeptNoteState>>({});

  const reset = () => {
    setSelectedFile(null);
    setFileError(null);
    setSubmitting(false);
    setDeptNotes({});
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  useEffect(() => {
    if (!open || !revision) return;
    setLoadingDepts(true);
    getDepartments()
      .then((allDepts) => {
        setAllDeptsList(allDepts);
        
        const initial: Record<number, DeptNoteState> = {};
        allDepts.forEach((d) => {
          const isStopped = revision.stoppedDepartmentIds?.includes(d.id);
          if (isStopped) {
            initial[d.id] = { isAffected: true, note: "" };
          } else {
            initial[d.id] = { isAffected: false, note: "No impact on your department." };
          }
        });
        setDeptNotes(initial);
      })
      .catch((err) =>
        toast.error("Failed to load departments", { description: err.message })
      )
      .finally(() => setLoadingDepts(false));
  }, [open, revision]);

  const updateNote = (deptId: number, field: keyof DeptNoteState, value: string | boolean) => {
    setDeptNotes((prev) => {
      const current = prev[deptId];
      const updated = { ...current, [field]: value };
      if (field === "isAffected" && value === false && !current.note) {
        updated.note = "No impact on your department.";
      }
      if (field === "isAffected" && value === true && current.note === "No impact on your department.") {
        updated.note = "";
      }
      return { ...prev, [deptId]: updated };
    });
  };

  const buildDepartmentNotes = (): DepartmentNoteRequest[] =>
    allDeptsList.map((d) => ({
      departmentId: d.id,
      note: deptNotes[d.id]?.note || "",
      isAffected: deptNotes[d.id]?.isAffected ?? true,
    }));

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

  const isValid = allDeptsList.every((d) => deptNotes[d.id]?.note?.trim()) && selectedFile && !fileError;

  const handleSubmit = async () => {
    if (!revision || !selectedFile || !isValid) return;
    
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("note", JSON.stringify(buildDepartmentNotes()));
      
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
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 pb-4 bg-muted/30 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Upload className="w-5 h-5 text-primary" />
            {t("staff.uploadRevised") || "Upload Revised File"}
          </DialogTitle>
          <DialogDescription>
            Upload the revised file and specify notes for each stopped department.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

          {/* Leader message (if any) */}
          {revision.message && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 space-y-1">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-semibold uppercase tracking-wide">
                <AlertCircle className="w-3.5 h-3.5" />
                Leader's Note
              </div>
              <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
                {revision.message}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                — {revision.requestedBy}
              </p>
            </div>
          )}

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
                  <p className="text-sm text-muted-foreground">Click to select file</p>
                  <p className="text-xs text-muted-foreground">.png, .jpg, .jpeg, .pdf, .dwg</p>
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

          {/* Department Notes */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">
              Department Notes <span className="text-destructive">*</span>
            </h3>
            
            {loadingDepts ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : allDeptsList.length === 0 ? (
              <div className="text-sm text-muted-foreground italic py-4 text-center">
                No departments found.
              </div>
            ) : (
              <div className="space-y-3">
                {allDeptsList.map((dept) => {
                  const state = deptNotes[dept.id] ?? { isAffected: true, note: "" };
                  return (
                    <div
                      key={dept.id}
                      className={cn(
                        "rounded-xl border p-4 transition-all",
                        state.isAffected
                          ? "border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800/50"
                          : "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-800/50"
                      )}
                    >
                      {/* Dept header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{dept.name}</span>
                          <span className="text-xs text-muted-foreground">({dept.code})</span>
                        </div>
                        {/* Affected Toggle */}
                        <div className="flex items-center gap-1 bg-background rounded-full border p-0.5 shadow-sm">
                          <Badge
                            variant={state.isAffected ? "default" : "secondary"}
                            className={cn("cursor-pointer", state.isAffected && "bg-amber-500 hover:bg-amber-600 text-white")}
                            onClick={() => updateNote(dept.id, "isAffected", true)}
                          >
                            {state.isAffected && <AlertTriangle className="w-3 h-3 mr-1" />}
                            {t("modals.resume.affected")}
                          </Badge>
                          <Badge
                            variant={!state.isAffected ? "default" : "secondary"}
                            className={cn("cursor-pointer", !state.isAffected && "bg-slate-500 hover:bg-slate-600")}
                            onClick={() => updateNote(dept.id, "isAffected", false)}
                          >
                            {!state.isAffected && <Check className="w-3 h-3 mr-1" />}
                            {t("modals.resume.notAffected")}
                          </Badge>
                        </div>
                      </div>

                      {/* Note textarea */}
                      <textarea
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-y"
                        style={{ minHeight: "72px", maxHeight: "200px" }}
                        placeholder={state.isAffected 
                          ? t("modals.resume.describeAffected") 
                          : t("modals.resume.describeNotAffected")}
                        value={state.note}
                        onChange={(e) => updateNote(dept.id, "note", e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-muted/20 flex gap-2 shrink-0">
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!selectedFile || !isValid || submitting}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Submit for Review
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
