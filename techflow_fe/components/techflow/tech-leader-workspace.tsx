"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Cuboid,
  FileText,
  FolderClosed,
  FolderDot,
  FolderOpen,
  LayoutGrid,
  OctagonX,
  Package,
  Play,
  Plus,
  Upload,
  UploadCloud,
  Search,
  Eye,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ResumeModal } from "./resume-modal";
import { DraftReviewModal } from "./draft-review-modal";
import { RevisionRequestModal } from "./revision-request-modal";
import { useAuth } from "@/lib/auth-context";
import {
  getCategories,
  getFolders,
  getFolderFiles,
  createFolder,
  deleteFolder,
  stopFile,
  getPendingDrafts,
  getDepartments,
  createRevisionRequest,
  getStaffUsers,
  CategoryDto,
  FolderTreeDto,
  FolderFileDto,
  DraftFileDto,
  DepartmentDto,
  StaffUserDto,
  API_BASE,
} from "@/lib/api";
import { toast } from "sonner";
import { useSignalR } from "@/lib/use-signalr";
import { useLanguage } from "@/lib/i18n-context";

export default function TechLeaderWorkspace() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [uploadCtx, setUploadCtx] = useState<{
    folderId: number;
    folderName: string;
    productName: string;
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

  const [resumeCtx, setResumeCtx] = useState<{
    fileId: number;
    fileName: string;
    sentToDepartments: string[];
    uploadedByRole: string;
  } | null>(null);

  // Draft approval state
  const [pendingDrafts, setPendingDrafts] = useState<DraftFileDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUserDto[]>([]);
  const [reviewDraftCtx, setReviewDraftCtx] = useState<DraftFileDto | null>(null);
  const [draftPanelOpen, setDraftPanelOpen] = useState(false);

  // Revision request state
  const [revisionCtx, setRevisionCtx] = useState<{ fileId: number; fileName: string } | null>(null);
  const [revisionMessage, setRevisionMessage] = useState("");
  const [revisionStaffId, setRevisionStaffId] = useState<number | null>(null);
  const [sendingRevision, setSendingRevision] = useState(false);

  const loadPendingDrafts = () => {
    getPendingDrafts()
      .then(setPendingDrafts)
      .catch(console.error);
  };

  useEffect(() => {
    loadPendingDrafts();
    getDepartments().then(setDepartments).catch(console.error);
    getStaffUsers().then(setStaffUsers).catch(console.error);
  }, []);

  const { on } = useSignalR({
    role: user?.role === "Admin" ? "Admin" : undefined,
  });

  useEffect(() => {
    const offUpload = on("NewUploadNotification", () => {
      setRefreshTrigger(prev => prev + 1);
    });
    const offConfirm = on("DistributionConfirmed", () => {
      setRefreshTrigger(prev => prev + 1);
    });
    return () => {
      offUpload();
      offConfirm();
    };
  }, [on]);

  useEffect(() => {
    getCategories()
      .then((data) => {
        setCategories(data);
      })
      .catch((err) => toast.error("Failed to load categories", { description: err.message }));
  }, []);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-500 min-h-[calc(100vh-4rem)] flex flex-col">
      {/* View 1: Landing Grid */}
      {!selectedCategoryId && (
        <>
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{t("techLeader.title")}</h1>
            <p className="text-muted-foreground">
              {t("techLeader.selectCategoryPrompt")}
            </p>
          </div>

          {categories.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              Loading categories...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((cat) => {
                const isManaged = user?.categoryId === cat.id;
                return (
                  <Card
                    key={cat.id}
                    className={cn(
                      "cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                      isManaged ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20" : "hover:border-primary/50"
                    )}
                    onClick={() => setSelectedCategoryId(cat.id)}
                  >
                    <CardHeader className="pb-4 relative">
                      {isManaged && (
                        <Badge className="absolute top-4 right-4 bg-primary/20 text-primary hover:bg-primary/30 border-0 shadow-none pointer-events-none">
                          {t("techLeader.yourWorkspace")}
                        </Badge>
                      )}
                      <div className={cn("w-12 h-12 rounded-lg mb-4 flex items-center justify-center", isManaged ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground")}>
                        <LayoutGrid className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-xl">{cat.name}</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {t("techLeader.owner")}: {cat.leaderUsername || t("techLeader.unassigned")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {t("techLeader.categoryDesc")}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* View 2: Detailed Workspace */}
      {selectedCategoryId && selectedCategory && (
        <CategoryWorkspace
          category={selectedCategory}
          managed={user?.categoryId === selectedCategory.id}
          onBack={() => setSelectedCategoryId(null)}
          refreshTrigger={refreshTrigger}
          setUploadCtx={setUploadCtx}
          setRollbackCtx={setRollbackCtx}
          setStopCtx={setStopCtx}
          setResumeCtx={setResumeCtx}
          pendingDrafts={pendingDrafts.filter(d => d.categoryId === selectedCategory.id)}
          setReviewDraftCtx={setReviewDraftCtx}
        />
      )}

      {/* Modals */}
      {uploadCtx && (
        <UploadModal
          open={!!uploadCtx}
          onOpenChange={(open) => {
            if (!open) {
              setUploadCtx(null);
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

      {resumeCtx && resumeCtx.uploadedByRole === "Staff" && (
        <RevisionRequestModal
          open={!!resumeCtx}
          onOpenChange={(open) => {
            if (!open) {
              setResumeCtx(null);
              setRefreshTrigger((p) => p + 1);
            }
          }}
          fileId={resumeCtx.fileId}
          fileName={resumeCtx.fileName}
        />
      )}

      {resumeCtx && resumeCtx.uploadedByRole !== "Staff" && (
        <ResumeModal
          open={!!resumeCtx}
          onOpenChange={(open) => {
            if (!open) {
              setResumeCtx(null);
              setRefreshTrigger((p) => p + 1);
            }
          }}
          fileId={resumeCtx.fileId}
          fileName={resumeCtx.fileName}
          sentToDepartmentNames={resumeCtx.sentToDepartments}
        />
      )}

      {reviewDraftCtx && (
        <DraftReviewModal
          open={!!reviewDraftCtx}
          onOpenChange={(open) => !open && setReviewDraftCtx(null)}
          draft={reviewDraftCtx}
          departments={departments}
          onReviewed={() => {
            loadPendingDrafts();
            setReviewDraftCtx(null);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}

    </div>
  );
}

// ── Category Workspace (Split-Pane) ─────────────────────────────────────────

function CategoryWorkspace({
  category,
  managed,
  onBack,
  refreshTrigger,
  setUploadCtx,
  setRollbackCtx,
  setStopCtx,
  setResumeCtx,
  pendingDrafts,
  setReviewDraftCtx,
}: {
  category: CategoryDto;
  managed: boolean;
  onBack: () => void;
  refreshTrigger: number;
  setUploadCtx: (ctx: any) => void;
  setRollbackCtx: (ctx: any) => void;
  setStopCtx: (ctx: any) => void;
  setResumeCtx: (ctx: any) => void;
  pendingDrafts: DraftFileDto[];
  setReviewDraftCtx: (ctx: DraftFileDto) => void;
}) {
  const { t } = useLanguage();
  const [folders, setFolders] = useState<FolderTreeDto[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [folderSearch, setFolderSearch] = useState("");

  // Recursive folder filter
  const filterFolders = (nodes: FolderTreeDto[], query: string): FolderTreeDto[] => {
    if (!query) return nodes;
    const lowerQuery = query.toLowerCase();
    
    return nodes.reduce<FolderTreeDto[]>((acc, node) => {
      const isMatch = node.name.toLowerCase().includes(lowerQuery);
      const filteredChildren = filterFolders(node.children || [], query);
      
      if (isMatch || filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren });
      }
      return acc;
    }, []);
  };

  const filteredFolders = filterFolders(folders, folderSearch);

  // We fetch folders
  const loadFolders = () => {
    getFolders(category.id)
      .then(setFolders)
      .catch((err) => toast.error(`Failed to load folders for ${category.name}`));
  };

  useEffect(() => {
    loadFolders();
  }, [category.id, refreshTrigger]);

  const selectedFolder = findFolderRecursive(folders, selectedFolderId);

  return (
    <div className="flex flex-col h-full flex-1 animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary transition-colors" onClick={onBack}>
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t("techLeader.backToCategories")}
          </Button>
          <div className="h-6 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">{category.name}</h2>
            {managed && <Badge variant="secondary" className="bg-primary/10 text-primary">{t("techLeader.yourWorkspace")}</Badge>}
          </div>
        </div>
        <Button
          onClick={() => {
            setNewFolderName("");
            setCreateOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("techLeader.createProject")}
        </Button>
      </div>

      {/* Split Pane */}
      <div className="flex flex-col md:flex-row flex-1 gap-6 min-h-0">
        {/* Left Pane: Folder Tree */}
        <div className="w-full md:w-80 lg:w-96 shrink-0 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden h-[500px] md:h-[calc(100vh-14rem)]">
          <div className="p-4 bg-muted/30 border-b flex flex-col gap-3 font-medium text-sm text-muted-foreground">
            <div className="flex items-center">
              <FolderClosed className="w-4 h-4 mr-2" />
              {t("techLeader.folderStructure")}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <input
                className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                placeholder={t("techLeader.filterFolders")}
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {folders.length === 0 ? (
              <div className="text-center p-6 text-sm text-muted-foreground italic">
                {t("techLeader.noFolders")}
              </div>
            ) : filteredFolders.length === 0 ? (
              <div className="text-center p-6 text-sm text-muted-foreground italic">
                {t("techLeader.noFoldersFound")} "{folderSearch}".
              </div>
            ) : (
              filteredFolders.map((folder) => (
                <FolderTreeNode
                  key={folder.id}
                  folder={folder}
                  categoryId={category.id}
                  selectedFolderId={selectedFolderId}
                  onSelect={setSelectedFolderId}
                  onRefresh={loadFolders}
                  level={0}
                  forceExpand={folderSearch.length > 0}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Pane: File Viewer */}
        <div className="flex-1 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden h-[500px] md:h-[calc(100vh-14rem)]">
          {selectedFolder ? (
            <FileViewerPane
              folder={selectedFolder}
              categoryId={category.id}
              productName={category.name}
              refreshTrigger={refreshTrigger}
              setUploadCtx={setUploadCtx}
              setRollbackCtx={setRollbackCtx}
              setStopCtx={setStopCtx}
              setResumeCtx={setResumeCtx}
              onRefresh={loadFolders}
              pendingDrafts={pendingDrafts.filter(d => d.folderId === selectedFolder.id)}
              setReviewDraftCtx={setReviewDraftCtx}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-muted/5">
              <FolderDot className="w-16 h-16 mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-foreground mb-1">{t("techLeader.noFolderSelected")}</h3>
              <p className="text-sm">{t("techLeader.selectFolderPrompt")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("techLeader.createProject")}</DialogTitle>
            <DialogDescription>
              Create a new project (root folder) for {category.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              autoFocus
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              placeholder="Project name"
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
                  toast.success("Project created");
                  setCreateOpen(false);
                  loadFolders();
                } catch (err: any) {
                  toast.error("Failed to create project", { description: err.message });
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Folder Tree Node (Recursive Sidebar item) ───────────────────────────────

function FolderTreeNode({
  folder,
  categoryId,
  selectedFolderId,
  onSelect,
  onRefresh,
  level,
  forceExpand,
}: {
  folder: FolderTreeDto;
  categoryId: number;
  selectedFolderId: number | null;
  onSelect: (id: number) => void;
  onRefresh: () => void;
  level: number;
  forceExpand?: boolean;
}) {
  const isSelected = selectedFolderId === folder.id;
  const [expanded, setExpanded] = useState(true);

  // Auto-expand when searching
  useEffect(() => {
    if (forceExpand) setExpanded(true);
  }, [forceExpand]);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [creating, setCreating] = useState(false);
  
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <div>
      <div
        className={cn(
          "group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors text-sm",
          isSelected 
            ? "bg-primary text-primary-foreground font-medium shadow-sm" 
            : folder.hasStoppedFiles
              ? "bg-red-500/15 hover:bg-red-500/25 text-red-700 dark:text-red-400"
              : "hover:bg-muted/60 text-foreground"
        )}
        style={{ paddingLeft: `${level * 1 + 0.5}rem` }}
        onClick={() => onSelect(folder.id)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {folder.children && folder.children.length > 0 ? (
            <div 
              className={cn("p-0.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 shrink-0", isSelected ? "text-primary-foreground" : "text-muted-foreground")}
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </div>
          ) : (
            <div className="w-4 shrink-0" /> // spacer
          )}
          {level === 0 ? (
            <Cuboid className={cn("w-4 h-4 shrink-0", !isSelected && "text-primary/70")} />
          ) : (
            <Package className={cn("w-4 h-4 shrink-0", !isSelected && "text-primary/70")} />
          )}
          <span className="truncate">{folder.name}</span>
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 rounded-sm shrink-0", isSelected ? "text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}
            title="Create Product Code"
            onClick={(e) => {
              e.stopPropagation();
              setNewSubfolderName("");
              setCreateOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 rounded-sm shrink-0", isSelected ? "text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive")}
            title="Delete Folder"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteOpen(true);
            }}
          >
            <OctagonX className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Subfolders */}
      {expanded && folder.children && folder.children.length > 0 && (
        <div className="mt-0.5 space-y-0.5">
          {folder.children.map((child: FolderTreeDto) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              categoryId={categoryId}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onRefresh={onRefresh}
              level={level + 1}
              forceExpand={forceExpand}
            />
          ))}
        </div>
      )}

      {/* Create Product Code Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Create Product Code</DialogTitle>
            <DialogDescription>
              Create a new product code inside "{folder.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              autoFocus
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              placeholder="Product Code"
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
                  toast.success("Product Code created");
                  setCreateOpen(false);
                  setExpanded(true);
                  onRefresh();
                } catch (err: any) {
                  toast.error("Failed to create product code", { description: err.message });
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "Creating..." : "Create Product Code"}
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
                  if (selectedFolderId === folder.id) {
                    onSelect(-1); // Deselect if deleting current folder
                  }
                  onRefresh();
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
    </div>
  );
}

// ── File Viewer Pane (Right side) ───────────────────────────────────────────

function FileViewerPane({
  folder,
  categoryId,
  productName,
  refreshTrigger,
  setUploadCtx,
  setRollbackCtx,
  setStopCtx,
  setResumeCtx,
  onRefresh,
  pendingDrafts,
  setReviewDraftCtx,
}: {
  folder: FolderTreeDto;
  categoryId: number;
  productName: string;
  refreshTrigger: number;
  setUploadCtx: any;
  setRollbackCtx: any;
  setStopCtx: any;
  setResumeCtx: any;
  onRefresh: () => void;
  pendingDrafts: DraftFileDto[];
  setReviewDraftCtx: (ctx: DraftFileDto) => void;
}) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<FolderFileDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getFolderFiles(folder.id)
      .then(setFiles)
      .catch(() => toast.error(`Failed to load files for ${folder.name}`))
      .finally(() => setLoading(false));
  }, [folder.id, refreshTrigger]);

  const maxCreatedAt = files.length > 0 ? Math.max(...files.map(f => new Date(f.createdAt).getTime())) : 0;

  return (
    <div className="flex flex-col h-full animate-in fade-in">
      <div className="p-4 border-b flex items-center justify-between bg-muted/10">
        <div>
          <h3 className="font-semibold text-lg flex items-center">
            <FolderOpen className="w-5 h-5 mr-2 text-primary" />
            {folder.name}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {files.length} {t("techLeader.filesInFolder")} 
            {folder.children && folder.children.length > 0 && ` • ${folder.children.length} ${folder.children.length === 1 ? t('techLeader.subfolder') : t('techLeader.subfolders')}`}
          </p>
        </div>
        {folder.parentId !== null && (
          <Button onClick={() => setUploadCtx({ folderId: folder.id, folderName: folder.name })} className="gap-2">
            <UploadCloud className="w-4 h-4" />
            {t("techLeader.uploadFile")}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Pending Drafts Section */}
        {pendingDrafts.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-500 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {t("leader.pendingDrafts")} ({pendingDrafts.length})
            </h4>
            {pendingDrafts.map((draft) => (
              <div
                key={draft.id}
                className="group flex flex-col p-4 text-sm rounded-lg border bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/50 transition-all hover:shadow-sm"
              >
                <div className="flex items-start justify-between w-full gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="truncate font-semibold text-base text-amber-900 dark:text-amber-100">
                          {draft.fileName}
                        </span>
                        <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 gap-1 bg-amber-500/10">
                          Draft
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                        Uploaded by <span className="font-medium text-foreground">{draft.uploadedBy}</span> on {new Date(draft.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => setReviewDraftCtx(draft)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Review Draft
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Regular Files Section */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground min-h-[200px]">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl p-12 min-h-[200px]">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p>This folder is empty.</p>
            {folder.parentId !== null && (
              <Button variant="link" onClick={() => setUploadCtx({ folderId: folder.id, folderName: folder.name, productName })}>
                Upload your first file
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {t("techLeader.filesInFolder")} ({files.length})
            </h4>
            {files.map((file) => {
              const isNew = new Date(file.createdAt).getTime() === maxCreatedAt && maxCreatedAt > 0;
              return (
                <div
                  key={file.fileVersionId}
                  className={cn(
                    "group flex flex-col p-4 text-sm rounded-lg border transition-all hover:shadow-sm",
                    file.isStopped ? "bg-destructive/5 border-destructive/30" : "bg-card hover:border-primary/30"
                  )}
                >
                  <div className="flex items-start justify-between w-full gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn("w-10 h-10 rounded-md flex items-center justify-center shrink-0", file.isStopped ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {file.fileUrl ? (
                            <button
                              onClick={() => {
                                if (!file.fileUrl) return;
                                const url = API_BASE.replace(/\/$/, "") + file.fileUrl;
                                window.open(url, "_blank");
                              }}
                              className={cn("truncate font-semibold text-base hover:underline hover:text-primary transition-colors text-left", (isNew && file.isStopped) && "text-destructive line-through")}
                            >
                              {file.fileName}
                            </button>
                          ) : (
                            <span className={cn("truncate font-semibold text-base", (isNew && file.isStopped) && "text-destructive line-through")}>
                              {file.fileName}
                            </span>
                          )}
                          <Badge variant="secondary" className="px-2 font-mono">v{file.versionNumber}</Badge>
                          {isNew && <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none text-white shadow-sm animate-pulse">{t("techLeader.new")}</Badge>}
                          {(isNew && file.isStopped) && <Badge variant="destructive" className="animate-flash shadow-sm">{t("techLeader.stop")}</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                          {t("techLeader.uploadedOn")} {new Date(file.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isNew ? (
                        file.isStopped ? (
                          <Button
                            variant="outline"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                            onClick={() => setResumeCtx({ fileId: file.fileId, fileName: file.fileName, sentToDepartments: file.sentToDepartments || [], uploadedByRole: file.uploadedByRole })}
                          >
                            <Play className="w-4 h-4 mr-2 fill-current" /> Resume
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                            onClick={() => setStopCtx({ fileId: file.fileId, fileName: file.fileName, sentToDepartments: file.sentToDepartments || [] })}
                          >
                            <OctagonX className="w-4 h-4 mr-2" /> {t("techLeader.stop")}
                          </Button>
                        )
                      ) : null}
                      
                      {!isNew && !file.isStopped && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-muted-foreground hover:text-foreground"
                            disabled={file.isStopped}
                            onClick={() => setRollbackCtx({ fileId: file.fileId, versionId: file.fileVersionId, fileName: file.fileName, versionNumber: file.versionNumber })}
                          >
                            {t("techLeader.rollback")}
                          </Button>
                      )}
                    </div>
                  </div>

                  {/* Distribution Status */}
                  {!file.isStopped && file.sentToDepartments && file.sentToDepartments.length > 0 && (
                    <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground">{t("techLeader.distributedTo")}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {file.sentToDepartments.map((dept: string) => {
                          const isConfirmed = file.confirmedByDepartments?.includes(dept);
                          return (
                            <Badge 
                              key={dept} 
                              variant="outline" 
                              className={cn(
                                "text-xs py-0.5",
                                isConfirmed 
                                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-200" 
                                  : "bg-amber-500/10 text-amber-700 border-amber-200"
                              )}
                            >
                              <div className={cn("w-1.5 h-1.5 rounded-full mr-1.5", isConfirmed ? "bg-emerald-500" : "bg-amber-500")} />
                              {dept} {isConfirmed ? "Confirmed" : "Pending"}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper ──────────────────────────────────────────────────────────────────

function findFolderRecursive(folders: FolderTreeDto[], targetId: number | null): FolderTreeDto | null {
  if (targetId === null) return null;
  for (const f of folders) {
    if (f.id === targetId) return f;
    if (f.children && f.children.length > 0) {
      const found = findFolderRecursive(f.children, targetId);
      if (found) return found;
    }
  }
  return null;
}
