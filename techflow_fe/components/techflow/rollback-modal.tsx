"use client";

import { useState, useEffect } from "react";
import { History, Loader2, CheckCircle2 } from "lucide-react";
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
import { getDepartments, rollbackVersion, DepartmentDto } from "@/lib/api";
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
  const [selectedDepts, setSelectedDepts] = useState<number[]>([]);
  const [changeReason, setChangeReason] = useState("");

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
      setSelectedDepts([]);
      setChangeReason("");
    }
  }, [open]);

  const toggleDept = (deptId: number) => {
    setSelectedDepts((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSubmit = async () => {
    if (selectedDepts.length === 0 || !changeReason) return;

    setUploading(true);
    try {
      await rollbackVersion(fileId, versionId, {
        changeReason,
        departmentIds: selectedDepts,
      });
      
      toast.success("Rollback successful!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Rollback failed", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0 border-none shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-muted/30 border-b shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Restore Version
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            You are about to restore <span className="font-semibold text-foreground">{fileName}</span> to <Badge variant="secondary">v{versionNumber}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6 bg-background overflow-y-auto flex-1">
          {/* Reason Input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Reason for Rollback <span className="text-destructive">*</span></label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
              placeholder="Why are you restoring to this version?"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
            />
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
            disabled={selectedDepts.length === 0 || !changeReason || uploading}
            onClick={handleSubmit}
            className="min-w-[120px]"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Restoring...</>
            ) : (
              "Restore Version"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
