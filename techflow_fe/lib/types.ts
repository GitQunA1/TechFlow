// ─────────────────────────────────────────────────────────────────────────────
// TypeScript interfaces that mirror the .NET backend DTOs exactly.
// ─────────────────────────────────────────────────────────────────────────────

/** Stored in localStorage after a successful login */
export interface AuthUser {
  token: string;
  userId: number;
  role: "Admin" | "TechLeader" | "Production";
  categoryId: number | null;
  departmentId: number | null;
  username: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  userId: number;
  role: "Admin" | "TechLeader" | "Production";
  categoryId: number | null;
  departmentId: number | null;
}

// ── Categories ───────────────────────────────────────────────────────────────

export interface CategoryDto {
  id: number;
  name: string;
  leaderUsername: string | null;
}

// ── Departments ──────────────────────────────────────────────────────────────

export interface DepartmentDto {
  id: number;
  code: string;
  name: string;
}

// ── Folders ──────────────────────────────────────────────────────────────────

export interface FolderTreeDto {
  id: number;
  name: string;
  parentId: number | null;
  children: FolderTreeDto[];
  hasStoppedFiles: boolean;
}

export interface CreateFolderRequest {
  name: string;
  categoryId: number;
  parentId?: number | null;
}

export interface CreateFolderResponse {
  id: number;
  name: string;
  parentId: number | null;
}

// ── Folder Files ─────────────────────────────────────────────────────────────

export interface FolderFileDto {
  fileId: number;
  fileVersionId: number;
  fileName: string;
  isStopped: boolean;
  versionNumber: number;
  fileUrl: string | null;
  changeReason: string | null;
  createdAt: string; // ISO datetime
  sentToDepartments: string[];
  confirmedByDepartments: string[];
}

// ── File Upload ───────────────────────────────────────────────────────────────

export interface UploadFileResponse {
  fileId: number;
  fileVersionId: number;
  versionNumber: number;
  fileUrl: string | null;
}

// ── Pending Files (Production workspace) ─────────────────────────────────────

export interface PendingFileDto {
  distributionId: number;
  fileId: number;
  fileName: string;
  folderId: number;
  folderName: string;
  parentFolderName: string | null;
  categoryId: number;
  categoryName: string;
  categoryLeader: string | null;
  versionNumber: number;
  fileUrl: string | null;
  isStopped: boolean;
  changeReason: string | null;
  status: "Pending" | "Confirmed" | "Overdue";
  deadlineTime: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  note: string | null;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface NotificationDto {
  id: number;
  title: string;
  message: string;
  targetFolderId: number | null;
  targetFileId: number | null;
  isRead: boolean;
  createdAt: string;
}

// ── File History ──────────────────────────────────────────────────────────────

export interface FileHistoryDto {
  fileVersionId: number;
  versionNumber: number;
  fileUrl: string;
  changeReason: string | null;
  uploadedBy: string;
  createdAt: string;
}

// ── SignalR Events ─────────────────────────────────────────────────────────────

export interface NewUploadNotificationPayload {
  fileId: number;
  fileVersionId: number;
  fileName: string;
  versionNumber: number;
  departmentIds: number[];
}

export interface EmergencyStopPayload {
  fileId: number;
  fileName: string;
}

// ── Resume ────────────────────────────────────────────────────────────────────

export interface DepartmentNoteRequest {
  departmentId: number;
  note: string;
  isAffected: boolean;
}
