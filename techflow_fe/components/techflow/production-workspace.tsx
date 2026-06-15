"use client";

import { useMemo, useState, useEffect } from "react";
import { Bell, Check, CircleAlert, FileText, OctagonX, Loader2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  getPendingFiles,
  getNotifications,
  markNotificationRead,
  confirmDistribution,
  NotificationDto,
  API_BASE,
} from "@/lib/api";
import { toast } from "sonner";
import { useSignalR } from "@/lib/use-signalr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

export default function ProductionWorkspace() {
  const { user } = useAuth();
  const [files, setFiles] = useState<PendingFileDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [pending, notifs] = await Promise.all([
        getPendingFiles(),
        getNotifications(),
      ]);
      setFiles(pending || []);
      setNotifications(notifs || []);
    } catch (err: any) {
      toast.error("Failed to load workspace data", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.departmentId) {
      fetchData();
    }
  }, [user?.departmentId]);

  // SignalR Real-time events
  const { on } = useSignalR({
    departmentId: user?.departmentId,
  });

  useEffect(() => {
    const offUpload = on("NewUploadNotification", (payload: any) => {
      toast.info("New Drawing Released", {
        description: `${payload.fileName} v${payload.versionNumber}`,
      });
      fetchData(); // Refresh both files and notifications
    });

    const offStop = on("Emergency_Stop", (payload: any) => {
      toast.error("EMERGENCY STOP", {
        description: `Production stopped for ${payload.fileName}`,
        duration: 10000,
      });
      // Optimistically update the file list
      setFiles((prev) =>
        prev.map((f) => (f.fileId === payload.fileId ? { ...f, isStopped: true } : f))
      );
      // Fetch data to sync everything
      fetchData();
    });

    const offResume = on("Production_Resume", (payload: any) => {
      toast.success("PRODUCTION RESUMED", {
        description: `${payload.fileName} is back to normal`,
        duration: 5000,
      });
      // Optimistically update the file list
      setFiles((prev) =>
        prev.map((f) => (f.fileId === payload.fileId ? { ...f, isStopped: false } : f))
      );
      fetchData();
    });

    return () => {
      offUpload();
      offStop();
      offResume();
    };
  }, [on]);

  const unconfirmedCount = useMemo(() => files.filter((f) => f.status === "Pending").length, [files]);
  const stopCount = useMemo(() => files.filter((f) => f.isStopped).length, [files]);
  const unreadNotifs = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const groupedByCategory = useMemo(() => {
    const categories: Record<number, { name: string, leader: string | null, folders: Record<number, { name: string, files: PendingFileDto[] }> }> = {};
    for (const f of files) {
      // In case categoryId is not populated (e.g. older files without eager load), use a fallback.
      const catId = f.categoryId || 0;
      if (!categories[catId]) {
        categories[catId] = { name: f.categoryName || "Uncategorized", leader: f.categoryLeader, folders: {} };
      }
      const cat = categories[catId];
      const folId = f.folderId || 0;
      if (!cat.folders[folId]) {
        cat.folders[folId] = { name: f.folderName || "General", files: [] };
      }
      cat.folders[folId].files.push(f);
    }
    return Object.values(categories);
  }, [files]);

  const handleConfirm = async (id: number) => {
    try {
      await confirmDistribution(id);
      toast.success("Receipt confirmed");
      setFiles((prev) =>
        prev.map((f) =>
          f.distributionId === id
            ? { ...f, status: "Confirmed", confirmedAt: new Date().toISOString() }
            : f
        )
      );
      fetchData();
    } catch (err: any) {
      toast.error("Failed to confirm", { description: err.message });
    }
  };

  const handleReadNotification = async (id: number) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="text-lg px-3 py-1 bg-background">
              Dept: {user?.departmentId} {/* Optionally resolve department name here */}
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight">Production Floor</h1>
          </div>
          <p className="text-muted-foreground">
            Monitor incoming drawings, confirm receipt, and strictly adhere to emergency stops.
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-12 w-12 rounded-full shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center">
            <Bell className="w-5 h-5" />
            {unreadNotifs > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 px-1.5 min-w-[20px] h-5 flex items-center justify-center rounded-full animate-in zoom-in"
              >
                {unreadNotifs}
              </Badge>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                notifications.slice(0, 5).map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                    onClick={() => !n.isRead && handleReadNotification(n.id)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={cn("font-medium text-sm", !n.isRead && "text-primary")}>
                        {n.title}
                      </span>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">{n.message}</span>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {stopCount > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/15 border border-destructive/30 flex items-center gap-4 animate-in slide-in-from-top-4">
          <OctagonX className="w-8 h-8 text-destructive animate-flash" />
          <div>
            <h3 className="font-bold text-destructive text-lg">EMERGENCY STOP ACTIVE</h3>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-40 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading pending files...
        </div>
      ) : files.length === 0 ? (
        <div className="flex h-40 items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground">
          No pending or confirmed files found for your department.
        </div>
      ) : (
        <div className="space-y-12">
          {groupedByCategory.map((category, catIdx) => (
            <div key={catIdx} className="space-y-6">
              {/* Category Header */}
              <div className="border-b pb-2 flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{category.name}</h2>
                <Badge variant="secondary" className="text-sm">Owner: {category.leader || "Unassigned"}</Badge>
              </div>

              {/* Folders in this Category */}
              <div className="space-y-8">
                {Object.entries(category.folders).map(([folderId, folder]) => (
                  <div key={folderId} className="bg-muted/30 rounded-xl p-6 border shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <FolderOpen className="w-5 h-5 text-primary" />
                      <h3 className="text-xl font-semibold">{folder.name}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {folder.files.map((file) => {
                        const folderFiles = folder.files;
                        const maxCreatedAt = folderFiles.length > 0 ? Math.max(...folderFiles.map(f => new Date(f.createdAt).getTime())) : 0;
                        const isNew = new Date(file.createdAt).getTime() === maxCreatedAt && maxCreatedAt > 0;
                        return (
                          <WorkshopCard
                            key={file.distributionId}
                            file={file}
                            isNew={isNew}
                            onConfirm={() => handleConfirm(file.distributionId)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Workshop Card ───────────────────────────────────────────────────────────

function WorkshopCard({ file, isNew, onConfirm }: { file: PendingFileDto; isNew: boolean; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirmClick = async () => {
    setConfirming(true);
    await onConfirm();
    setConfirming(false);
  };

  const isConfirmed = file.status === "Confirmed";
  const showStop = file.isStopped && isNew;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md",
        showStop
          ? "border-destructive ring-1 ring-destructive"
          : isConfirmed
          ? "border-primary/20 bg-primary/5"
          : "border-border"
      )}
    >
      <div className="p-5 flex-1 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={cn(
                "p-2.5 rounded-lg",
                showStop ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
              )}
            >
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              {file.fileUrl ? (
                <div className="flex items-center gap-2 mb-1.5 min-w-0">
                  <a
                    href={file.fileUrl.startsWith("http") ? file.fileUrl : `${API_BASE}${file.fileUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("truncate font-semibold leading-none hover:underline hover:text-primary transition-colors block", showStop && "line-through text-destructive")}
                    title={file.fileName}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {file.fileName}
                  </a>
                  {isNew && (
                    <Badge className="bg-emerald-500 text-white text-[10px] h-5 px-1.5 shrink-0 border-none shadow-sm hover:bg-emerald-600">
                      NEW
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1.5 min-w-0">
                  <h3
                    className={cn("truncate font-semibold leading-none", showStop && "line-through text-destructive")}
                    title={file.fileName}
                  >
                    {file.fileName}
                  </h3>
                  {isNew && (
                    <Badge className="bg-emerald-500 text-white text-[10px] h-5 px-1.5 shrink-0 border-none shadow-sm hover:bg-emerald-600">
                      NEW
                    </Badge>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground truncate">{file.folderName}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-muted/50 p-2 rounded-md">
            <span className="text-xs text-muted-foreground block mb-0.5">Version</span>
            <span className="font-medium">v{file.versionNumber}</span>
          </div>
          <div className="bg-muted/50 p-2 rounded-md">
            <span className="text-xs text-muted-foreground block mb-0.5">
              {isConfirmed ? "Confirmed At" : "Distributed"}
            </span>
            <span className="font-medium">
              {isConfirmed
                ? file.confirmedAt
                  ? new Date(file.confirmedAt).toLocaleString()
                  : "Confirmed"
                : file.deadlineTime
                ? new Date(file.deadlineTime).toLocaleDateString()
                : "Just now"}
            </span>
          </div>
        </div>

        {file.changeReason && (
          <div className="bg-muted/30 p-3 rounded-md text-sm border">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
              <CircleAlert className="w-3 h-3" />
              Change Notes
            </span>
            <p className="text-muted-foreground italic leading-relaxed">"{file.changeReason}"</p>
          </div>
        )}
      </div>

      <div className="p-5 pt-0 mt-auto">
        {showStop ? (
          <Button variant="destructive" className="w-full font-bold h-11" disabled>
            <OctagonX className="w-4 h-4 mr-2" />
            PRODUCTION STOPPED
          </Button>
        ) : isConfirmed ? (
          <Button variant="outline" className="w-full text-primary border-primary/20 bg-primary/5 h-11" disabled>
            <Check className="w-4 h-4 mr-2" />
            Confirmed
          </Button>
        ) : (
          <Button className="w-full font-semibold shadow-sm h-11" onClick={handleConfirmClick} disabled={confirming}>
            {confirming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirm Receipt"}
          </Button>
        )}
      </div>

      {/* Extreme Visual Overlay for Emergency Stop */}
      {showStop && (
        <div className="absolute inset-0 bg-destructive/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-destructive-foreground z-10 animate-in fade-in duration-300">
          <OctagonX className="w-16 h-16 mb-4 animate-flash" />
          <h2 className="text-xl font-black text-center mb-6 tracking-tight">STOP PRODUCTION IMMEDIATELY</h2>
          <Button variant="secondary" className="w-full font-bold shadow-lg" onClick={handleConfirmClick} disabled={confirming}>
            {confirming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Acknowledge Stop"}
          </Button>
        </div>
      )}
    </div>
  );
}
