"use client";

import { useMemo, useState, useEffect } from "react";
import { Bell, Check, CircleAlert, FileText, OctagonX, Loader2, FolderOpen, Search, Filter, CheckCircle2, AlertCircle, Trash2, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  getPendingFiles,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  confirmDistribution,
  getDepartments,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { FileViewerModal } from "./file-viewer-modal";

export default function ProductionWorkspace() {
  const { user } = useAuth();
  const [files, setFiles] = useState<PendingFileDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [departmentName, setDepartmentName] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "unconfirmed">("all");

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [pending, notifs, depts] = await Promise.all([
        getPendingFiles(),
        getNotifications(),
        getDepartments(),
      ]);
      setFiles(pending || []);
      setNotifications(notifs || []);
      if (user?.departmentId && depts) {
        const currentDept = depts.find((d) => d.id === user.departmentId);
        if (currentDept) setDepartmentName(currentDept.name);
      }
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
  }, [on, user?.departmentId, fetchData]);

  const unconfirmedCount = useMemo(() => {
    const folderGroups = new Map<number, PendingFileDto[]>();
    files.forEach(f => {
      const folId = f.folderId || 0;
      if (!folderGroups.has(folId)) folderGroups.set(folId, []);
      folderGroups.get(folId)!.push(f);
    });
    let count = 0;
    folderGroups.forEach(folderFiles => {
      const maxCreatedAt = folderFiles.length > 0 ? Math.max(...folderFiles.map(f => new Date(f.createdAt).getTime())) : 0;
      count += folderFiles.filter(f => 
        new Date(f.createdAt).getTime() === maxCreatedAt && 
        maxCreatedAt > 0 && 
        (f.status === "Pending" || f.status === "Overdue")
      ).length;
    });
    return count;
  }, [files]);
  const stopCount = useMemo(() => files.filter((f) => f.isStopped).length, [files]);
  const unreadNotifs = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  // Derived state
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      if (categoryFilter && !(f.categoryName || "Uncategorized").toLowerCase().includes(categoryFilter.toLowerCase())) return false;
      if (folderFilter && !f.folderName.toLowerCase().includes(folderFilter.toLowerCase())) return false;
      if (statusFilter === "confirmed" && f.status !== "Confirmed") return false;
      if (statusFilter === "unconfirmed" && f.status === "Confirmed") return false;
      return true;
    });
  }, [files, folderFilter, statusFilter, categoryFilter]);

  const groupedByCategory = useMemo(() => {
    const categoriesMap: Record<number, { 
      name: string, 
      leader: string | null, 
      foldersMap: Record<number, { folderId: number, name: string, files: PendingFileDto[], maxCreatedAt: number }>,
      maxCreatedAt: number
    }> = {};

    for (const f of filteredFiles) {
      // In case categoryId is not populated, use a fallback.
      const catId = f.categoryId || 0;
      if (!categoriesMap[catId]) {
        categoriesMap[catId] = { name: f.categoryName || "Uncategorized", leader: f.categoryLeader, foldersMap: {}, maxCreatedAt: 0 };
      }
      const cat = categoriesMap[catId];
      
      const folId = f.folderId || 0;
      if (!cat.foldersMap[folId]) {
        cat.foldersMap[folId] = { folderId: folId, name: f.folderName || "General", files: [], maxCreatedAt: 0 };
      }
      const fol = cat.foldersMap[folId];
      
      fol.files.push(f);
      
      const fileTime = new Date(f.createdAt).getTime();
      if (fileTime > fol.maxCreatedAt) fol.maxCreatedAt = fileTime;
      if (fileTime > cat.maxCreatedAt) cat.maxCreatedAt = fileTime;
    }

    // Convert to sorted arrays
    const sortedCategories = Object.values(categoriesMap).map(cat => {
      const sortedFolders = Object.values(cat.foldersMap).sort((a, b) => b.maxCreatedAt - a.maxCreatedAt);
      // Sort files within folder (newest first)
      sortedFolders.forEach(fol => fol.files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      return {
        name: cat.name,
        leader: cat.leader,
        folders: sortedFolders,
        maxCreatedAt: cat.maxCreatedAt
      };
    }).sort((a, b) => b.maxCreatedAt - a.maxCreatedAt);

    return sortedCategories;
  }, [filteredFiles]);

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

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err: any) {
      toast.error("Failed to mark all as read");
    }
  };

  const handleDeleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  const handleDeleteAllNotifications = async () => {
    try {
      await deleteAllNotifications();
      setNotifications([]);
    } catch {
      toast.error("Failed to clear notifications");
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
          {/* Title Area */}
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold tracking-tight">{departmentName || "Production Floor"}</h1>
          </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-12 w-12 rounded-full shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center">
            <Bell className={cn("w-5 h-5 transition-colors", unreadNotifs > 0 && "text-destructive animate-pulse")} />
            {unreadNotifs > 0 && (
              <div className="absolute -top-1 -right-1 flex h-5 min-w-[20px]">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <Badge
                  variant="destructive"
                  className="relative inline-flex px-1.5 h-5 items-center justify-center rounded-full"
                >
                  {unreadNotifs}
                </Badge>
              </div>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 sm:w-96">
            <DropdownMenuGroup>
              <div className="flex items-center justify-between px-3 py-2">
                <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                {notifications.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleMarkAllRead} disabled={unreadNotifs === 0}>
                      <CheckCheck className="w-3 h-3 mr-1" /> Mark all read
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDeleteAllNotifications}>
                      <Trash2 className="w-3 h-3 mr-1" /> Clear all
                    </Button>
                  </div>
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                    <Bell className="w-8 h-8 opacity-20" />
                    No notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      className="flex flex-col items-start gap-1 p-3 cursor-pointer group relative"
                      onSelect={(e) => {
                        e.preventDefault();
                        if (!n.isRead) handleReadNotification(n.id);
                      }}
                    >
                      <div className="flex items-start justify-between w-full">
                        <span className={cn("font-medium text-sm pr-6", !n.isRead && "text-primary")}>
                          {n.title}
                        </span>
                        {!n.isRead && <span className="w-2 h-2 mt-1.5 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <span className="text-xs text-muted-foreground pr-6 line-clamp-3">{n.message}</span>
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDeleteNotification(n.id, e)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Emergency Stop Banner */}
      {stopCount > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/15 border border-destructive/30 flex items-center gap-4 animate-in slide-in-from-top-4">
          <OctagonX className="w-8 h-8 text-destructive animate-flash" />
          <div>
            <h3 className="font-bold text-destructive text-lg">EMERGENCY STOP ACTIVE</h3>
          </div>
        </div>
      )}

      {/* Warning Banner */}
      {unconfirmedCount > 0 && (
        <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-amber-600 mr-3 shrink-0" />
            <div>
              <h4 className="text-amber-800 font-semibold text-sm">Action Required: Unconfirmed Distributions</h4>
              <p className="text-amber-700 text-xs mt-0.5">
                You have {unconfirmedCount} distribution(s) that require your attention. Please acknowledge and confirm them as soon as possible.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-card rounded-xl border shadow-sm items-center">
        <div className="flex items-center text-sm font-semibold text-muted-foreground whitespace-nowrap">
          <Filter className="w-4 h-4 mr-2" />
          Filters:
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            placeholder="Search category..."
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            placeholder="Search folder..."
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full md:w-[180px] justify-between")}>
            Status: <span className="capitalize ml-2 font-semibold text-primary">{statusFilter}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[180px]">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={statusFilter} onValueChange={(v: string) => setStatusFilter(v as any)}>
              <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="unconfirmed">Unconfirmed</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="confirmed">Confirmed</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading pending files...
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex h-40 items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground">
          No files match your current filters.
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
                {category.folders.map((folder) => (
                  <div key={folder.folderId} className="bg-muted/30 rounded-xl p-6 border shadow-sm">
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
  const [viewerOpen, setViewerOpen] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);

  const handleConfirmClick = async () => {
    setConfirming(true);
    await onConfirm();
    setConfirming(false);
  };

  const handleView = () => {
    setViewerOpen(true);
  };

  const handleViewed = () => {
    setHasViewed(true);
  };

  const isConfirmed = file.status === "Confirmed";
  const isOverdue = file.status === "Overdue";
  const showStop = file.isStopped && isNew;

  if (showStop) {
    return (
      <>
        <div className="relative flex flex-col rounded-xl border-2 border-[#E50014] bg-[#E50014] text-white shadow-lg overflow-hidden transition-all duration-300">
          <div className="p-6 flex flex-col items-center text-center space-y-4 flex-1 justify-center">
            <OctagonX className="w-12 h-12 text-white animate-pulse" />
            <h2 className="text-xl font-black tracking-tight">STOP PRODUCTION IMMEDIATELY</h2>
            
            <div className="flex items-center justify-center gap-2 pt-2">
              <FileText className="w-4 h-4" />
              <span className="font-semibold">{file.fileName} (v{file.versionNumber})</span>
            </div>

            <div className="space-y-1 text-sm font-medium opacity-90 pt-2">
              {file.changeReason && (
                <p>{file.categoryLeader || 'Tech Leader'}: {file.changeReason}</p>
              )}
              {file.note && (
                <p>Note: {file.note}</p>
              )}
            </div>
          </div>
          <div className="p-5 pt-0 mt-auto">
            <Button variant="secondary" className="w-full font-bold h-11 bg-white text-[#E50014] hover:bg-gray-100" onClick={() => {}}>
              <Check className="w-4 h-4 mr-2" />
              Acknowledge Stop
            </Button>
          </div>
        </div>
        {viewerOpen && (
          <FileViewerModal
            fileUrl={file.fileUrl.startsWith("http") ? file.fileUrl : `${API_BASE}${file.fileUrl}`}
            fileName={file.fileName}
            onClose={() => setViewerOpen(false)}
            requireViewForConfirm={!hasViewed}
            onViewed={handleViewed}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          "relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md",
          isOverdue 
            ? "border-amber-400 bg-amber-50/50"
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
                  "p-2.5 rounded-lg shrink-0",
                  isOverdue ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
                )}
              >
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                {file.fileUrl ? (
                  <div className="flex items-center gap-2 mb-1.5 min-w-0">
                    <button
                      onClick={handleView}
                      className="truncate font-semibold text-left leading-none hover:underline hover:text-primary transition-colors block outline-none"
                      title={file.fileName}
                    >
                      {file.fileName}
                    </button>
                    {isNew && (
                      <Badge className="bg-emerald-500 text-white text-[10px] h-5 px-1.5 shrink-0 border-none shadow-sm hover:bg-emerald-600 animate-pulse">
                        NEW
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1.5 min-w-0">
                    <h3 className="truncate font-semibold leading-none" title={file.fileName}>
                      {file.fileName}
                    </h3>
                    {isNew && (
                      <Badge className="bg-emerald-500 text-white text-[10px] h-5 px-1.5 shrink-0 border-none shadow-sm hover:bg-emerald-600 animate-pulse">
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
            <div className={cn("p-2 rounded-md", isOverdue ? "bg-amber-100/50" : "bg-muted/50")}>
              <span className="text-xs text-muted-foreground block mb-0.5">
                {isConfirmed ? "Confirmed At" : "Distributed"}
              </span>
              <span className={cn("font-medium", isOverdue && "text-amber-700")}>
                {isConfirmed
                  ? file.confirmedAt
                    ? new Date(file.confirmedAt).toLocaleString()
                    : "Confirmed"
                  : file.deadlineTime
                  ? new Date(file.deadlineTime).toLocaleDateString()
                  : new Date(file.createdAt).toLocaleString()}
              </span>
            </div>
          </div>

          {(file.changeReason || file.note) && (
            <div className="bg-muted/30 p-3 rounded-md text-sm border">
              {file.changeReason && (
                <>
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                    <CircleAlert className="w-3 h-3" />
                    Change Notes
                  </span>
                  <p className="text-muted-foreground italic leading-relaxed mb-3">"{file.changeReason}"</p>
                </>
              )}
              {file.note && (
                <>
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 mb-1">
                    <FileText className="w-3 h-3" />
                    Department Note
                  </span>
                  <p className="text-foreground font-medium leading-relaxed">{file.note}</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-5 pt-0 mt-auto">
          {isConfirmed ? (
            <Button 
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary opacity-100 cursor-default" 
              onClick={(e) => e.preventDefault()}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirmed
            </Button>
          ) : (
            <Button 
              className={cn("w-full font-semibold shadow-sm h-11 transition-all", isOverdue && hasViewed && "bg-amber-600 hover:bg-amber-700 text-white")}
              onClick={handleConfirmClick} 
              disabled={confirming || !hasViewed}
              variant={hasViewed ? "default" : "secondary"}
            >
              {confirming ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                hasViewed ? "Confirm Receipt" : "View File to Confirm"
              )}
            </Button>
          )}
        </div>
      </div>

      {viewerOpen && (
        <FileViewerModal
          fileUrl={file.fileUrl.startsWith("http") ? file.fileUrl : `${API_BASE}${file.fileUrl}`}
          fileName={file.fileName}
          onClose={() => setViewerOpen(false)}
          requireViewForConfirm={!hasViewed}
          onViewed={handleViewed}
        />
      )}
    </>
  );
}
