// ─────────────────────────────────────────────────────────────────────────────
// Central API service layer.
// All backend calls go through here. The `apiFetch` wrapper automatically
// injects the stored JWT token into every request.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  LoginResponse,
  CategoryDto,
  DepartmentDto,
  FolderTreeDto,
  FolderFileDto,
  CreateFolderRequest,
  CreateFolderResponse,
  UploadFileResponse,
  PendingFileDto,
  NotificationDto,
  FileHistoryDto,
  DepartmentNoteRequest,
  DraftFileDto,
  StaffRevisionRequestDto,
  StaffUserDto,
} from "./types";

export type {
  LoginResponse,
  CategoryDto,
  DepartmentDto,
  FolderTreeDto,
  FolderFileDto,
  CreateFolderRequest,
  CreateFolderResponse,
  UploadFileResponse,
  PendingFileDto,
  NotificationDto,
  FileHistoryDto,
  DepartmentNoteRequest,
  DraftFileDto,
  StaffRevisionRequestDto,
  StaffUserDto,
};

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://technical.vfr.net.vn:10114";

// ── Token storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY = "tf_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("tf_user");
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

interface ApiError {
  status: number;
  message: string;
}

export class ApiException extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiException";
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Only set Content-Type for JSON bodies (not FormData)
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    // Try to read error text from backend
    let message = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      if (text) message = text;
    } catch {
      // ignore
    }
    throw new ApiException(message, res.status);
  }

  // 204 No Content or empty body
  const text = await res.text();
  if (!text) return undefined as T;

  return JSON.parse(text) as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<CategoryDto[]> {
  return apiFetch<CategoryDto[]>("/api/categories");
}

// ── Departments ───────────────────────────────────────────────────────────────

export async function getDepartments(): Promise<DepartmentDto[]> {
  return apiFetch<DepartmentDto[]>("/api/departments");
}

// ── Folders ───────────────────────────────────────────────────────────────────

export async function getFolders(categoryId: number): Promise<FolderTreeDto[]> {
  return apiFetch<FolderTreeDto[]>(`/api/folders?categoryId=${categoryId}`);
}

export async function getFolderFiles(folderId: number): Promise<FolderFileDto[]> {
  return apiFetch<FolderFileDto[]>(`/api/folders/${folderId}/files`);
}

export async function createFolder(
  req: CreateFolderRequest
): Promise<CreateFolderResponse> {
  return apiFetch<CreateFolderResponse>("/api/folders", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function deleteFolder(folderId: number): Promise<void> {
  return apiFetch<void>(`/api/folders/${folderId}`, {
    method: "DELETE",
  });
}

// ── Files ─────────────────────────────────────────────────────────────────────

/** Upload bản vẽ mới bằng vật lý file */
export async function uploadFile(formData: FormData): Promise<UploadFileResponse> {
  return apiFetch<UploadFileResponse>("/api/files/upload", {
    method: "POST",
    body: formData,
  });
}

export async function stopFile(fileId: number, departmentIds: number[]): Promise<void> {
  return apiFetch<void>(`/api/files/${fileId}/stop`, {
    method: "POST",
    body: JSON.stringify({ departmentIds }),
  });
}

export async function resumeFile(
  fileId: number,
  request: { departmentNotes: DepartmentNoteRequest[] }
): Promise<void> {
  return apiFetch<void>(`/api/files/${fileId}/resume`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/** Resume kèm bản vẽ mới (upload file vật lý) */
export async function resumeFileWithFile(
  fileId: number,
  formData: FormData
): Promise<UploadFileResponse> {
  return apiFetch<UploadFileResponse>(`/api/files/${fileId}/resume-with-file`, {
    method: "POST",
    body: formData,
  });
}

export async function rollbackVersion(
  fileId: number,
  versionId: number,
  data: { changeReason: string }
): Promise<UploadFileResponse> {
  return apiFetch<UploadFileResponse>(`/api/files/${fileId}/versions/${versionId}/rollback`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getFileHistory(fileId: number): Promise<FileHistoryDto[]> {
  return apiFetch<FileHistoryDto[]>(`/api/files/${fileId}/history`);
}

// ── Workspace (Production) ────────────────────────────────────────────────────

export async function getPendingFiles(): Promise<PendingFileDto[]> {
  return apiFetch<PendingFileDto[]>("/api/workspaces/pending-files");
}

// ── Distributions ─────────────────────────────────────────────────────────────

export async function confirmDistribution(id: number): Promise<void> {
  return apiFetch<void>(`/api/distributions/${id}/confirm`, { method: "POST" });
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function getNotifications(): Promise<NotificationDto[]> {
  return apiFetch<NotificationDto[]>("/api/notifications");
}

export async function markNotificationRead(id: number): Promise<void> {
  return apiFetch<void>(`/api/notifications/${id}/read`, { method: "PUT" });
}

export async function markAllNotificationsRead(): Promise<void> {
  return apiFetch<void>(`/api/notifications/read-all`, { method: "PUT" });
}

export async function deleteNotification(id: number): Promise<void> {
  return apiFetch<void>(`/api/notifications/${id}`, { method: "DELETE" });
}

export async function deleteAllNotifications(): Promise<void> {
  return apiFetch<void>(`/api/notifications/all`, { method: "DELETE" });
}

export interface HistoryDto {
  distributionId: number;
  fileName: string;
  versionNumber: number;
  folderName: string;
  categoryName: string;
  uploaderName: string;
  uploadedAt: string;
  departmentName: string;
  confirmedAt?: string;
  status: string;
  isStopped: boolean;
}

export async function getHistory(): Promise<HistoryDto[]> {
  return apiFetch<HistoryDto[]>("/api/admin/history");
}

// ── Staff Draft APIs ───────────────────────────────────────────────────────────────

export async function getMyDrafts(): Promise<DraftFileDto[]> {
  return apiFetch<DraftFileDto[]>("/api/files/drafts");
}

export async function getPendingDrafts(): Promise<DraftFileDto[]> {
  return apiFetch<DraftFileDto[]>("/api/files/drafts/pending");
}

export async function reviewDraft(
  id: number,
  data: { approve: boolean; rejectReason?: string }
): Promise<void> {
  return apiFetch<void>(`/api/files/drafts/${id}/review`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function resubmitDraft(id: number, formData: FormData): Promise<void> {
  return apiFetch<void>(`/api/files/drafts/${id}/resubmit`, {
    method: "POST",
    body: formData,
  });
}

// ── Staff Revision APIs ─────────────────────────────────────────────────────────

export async function createRevisionRequest(
  fileId: number,
  data: { message: string; assignedStaffId?: number | null }
): Promise<void> {
  return apiFetch<void>(`/api/files/${fileId}/revision-request`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMyRevisionRequests(): Promise<StaffRevisionRequestDto[]> {
  return apiFetch<StaffRevisionRequestDto[]>("/api/files/revision-requests");
}

export async function getPendingRevisionRequests(): Promise<StaffRevisionRequestDto[]> {
  return apiFetch<StaffRevisionRequestDto[]>("/api/files/revision-requests/pending");
}

export async function submitRevision(id: number, formData: FormData): Promise<void> {
  return apiFetch<void>(`/api/files/revision-requests/${id}/submit`, {
    method: "POST",
    body: formData,
  });
}

export async function approveRevision(id: number): Promise<UploadFileResponse> {
  return apiFetch<UploadFileResponse>(`/api/files/revision-requests/${id}/approve`, {
    method: "POST",
  });
}

// ── Admin staff users list ────────────────────────────────────────────────────────

export async function getStaffUsers(): Promise<StaffUserDto[]> {
  return apiFetch<StaffUserDto[]>("/api/admin/staff-users");
}
