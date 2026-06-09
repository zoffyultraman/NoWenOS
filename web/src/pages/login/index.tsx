import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/stores/session";
import { loginRequest } from "@/features/auth/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HardDrive, Moon, Sun } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useLocaleStore } from "@/stores/locale";
import { useThemeStore } from "@/stores/theme";

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);
  const t = useTranslation();
  const { locale, toggleLocale } = useLocaleStore();
  const { resolved, toggleTheme } = useThemeStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const resp = await loginRequest({ username, password });
      setSession(resp.data.token, resp.data.username, resp.data.role);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <HardDrive className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">{t("login.title")}</CardTitle>
          <CardDescription>{t("login.subtitle")}</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">{t("login.username")}</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("login.signingIn") : t("login.signIn")}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Default: admin / admin
            </p>
          </form>

          <div className="mt-4 flex items-center justify-center gap-4">
            <button type="button" onClick={toggleLocale} className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
              {locale === "zh" ? "English" : "中文"}
            </button>
            <span className="text-xs text-muted-foreground">|</span>
            <button type="button" onClick={toggleTheme} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {resolved === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              {resolved === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
