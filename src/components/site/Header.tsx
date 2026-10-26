import { Link, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { CartButton, CartDrawer } from "@/components/site/CartDrawer";
import { Logo } from "@/components/site/Logo";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Links do menu. `hash` = âncora dentro da página do kit. */
export const NAV = [
  { to: "/", label: "Início" },
  { to: "/produto", label: "Projetor Laser Tag" },
  { to: "/produto", hash: "em-acao", label: "Veja em ação" },
  { to: "/produto", hash: "como-jogar", label: "Como jogar" },
] as const;

const help = [
  { href: "/rastreio", label: "Rastrear pedido" },
  { href: "/faq", label: "Dúvidas frequentes" },
  { href: "/contato", label: "Contato" },
  { href: "/sobre", label: "Sobre a loja" },
];

const iconBtn = "grid h-10 w-10 place-items-center text-[var(--ink)] transition hover:opacity-70";

function Drawer({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 lg:hidden" onClick={onClose}>
      <aside
        className="flex h-full w-[86%] max-w-sm flex-col overflow-y-auto border-r border-[var(--line)] bg-[#0a1030] animate-in slide-in-from-left duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <Logo size="sm" />
          <button type="button" aria-label="Fechar menu" className={iconBtn} onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="px-5 pt-3">
          <ul>
            {NAV.map((n) => (
              <li key={n.label}>
                <Link
                  to={n.to}
                  hash={"hash" in n ? n.hash : undefined}
                  onClick={onClose}
                  className="flex items-center justify-between border-b border-[var(--line)] py-4 font-display text-[22px] font-extrabold uppercase text-[var(--ink)]"
                >
                  {n.label}
                  <ArrowUpRight className="h-5 w-5 text-[var(--blue)]" />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/produto"
            onClick={onClose}
            className="btn-lime mt-6 h-14 w-full px-5"
          >
            Escolher meu kit <ArrowUpRight className="h-4 w-4" />
          </Link>
          <p className="eyebrow mb-1 mt-9 !text-[var(--slate)]">Ajuda</p>
          <ul className="pb-10">
            {help.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={onClose}
                  className="block py-2.5 text-[14px] text-[var(--ink)]"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}

export function Header() {
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const { path, hash } = useRouterState({
    select: (s) => ({ path: s.location.pathname, hash: s.location.hash }),
  });

  // Trava a rolagem da página com o menu aberto.
  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menu]);

  return (
    <header className="border-b border-[var(--line)] bg-[rgb(var(--fade-rgb)/0.78)] backdrop-blur-md">
      <div className="container-edge flex h-[64px] items-center justify-between gap-6 lg:h-[78px]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Abrir menu"
            className={`${iconBtn} -ml-2 lg:hidden`}
            onClick={() => setMenu(true)}
          >
            <Menu className="h-[22px] w-[22px]" strokeWidth={1.9} />
          </button>
          <Link to="/" aria-label={`${brand.name}: início`}>
            <Logo />
          </Link>
        </div>

        <nav className="hidden items-center gap-9 text-[13px] font-semibold text-[var(--ink)] lg:flex">
          {NAV.map((n) => {
            const on = "hash" in n ? path === n.to && hash === n.hash : path === n.to && !hash;
            return (
              <Link
                key={n.label}
                to={n.to}
                hash={"hash" in n ? n.hash : undefined}
                className={cn(
                  "relative whitespace-nowrap py-2 transition-colors hover:text-[var(--blue)]",
                  on &&
                    "text-[var(--blue)] after:absolute after:inset-x-0 after:-bottom-[2px] after:h-[2px] after:rounded after:bg-[var(--blue)]",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="-mr-2 flex items-center">
          <CartButton className={iconBtn} />
        </div>
      </div>
      <CartDrawer />

      {menu && <Drawer onClose={closeMenu} />}
    </header>
  );
}
