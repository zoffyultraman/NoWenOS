import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchUsers, createUser, deleteUser, changePassword } from "@/features/users/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/stores/toast";
import { UserPlus, Trash2, User, Shield, KeyRound, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [changePwdUser, setChangePwdUser] = useState<string | null>(null);

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: fetchUsers });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowForm(false); setUsername(""); setPassword(""); setRole("user");
      toast.success(t("users.created"));
    },
    onError: (err: Error) => { toast.error(err.message || t("users.createFailed")); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); toast.success(t("users.deleted")); },
    onError: (err: Error) => { toast.error(err.message || t("users.deleteFailed")); },
  });

  const users = usersQuery.data?.data ?? [];

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ username, password, role });
  }

  function handleDelete(name: string) {
    if (confirm(`Delete user "${name}"?`)) {
      deleteMutation.mutate(name);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("users.title")}</h1>
          <p className="text-muted-foreground">{t("users.subtitle")}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <UserPlus className="mr-2 h-4 w-4" />{t("users.addUser")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>{t("users.newUser")}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("users.username")}</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" required />
                </div>
                <div className="space-y-2">
                  <Label>{t("users.password")}</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" required />
                </div>
                <div className="space-y-2">
                  <Label>{t("users.role")}</Label>
                  <select value={role} onChange={(e) => setRole(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="user">{t("users.user")}</option>
                    <option value="admin">{t("users.admin")}</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? t("users.creating") : t("users.createUser")}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {changePwdUser && <ChangePasswordDialog username={changePwdUser} onClose={() => setChangePwdUser(null)} />}

      {usersQuery.isLoading && <p className="text-sm text-muted-foreground">{t("users.loading")}</p>}
      {usersQuery.isError && (
        <Card className="border-danger/30 bg-danger/5"><CardContent className="pt-6"><p className="text-sm text-danger">{t("users.failed")}</p></CardContent></Card>
      )}
      {users.length === 0 && !usersQuery.isLoading && (
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{t("users.noUsers")}</p></CardContent></Card>
      )}

      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.username} className="border-border bg-card transition-all duration-200 hover:border-border/80">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${user.role === "admin" ? "bg-cyan-500/10 text-cyan-400" : "bg-purple-500/10 text-purple-400"}`}>
                  {user.role === "admin" ? <Shield className="h-5 w-5" /> : <User className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-medium">{user.username}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${user.role === "admin" ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-400" : "border-slate-500/20 bg-slate-500/10 text-muted-foreground"}`}>
                  {user.role}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setChangePwdUser(user.username)} className="h-8 w-8 p-0" title={t("users.changePassword")}>
                  <KeyRound className="h-4 w-4" />
                </Button>
                {user.username !== "admin" && (
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(user.username)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" disabled={deleteMutation.isPending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ChangePasswordDialog({ username, onClose }: { username: string; onClose: () => void }) {
  const toast = useToast();
  const t = useTranslation();
  
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePwdMutation = useMutation({
    mutationFn: () => changePassword(username, { oldPassword, newPassword }),
    onSuccess: () => { toast.success(t("users.changePwdTitle") + " OK"); onClose(); },
    onError: (err: Error) => { toast.error(err.message || t("users.changePwdTitle") + " failed"); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (newPassword.length < 4) { toast.error("Password must be at least 4 characters"); return; }
    changePwdMutation.mutate();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">{t("users.changePwdTitle")}: {username}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("users.currentPwd")}</Label>
              <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>{t("users.newPwd")}</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>{t("users.confirmPwd")}</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={changePwdMutation.isPending}>
              {changePwdMutation.isPending ? t("users.saving") : t("users.changePwdTitle")}
            </Button>
            <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

