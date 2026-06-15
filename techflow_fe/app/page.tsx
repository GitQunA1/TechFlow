"use client";

import { useState } from "react";
import { HardHat, PencilRuler, ShieldCheck, Workflow, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import TechLeaderWorkspace from "@/components/techflow/tech-leader-workspace";
import ProductionWorkspace from "@/components/techflow/production-workspace";
import AdminDashboard from "@/components/techflow/admin-dashboard";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function Page() {
  const { user, isAuthenticated, login, logout } = useAuth();
  
  // Login State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setLoading(true);
    try {
      await login(username, password);
      toast.success("Welcome back!");
    } catch (err: any) {
      toast.error("Login failed", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md shadow-xl border-border/50">
          <CardHeader className="space-y-3 pb-6">
            <div className="flex items-center gap-2 text-primary">
              <Workflow className="w-8 h-8" />
              <span className="text-2xl font-bold tracking-tight">TechFlow</span>
            </div>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Sign in to your workspace.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="e.g. tan_jc"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading || !username || !password}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Sign in"}
              </Button>
            </CardFooter>
          </form>
          <div className="px-6 pb-6 text-xs text-muted-foreground">
            <p>Hint: tan_jc (Tech Leader), wood1_user (Production)</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Workflow className="w-6 h-6" />
            <span className="text-lg font-bold tracking-tight">TechFlow</span>
          </div>

          <div className="flex flex-1 items-center justify-end space-x-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium">{user.username}</span>
                <Badge variant="outline" className="text-[10px] uppercase h-5 px-1.5 font-semibold">
                  {user.role}
                  {user.role === "TechLeader" && <PencilRuler className="w-3 h-3 ml-1 inline" />}
                  {user.role === "Production" && <HardHat className="w-3 h-3 ml-1 inline" />}
                  {user.role === "Admin" && <ShieldCheck className="w-3 h-3 ml-1 inline" />}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={logout}>
                Log out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT AREA */}
      <main className="flex-1">
        {user.role === "TechLeader" && <TechLeaderWorkspace />}
        {user.role === "Production" && <ProductionWorkspace />}
        {user.role === "Admin" && <AdminDashboard />}
      </main>

      {/* FOOTER */}
      <footer className="py-6 border-t mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>TechFlow © 2026. Factory Drawing & Document Management.</p>
        </div>
      </footer>
    </div>
  );
}
