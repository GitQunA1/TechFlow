"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FolderOpen,
  FolderClosed,
  Upload,
  Plus,
  ChevronRight,
  ChevronDown,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Wrench,
  History,
  Loader2,
  UploadCloud,
  AlertCircle,
  UserCog,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UploadModal } from "./upload-modal";
import { RevisionSubmitModal } from "./revision-submit-modal";
import {
  getCategories,
  getFolders,
  createFolder,
  deleteFolder,
  getMyDrafts,
  getMyRevisionRequests,
  resubmitDraft,
  API_BASE,
} from "@/lib/api";
import type {
  CategoryDto,
  FolderTreeDto,
  DraftFileDto,
  StaffRevisionRequestDto,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useSignalR } from "@/lib/use-signalr";
import { useLanguage } from "@/lib/i18n-context";

// ─────────────────────────────────────────────────────────────────────────────
// Status Badges
// ─────────────────────────────────────────────────────────────────────────────

function DraftStatusBadge({ status }: { status: DraftFileDto["status"] }) {
  const { t } = useLanguage();
  if (status === "Pending")
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 gap-1">
        <Clock className="w-3 h-3" />
        {t("staff.status.draftPending")}
      </Badge>
    );
  if (status === "Approved")
    return (
      <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400 gap-1">
        <CheckCircle2 className="w-3 h-3" />
        {t("staff.status.draftApproved")}
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-red-500 text-red-600 dark:text-red-400 gap-1">
      <XCircle className="w-3 h-3" />
      {t("staff.status.draftRejected")}
    </Badge>
  );
}

function RevisionStatusBadge({ status }: { status: "Pending" | "Submitted" | "Approved" | "Rejected" }) {
  const { t } = useLanguage();
  if (status === "Pending") return <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 gap-1.5"><Clock className="w-3.5 h-3.5" /> {t("staff.revisionStatus.pending")}</Badge>;
  if (status === "Submitted") return <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50 gap-1.5"><Upload className="w-3.5 h-3.5" /> {t("staff.revisionStatus.submitted")}</Badge>;
  if (status === "Rejected") return <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10 gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {t("staff.revisionStatus.rejected")}</Badge>;
  return <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50 gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> {t("staff.revisionStatus.approved")}</Badge>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Folder Tree Node
// ─────────────────────────────────────────────────────────────────────────────

interface FolderNodeProps {
  folder: FolderTreeDto;
  depth?: number;
  selectedFolderId: number | null;
  onSelect: (folder: FolderTreeDto) => void;
}

function FolderNode({ folder, depth = 0, selectedFolderId, onSelect }: FolderNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = folder.children.length > 0;
  const isSelected = selectedFolderId === folder.id;

  useEffect(() => {
    if (isSelected) {
      setExpanded(true);
    }
  }, [isSelected]);

  return (
    <div>
      <button
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left",
          isSelected
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted/60 text-foreground"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          setExpanded(!expanded);
          onSelect(folder);
        }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {expanded || isSelected ? (
          <FolderOpen className="w-4 h-4 shrink-0 text-amber-500" />
        ) : (
          <FolderClosed className="w-4 h-4 shrink-0 text-amber-500" />
        )}
        <span className="truncate">{folder.name}</span>
      </button>

      {expanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resubmit Draft Modal
// ─────────────────────────────────────────────────────────────────────────────

function ResubmitDraftModal({
  open,
  onOpenChange,
  draft,
  onResubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: DraftFileDto | null;
  onResubmitted: () => void;
}) {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const VALID = [".png", ".jpg", ".jpeg", ".pdf", ".dwg"];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!VALID.includes(ext)) {
      setError(t("modals.resubmit.invalidExt"));
      setFile(null);
    } else {
      setError(null);
      setFile(f);
    }
  };

  const handleSubmit = async () => {
    if (!draft || !file) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await resubmitDraft(draft.id, fd);
      toast.success(t("modals.resubmit.success"));
      onResubmitted();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(t("modals.resubmit.error"), { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("modals.resubmit.title")}</DialogTitle>
          <DialogDescription>
            {t("modals.resubmit.desc")} <strong>{draft.fileName}</strong>
          </DialogDescription>
        </DialogHeader>
        {draft.rejectReason && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
            <strong>{t("modals.resubmit.rejectReason")}</strong> {draft.rejectReason}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="resubmit-file">{t("modals.resubmit.selectNewFile")}</Label>
          <Input
            id="resubmit-file"
            type="file"
            accept=".png,.jpg,.jpeg,.pdf,.dwg"
            onChange={handleFile}
            disabled={submitting}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("modals.resubmit.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!file || submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t("modals.resubmit.resubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Subfolder Modal
// ─────────────────────────────────────────────────────────────────────────────

function CreateSubfolderModal({
  open,
  onOpenChange,
  categoryId,
  parentFolder,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoryId: number;
  parentFolder: FolderTreeDto | null;
  onCreated: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !parentFolder) return;
    setSubmitting(true);
    try {
      await createFolder({ name: name.trim(), categoryId, parentId: parentFolder.id });
      toast.success(`${t("modals.createSubfolder.success")} "${name}"`);
      setName("");
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(t("modals.createSubfolder.error"), { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("modals.createSubfolder.title")}</DialogTitle>
          <DialogDescription>
            {t("modals.createSubfolder.desc")} <strong>{parentFolder?.name}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="subfolder-name">{t("modals.createSubfolder.folderName")}</Label>
          <Input
            id="subfolder-name"
            placeholder={t("modals.createSubfolder.placeholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            disabled={submitting}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("modals.createSubfolder.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t("modals.createSubfolder.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Folder Modal
// ─────────────────────────────────────────────────────────────────────────────

function DeleteFolderModal({
  open,
  onOpenChange,
  folder,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folder: FolderTreeDto | null;
  onDeleted: () => void;
}) {
  const { t } = useLanguage();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!folder) return;
    setDeleting(true);
    try {
      await deleteFolder(folder.id);
      toast.success(`${t("modals.deleteFolder.success")} "${folder.name}"`);
      onDeleted();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(t("modals.deleteFolder.error"), { description: e.message || "Failed" });
    } finally {
      setDeleting(false);
    }
  };

  if (!folder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("modals.deleteFolder.title")}</DialogTitle>
          <DialogDescription>
            {t("modals.deleteFolder.desc")} <strong>{folder.name}</strong> {t("modals.deleteFolder.warning")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            {t("modals.deleteFolder.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t("modals.deleteFolder.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main StaffWorkspace
// ─────────────────────────────────────────────────────────────────────────────

export default function StaffWorkspace() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [folders, setFolders] = useState<FolderTreeDto[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderTreeDto | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);

  const [drafts, setDrafts] = useState<DraftFileDto[]>([]);
  const [revisions, setRevisions] = useState<StaffRevisionRequestDto[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [resubmitDraft_, setResubmitDraft] = useState<DraftFileDto | null>(null);
  const [revisionToSubmit, setRevisionToSubmit] = useState<StaffRevisionRequestDto | null>(null);
  const [createSubfolderOpen, setCreateSubfolderOpen] = useState(false);
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refresh = () => setRefreshTrigger((v) => v + 1);

  // Load categories
  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  // Load folders when category selected
  useEffect(() => {
    if (!selectedCategoryId) return;
    setLoadingFolders(true);
    getFolders(selectedCategoryId)
      .then(setFolders)
      .catch(console.error)
      .finally(() => setLoadingFolders(false));
  }, [selectedCategoryId, refreshTrigger]);

  // Load drafts
  const loadDrafts = useCallback(() => {
    setLoadingDrafts(true);
    getMyDrafts()
      .then(setDrafts)
      .catch(console.error)
      .finally(() => setLoadingDrafts(false));
  }, []);

  // Load revision tasks
  const loadRevisions = useCallback(() => {
    setLoadingRevisions(true);
    getMyRevisionRequests()
      .then(setRevisions)
      .catch(console.error)
      .finally(() => setLoadingRevisions(false));
  }, []);

  useEffect(() => {
    loadDrafts();
    loadRevisions();
  }, [loadDrafts, loadRevisions, refreshTrigger]);

  // SignalR for real-time updates
  const { on } = useSignalR({
    role: "Staff",
    userId: user?.userId,
  });

  useEffect(() => {
    const off1 = on("DraftApproved", () => loadDrafts());
    const off2 = on("DraftRejected", () => loadDrafts());
    const off3 = on("RevisionRequested", () => loadRevisions());
    const off4 = on("FolderUpdated", () => refresh());
    return () => { off1(); off2(); off3(); off4(); };
  }, [on, loadDrafts, loadRevisions]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const filteredDrafts = selectedFolder
    ? drafts.filter((d) => d.folderId === selectedFolder.id)
    : [];
  const filteredRevisions = revisions;

  // Pre-calculate version numbers for drafts per folder
  const draftVersions = useMemo(() => {
    const counts: Record<number, number> = {};
    const versions: Record<number, number> = {};
    // items are sorted newest first. iterate backwards to assign V1, V2...
    const reversed = [...drafts].reverse();
    for (const d of reversed) {
      counts[d.folderId] = (counts[d.folderId] || 0) + 1;
      versions[d.id] = counts[d.folderId];
    }
    return versions;
  }, [drafts]);

  // Pre-calculate version numbers for revisions per folder
  const revisionVersions = useMemo(() => {
    const counts: Record<number, number> = {};
    const versions: Record<number, number> = {};
    const reversed = [...revisions].reverse();
    for (const r of reversed) {
      counts[r.folderId] = (counts[r.folderId] || 0) + 1;
      versions[r.id] = counts[r.folderId];
    }
    return versions;
  }, [revisions]);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* LEFT: Category list */}
      <aside className="w-60 border-r bg-muted/20 flex flex-col overflow-y-auto">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <UserCog className="w-4 h-4" />
            {t("staff.categories")}
          </div>
        </div>
        <div className="p-2 space-y-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategoryId(cat.id);
                setSelectedFolder(null);
              }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                selectedCategoryId === cat.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted/60"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </aside>

      {/* CENTER: Folder tree */}
      <div className="w-72 border-r flex flex-col overflow-hidden">
        {selectedCategoryId ? (
          <>
            <div className="p-3 border-b flex items-center justify-between">
              <span className="text-sm font-medium truncate">
                {selectedCategory?.name}
              </span>
              {selectedFolder && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => setCreateSubfolderOpen(true)}
                    disabled={selectedFolder.parentId !== null}
                  >
                    <Plus className="w-3 h-3" />
                    {t("staff.subfolder")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs gap-1 px-2"
                    onClick={() => setDeleteFolderOpen(true)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loadingFolders && folders.length === 0 ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : folders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("staff.noFolders")}
                </p>
              ) : (
                <div className={cn("transition-opacity", loadingFolders && "opacity-60 pointer-events-none")}>
                  {folders.map((f) => (
                    <FolderNode
                      key={f.id}
                      folder={f}
                      selectedFolderId={selectedFolder?.id ?? null}
                      onSelect={setSelectedFolder}
                    />
                  ))}
                </div>
              )}
            </div>
            {/* Upload button */}
            {selectedFolder && selectedFolder.children.length === 0 && (
              <div className="p-3 border-t">
                <Button
                  className="w-full gap-2"
                  size="sm"
                  onClick={() => setUploadOpen(true)}
                >
                  <Upload className="w-4 h-4" />
                  {t("staff.uploadFile")}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">{t("staff.selectCategoryToViewFolders")}</p>
          </div>
        )}
      </div>

      {/* RIGHT: Tabs */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!selectedFolder ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 p-8 text-center space-y-3">
            <FolderOpen className="w-12 h-12 opacity-20" />
            <p>{t("staff.pleaseSelectFolder")}</p>
          </div>
        ) : (
          <Tabs defaultValue="drafts" className="flex flex-col h-full">
            <div className="border-b px-4">
              <TabsList className="mt-2">
                <TabsTrigger value="drafts" className="gap-2">
                  <FileText className="w-4 h-4" />
                  {t("staff.myDrafts")}
                  {filteredDrafts.filter((d) => d.status === "Pending").length > 0 && (
                    <Badge className="ml-1 h-5 px-1.5 text-xs bg-amber-500">
                      {filteredDrafts.filter((d) => d.status === "Pending").length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="revisions" className="gap-2">
                  <Wrench className="w-4 h-4" />
                  {t("staff.revisionTasks")}
                  {filteredRevisions.filter((r) => r.status === "Pending" || r.status === "Rejected").length > 0 && (
                    <Badge className="ml-1 h-5 px-1.5 text-xs bg-red-500">
                      {filteredRevisions.filter((r) => r.status === "Pending" || r.status === "Rejected").length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* DRAFTS TAB */}
            <TabsContent value="drafts" className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("staff.myDrafts")} ({filteredDrafts.length})
                </h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadDrafts}>
                <RefreshCw className={cn("w-3.5 h-3.5", loadingDrafts && "animate-spin")} />
              </Button>
            </div>

            {loadingDrafts ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDrafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <FileText className="w-10 h-10 opacity-30" />
                <p className="text-sm">{t("staff.noDraftsInFolder")}</p>
              </div>
            ) : (
              filteredDrafts.map((draft) => (
                <Card key={draft.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{draft.fileName}</span>
                          <Badge variant="secondary" className="px-2 font-mono">v{draftVersions[draft.id]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {draft.categoryName} · {draft.parentFolderName ? `${draft.parentFolderName} / ` : ""}{draft.folderName}
                        </p>
                        {draft.rejectReason && (
                          <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 mt-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{draft.rejectReason}</span>
                          </div>
                        )}
                        {draft.fileUrl && (
                          <a
                            href={`${API_BASE}${draft.fileUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            {t("staff.viewFile")}
                          </a>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <DraftStatusBadge status={draft.status} />
                        {draft.status === "Rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => setResubmitDraft(draft)}
                          >
                            <RefreshCw className="w-3 h-3" />
                            {t("staff.reupload")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* REVISIONS TAB */}
          <TabsContent value="revisions" className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t("staff.revisionTasksFromLeader")} ({filteredRevisions.length})
              </h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadRevisions}>
                <RefreshCw className={cn("w-3.5 h-3.5", loadingRevisions && "animate-spin")} />
              </Button>
            </div>

            {loadingRevisions ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRevisions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Wrench className="w-10 h-10 opacity-30" />
                <p className="text-sm">{t("staff.noRevisions")}</p>
              </div>
            ) : (
              filteredRevisions.map((rev) => (
                <Card key={rev.id} className={cn(
                  "hover:shadow-sm transition-shadow",
                  rev.status === "Pending" && "border-amber-300 dark:border-amber-700"
                )}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{rev.fileName}</span>
                          <Badge variant="secondary" className="px-2 font-mono">v{revisionVersions[rev.id]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {rev.categoryName} · {rev.folderName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("staff.requestedBy")} <span className="font-medium">{rev.requestedBy}</span>
                        </p>
                      </div>
                      <RevisionStatusBadge status={rev.status} />
                    </div>

                    {/* Rejected message */}
                    {rev.status === "Rejected" && rev.message && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                        <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-1">
                          {t("staff.rejectReasonTitle")}
                        </p>
                        <p className="text-sm text-destructive/90 whitespace-pre-wrap break-words">
                          {rev.message}
                        </p>
                      </div>
                    )}

                    {(rev.status === "Pending" || rev.status === "Rejected") && (
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => setRevisionToSubmit(rev)}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {t("staff.uploadRevised")}
                      </Button>
                    )}

                    {rev.status === "Submitted" && rev.submittedFileName && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                        {t("staff.submitted")} {rev.submittedFileName}
                        {rev.submittedFileUrl && (
                          <a
                            href={`${API_BASE}${rev.submittedFileUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {t("staff.view")}
                          </a>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
        )}
      </main>

      {/* Upload Draft Modal */}
      {selectedFolder && (
        <UploadModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          productName={selectedCategory?.name ?? ""}
          folderName={selectedFolder.name}
          folderId={selectedFolder.id}
          onUploaded={() => {
            loadDrafts();
          }}
        />
      )}

      <ResubmitDraftModal
        open={!!resubmitDraft_}
        onOpenChange={(v) => !v && setResubmitDraft(null)}
        draft={resubmitDraft_}
        onResubmitted={() => {
          loadDrafts();
          setResubmitDraft(null);
        }}
      />

      <RevisionSubmitModal
        open={!!revisionToSubmit}
        onOpenChange={(v) => !v && setRevisionToSubmit(null)}
        revision={revisionToSubmit}
        onSubmitted={() => {
          loadRevisions();
          setRevisionToSubmit(null);
        }}
      />

      {selectedFolder && selectedCategoryId && (
        <CreateSubfolderModal
          open={createSubfolderOpen}
          onOpenChange={setCreateSubfolderOpen}
          categoryId={selectedCategoryId}
          parentFolder={selectedFolder}
          onCreated={refresh}
        />
      )}

      {selectedFolder && (
        <DeleteFolderModal
          open={deleteFolderOpen}
          onOpenChange={setDeleteFolderOpen}
          folder={selectedFolder}
          onDeleted={() => {
            setSelectedFolder(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
