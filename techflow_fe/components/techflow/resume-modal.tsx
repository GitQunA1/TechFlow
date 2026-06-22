"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Upload,
  X,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
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
import { getDepartments, resumeFile, resumeFileWithNewFile, DepartmentDto } from "@/lib/api";
import { DepartmentNoteRequest } from "@/lib/types";
import { toast } from "sonner";

interface ResumeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: number;
  fileName: string;
  /** Names of departments that were stopped — used to pre-load the correct dept list */
  sentToDepartmentNames: string[];
}

type DeptNoteState = { note: string; isAffected: boolean };

export function ResumeModal({
  open,
  onOpenChange,
  fileId,
  fileName,
  sentToDepartmentNames,
}: ResumeModalProps) {
  const [tab, setTab] = useState<"simple" | "with-file">("simple");

  // All departments + filtered stopped departments
  const [stoppedDepts, setStoppedDepts] = useState<DepartmentDto[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  // Per-department notes: Record<deptId, { note, isAffected }>
  const [deptNotes, setDeptNotes] = useState<Record<number, DeptNoteState>>({});

  // File upload (Case 2)
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);

  // Load & filter departments on open
  useEffect(() => {
    if (!open) {
      // Reset
      setTab("simple");
      setNewFile(null);
      setDeptNotes({});
      return;
    }
    setLoadingDepts(true);
    getDepartments()
      .then((allDepts) => {
        const stopped = allDepts.filter((d) =>
          sentToDepartmentNames.includes(d.code) || sentToDepartmentNames.includes(d.name)
        );
        setStoppedDepts(stopped);
        // Initialise notes: affected=true, note=""
        const initial: Record<number, DeptNoteState> = {};
        stopped.forEach((d) => {
          initial[d.id] = { isAffected: true, note: "" };
        });
        setDeptNotes(initial);
      })
      .catch((err) =>
        toast.error("Failed to load departments", { description: err.message })
      )
      .finally(() => setLoadingDepts(false));
  }, [open]);

  const updateNote = (deptId: number, field: keyof DeptNoteState, value: string | boolean) => {
    setDeptNotes((prev) => {
      const current = prev[deptId];
      const updated = { ...current, [field]: value };
      // Auto-fill note when switching to "not affected"
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
    stoppedDepts.map((d) => ({
      departmentId: d.id,
      note: deptNotes[d.id]?.note || "",
      isAffected: deptNotes[d.id]?.isAffected ?? true,
    }));

  const isValid = tab === "simple" ? true : stoppedDepts.every((d) => deptNotes[d.id]?.note?.trim());

  // Case 1 submit
  const handleSimpleResume = async () => {
    setSubmitting(true);
    try {
      await resumeFile(fileId, { departmentNotes: [] });
      toast.success("File resumed successfully!", {
        description: "Notifications have been sent to all departments.",
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Resume failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Case 2 submit
  const handleResumeWithFile = async () => {
    if (!isValid || !newFile) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", newFile);
      formData.append("departmentNotesJson", JSON.stringify(buildDepartmentNotes()));
      await resumeFileWithNewFile(fileId, formData);
      toast.success("Resumed with new file version!", {
        description: "A new version has been created and all departments must re-confirm.",
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Resume with file failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      const ext = dropped.name.toLowerCase().split(".").pop();
      if (["pdf", "png", "dwg"].includes(ext || "")) {
        setNewFile(dropped);
      } else {
        toast.error("Invalid file type. Please upload a PDF, PNG, or DWG.");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0 border-none shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 bg-muted/30 border-b shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Play className="w-5 h-5 text-emerald-600 fill-current" />
            Resume File
          </DialogTitle>
          <DialogDescription className="text-base mt-1">
            Resuming:{" "}
            <span className="font-semibold text-foreground">{fileName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex border-b bg-muted/20 shrink-0">
          <button
            onClick={() => setTab("simple")}
            className={cn(
              "flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2",
              tab === "simple"
                ? "border-emerald-500 text-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <CheckCircle2 className="w-4 h-4" />
            Resume Only
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">No file change</Badge>
          </button>
          <button
            onClick={() => setTab("with-file")}
            className={cn(
              "flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2",
              tab === "with-file"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Upload className="w-4 h-4" />
            Resume with New File
            <Badge className="text-[10px] h-4 px-1.5 bg-primary/20 text-primary border-0">New version</Badge>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">

          {/* Case 2: File upload zone (shown only in with-file tab) */}
          {tab === "with-file" && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                New File <span className="text-destructive">*</span>
              </label>
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 ease-in-out cursor-pointer",
                  isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/25 hover:border-primary/50",
                  newFile && "border-primary/50 bg-primary/5"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !newFile && fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.png,.dwg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setNewFile(f);
                  }}
                />
                {!newFile ? (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium">Drag & Drop or click to select</p>
                    <p className="text-xs text-muted-foreground mt-1">Supports PDF, PNG, DWG</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{newFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(newFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setNewFile(null); }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Info banner for Case 2 */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800 mt-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  A new file version will be created. <strong>All departments listed below must re-confirm</strong>, regardless of whether they are affected or not.
                </p>
              </div>
            </div>
          )}

          {/* Department Notes (Only for Case 2) */}
          {tab === "with-file" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">
                  Department Notes <span className="text-destructive">*</span>
                </label>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="w-3.5 h-3.5" />
                  Note required for each department
                </div>
              </div>

              {loadingDepts ? (
                <div className="text-sm text-muted-foreground text-center py-6">Loading departments...</div>
              ) : stoppedDepts.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                  No stopped departments found.
                </div>
              ) : (
                <div className="space-y-3">
                  {stoppedDepts.map((dept) => {
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
                            <button
                              onClick={() => updateNote(dept.id, "isAffected", true)}
                              className={cn(
                                "px-3 py-1 rounded-full text-xs font-medium transition-all",
                                state.isAffected
                                  ? "bg-amber-500 text-white shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              ⚠ Affected
                            </button>
                            <button
                              onClick={() => updateNote(dept.id, "isAffected", false)}
                              className={cn(
                                "px-3 py-1 rounded-full text-xs font-medium transition-all",
                                !state.isAffected
                                  ? "bg-emerald-500 text-white shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              ✓ Not Affected
                            </button>
                          </div>
                        </div>

                        {/* Note textarea */}
                        <textarea
                          className="w-full min-h-[72px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
                          placeholder={
                            state.isAffected
                              ? "Describe how this department is affected and what actions are needed..."
                              : "Confirm that this department is not impacted..."
                          }
                          value={state.note}
                          onChange={(e) => updateNote(dept.id, "note", e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 bg-muted/10 border-t shrink-0 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {tab === "with-file" ? `${stoppedDepts.filter((d) => deptNotes[d.id]?.note?.trim()).length}/${stoppedDepts.length} notes filled` : ""}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            {tab === "simple" ? (
              <Button
                className="min-w-[160px] bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={submitting}
                onClick={handleSimpleResume}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resuming...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2 fill-current" /> Resume & Notify</>
                )}
              </Button>
            ) : (
              <Button
                className="min-w-[160px]"
                disabled={!isValid || !newFile || submitting}
                onClick={handleResumeWithFile}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Upload & Resume</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
