"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
  Users,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  HardHat,
  PencilRuler,
  X,
  Bell,
  History,
  Building2,
  UserCircle,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  getAdminDashboardStats,
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  remindOverdue,
} from "@/lib/api-admin";
import { getDepartments, getCategories, getHistory, type HistoryDto } from "@/lib/api";
import type {
  AdminUserDto,
  AdminCategoryDto,
  DashboardStatsDto,
} from "@/lib/types-admin";
import type { DepartmentDto, CategoryDto } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useSignalR } from "@/lib/use-signalr";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = ["Admin", "TechLeader", "Production"];

const PIE_COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    Admin: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    TechLeader: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    Production: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold", map[role] ?? "bg-muted text-muted-foreground")}>
      {role === "Admin" && <ShieldCheck className="w-3 h-3" />}
      {role === "TechLeader" && <PencilRuler className="w-3 h-3" />}
      {role === "Production" && <HardHat className="w-3 h-3" />}
      {role}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal primitive (simple dialog without nesting issues)
// ─────────────────────────────────────────────────────────────────────────────

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card w-full max-w-md rounded-xl border shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium mb-1">{children}</label>;
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50",
        props.className
      )}
    />
  );
}

function FieldSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50",
        props.className
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent?: "primary" | "danger" | "success" | "warning";
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold tracking-tight",
              accent === "primary" && "text-primary",
              accent === "danger" && "text-destructive",
              accent === "success" && "text-green-600",
              accent === "warning" && "text-amber-500",
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            accent === "primary" ? "bg-primary/10 text-primary" :
            accent === "danger" ? "bg-destructive/10 text-destructive" :
            accent === "success" ? "bg-green-500/10 text-green-600" :
            accent === "warning" ? "bg-amber-500/10 text-amber-500" :
            "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Donut Chart (no external lib dependency)
// ─────────────────────────────────────────────────────────────────────────────

function SvgDonutChart({ data }: { data: { name: string; value: number }[] }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 75;
  const innerR = 45;
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="var(--muted)" />
        <circle cx={cx} cy={cy} r={innerR} fill="var(--card)" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="var(--muted-foreground)">No data</text>
      </svg>
    );
  }

  let startAngle = -Math.PI / 2;
  const segments = data.map((d, i) => {
    let angle = (d.value / total) * 2 * Math.PI;
    if (angle >= 2 * Math.PI) angle -= 0.0001; // Fix SVG arc bug when 100%
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`;
    const seg = { path, color: PIE_COLORS[i], name: d.name, value: d.value };
    startAngle = endAngle;
    return seg;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {segments.map((seg) => (
        <path key={seg.name} d={seg.path} fill={seg.color} opacity={0.9} />
      ))}
      <circle cx={cx} cy={cy} r={innerR} fill="var(--card)" />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={20} fontWeight="bold" fill="var(--foreground)">{Math.round((data[0]?.value ?? 0) / total * 100)}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">confirmed</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Tab
// ─────────────────────────────────────────────────────────────────────────────

function DashboardTab({ refreshTrigger }: { refreshTrigger?: number }) {
  const [stats, setStats] = useState<DashboardStatsDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getAdminDashboardStats());
    } catch (err: any) {
      toast.error("Failed to load dashboard", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading stats...
      </div>
    );
  }

  if (!stats) return null;

  const pieData = [
    { name: "Confirmed", value: stats.totalConfirmed },
    { name: "Pending", value: stats.totalPending },
    { name: "Overdue", value: stats.totalOverdue },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Layers className="size-5" />} label="Active Files" value={String(stats.totalActiveFiles)} hint="Non-stopped files in system" />
        <KpiCard icon={<TrendingUp className="size-5" />} label="Confirmation Rate" value={`${stats.confirmationRate}%`} hint={`${stats.totalConfirmed} of ${stats.totalConfirmed + stats.totalPending + stats.totalOverdue} distributions`} accent="primary" />
        <KpiCard icon={<CheckCircle2 className="size-5" />} label="Confirmed" value={String(stats.totalConfirmed)} hint="Acknowledged by departments" accent="success" />
        <KpiCard icon={<AlertTriangle className="size-5" />} label="Overdue" value={String(stats.totalOverdue)} hint="Past deadline, not confirmed" accent={stats.totalOverdue > 0 ? "danger" : undefined} />
      </div>

      {/* Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribution Status Breakdown</CardTitle>
          <CardDescription>Proportion of confirmed, pending, and overdue distributions across all departments.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row items-center gap-8">
          <SvgDonutChart data={pieData} />
          <div className="flex flex-col gap-3 flex-1">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: PIE_COLORS[i] }} />
                <span className="text-sm font-medium flex-1">{d.name}</span>
                <span className="font-bold text-lg">{d.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>


      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Users Tab
// ─────────────────────────────────────────────────────────────────────────────

function UsersTab({ refreshTrigger, onDataChanged }: { refreshTrigger?: number, onDataChanged?: () => void }) {
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ username: "", password: "", role: "Production", categoryId: "", departmentId: "" });
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editUser, setEditUser] = useState<AdminUserDto | null>(null);
  const [editForm, setEditForm] = useState({ username: "", newPassword: "", role: "", categoryId: "", departmentId: "" });
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, d, c] = await Promise.all([getAdminUsers(), getDepartments(), getCategories()]);
      setUsers(u);
      setDepartments(d);
      setCategories(c);
    } catch (err: any) {
      toast.error("Failed to load users", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const handleCreate = async () => {
    if (!createForm.username || !createForm.password) return;
    setCreating(true);
    try {
      await createAdminUser({
        username: createForm.username,
        password: createForm.password,
        role: createForm.role,
        categoryId: createForm.categoryId ? Number(createForm.categoryId) : null,
        departmentId: createForm.departmentId ? Number(createForm.departmentId) : null,
      });
      toast.success("User created");
      setCreateOpen(false);
      setCreateForm({ username: "", password: "", role: "Production", categoryId: "", departmentId: "" });
      onDataChanged?.();
      await load();
    } catch (err: any) {
      toast.error("Failed to create user", { description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u: AdminUserDto) => {
    setEditUser(u);
    setEditForm({
      username: u.username,
      newPassword: "",
      role: u.role,
      categoryId: u.categoryId?.toString() ?? "",
      departmentId: u.departmentId?.toString() ?? "",
    });
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await updateAdminUser(editUser.id, {
        username: editForm.username || undefined,
        newPassword: editForm.newPassword || undefined,
        role: editForm.role || undefined,
        categoryId: editForm.categoryId ? Number(editForm.categoryId) : -1,
        departmentId: editForm.departmentId ? Number(editForm.departmentId) : -1,
      });
      toast.success("User updated");
      setEditUser(null);
      onDataChanged?.();
      await load();
    } catch (err: any) {
      toast.error("Failed to update user", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteAdminUser(deleteId);
      toast.success("User deleted");
      setDeleteId(null);
      onDataChanged?.();
      await load();
    } catch (err: any) {
      toast.error("Failed to delete user", { description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  const renderUserFormFields = (form: any, setForm: (f: any) => void, isCreate: boolean = false) => (
    <div className="space-y-3">
      <div>
        <FieldLabel>Username</FieldLabel>
        <FieldInput autoComplete="off" data-lpignore="true" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="e.g. tan_jc" />
      </div>
      <div>
        <FieldLabel>{isCreate ? "Password" : "New Password (leave blank to keep)"}</FieldLabel>
        <FieldInput type="password" autoComplete="new-password" data-lpignore="true" value={form.password ?? form.newPassword} onChange={e => setForm({ ...form, [isCreate ? "password" : "newPassword"]: e.target.value })} placeholder={isCreate ? "Password" : "Leave blank to keep current"} />
      </div>
      <div>
        <FieldLabel>Role</FieldLabel>
        <FieldSelect value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </FieldSelect>
      </div>
      {form.role === "TechLeader" || form.role === "Admin" ? (
        <div>
          <FieldLabel>Category (optional)</FieldLabel>
          <FieldSelect value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">— None —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FieldSelect>
        </div>
      ) : null}
      {form.role === "Production" ? (
        <div>
          <FieldLabel>Department</FieldLabel>
          <FieldSelect value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}>
            <option value="">— None —</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
          </FieldSelect>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">User Accounts</h2>
          <p className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? "s" : ""} registered</p>
        </div>
        <Button onClick={() => {
          setCreateForm({ username: "", password: "", role: "Production", categoryId: "", departmentId: "" });
          setCreateOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-2" /> Create User
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Category / Dept</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell><RoleBadge role={u.role} /></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {u.categoryName ? `📁 ${u.categoryName}` : u.departmentName ? `🏭 ${u.departmentName}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(u.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} title="Create New User" onClose={() => setCreateOpen(false)}>
        {renderUserFormFields(createForm, setCreateForm, true)}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !createForm.username || !createForm.password}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create
          </Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editUser} title="Edit User" onClose={() => setEditUser(null)}>
        {renderUserFormFields(editForm, setEditForm, false)}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setEditUser(null)} disabled={saving}>Cancel</Button>
          <Button onClick={handleEdit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteId} title="Delete User" onClose={() => setDeleteId(null)}>
        <p className="text-sm text-muted-foreground">Are you sure you want to delete this user? This action cannot be undone.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Categories Tab
// ─────────────────────────────────────────────────────────────────────────────

function CategoriesTab({ refreshTrigger, onDataChanged }: { refreshTrigger?: number, onDataChanged?: () => void }) {
  const [categories, setCategories] = useState<AdminCategoryDto[]>([]);
  const [allUsers, setAllUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editCat, setEditCat] = useState<AdminCategoryDto | null>(null);
  const [editForm, setEditForm] = useState({ name: "", leaderId: "" });
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const techLeaders = allUsers.filter(u => u.role === "TechLeader");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, users] = await Promise.all([getAdminCategories(), getAdminUsers()]);
      setCategories(cats);
      setAllUsers(users);
    } catch (err: any) {
      toast.error("Failed to load categories", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createAdminCategory({ name: newName.trim() });
      toast.success("Category created");
      setCreateOpen(false);
      setNewName("");
      onDataChanged?.();
      await load();
    } catch (err: any) {
      toast.error("Failed to create category", { description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (c: AdminCategoryDto) => {
    setEditCat(c);
    setEditForm({ name: c.name, leaderId: c.leaderId?.toString() ?? "" });
  };

  const handleEdit = async () => {
    if (!editCat) return;
    setSaving(true);
    try {
      await updateAdminCategory(editCat.id, {
        name: editForm.name || undefined,
        leaderId: editForm.leaderId ? Number(editForm.leaderId) : -1,
      });
      toast.success("Category updated");
      setEditCat(null);
      onDataChanged?.();
      await load();
    } catch (err: any) {
      toast.error("Failed to update category", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteAdminCategory(deleteId);
      toast.success("Category deleted");
      setDeleteId(null);
      onDataChanged?.();
      await load();
    } catch (err: any) {
      toast.error("Failed to delete category", { description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Product Categories</h2>
          <p className="text-sm text-muted-foreground">{categories.length} categor{categories.length !== 1 ? "ies" : "y"} registered</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Category
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tech Leader</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(cat => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>
                    {cat.leaderUsername ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <PencilRuler className="w-3.5 h-3.5 text-blue-500" />
                        {cat.leaderUsername}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(cat.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} title="Create Category" onClose={() => setCreateOpen(false)}>
        <div>
          <FieldLabel>Category Name</FieldLabel>
          <FieldInput value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Mechanical Parts" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create
          </Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editCat} title="Edit Category & Assign Leader" onClose={() => setEditCat(null)}>
        <div className="space-y-3">
          <div>
            <FieldLabel>Category Name</FieldLabel>
            <FieldInput value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Tech Leader</FieldLabel>
            <FieldSelect value={editForm.leaderId} onChange={e => setEditForm({ ...editForm, leaderId: e.target.value })}>
              <option value="">— Unassigned —</option>
              {techLeaders.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </FieldSelect>
            {techLeaders.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No TechLeader users found. Create one in the Users tab first.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setEditCat(null)} disabled={saving}>Cancel</Button>
          <Button onClick={handleEdit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save
          </Button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteId} title="Delete Category" onClose={() => setDeleteId(null)}>
        <p className="text-sm text-muted-foreground">Delete this category? All associated folders and files may be affected.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History Tab
// ─────────────────────────────────────────────────────────────────────────────

function HistoryTab({ refreshTrigger }: { refreshTrigger?: number }) {
  const [history, setHistory] = useState<HistoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await getHistory();
      setHistory(data);
    } catch {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter((h) => {
    const matchStatus = statusFilter === "All" || h.status === statusFilter;
    const matchCat = categoryFilter === "" || h.categoryName.toLowerCase().includes(categoryFilter.toLowerCase());
    const matchFolder = folderFilter === "" || h.folderName.toLowerCase().includes(folderFilter.toLowerCase());
    const matchDept = departmentFilter === "" || h.departmentName.toLowerCase().includes(departmentFilter.toLowerCase());
    return matchStatus && matchCat && matchFolder && matchDept;
  });

  return (
    <Card className="border-0 shadow-sm ring-1 ring-border/50">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Global Action History
        </CardTitle>
        <CardDescription>Comprehensive log of file uploads and departmental confirmations.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 border-b bg-muted/10 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              placeholder="Search category..."
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
          </div>
          <div className="relative w-full md:w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              placeholder="Search folder/package..."
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
            />
          </div>
          <div className="relative w-full md:w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              placeholder="Search department..."
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            />
          </div>
          <select 
            className="flex h-9 w-full md:w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/50">
              <TableHead>Time</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Uploader</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading history...
                </TableCell>
              </TableRow>
            ) : history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No history matching filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredHistory.map((h) => (
                <TableRow key={h.distributionId} className="group transition-colors hover:bg-muted/50">
                  <TableCell className="text-xs whitespace-nowrap">
                    <div>
                      <span className="font-semibold block mb-0.5 text-foreground">Upload:</span>
                      {new Date(h.uploadedAt).toLocaleString()}
                    </div>
                    {h.confirmedAt && (
                      <div className="mt-1">
                        <span className="font-semibold block mb-0.5 text-emerald-600">Confirm:</span>
                        {new Date(h.confirmedAt).toLocaleString()}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                      {h.fileName} <Badge variant="outline" className="text-[10px] ml-1">v{h.versionNumber}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <FolderKanban className="w-3 h-3" /> {h.categoryName} / {h.folderName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-md",
                        h.status === "Confirmed" ? "bg-emerald-100 text-emerald-800" :
                        h.status === "Overdue" ? "bg-red-100 text-red-800" :
                        h.status === "Pending" ? "bg-amber-100 text-amber-800" :
                        "bg-slate-100 text-slate-800"
                      )}>
                        {h.status}
                      </span>
                      {h.isStopped && (
                        <Badge variant="destructive" className="h-4 px-1 text-[9px] uppercase tracking-wider">Stopped</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      {h.departmentName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm flex items-center gap-1.5">
                      <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      {h.uploaderName}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root AdminDashboard
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user } = useAuth();
  const { on } = useSignalR({
    role: user?.role === "Admin" ? "Admin" : undefined,
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleDataChanged = useCallback(() => setRefreshTrigger(prev => prev + 1), []);

  useEffect(() => {
    const handleRefresh = () => setRefreshTrigger(prev => prev + 1);
    
    const offConfirm = on("DistributionConfirmed", handleRefresh);
    const offUpload = on("NewUploadNotification", handleRefresh);
    const offStop = on("Emergency_Stop", handleRefresh);
    const offResume = on("Production_Resume", handleRefresh);
    const offOverdue = on("OverdueNotification", handleRefresh);

    return () => {
      offConfirm();
      offUpload();
      offStop();
      offResume();
      offOverdue();
    };
  }, [on]);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-1 pb-2 border-b">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Control Panel</h1>
            <p className="text-sm text-muted-foreground">Manage users, categories, and monitor system-wide drawing confirmations.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="w-4 h-4 mr-1.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-1.5" /> History
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-1.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="categories">
            <FolderKanban className="w-4 h-4 mr-1.5" /> Categories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab refreshTrigger={refreshTrigger} />
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <HistoryTab refreshTrigger={refreshTrigger} />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersTab refreshTrigger={refreshTrigger} onDataChanged={handleDataChanged} />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <CategoriesTab refreshTrigger={refreshTrigger} onDataChanged={handleDataChanged} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
