"use client";

import { useState, useEffect, useCallback } from "react";
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

// ─────────────────────────────────────────────────────────────────────────────
// Status Badges
// ─────────────────────────────────────────────────────────────────────────────

function DraftStatusBadge({ status }: { status: DraftFileDto["status"] }) {
  if (status === "Pending")
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 gap-1">
        <Clock className="w-3 h-3" />
        Chờ duyệt
      </Badge>
    );
  if (status === "Approved")
    return (
      <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400 gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Đã duyệt
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-red-500 text-red-600 dark:text-red-400 gap-1">
      <XCircle className="w-3 h-3" />
      Bị từ chối
    </Badge>
  );
}

function RevisionStatusBadge({ status }: { status: "Pending" | "Submitted" | "Approved" | "Rejected" }) {
  if (status === "Pending") return <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 gap-1.5"><Clock className="w-3.5 h-3.5" /> Chờ upload</Badge>;
  if (status === "Submitted") return <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50 gap-1.5"><Upload className="w-3.5 h-3.5" /> Đã upload, chờ duyệt</Badge>;
  if (status === "Rejected") return <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10 gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Bị từ chối</Badge>;
  return <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50 gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Đã duyệt</Badge>;
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
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const VALID = [".png", ".jpg", ".jpeg", ".pdf", ".dwg"];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!VALID.includes(ext)) {
      setError("Chỉ cho phép .png, .jpg, .jpeg, .pdf, .dwg");
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
      toast.success("Draft đã được gửi lại! Chờ Leader xem xét.");
      onResubmitted();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Gửi lại thất bại", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tải lại file bị từ chối</DialogTitle>
          <DialogDescription>
            Tải lên phiên bản mới cho <strong>{draft.fileName}</strong>
          </DialogDescription>
        </DialogHeader>
        {draft.rejectReason && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
            <strong>Lý do từ chối:</strong> {draft.rejectReason}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="resubmit-file">Chọn file mới</Label>
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
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={!file || submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Gửi lại
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
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !parentFolder) return;
    setSubmitting(true);
    try {
      await createFolder({ name: name.trim(), categoryId, parentId: parentFolder.id });
      toast.success(`Đã tạo thư mục "${name}"`);
      setName("");
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Tạo thư mục thất bại", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tạo thư mục con</DialogTitle>
          <DialogDescription>
            Tạo thư mục con trong: <strong>{parentFolder?.name}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="subfolder-name">Tên thư mục</Label>
          <Input
            id="subfolder-name"
            placeholder="Nhập tên thư mục..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            disabled={submitting}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Tạo
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
    return () => { off1(); off2(); off3(); };
  }, [on, loadDrafts, loadRevisions]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const filteredDrafts = selectedFolder
    ? drafts.filter((d) => d.folderId === selectedFolder.id)
    : [];
  const filteredRevisions = selectedFolder
    ? revisions.filter((r) => r.folderId === selectedFolder.id)
    : [];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* LEFT: Category list */}
      <aside className="w-60 border-r bg-muted/20 flex flex-col overflow-y-auto">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <UserCog className="w-4 h-4" />
            Danh mục
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
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setCreateSubfolderOpen(true)}
                >
                  <Plus className="w-3 h-3" />
                  Thư mục con
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loadingFolders ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : folders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Chưa có thư mục
                </p>
              ) : (
                folders.map((f) => (
                  <FolderNode
                    key={f.id}
                    folder={f}
                    selectedFolderId={selectedFolder?.id ?? null}
                    onSelect={setSelectedFolder}
                  />
                ))
              )}
            </div>
            {/* Upload button */}
            {selectedFolder && (
              <div className="p-3 border-t">
                <Button
                  className="w-full gap-2"
                  size="sm"
                  onClick={() => setUploadOpen(true)}
                >
                  <Upload className="w-4 h-4" />
                  Upload File
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Chọn danh mục để xem thư mục</p>
          </div>
        )}
      </div>

      {/* RIGHT: Tabs */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!selectedFolder ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 p-8 text-center space-y-3">
            <FolderOpen className="w-12 h-12 opacity-20" />
            <p>Vui lòng chọn một thư mục từ danh sách bên trái để xem các bản nháp và yêu cầu chỉnh sửa.</p>
          </div>
        ) : (
          <Tabs defaultValue="drafts" className="flex flex-col h-full">
            <div className="border-b px-4">
              <TabsList className="mt-2">
                <TabsTrigger value="drafts" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Bản nháp của tôi
                  {filteredDrafts.filter((d) => d.status === "Pending").length > 0 && (
                    <Badge className="ml-1 h-5 px-1.5 text-xs bg-amber-500">
                      {filteredDrafts.filter((d) => d.status === "Pending").length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="revisions" className="gap-2">
                  <Wrench className="w-4 h-4" />
                  Yêu cầu chỉnh sửa
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
                  Bản nháp của tôi ({filteredDrafts.length})
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
                <p className="text-sm">Chưa có bản nháp nào trong thư mục này. Upload file để bắt đầu!</p>
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
                            Xem file
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
                            Tải lại
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
                Yêu cầu chỉnh sửa từ Leader ({filteredRevisions.length})
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
                <p className="text-sm">Không có yêu cầu chỉnh sửa nào trong thư mục này.</p>
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
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {rev.categoryName} · {rev.folderName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Yêu cầu bởi: <span className="font-medium">{rev.requestedBy}</span>
                        </p>
                      </div>
                      <RevisionStatusBadge status={rev.status} />
                    </div>

                    {/* Rejected message */}
                    {rev.status === "Rejected" && rev.message && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                        <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-1">
                          Lý do từ chối
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
                        Upload file đã chỉnh sửa
                      </Button>
                    )}

                    {rev.status === "Submitted" && rev.submittedFileName && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                        Đã gửi: {rev.submittedFileName}
                        {rev.submittedFileUrl && (
                          <a
                            href={`${API_BASE}${rev.submittedFileUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Xem
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
            refresh();
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
    </div>
  );
}
