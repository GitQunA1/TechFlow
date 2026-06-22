// ── Admin Module TypeScript Types ────────────────────────────────────────────

export interface AdminUserDto {
  id: number;
  username: string;
  role: string;
  categoryId: number | null;
  categoryName: string | null;
  departmentId: number | null;
  departmentName: string | null;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: string;
  categoryId?: number | null;
  departmentId?: number | null;
}

export interface UpdateUserRequest {
  username?: string;
  newPassword?: string;
  role?: string;
  categoryId?: number | null;
  departmentId?: number | null;
}

export interface AdminCategoryDto {
  id: number;
  name: string;
  leaderId: number | null;
  leaderUsername: string | null;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  leaderId?: number | null;
}

export interface OverdueAlertDto {
  distributionId: number;
  departmentName: string;
  fileName: string;
  versionNumber: number;
  categoryName: string;
  deadline: string;
  hoursOverdue: number;
}

export interface DashboardStatsDto {
  totalActiveFiles: number;
  confirmationRate: number;
  totalConfirmed: number;
  totalPending: number;
  totalOverdue: number;
  overdueAlerts: OverdueAlertDto[];
}
