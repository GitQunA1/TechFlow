"use client";

import { useState, useEffect } from "react";
import { OctagonX, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDepartments, DepartmentDto, stopFile } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StopModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: number;
  fileName: string;
  sentToDepartments: string[];
}

export function StopModal({
  open,
  onOpenChange,
  fileId,
  fileName,
  sentToDepartments,
}: StopModalProps) {
  const [selectedDepts, setSelectedDepts] = useState<number[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (open) {
      setLoadingDepts(true);
      getDepartments()
        .then((depts) => {
          // Filter departments that were actually sent this file
          const relevantDepts = depts.filter(d => sentToDepartments.includes(d.code));
          setDepartments(relevantDepts);
        })
        .catch((err) => toast.error("Failed to load departments", { description: err.message }))
        .finally(() => setLoadingDepts(false));
    } else {
      setSelectedDepts([]);
    }
  }, [open]);

  const toggleDept = (deptId: number) => {
    setSelectedDepts((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleStop = async () => {
    if (selectedDepts.length === 0) return;

    setStopping(true);
    try {
      await stopFile(fileId, selectedDepts);
      toast.success("Emergency stop triggered successfully");
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Failed to stop file", { description: error.message });
    } finally {
      setStopping(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !stopping && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Emergency Stop
          </DialogTitle>
          <DialogDescription>
            Select the departments to stop distribution for <strong className="text-foreground">{fileName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Target Departments</h4>
            {loadingDepts ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {departments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No departments available.</p>
                ) : (
                  departments.map((dept) => (
                    <Badge
                      key={dept.id}
                      variant={selectedDepts.includes(dept.id) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer px-3 py-1.5 transition-all",
                        selectedDepts.includes(dept.id)
                          ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
                          : "hover:bg-muted"
                      )}
                      onClick={() => toggleDept(dept.id)}
                    >
                      {dept.name}
                    </Badge>
                  ))
                )}
              </div>
            )}
            {departments.length > 0 && selectedDepts.length === 0 && (
              <p className="text-xs text-destructive mt-1">Please select at least one department.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={stopping}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleStop} 
            disabled={selectedDepts.length === 0 || stopping}
            className="min-w-[120px]"
          >
            {stopping ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <OctagonX className="w-4 h-4 mr-2" />
                Confirm Stop
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
