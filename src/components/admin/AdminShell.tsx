/** Moldura do /admin: menu lateral no computador e barra de abas embaixo no celular. */
import type { ReactNode } from "react";
import {
  Activity,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";

export type AdminSection = "inicio" | "pedidos" | "abandonos" | "produtos" | "aovivo" | "ajustes";

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  "inicio",
  "pedidos",
  "abandonos",
  "produtos",
  "aovivo",
  "ajustes",
];

const NAV: {
  grupo: string;
  itens: { id: AdminSection; label: string; curto: string; icon: ReactNode }[];
}[] = [
  {
    grupo: "Vendas",
    itens: [
      { id: "inicio", label: "Visão geral", curto: "Início", icon: <LayoutDashboard /> },
      { id: "pedidos", label: "Pedidos", curto: "Pedidos", icon: <Receipt /> },
      {
        id: "abandonos",
        label: "Carrinhos abandonados",
        curto: "Abandonos",
        icon: <ShoppingCart />,
      },
    ],
  },
  {
    grupo: "Loja",
    itens: [
      { id: "produtos", label: "Produtos", curto: "Produtos", icon: <Package /> },
      { id: "aovivo", label: "Tráfego ao vivo", curto: "Ao vivo", icon: <Activity /> },
      { id: "ajustes", label: "Configurações", curto: "Ajustes", icon: <Settings /> },
    ],
  },
];

function OnlineBadge({ onlineNow }: { onlineNow: number | null }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#ecfdf3] px-2.5 py-1 text-xs font-medium text-[#067647]">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#17b26a] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#17b26a]" />
      </span>
      {onlineNow == null ? "Ao vivo" : `${onlineNow} no site agora`}
    </span>
  );
}

export function AdminShell({
  section,
  onSection,
  onlineNow,
  onLogout,
  children,
}: {
  section: AdminSection;
  onSection: (s: AdminSection) => void;
  onlineNow: number | null;
  onLogout: () => void;
  children: ReactNode;
}) {
  const itens = NAV.flatMap((g) => g.itens);
  return (
    <div className="adm min-h-screen">
      {/* Menu lateral (computador) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-[#e4e7ec] bg-white lg:flex">
        <div className="flex h-[68px] items-center gap-3 border-b border-[#eef0f3] px-5">
          <img src="/marca/logo.webp" alt={brand.name} className="h-9 w-auto" />
          <span className="rounded-md bg-[#f2f4f7] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#475467]">
            Painel
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((g) => (
            <div key={g.grupo} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#98a2b3]">
                {g.grupo}
              </p>
              <ul className="space-y-0.5">
                {g.itens.map((it) => {
                  const on = it.id === section;
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => onSection(it.id)}
                        aria-current={on ? "page" : undefined}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors [&_svg]:h-[18px] [&_svg]:w-[18px]",
                          on
                            ? "bg-[var(--adm-brand-soft)] text-[var(--adm-brand)]"
                            : "text-[#344054] hover:bg-[#f9fafb] [&_svg]:text-[#667085]",
                        )}
                      >
                        {it.icon}
                        {it.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="space-y-3 border-t border-[#eef0f3] p-4">
          <OnlineBadge onlineNow={onlineNow} />
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-[#475467] hover:bg-[#f9fafb]"
          >
            <ExternalLink className="h-4 w-4" /> Abrir a loja
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-[#475467] hover:bg-[#f9fafb]"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Barra do topo (celular) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[#e4e7ec] bg-white/95 px-4 backdrop-blur lg:hidden">
        <img src="/marca/logo.webp" alt={brand.name} className="h-8 w-auto" />
        <div className="flex items-center gap-2">
          <OnlineBadge onlineNow={onlineNow} />
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sair"
            className="grid h-9 w-9 place-items-center rounded-lg text-[#475467] hover:bg-[#f2f4f7]"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <main className="lg:pl-[248px]">
        <div className="mx-auto w-full max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </div>
      </main>

      {/* Abas de baixo (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e4e7ec] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="grid grid-cols-6">
          {itens.map((it) => {
            const on = it.id === section;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onSection(it.id)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex w-full flex-col items-center gap-1 pb-2 pt-2.5 text-[10.5px] font-medium [&_svg]:h-5 [&_svg]:w-5",
                    on ? "text-[var(--adm-brand)]" : "text-[#667085]",
                  )}
                >
                  {it.icon}
                  {it.curto}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
