/** Peças visuais do /admin: um só jeito de mostrar cartões, números, filtros e status. */
import type { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBundle, parseBundleId } from "@/lib/bundles";
import { iniciais } from "@/lib/admin-format";

/** Cabeçalho de cada tela: título, uma linha de explicação e as ações à direita. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight text-[#101828] sm:text-2xl">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-[#667085]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Bloco branco com título opcional. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-xl border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-[#eef0f3] px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-[#101828]">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-[#667085]">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Número de destaque (faturamento, pedidos...). */
export function Kpi({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "brand";
}) {
  const brand = tone === "brand";
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5",
        brand ? "border-transparent bg-[var(--adm-brand)] text-white" : "border-[#e4e7ec] bg-white",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-[13px] font-medium", brand ? "text-white/75" : "text-[#667085]")}>
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg [&_svg]:h-4 [&_svg]:w-4",
              brand ? "bg-white/12 text-white" : "bg-[#f2f4f7] text-[#475467]",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-2 text-[22px] font-semibold tabular-nums leading-tight sm:text-[26px]",
          brand ? "text-white" : "text-[#101828]",
        )}
      >
        {value}
      </div>
      {hint && (
        <div className={cn("mt-1 text-xs", brand ? "text-white/70" : "text-[#667085]")}>{hint}</div>
      )}
    </div>
  );
}

/** Botões lado a lado em que só um fica marcado (período, status...). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
  stretch,
}: {
  options: readonly { value: T; label: ReactNode; count?: number | undefined }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  /** Ocupa a largura toda no celular, com os botões divididos por igual. */
  stretch?: boolean;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex max-w-full overflow-x-auto rounded-lg border border-[#e4e7ec] bg-[#f2f4f7] p-0.5 [scrollbar-width:none]",
        stretch && "flex w-full sm:inline-flex sm:w-auto",
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors",
              stretch && "flex-1 px-2 sm:flex-none sm:px-3",
              on
                ? "bg-white text-[#101828] shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
                : "text-[#475467] hover:text-[#101828]",
            )}
          >
            {o.label}
            {o.count != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  on ? "bg-[#f2f4f7] text-[#344054]" : "bg-white/70 text-[#667085]",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const TONES = {
  green: "bg-[#ecfdf3] text-[#067647] ring-[#abefc6]",
  amber: "bg-[#fffaeb] text-[#b54708] ring-[#fedf89]",
  orange: "bg-[#fff6ed] text-[#c4320a] ring-[#fddcab]",
  red: "bg-[#fef3f2] text-[#b42318] ring-[#fecdca]",
  blue: "bg-[#eff8ff] text-[#175cd3] ring-[#b2ddff]",
  violet: "bg-[#f4f3ff] text-[#5925dc] ring-[#d9d6fe]",
  gray: "bg-[#f2f4f7] text-[#344054] ring-[#e4e7ec]",
} as const;
const DOTS = {
  green: "bg-[#17b26a]",
  amber: "bg-[#f79009]",
  orange: "bg-[#ef6820]",
  red: "bg-[#f04438]",
  blue: "bg-[#2e90fa]",
  violet: "bg-[#7a5af8]",
  gray: "bg-[#98a2b3]",
} as const;
export type Tone = keyof typeof TONES;

/** Selo de status com bolinha. */
export function Pill({
  tone = "gray",
  children,
  dot = true,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}

/** Lista ou tabela vazia. */
export function EmptyState({
  icon,
  title,
  text,
}: {
  icon?: ReactNode;
  title: string;
  text?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && (
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#f2f4f7] text-[#667085] [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
      )}
      <p className="text-sm font-semibold text-[#101828]">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[13px] text-[#667085]">{text}</p>}
    </div>
  );
}

/** Botão "Atualizar" com o giro enquanto carrega. */
export function RefreshButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d0d5dd] bg-white px-3 text-[13px] font-medium text-[#344054] shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      <span className="hidden sm:inline">Atualizar</span>
    </button>
  );
}

/** Botão secundário do painel (borda clara). */
export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border border-[#d0d5dd] bg-white px-3 text-[13px] font-medium text-[#344054] shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Círculo com as iniciais do cliente. */
export function Avatar({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--adm-brand-soft)] text-xs font-semibold text-[var(--adm-brand)]",
        className,
      )}
    >
      {iniciais(name)}
    </span>
  );
}

/** Foto do produto do catálogo (ou um quadrado neutro se o id não existir mais). */
export function ProductThumb({
  id,
  className,
}: {
  id: string | null | undefined;
  className?: string;
}) {
  const bid = parseBundleId(id ?? undefined);
  const src = bid ? getBundle(bid).img : null;
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={cn("h-9 w-9 shrink-0 rounded-lg border border-[#eef0f3] object-cover", className)}
    />
  ) : (
    <span className={cn("h-9 w-9 shrink-0 rounded-lg bg-[#f2f4f7]", className)} />
  );
}

/** Nome do produto sem as escolhas ("Pijama — Modelo: Preto · Tamanho: M" → partes). */
export function nomeEVariacao(bundleName: string | null | undefined) {
  const [nome, ...resto] = (bundleName ?? "").split(" — ");
  return { nome: nome || "—", variacao: resto.join(" — ") };
}

/** Cabeçalho comum dos cartões de Configurações: ícone, título, explicação e status. */
export function SettingHeader({
  icon,
  title,
  description,
  status,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#e4e7ec] bg-[#f9fafb] text-[#344054] [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-semibold text-[#101828]">{title}</h3>
          {status}
        </div>
        {description && (
          <p className="mt-0.5 text-[13px] leading-relaxed text-[#667085]">{description}</p>
        )}
      </div>
    </div>
  );
}

/** Cartão de uma integração/ajuste na tela de Configurações. */
export function SettingCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-[#e4e7ec] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
