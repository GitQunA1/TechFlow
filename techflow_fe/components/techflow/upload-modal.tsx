"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, X, Loader2, FileText, CheckCircle2 } from "lucide-react";
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
import { getDepartments, uploadFile, DepartmentDto } from "@/lib/api";
import { toast } from "sonner";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  folderName: string;
  folderId: number;
}

export function UploadModal({
  open,
  onOpenChange,
  productName,
  folderName,
  folderId,
}: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDepts, setSelectedDepts] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Load departments
  useEffect(() => {
    if (open) {
      setLoadingDepts(true);
      getDepartments()
        .then(setDepartments)
        .catch((err) => toast.error("Failed to load departments", { description: err.message }))
        .finally(() => setLoadingDepts(false));
    } else {
      // Reset state on close
      setFile(null);
      setSelectedDepts([]);
    }
  }, [open]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const ext = droppedFile.name.toLowerCase().split('.').pop();
      if (['pdf', 'png', 'dwg'].includes(ext || '')) {
        setFile(droppedFile);
      } else {
        toast.error("Invalid file type. Please upload a PDF, PNG, or DWG.");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const toggleDept = (deptId: number) => {
    setSelectedDepts((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSubmit = async () => {
    if (!file || selectedDepts.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("folderId", folderId.toString());
      formData.append("file", file);
      
      selectedDepts.forEach((id) => {
        formData.append("departmentIds", id.toString());
      });

      await uploadFile(formData);
      
      toast.success("Upload successful!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0 border-none shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-muted/30 border-b shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            { "Upload New Drawing"}
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            {productName} <span className="text-muted-foreground mx-1">›</span>{" "}
            <span className="font-semibold text-foreground">{folderName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6 bg-background overflow-y-auto flex-1">
          {/* File Drop Zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 ease-in-out",
              isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/25 hover:border-primary/50",
              file && "border-primary/50 bg-primary/5"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.png,.dwg"
              className="hidden"
            />

            {!file ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Drag & Drop PDF, PNG, DWG</h3>
                <p className="text-sm text-muted-foreground mb-4">or click to browse from your computer</p>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  Select File
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-background p-4 rounded-lg border shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setFile(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>



          {/* Department Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Distribute To <span className="text-destructive">*</span></label>
              <span className="text-xs text-muted-foreground">Select at least one</span>
            </div>
            
            {loadingDepts ? (
              <div className="text-sm text-muted-foreground">Loading departments...</div>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button 
            disabled={!file || selectedDepts.length === 0 || uploading}
            onClick={handleSubmit}
            className="min-w-[120px]"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
            ) : (
              "Upload & Distribute"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
