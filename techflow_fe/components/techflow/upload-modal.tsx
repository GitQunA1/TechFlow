"use client";

import { useState, useEffect } from "react";
import { FolderOpen, Loader2, CheckCircle2, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDepartments, uploadFileByPath, DepartmentDto } from "@/lib/api";
import { toast } from "sonner";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  folderName: string;
  folderId: number;
}

const VALID_EXTENSIONS = [".png", ".pdf", ".dwg"];

function validatePath(path: string): { valid: boolean; error?: string } {
  if (!path.trim()) return { valid: false, error: "Đường dẫn không được để trống." };
  const lower = path.toLowerCase();
  const hasValidExt = VALID_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!hasValidExt) return { valid: false, error: "Chỉ cho phép file .png, .pdf hoặc .dwg." };
  return { valid: true };
}

function extractFileName(filePath: string): string {
  // Hỗ trợ cả Windows path (backslash) lẫn Unix path (slash)
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || filePath;
}

export function UploadModal({
  open,
  onOpenChange,
  productName,
  folderName,
  folderId,
}: UploadModalProps) {
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<number[]>([]);

  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load departments
  useEffect(() => {
    if (open) {
      setLoadingDepts(true);
      getDepartments()
        .then(setDepartments)
        .catch((err) => toast.error("Failed to load departments", { description: err.message }))
        .finally(() => setLoadingDepts(false));
    } else {
      setFileName("");
      setFileError(null);
      setSelectedDepts([]);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const { valid, error } = validatePath(file.name);
      setFileError(valid ? null : (error ?? null));
    } else {
      setFileName("");
      setFileError(null);
    }
  };

  const toggleDept = (deptId: number) => {
    setSelectedDepts((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSubmit = async () => {
    const { valid, error } = validatePath(fileName);
    if (!valid) { setFileError(error ?? "File không hợp lệ."); return; }
    if (selectedDepts.length === 0) {
      toast.error("Vui lòng chọn ít nhất một phòng ban.");
      return;
    }

    setSubmitting(true);
    try {
      await uploadFileByPath({
        folderId,
        fileName: fileName,
        departmentIds: selectedDepts,
      });
      toast.success("Lưu bản vẽ thành công!", {
        description: `${fileName} đã được phân phối đến ${selectedDepts.length} phòng ban.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Lưu thất bại", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const isFileValid = fileName && !fileError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0 border-none shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-muted/30 border-b shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            Thêm Bản Vẽ Mới
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            {productName} <span className="text-muted-foreground mx-1">›</span>{" "}
            <span className="font-semibold text-foreground">{folderName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6 bg-background overflow-y-auto flex-1">
          {/* File Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Chọn bản vẽ <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Chọn file bản vẽ từ máy tính của bạn (hệ thống chỉ lưu tên file để trỏ đến mạng nội bộ).
            </p>
            <div className={cn(
              "border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors relative",
              fileError ? "border-destructive/50 bg-destructive/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
            )}>
              <input
                type="file"
                onChange={handleFileChange}
                accept=".png,.pdf,.dwg"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileText className="w-10 h-10 text-muted-foreground mb-4" />
              {fileName ? (
                <div>
                  <p className="text-sm font-medium text-foreground">{fileName}</p>
                  <p className="text-xs text-emerald-600 mt-1">Đã chọn file</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-foreground">Click để chọn file</p>
                  <p className="text-xs text-muted-foreground mt-1">Hỗ trợ .png, .pdf, .dwg</p>
                </div>
              )}
            </div>
            {fileError && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-2">
                ⚠ {fileError}
              </p>
            )}
          </div>

          {/* Department Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Phân phối đến <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-muted-foreground">Chọn ít nhất một phòng ban</span>
            </div>

            {loadingDepts ? (
              <div className="text-sm text-muted-foreground">Đang tải danh sách phòng ban...</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {departments.map((dept) => {
                  const isSelected = selectedDepts.includes(dept.id);
                  return (
                    <div
                      key={dept.id}
                      onClick={() => toggleDept(dept.id)}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors", isSelected ? "border-primary bg-primary" : "border-input")}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{dept.name}</p>
                        <p className="text-[10px] text-muted-foreground">{dept.code}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 bg-muted/10 border-t shrink-0 flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button
            disabled={!isFileValid || selectedDepts.length === 0 || submitting}
            onClick={handleSubmit}
            className="min-w-[140px]"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang lưu...</>
            ) : (
              "Lưu & Phân Phối"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
