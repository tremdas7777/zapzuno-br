import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/lib/brand";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { getAdminFunnel, verifyAdminPassword } from "@/lib/admin.functions";
import { ADMIN_SECTIONS, AdminShell, type AdminSection } from "@/components/admin/AdminShell";
import { OverviewTab } from "@/components/admin/OverviewTab";
import { OrdersTab } from "@/components/admin/OrdersTab";
import { AbandonedTab } from "@/components/admin/AbandonedTab";
import { LiveTab } from "@/components/admin/LiveTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { ProductsTab } from "@/components/admin/ProductsTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: `Admin · ${brand.name}` }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminPage,
});

const STORAGE_KEY = "loja_admin_pwd";

/** Seção aberta fica no endereço (#pedidos...), para recarregar e voltar no mesmo lugar. */
function secaoDoEndereco(): AdminSection {
  if (typeof window === "undefined") return "inicio";
  const h = window.location.hash.replace("#", "") as AdminSection;
  return ADMIN_SECTIONS.includes(h) ? h : "inicio";
}

/** Demonstração com dados fictícios: só no ambiente local (`/admin?demo`), nunca no site. */
const demoLocal = () =>
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("demo");

function AdminPage() {
  const verify = useServerFn(verifyAdminPassword);
  const fetchFunnel = useServerFn(getAdminFunnel);

  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [entering, setEntering] = useState(false);
  const [section, setSection] = useState<AdminSection>("inicio");
  const [onlineNow, setOnlineNow] = useState<number | null>(null);

  // Auto-login from sessionStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (import.meta.env.DEV && demoLocal()) {
        const { ligarDemoAdmin } = await import("@/lib/admin-demo");
        ligarDemoAdmin();
        if (!cancelled) {
          setPassword("demo");
          setAuthed(true);
          setChecking(false);
        }
        return;
      }
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return setChecking(false);
      try {
        const r = await verify({ data: { password: stored } });
        if (cancelled) return;
        if (r.ok) {
          setPassword(stored);
          setAuthed(true);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verify]);

  useEffect(() => {
    setSection(secaoDoEndereco());
    const onHash = () => setSection(secaoDoEndereco());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // "No site agora" do menu: sessões ativas nos últimos 3 minutos.
  useEffect(() => {
    if (!authed || !password) return;
    let cancelled = false;
    const load = () =>
      fetchFunnel({ data: { password, windowMinutes: 5, onlineMinutes: 3 } })
        .then((r) => !cancelled && setOnlineNow(r.funnel.onlineNow))
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [authed, password, fetchFunnel]);

  const go = (s: AdminSection) => {
    setSection(s);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${s}`,
    );
    window.scrollTo({ top: 0 });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEntering(true);
    try {
      const r = await verify({ data: { password } });
      if (r.ok) {
        sessionStorage.setItem(STORAGE_KEY, password);
        setAuthed(true);
      } else {
        setError("Senha incorreta");
      }
    } catch {
      setError("Erro ao verificar senha");
    } finally {
      setEntering(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPassword("");
    setAuthed(false);
  };

  if (checking) {
    return (
      <div className="adm flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--adm-brand)]" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="adm flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            <img src="/marca/logo.webp" alt={brand.name} className="h-14 w-auto" />
          </div>
          <div className="rounded-2xl border border-[#e4e7ec] bg-white p-7 shadow-[0_12px_24px_-12px_rgba(16,24,40,0.18)]">
            <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[var(--adm-brand-soft)] text-[var(--adm-brand)]">
              <Lock className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-semibold text-[#101828]">Entrar no painel</h1>
            <p className="mb-6 mt-1 text-sm text-[#667085]">
              Acesso restrito à equipe da {brand.name}.
            </p>
            <form onSubmit={handleLogin} className="space-y-3">
              <Input
                type="password"
                placeholder="Senha do painel"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="h-11"
              />
              {error && <p className="text-sm text-[#b42318]">{error}</p>}
              <Button type="submit" className="h-11 w-full" disabled={entering || !password}>
                {entering ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminShell section={section} onSection={go} onlineNow={onlineNow} onLogout={logout}>
      {section === "inicio" && (
        <OverviewTab password={password} onVerPedidos={() => go("pedidos")} />
      )}
      {section === "pedidos" && <OrdersTab password={password} />}
      {section === "abandonos" && <AbandonedTab password={password} />}
      {section === "produtos" && <ProductsTab password={password} />}
      {section === "aovivo" && <LiveTab password={password} />}
      {section === "ajustes" && <SettingsTab password={password} />}
    </AdminShell>
  );
}
