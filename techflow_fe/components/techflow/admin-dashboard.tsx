"use client"

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
} from "lucide-react"

const CATEGORY_STATS = [
  { category: "Mechanical Parts", owner: "tan_jc", confirmed: 145, pending: 12 },
  { category: "Electrical Schematics", owner: "elec_leader", confirmed: 89, pending: 4 },
  { category: "Assembly Instructions", owner: "asm_leader", confirmed: 210, pending: 0 },
];

const OVERDUE_ALERTS = [
  {
    id: 1,
    department: "WOOD1",
    file: "ChairLeg_V3.pdf",
    version: 3,
    category: "Mechanical Parts",
    sentAt: "10/24/2026, 08:30 AM",
    hoursOverdue: 26,
  },
  {
    id: 2,
    department: "PAINT1",
    file: "Coating_Spec_X.pdf",
    version: 1,
    category: "Assembly Instructions",
    sentAt: "10/25/2026, 14:00 PM",
    hoursOverdue: 8,
  },
];
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function AdminDashboard() {
  const totalConfirmed = CATEGORY_STATS.reduce((s, c) => s + c.confirmed, 0)
  const totalPending = CATEGORY_STATS.reduce((s, c) => s + c.pending, 0)
  const total = totalConfirmed + totalPending
  const globalRate = Math.round((totalConfirmed / total) * 100)
  const activeProducts = 14

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-pretty text-xl font-semibold tracking-tight">
          Admin Monitoring Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Track whether workshops are confirming the drawings sent to them.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Layers className="size-5" />}
          label="Active Products"
          value={String(activeProducts)}
          hint="Across 3 categories"
        />
        <KpiCard
          icon={<TrendingUp className="size-5" />}
          label="Global Confirmation Rate"
          value={`${globalRate}%`}
          hint={`${totalConfirmed} of ${total} distributions`}
          accent="primary"
        />
        <KpiCard
          icon={<CheckCircle2 className="size-5" />}
          label="Confirmed"
          value={String(totalConfirmed)}
          hint="Acknowledged by workshops"
        />
        <KpiCard
          icon={<Clock className="size-5" />}
          label="Pending / Overdue"
          value={String(totalPending)}
          hint={`${OVERDUE_ALERTS.length} past deadline`}
          accent={totalPending > 0 ? "danger" : undefined}
        />
      </div>

      {/* Per-category confirmation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Confirmation by Tech Leader Category
          </CardTitle>
          <CardDescription>
            Percentage of distributed drawings confirmed vs. pending.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {CATEGORY_STATS.map((stat) => {
            const catTotal = stat.confirmed + stat.pending
            const pct = Math.round((stat.confirmed / catTotal) * 100)
            return (
              <div key={stat.category} className="flex flex-col items-center gap-3">
                <DonutGauge value={pct} />
                <div className="text-center">
                  <p className="text-sm font-semibold">{stat.category}</p>
                  <p className="text-xs text-muted-foreground">
                    Owner: {stat.owner}
                  </p>
                </div>
                <div className="flex w-full items-center justify-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-primary" />
                    {stat.confirmed} confirmed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-muted-foreground/40" />
                    {stat.pending} pending
                  </span>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Overdue alerts */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="size-5" />
            Overdue Alerts
          </CardTitle>
          <CardDescription>
            Departments that missed their confirmation deadline.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Department</TableHead>
                <TableHead>Drawing</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden sm:table-cell">Sent</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {OVERDUE_ALERTS.map((alert) => {
                const critical = alert.hoursOverdue >= 24
                return (
                  <TableRow
                    key={alert.id}
                    className={cn(critical && "bg-destructive/5")}
                  >
                    <TableCell>
                      <Badge className="bg-destructive text-white">
                        {alert.department}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {alert.file}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        v{alert.version}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {alert.category}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {alert.sentAt}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
                          critical
                            ? "bg-destructive text-white"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        <Clock className="size-3.5" />
                        {alert.hoursOverdue}h
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  accent?: "primary" | "danger"
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold tracking-tight",
              accent === "primary" && "text-primary",
              accent === "danger" && "text-destructive",
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            accent === "primary"
              ? "bg-primary/10 text-primary"
              : accent === "danger"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
      </CardContent>
    </Card>
  )
}

function DonutGauge({ value }: { value: number }) {
  const critical = value < 60
  const color = critical
    ? "var(--destructive)"
    : value < 85
      ? "var(--chart-3)"
      : "var(--primary)"
  return (
    <div
      className="relative flex size-28 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${color} ${value * 3.6}deg, var(--muted) 0deg)`,
      }}
      role="img"
      aria-label={`${value}% confirmed`}
    >
      <div className="flex size-20 flex-col items-center justify-center rounded-full bg-card">
        <span className="text-2xl font-bold tracking-tight">{value}%</span>
        <span className="text-[10px] uppercase text-muted-foreground">
          confirmed
        </span>
      </div>
    </div>
  )
}
