"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Cuboid,
  FileText,
  FolderClosed,
  FolderDot,
  FolderOpen,
  LayoutGrid,
  Package,
  Search,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCategories,
  getFolders,
  getFolderFiles,
  CategoryDto,
  FolderTreeDto,
  FolderFileDto,
  API_BASE,
} from "@/lib/api";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n-context";

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

// ── Root Component ───────────────────────────────────────────────────────────

export default function PlanningWorkspace() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [refreshTrigger] = useState(0);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch((err) => toast.error("Failed to load categories", { description: err.message }));
  }, []);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-500 min-h-[calc(100vh-4rem)] flex flex-col">
      {/* View 1: Category Grid */}
      {!selectedCategoryId && (
        <>
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{t("planning.title")}</h1>
            <p className="text-muted-foreground">
              {t("planning.subtitle")}
            </p>
          </div>

          {categories.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              {t("planning.loadingCategories")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((cat) => (
                <Card
                  key={cat.id}
                  className="cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/50"
                  onClick={() => setSelectedCategoryId(cat.id)}
                >
                  <CardHeader className="pb-4">
                    <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center bg-muted text-muted-foreground">
                      <LayoutGrid className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-xl">{cat.name}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {t("planning.owner")}: {cat.leaderUsername || t("planning.unassigned")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {t("planning.clickToBrowse")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* View 2: Category Detail */}
      {selectedCategoryId && selectedCategory && (
        <PlanningCategoryView
          category={selectedCategory}
          onBack={() => setSelectedCategoryId(null)}
          refreshTrigger={refreshTrigger}
        />
      )}
    </div>
  );
}

// ── Category View ────────────────────────────────────────────────────────────

function PlanningCategoryView({
  category,
  onBack,
  refreshTrigger,
}: {
  category: CategoryDto;
  onBack: () => void;
  refreshTrigger: number;
}) {
  const { t } = useLanguage();
  const [folders, setFolders] = useState<FolderTreeDto[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [folderSearch, setFolderSearch] = useState("");

  const filterFolders = (nodes: FolderTreeDto[], query: string): FolderTreeDto[] => {
    if (!query) return nodes;
    const lq = query.toLowerCase();
    return nodes.reduce<FolderTreeDto[]>((acc, node) => {
      const match = node.name.toLowerCase().includes(lq);
      const filteredChildren = filterFolders(node.children || [], query);
      if (match || filteredChildren.length > 0) acc.push({ ...node, children: filteredChildren });
      return acc;
    }, []);
  };

  const filteredFolders = filterFolders(folders, folderSearch);

  useEffect(() => {
    getFolders(category.id)
      .then(setFolders)
      .catch(() => toast.error(`Failed to load folders for ${category.name}`));
  }, [category.id, refreshTrigger]);

  const selectedFolder = findFolderRecursive(folders, selectedFolderId);

  return (
    <div className="flex flex-col h-full flex-1 animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b">
        <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary transition-colors" onClick={onBack}>
          <ArrowLeft className="w-5 h-5 mr-2" />
          {t("planning.backToCategories")}
        </Button>
        <div className="h-6 w-px bg-border hidden sm:block" />
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">{category.name}</h2>
          <Badge variant="outline" className="text-xs">{t("planning.viewOnly")}</Badge>
        </div>
      </div>

      {/* Split Pane */}
      <div className="flex flex-col md:flex-row flex-1 gap-6 min-h-0">
        {/* Left: Folder Tree */}
        <div className="w-full md:w-80 lg:w-96 shrink-0 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden h-[500px] md:h-[calc(100vh-14rem)]">
          <div className="p-4 bg-muted/30 border-b flex flex-col gap-3 font-medium text-sm text-muted-foreground">
            <div className="flex items-center">
              <FolderClosed className="w-4 h-4 mr-2" />
              {t("planning.folderStructure")}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <input
                className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                placeholder={t("planning.filterFolders")}
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {folders.length === 0 ? (
              <div className="text-center p-6 text-sm text-muted-foreground italic">{t("planning.noFoldersYet")}</div>
            ) : filteredFolders.length === 0 ? (
              <div className="text-center p-6 text-sm text-muted-foreground italic">
                {t("planning.noFoldersFound")} "{folderSearch}".
              </div>
            ) : (
              filteredFolders.map((folder) => (
                <PlanningFolderNode
                  key={folder.id}
                  folder={folder}
                  selectedFolderId={selectedFolderId}
                  onSelect={setSelectedFolderId}
                  level={0}
                  forceExpand={folderSearch.length > 0}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: File Viewer */}
        <div className="flex-1 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden h-[500px] md:h-[calc(100vh-14rem)]">
          {selectedFolder ? (
            <PlanningFileViewer folder={selectedFolder} refreshTrigger={refreshTrigger} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-muted/5">
              <FolderDot className="w-16 h-16 mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-foreground mb-1">{t("planning.noFolderSelected")}</h3>
              <p className="text-sm">{t("planning.selectFolderToView")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Folder Tree Node (Read-Only) ─────────────────────────────────────────────

function PlanningFolderNode({
  folder,
  selectedFolderId,
  onSelect,
  level,
  forceExpand,
}: {
  folder: FolderTreeDto;
  selectedFolderId: number | null;
  onSelect: (id: number) => void;
  level: number;
  forceExpand?: boolean;
}) {
  const isSelected = selectedFolderId === folder.id;
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (forceExpand) setExpanded(true);
  }, [forceExpand]);

  return (
    <div>
      <div
        className={cn(
          "flex items-center p-2 rounded-md cursor-pointer transition-colors text-sm",
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
            <div className="w-4 shrink-0" />
          )}
          {level === 0 ? (
            <Cuboid className={cn("w-4 h-4 shrink-0", !isSelected && "text-primary/70")} />
          ) : (
            <Package className={cn("w-4 h-4 shrink-0", !isSelected && "text-primary/70")} />
          )}
          <span className="truncate">{folder.name}</span>
        </div>
      </div>

      {expanded && folder.children && folder.children.length > 0 && (
        <div className="mt-0.5 space-y-0.5">
          {folder.children.map((child: FolderTreeDto) => (
            <PlanningFolderNode
              key={child.id}
              folder={child}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              level={level + 1}
              forceExpand={forceExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── File Viewer (Read-Only) ──────────────────────────────────────────────────

function PlanningFileViewer({
  folder,
  refreshTrigger,
}: {
  folder: FolderTreeDto;
  refreshTrigger: number;
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

  const maxCreatedAt = files.length > 0 ? Math.max(...files.map((f) => new Date(f.createdAt).getTime())) : 0;
  const maxVersionByFileId = useMemo(() => {
    const map = new Map<number, number>();
    files.forEach(f => {
      if (!map.has(f.fileId) || f.versionNumber > map.get(f.fileId)!) {
        map.set(f.fileId, f.versionNumber);
      }
    });
    return map;
  }, [files]);

  return (
    <div className="flex flex-col h-full animate-in fade-in">
      {/* Pane Header */}
      <div className="p-4 border-b flex items-center bg-muted/10">
        <div>
          <h3 className="font-semibold text-lg flex items-center">
            <FolderOpen className="w-5 h-5 mr-2 text-primary" />
            {folder.name}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {files.length} {t("planning.filesInFolder")}
            {folder.children && folder.children.length > 0 &&
              ` • ${folder.children.length} ${t("planning.subfolders")}`}
          </p>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground min-h-[200px]">
            {t("planning.loadingFiles")}
          </div>
        ) : files.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl p-12 min-h-[200px]">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p>{t("planning.folderEmpty")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {t("planning.files")} ({files.length})
            </h4>
            {files.map((file) => {
              const isLatest = file.versionNumber === maxVersionByFileId.get(file.fileId);
              const isNew = new Date(file.createdAt).getTime() === maxCreatedAt && maxCreatedAt > 0;
              return (
                <div
                  key={file.fileVersionId}
                  className={cn(
                    "flex flex-col p-4 text-sm rounded-lg border transition-all hover:shadow-sm",
                    file.isStopped ? "bg-destructive/5 border-destructive/30" : "bg-card hover:border-primary/30"
                  )}
                >
                  <div className="flex items-start justify-between w-full gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn("w-10 h-10 rounded-md flex items-center justify-center shrink-0", file.isStopped ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {file.fileUrl ? (
                            <button
                              onClick={() => {
                                if (!file.fileUrl) return;
                                const url = API_BASE.replace(/\/$/, "") + file.fileUrl;
                                window.open(url, "_blank");
                              }}
                              className={cn(
                                "truncate font-semibold text-base transition-colors text-left outline-none",
                                "hover:underline hover:text-primary cursor-pointer",
                                !isLatest && "text-muted-foreground",
                                (isNew && file.isStopped) && "text-destructive line-through"
                              )}
                              title={file.fileName}
                            >
                              {file.fileName}
                            </button>
                          ) : (
                            <span className={cn("truncate font-semibold text-base", isNew && file.isStopped && "text-destructive line-through")}>
                              {file.fileName}
                            </span>
                          )}
                          <Badge variant="secondary" className="px-2 font-mono">v{file.versionNumber}</Badge>
                          {isNew && !file.isStopped && (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none text-white shadow-sm animate-pulse">{t("common.new")}</Badge>
                          )}
                          {isNew && file.isStopped && (
                            <Badge variant="destructive" className="shadow-sm">{t("common.stop")}</Badge>
                          )}
                        </div>
                          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                            <span>{t("common.uploadedBy") || "Uploaded by"}</span>
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />
                              {file.uploadedByUsername || file.uploadedByRole}
                            </span>
                            <span>{t("common.on") || "on"} {new Date(file.createdAt).toLocaleString()}</span>
                          </div>
                      </div>
                    </div>
                  </div>

                  {/* Distribution Status */}
                  {!file.isStopped && file.sentToDepartments && file.sentToDepartments.length > 0 && (
                    <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground">{t("planning.distributedTo")}</p>
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
                              {dept} {isConfirmed ? t("common.confirmed") : t("common.pending")}
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
