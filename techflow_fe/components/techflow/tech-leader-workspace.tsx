"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderClosed,
  FolderOpen,
  Lock,
  OctagonX,
  Play,
  Plus,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadModal } from "./upload-modal";
import { RollbackModal } from "./rollback-modal";
import { StopModal } from "./stop-modal";
import { useAuth } from "@/lib/auth-context";
import {
  getCategories,
  getFolders,
  getFolderFiles,
  createFolder,
  deleteFolder,
  stopFile,
  resumeFile,
  CategoryDto,
  FolderTreeDto,
  FolderFileDto,
  API_BASE,
} from "@/lib/api";
import { toast } from "sonner";
import { useSignalR } from "@/lib/use-signalr";

export default function TechLeaderWorkspace() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  
  // State to refresh folders when an upload happens
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [uploadCtx, setUploadCtx] = useState<{
    folderId: number;
    folderName: string;
    productName: string; // The category name in this context
  } | null>(null);

  const [rollbackCtx, setRollbackCtx] = useState<{
    fileId: number;
    versionId: number;
    fileName: string;
    versionNumber: number;
  } | null>(null);

  const [stopCtx, setStopCtx] = useState<{
    fileId: number;
    fileName: string;
    sentToDepartments: string[];
  } | null>(null);

  // SignalR - Listen for uploads in any department to trigger a refresh
  const { on } = useSignalR({
    role: user?.role === "Admin" ? "Admin" : undefined, // Just to connect, we don't strictly need a group for global refresh unless backend sends it globally.
    // Actually, TechLeader doesn't naturally get upload notifications unless they have a department.
    // But let's connect anyway. If backend broadcasts to all, we'll catch it.
  });

  useEffect(() => {
    return on("NewUploadNotification", () => {
      setRefreshTrigger(prev => prev + 1);
    });
  }, [on]);

  // Fetch categories on mount
  useEffect(() => {
    getCategories()
      .then((data) => {
        setCategories(data);
        if (data.length > 0 && !activeCategoryId) {
          // Default to the user's category, or the first one
          setActiveCategoryId(user?.categoryId || data[0].id);
        }
      })
      .catch((err) => toast.error("Failed to load categories", { description: err.message }));
  }, [user?.categoryId]);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Tech Leader Workspace</h1>
        <p className="text-muted-foreground">
          Manage product categories, organize folder structures, and distribute versioned drawings to production.
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          Loading categories...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {categories.map((cat) => (
            <CategoryColumn
              key={cat.id}
              category={cat}
              active={activeCategoryId === cat.id}
              managed={user?.categoryId === cat.id}
              refreshTrigger={refreshTrigger}
              onSelect={() => setActiveCategoryId(cat.id)}
              onUpload={(folderId, folderName) => {
                setUploadCtx({
                  folderId,
                  folderName,
                  productName: cat.name,
                });
              }}
              onRollback={(fileId, versionId, fileName, versionNumber) => {
                setRollbackCtx({ fileId, versionId, fileName, versionNumber });
              }}
              onStop={(fileId, fileName, sentToDepartments) => {
                setStopCtx({ fileId, fileName, sentToDepartments });
              }}
            />
          ))}
        </div>
      )}

      {uploadCtx && (
        <UploadModal
          open={!!uploadCtx}
          onOpenChange={(open) => {
            if (!open) {
              setUploadCtx(null);
              // Refresh folder tree when modal closes (in case upload succeeded)
              setRefreshTrigger((prev) => prev + 1);
            }
          }}
          productName={uploadCtx.productName}
          folderName={uploadCtx.folderName}
          folderId={uploadCtx.folderId}
        />
      )}

      {rollbackCtx && (
        <RollbackModal
          open={!!rollbackCtx}
          onOpenChange={(open) => {
            if (!open) {
              setRollbackCtx(null);
              setRefreshTrigger((p) => p + 1);
            }
          }}
          fileId={rollbackCtx.fileId}
          versionId={rollbackCtx.versionId}
          fileName={rollbackCtx.fileName}
          versionNumber={rollbackCtx.versionNumber}
        />
      )}

      {stopCtx && (
        <StopModal
          open={!!stopCtx}
          onOpenChange={(open) => {
            if (!open) {
              setStopCtx(null);
              setRefreshTrigger((p) => p + 1);
            }
          }}
          fileId={stopCtx.fileId}
          fileName={stopCtx.fileName}
          sentToDepartments={stopCtx.sentToDepartments}
        />
      )}
    </div>
  );
}

// ── Category Column ─────────────────────────────────────────────────────────

function CategoryColumn({
  category,
  active,
  managed,
  refreshTrigger,
  onSelect,
  onUpload,
  onRollback,
  onStop,
}: {
  category: CategoryDto;
  active: boolean;
  managed: boolean;
  refreshTrigger: number;
  onSelect: () => void;
  onUpload: (folderId: number, folderName: string) => void;
  onRollback: (fileId: number, versionId: number, fileName: string, versionNumber: number) => void;
  onStop: (fileId: number, fileName: string, sentToDepartments: string[]) => void;
}) {
  const [folders, setFolders] = useState<FolderTreeDto[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!active) return;
    getFolders(category.id)
      .then(setFolders)
      .catch((err) => toast.error(`Failed to load folders for ${category.name}`));
  }, [active, category.id, refreshTrigger]);

  return (
    <div
      onClick={!active ? onSelect : undefined}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col h-[calc(100vh-12rem)] transition-all duration-300",
        active ? "ring-2 ring-primary shadow-md" : "opacity-60 hover:opacity-80 cursor-pointer scale-[0.98]",
        !managed && active && "ring-muted-foreground/30"
      )}
    >
      <div className={cn("p-4 border-b flex items-center justify-between", managed ? "bg-primary/5" : "bg-muted/30")}>
        <div>
          <h2 className="font-semibold text-lg">{category.name}</h2>
          <p className="text-xs text-muted-foreground mt-1">Owner: {category.leaderUsername || "Unassigned"}</p>
        </div>
        <div className="flex items-center gap-2">
          {active && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-primary border-primary/20 hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                setNewFolderName("");
                setCreateOpen(true);
              }}
              title="New Folder"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
          {managed && (
            <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/30 border-0 shadow-none">
              Yours
            </Badge>
          )}
        </div>
      </div>

      {/* Create Root Folder Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a new root folder for {category.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              autoFocus
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim() && !creating) {
                  document.getElementById(`create-root-${category.id}`)?.click();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              id={`create-root-${category.id}`}
              disabled={!newFolderName.trim() || creating}
              onClick={async () => {
                try {
                  setCreating(true);
                  await createFolder({ name: newFolderName.trim(), categoryId: category.id, parentId: null });
                  toast.success("Folder created");
                  setCreateOpen(false);
                  onSelect();
                  getFolders(category.id).then(setFolders);
                } catch (err: any) {
                  toast.error("Failed to create folder", { description: err.message });
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-4 flex-1 overflow-y-auto">
        {!active ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Click to expand
          </div>
        ) : folders.length === 0 ? (
          <div className="text-sm text-muted-foreground italic h-full flex items-center justify-center">No folders found. Click + to create one.</div>
        ) : (
          <div className="space-y-4">
            {folders.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                categoryId={category.id}
                interactive={true}
                refreshTrigger={refreshTrigger}
                onUpload={onUpload}
                onRollback={onRollback}
                onStop={onStop}
                onRefresh={() => getFolders(category.id).then(setFolders)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Folder Row ──────────────────────────────────────────────────────────────

function FolderRow({
  folder,
  categoryId,
  interactive,
  refreshTrigger,
  onUpload,
  onRollback,
  onStop,
  onRefresh,
}: {
  folder: FolderTreeDto;
  categoryId: number;
  interactive: boolean;
  refreshTrigger: number;
  onUpload: (folderId: number, folderName: string) => void;
  onRollback: (fileId: number, versionId: number, fileName: string, versionNumber: number) => void;
  onStop: (fileId: number, fileName: string, sentToDepartments: string[]) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [files, setFiles] = useState<FolderFileDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  // Dialog States
  const [createOpen, setCreateOpen] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [creating, setCreating] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || isDeleted) return;
    setLoading(true);
    getFolderFiles(folder.id)
      .then(setFiles)
      .catch(() => toast.error(`Failed to load files for ${folder.name}`))
      .finally(() => setLoading(false));
  }, [open, folder.id, refreshTrigger]);

  const handleResume = async (fileId: number, isStopped: boolean) => {
    if (!interactive || !isStopped) return;
    try {
      await resumeFile(fileId);
      toast.success("File resumed successfully");
      // Optimistic update
      setFiles(files.map(f => f.fileId === fileId ? { ...f, isStopped: false } : f));
    } catch (err: any) {
      toast.error("Failed to resume file", { description: err.message });
    }
  };

  const maxCreatedAt = files.length > 0 ? Math.max(...files.map(f => new Date(f.createdAt).getTime())) : 0;

  if (isDeleted) return null;

  return (
    <div className="rounded-md border bg-background overflow-hidden group/folder">
      <div
        className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <FolderOpen className="w-4 h-4 text-primary" />
          ) : (
            <FolderClosed className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">{folder.name}</span>
          <span className="text-xs text-muted-foreground ml-2">({files.length})</span>
        </div>
        <div className="flex items-center gap-1">
          {interactive && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground opacity-0 group-hover/folder:opacity-100 hover:text-primary hover:bg-primary/10 transition-opacity"
                title="Create Subfolder"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewSubfolderName("");
                  setCreateOpen(true);
                }}
              >
                <Plus className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground opacity-0 group-hover/folder:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity"
                title="Delete Folder"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteOpen(true);
              }}
            >
              <OctagonX className="w-3 h-3" />
            </Button>
            </>
          )}
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Create Subfolder Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Create Subfolder</DialogTitle>
            <DialogDescription>
              Create a new subfolder inside "{folder.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              autoFocus
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              placeholder="Subfolder name"
              value={newSubfolderName}
              onChange={(e) => setNewSubfolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSubfolderName.trim() && !creating) {
                  document.getElementById(`create-sub-${folder.id}`)?.click();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              id={`create-sub-${folder.id}`}
              disabled={!newSubfolderName.trim() || creating}
              onClick={async () => {
                try {
                  setCreating(true);
                  await createFolder({ name: newSubfolderName.trim(), categoryId, parentId: folder.id });
                  toast.success("Subfolder created");
                  setCreateOpen(false);
                  onRefresh();
                } catch (err: any) {
                  toast.error("Failed to create subfolder", { description: err.message });
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "Creating..." : "Create Subfolder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the folder "{folder.name}" and all of its contents? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                try {
                  setDeleting(true);
                  await deleteFolder(folder.id);
                  toast.success("Folder deleted");
                  setDeleteOpen(false);
                  setIsDeleted(true);
                } catch (err: any) {
                  toast.error("Failed to delete folder", { description: err.message });
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting..." : "Yes, delete folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {open && (
        <div className="bg-muted/10 p-2 border-t">
          {loading ? (
            <div className="text-xs text-muted-foreground p-2">Loading files...</div>
          ) : files.length === 0 ? (
            <div className="text-xs text-muted-foreground p-2 italic">Empty folder</div>
          ) : (
            <div className="space-y-1">
              {files.map((file) => {
                const isNew = new Date(file.createdAt).getTime() === maxCreatedAt && maxCreatedAt > 0;
                return (
                <div
                  key={file.fileVersionId}
                  className={cn(
                    "group flex flex-col p-2 text-sm rounded-md transition-colors",
                    file.isStopped ? "bg-destructive/5 border border-destructive/20" : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText
                      className={cn(
                        "w-4 h-4 shrink-0",
                        (isNew && file.isStopped) ? "text-destructive" : "text-muted-foreground group-hover:text-primary"
                      )}
                    />
                    {file.fileUrl ? (
                      <a
                        href={file.fileUrl.startsWith("http") ? file.fileUrl : `${API_BASE}${file.fileUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn("truncate font-medium hover:underline hover:text-primary transition-colors", (isNew && file.isStopped) && "text-destructive line-through")}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {file.fileName}
                      </a>
                    ) : (
                      <span className={cn("truncate font-medium", (isNew && file.isStopped) && "text-destructive line-through")}>
                        {file.fileName}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                      v{file.versionNumber}
                    </Badge>

                    {isNew && (
                      <Badge className="bg-emerald-500 text-white text-[10px] h-5 px-1.5 shrink-0 border-none shadow-sm hover:bg-emerald-600">
                        NEW
                      </Badge>
                    )}

                    {(isNew && file.isStopped) && (
                      <Badge variant="destructive" className="animate-flash text-[10px] h-5 px-1.5 shrink-0">
                        STOP
                      </Badge>
                    )}

                    </div>
                  </div>

                  {!file.isStopped && file.sentToDepartments && file.sentToDepartments.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-2 ml-7">
                      {file.sentToDepartments.map(dept => {
                        const isConfirmed = file.confirmedByDepartments?.includes(dept);
                        return (
                          <Badge 
                            key={dept} 
                            variant="outline" 
                            className={cn(
                              "text-[9px] h-4 px-1.5 py-0 shrink-0 font-medium leading-none tracking-wider",
                              isConfirmed 
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800" 
                                : "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800"
                            )}
                            title={isConfirmed ? `${dept} Confirmed` : `${dept} Pending`}
                          >
                            {dept}
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {interactive && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {isNew ? (
                        file.isStopped ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Resume File"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResume(file.fileId, file.isStopped);
                            }}
                          >
                            <Play className="w-4 h-4 fill-current" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Emergency Stop"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStop(file.fileId, file.fileName, file.sentToDepartments || []);
                            }}
                          >
                            <OctagonX className="w-4 h-4" />
                          </Button>
                        )
                      ) : null}
                      {!isNew && !file.isStopped && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2 bg-background hover:bg-muted"
                          disabled={file.isStopped}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRollback(file.fileId, file.fileVersionId, file.fileName, file.versionNumber);
                          }}
                        >
                          Rollback
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}

          {interactive && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 h-8 text-xs border-dashed text-muted-foreground hover:text-primary"
              onClick={() => onUpload(folder.id, folder.name)}
            >
              <Upload className="w-3 h-3 mr-2" />
              Upload New PDF
            </Button>
          )}

          {/* Render nested children folders if any */}
          {folder.children && folder.children.length > 0 && (
            <div className="mt-2 space-y-2 pl-4 border-l ml-2">
              {folder.children.map(child => (
                <FolderRow
                  key={child.id}
                  folder={child}
                  categoryId={categoryId}
                  interactive={interactive}
                  refreshTrigger={refreshTrigger}
                  onUpload={onUpload}
                  onRollback={onRollback}
                  onStop={onStop}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
