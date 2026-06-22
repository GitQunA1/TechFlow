// ── Admin API service layer ───────────────────────────────────────────────────
// All calls auto-inject the stored JWT token via the shared apiFetch wrapper
// imported from api.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { getStoredToken, API_BASE, ApiException } from "./api";
import type {
  AdminUserDto,
  CreateUserRequest,
  UpdateUserRequest,
  AdminCategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  DashboardStatsDto,
} from "./types-admin";

// Reuse the same token-injecting fetch wrapper
async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      if (text) message = text;
    } catch { /* ignore */ }
    throw new ApiException(message, res.status);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function getAdminDashboardStats(): Promise<DashboardStatsDto> {
  return adminFetch<DashboardStatsDto>("/api/admin/dashboard/stats");
}

export function remindOverdue(): Promise<{ message: string }> {
  return adminFetch<{ message: string }>("/api/admin/dashboard/remind-overdue", {
    method: "POST",
  });
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function getAdminUsers(): Promise<AdminUserDto[]> {
  return adminFetch<AdminUserDto[]>("/api/admin/users");
}

export function createAdminUser(data: CreateUserRequest): Promise<AdminUserDto> {
  return adminFetch<AdminUserDto>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAdminUser(id: number, data: UpdateUserRequest): Promise<void> {
  return adminFetch<void>(`/api/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteAdminUser(id: number): Promise<void> {
  return adminFetch<void>(`/api/admin/users/${id}`, { method: "DELETE" });
}

// ── Categories ────────────────────────────────────────────────────────────────

export function getAdminCategories(): Promise<AdminCategoryDto[]> {
  return adminFetch<AdminCategoryDto[]>("/api/admin/categories");
}

export function createAdminCategory(data: CreateCategoryRequest): Promise<AdminCategoryDto> {
  return adminFetch<AdminCategoryDto>("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAdminCategory(id: number, data: UpdateCategoryRequest): Promise<void> {
  return adminFetch<void>(`/api/admin/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteAdminCategory(id: number): Promise<void> {
  return adminFetch<void>(`/api/admin/categories/${id}`, { method: "DELETE" });
}
