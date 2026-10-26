import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  CircleDollarSign,
  Clock,
  Copy,
  Download,
  MessageCircle,
  Receipt,
  Search,
} from "lucide-react";
import { getAdminOrders, type AdminOrder } from "@/lib/admin.functions";
import {
  brlCents,
  brlCompacto,
  fmtCpf,
  fmtDateTime,
  fmtPhone,
  isPaid,
  origemDoPedido,
  origemTexto,
  statusLabel,
  tempoRelativo,
  whatsappUrl,
} from "@/lib/admin-format";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  Avatar,
  EmptyState,
  GhostButton,
  Kpi,
  PageHeader,
  Panel,
  Pill,
  ProductThumb,
  RefreshButton,
  Segmented,
  nomeEVariacao,
} from "./kit";

export interface OrdersTabProps {
  password: string;
}

const PERIODS = [
  { value: 1, label: "Hoje" },
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 365, label: "1 ano" },
] as const;

type StatusFilter = "all" | "paid" | "pending";

function StatusPill({ status }: { status: string }) {
  return <Pill tone={status === "paid" ? "green" : "amber"}>{statusLabel(status)}</Pill>;
}

function OrigemCell({ order }: { order: AdminOrder }) {
  const o = origemDoPedido(order);
  return (
    <div className="max-w-[180px] text-xs">
      <div className={o.alerta ? "font-medium text-[#b54708]" : "font-medium text-[#344054]"}>
        {o.titulo}
      </div>
      {o.detalhe && (
        <div className="truncate text-[#667085]" title={o.detalhe}>
          {o.detalhe}
        </div>
      )}
    </div>
  );
}

/** Aba de pedidos: lista, filtros, busca, detalhes completos e exportação CSV. */
export function OrdersTab({ password }: OrdersTabProps) {
  const fetchOrders = useServerFn(getAdminOrders);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchOrders({ data: { password, days } });
      setOrders(r.orders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, days]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return orders.filter((o) => {
      if (status === "paid" && !isPaid(o)) return false;
      if (status === "pending" && isPaid(o)) return false;
      if (!q) return true;
      const c = o.customer ?? ({} as AdminOrder["customer"]);
      return (
        o.id.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        o.bundle_name?.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && (c.cpf?.includes(qDigits) || c.phone?.includes(qDigits)))
      );
    });
  }, [orders, status, query]);

  const stats = useMemo(() => {
    const paid = orders.filter(isPaid);
    const revenue = paid.reduce((s, o) => s + o.amount_cents, 0);
    return {
      total: orders.length,
      paid: paid.length,
      pending: orders.length - paid.length,
      revenue,
      ticket: paid.length ? Math.round(revenue / paid.length) : 0,
      conv: orders.length ? Math.round((paid.length / orders.length) * 100) : 0,
    };
  }, [orders]);

  const exportCsv = () => {
    const header = [
      "Data",
      "ID",
      "Status",
      "Nome",
      "Email",
      "Telefone",
      "CPF",
      "Endereço",
      "Plano",
      "Frete",
      "Valor",
      "Origem",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "Pago em",
    ];
    // Texto que começa com = + - @ vira fórmula no Excel: o apóstrofo faz ele ficar só texto.
    const esc = (v: unknown) => {
      const t = String(v ?? "");
      return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
    };
    const lines = filtered.map((o) => {
      const c = o.customer ?? ({} as AdminOrder["customer"]);
      const u = o.utm ?? {};
      return [
        fmtDateTime(o.created_at),
        o.id,
        statusLabel(o.status),
        c.name,
        c.email,
        c.phone,
        c.cpf,
        c.endereco,
        o.bundle_name,
        c.frete?.name,
        (o.amount_cents / 100).toFixed(2).replace(".", ","),
        origemTexto(o),
        u.utm_source,
        u.utm_medium,
        u.utm_campaign,
        u.utm_content,
        u.utm_term,
        isPaid(o) ? fmtDateTime(o.paid_reported_at ?? o.updated_at) : "",
      ]
        .map(esc)
        .join(";");
    });
    const blob = new Blob(["﻿" + [header.map(esc).join(";"), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <PageHeader
        title="Pedidos"
        description="Todos os pedidos da loja, com cliente, produto, pagamento e origem."
        actions={
          <>
            <RefreshButton loading={loading} onClick={load} />
            <GhostButton onClick={exportCsv} disabled={!filtered.length}>
              <Download /> <span className="hidden sm:inline">Exportar</span> CSV
            </GhostButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          tone="brand"
          label="Faturamento"
          icon={<CircleDollarSign />}
          value={brlCompacto(stats.revenue)}
          hint="somente pedidos pagos"
        />
        <Kpi
          label="Pagos"
          icon={<BadgeCheck />}
          value={stats.paid}
          hint={`${stats.conv}% dos ${stats.total} pedidos`}
        />
        <Kpi label="Aguardando" icon={<Clock />} value={stats.pending} hint="Pix ainda não pago" />
        <Kpi label="Ticket médio" icon={<Receipt />} value={brlCents(stats.ticket)} />
      </div>

      <Panel className="mt-4" bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-[#eef0f3] p-4 lg:flex-row lg:items-center">
          <Segmented options={PERIODS} value={days} onChange={setDays} stretch />
          <Segmented
            options={[
              { value: "all" as const, label: "Todos", count: stats.total },
              { value: "paid" as const, label: "Pagos", count: stats.paid },
              { value: "pending" as const, label: "Aguardando", count: stats.pending },
            ]}
            value={status}
            onChange={setStatus}
            stretch
          />
          <label className="relative lg:ml-auto lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
            <input
              className="h-9 w-full rounded-lg border border-[#d0d5dd] bg-white pl-9 pr-3 text-sm text-[#101828] shadow-[0_1px_2px_rgba(16,24,40,0.05)] outline-none placeholder:text-[#98a2b3] focus:border-[var(--adm-brand)] focus:ring-2 focus:ring-[var(--adm-brand-soft)]"
              placeholder="Buscar cliente, CPF, telefone, produto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {error && <p className="px-5 pt-4 text-sm text-[#b42318]">{error}</p>}

        {filtered.length === 0 && !loading ? (
          <EmptyState
            icon={<Receipt />}
            title="Nenhum pedido encontrado"
            text={query ? "Tente outra busca ou mude o período." : "Mude o período para ver mais."}
          />
        ) : (
          <>
            {/* Celular: um cartão por pedido */}
            <ul className="divide-y divide-[#eef0f3] md:hidden">
              {filtered.map((o) => {
                const { nome } = nomeEVariacao(o.bundle_name);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(o)}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-[#f9fafb]"
                    >
                      <ProductThumb id={o.bundle_id} className="h-11 w-11" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[#101828]">
                            {o.customer?.name || "Cliente"}
                          </p>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-[#101828]">
                            {brlCents(o.amount_cents)}
                          </p>
                        </div>
                        <p className="truncate text-xs text-[#667085]">{nome}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <StatusPill status={o.status} />
                          <span className="text-xs text-[#98a2b3]">
                            {tempoRelativo(o.created_at)}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Computador: tabela */}
            <div className="hidden max-h-[720px] overflow-auto md:block">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#f9fafb] text-left text-xs font-medium text-[#667085]">
                  <tr className="border-b border-[#eef0f3]">
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Produto</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Origem</th>
                    <th className="px-5 py-3 text-right font-medium">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f3]">
                  {filtered.map((o) => {
                    const { nome, variacao } = nomeEVariacao(o.bundle_name);
                    return (
                      <tr
                        key={o.id}
                        className="cursor-pointer hover:bg-[#f9fafb]"
                        onClick={() => setSelected(o)}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={o.customer?.name} />
                            <div className="min-w-0">
                              <div className="max-w-[170px] truncate font-medium text-[#101828]">
                                {o.customer?.name || "Cliente"}
                              </div>
                              <div className="max-w-[170px] truncate text-xs text-[#667085]">
                                {o.customer?.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <ProductThumb id={o.bundle_id} />
                            <div className="min-w-0">
                              <div className="max-w-[220px] truncate text-[#101828]">{nome}</div>
                              {variacao && (
                                <div
                                  className="max-w-[220px] truncate text-xs text-[#667085]"
                                  title={variacao}
                                >
                                  {variacao}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-[#101828]">
                          {brlCents(o.amount_cents)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <StatusPill status={o.status} />
                            <UtmifyFalha order={o} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <OrigemCell order={o} />
                        </td>
                        <td
                          className="whitespace-nowrap px-5 py-3 text-right text-xs text-[#667085]"
                          title={fmtDateTime(o.created_at)}
                        >
                          {tempoRelativo(o.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <OrderSheet order={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function OrderSheet({ order: o, onClose }: { order: AdminOrder | null; onClose: () => void }) {
  return (
    <Sheet open={!!o} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="adm w-full overflow-y-auto border-l border-[#e4e7ec] bg-white p-0 sm:max-w-lg"
      >
        {o && <OrderDetails o={o} />}
      </SheetContent>
    </Sheet>
  );
}

function OrderDetails({ o }: { o: AdminOrder }) {
  const c = o.customer ?? ({} as AdminOrder["customer"]);
  const utmEntries = Object.entries(o.utm ?? {}).filter(([, v]) => v);
  const { nome, variacao } = nomeEVariacao(o.bundle_name);
  const og = origemDoPedido(o);
  return (
    <div>
      <div className="border-b border-[#eef0f3] px-6 pb-5 pt-6">
        <div className="flex items-center gap-2">
          <StatusPill status={o.status} />
          <span className="font-mono text-xs text-[#98a2b3]">{o.id}</span>
        </div>
        <SheetTitle className="mt-3 text-xl font-semibold text-[#101828]">
          {c.name || "Cliente"}
        </SheetTitle>
        <SheetDescription className="mt-0.5 text-sm text-[#667085]">
          {fmtDateTime(o.created_at)} · {brlCents(o.amount_cents)}
        </SheetDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          {c.phone && (
            <a
              href={whatsappUrl(c.phone)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#16a34a] px-3 text-[13px] font-semibold text-white hover:bg-[#15803d]"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          {c.email && (
            <a
              href={`mailto:${c.email}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d0d5dd] bg-white px-3 text-[13px] font-medium text-[#344054] hover:bg-[#f9fafb]"
            >
              E-mail
            </a>
          )}
        </div>
      </div>

      <div className="space-y-6 px-6 py-5">
        <div className="flex items-center gap-3 rounded-xl border border-[#eef0f3] bg-[#f9fafb] p-3">
          <ProductThumb id={o.bundle_id} className="h-14 w-14" />
          <div className="min-w-0">
            <p className="font-medium text-[#101828]">{nome}</p>
            {variacao && <p className="text-xs text-[#667085]">{variacao}</p>}
          </div>
        </div>

        {c.qrcode && <PixCode code={c.qrcode} paid={isPaid(o)} />}

        <Section title="Cliente">
          <Row label="Nome" value={c.name} />
          <Row label="E-mail" value={c.email} />
          <Row label="Telefone" value={c.phone ? fmtPhone(c.phone) : null} />
          <Row label="CPF" value={c.cpf ? fmtCpf(c.cpf) : null} />
          <Row label="Endereço" value={c.endereco} />
        </Section>

        <Section title="Pagamento">
          <Row label="Valor total" value={brlCents(o.amount_cents)} />
          <Row
            label="Forma"
            value={
              c.method === "card"
                ? `Cartão${c.card?.brand ? ` ${c.card.brand}` : ""}${c.card?.lastDigits ? ` final ${c.card.lastDigits}` : ""} — ${c.installments ?? 1}x`
                : `Pix${c.discount ? ` (desconto ${brlCents(Math.round(c.discount * 100))})` : ""}`
            }
          />
          <Row
            label="Frete"
            value={
              c.frete
                ? `${c.frete.name} — ${c.frete.price ? brlCents(Math.round(c.frete.price * 100)) : "Grátis"}`
                : null
            }
          />
          <Row label="Plano" value={o.bundle_id} />
          <Row label="Criado em" value={fmtDateTime(o.created_at)} />
          <Row
            label="Pago em"
            value={isPaid(o) ? fmtDateTime(o.paid_reported_at ?? o.updated_at) : null}
          />
          <Row label="Atualizado em" value={fmtDateTime(o.updated_at)} />
        </Section>

        <Section title="Origem">
          <Row
            label="Origem"
            value={
              <span className={og.alerta ? "text-[#b54708]" : undefined}>
                {[og.titulo, og.detalhe].filter(Boolean).join(" · ")}
              </span>
            }
          />
          {utmEntries.map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
          <Row label="URL" value={o.url} />
          <Row label="UTMify" value={<UtmifyBadge order={o} />} />
        </Section>

        <Section title="Técnico">
          <Row label="IP" value={o.ip} />
          <Row label="Navegador" value={o.ua} />
          <Row label="fbp" value={o.fbp} />
          <Row label="fbc" value={o.fbc} />
          <Row
            label="Reportado"
            value={o.paid_reported_at ? fmtDateTime(o.paid_reported_at) : null}
          />
          {o.report_result != null && (
            <pre className="mt-2 overflow-x-auto rounded-lg bg-[#f2f4f7] p-3 text-[11px] text-[#344054]">
              {JSON.stringify(o.report_result, null, 2)}
            </pre>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#98a2b3]">
        {title}
      </h3>
      <dl className="divide-y divide-[#f2f4f7] rounded-xl border border-[#eef0f3]">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 px-3 py-2 text-[13px]">
      <dt className="text-[#667085]">{label}</dt>
      <dd className="break-words text-[#101828]">{value || "—"}</dd>
    </div>
  );
}

/** Resultado do envio à UTMify para este pedido (pago ou, se não pago, o aviso de pendente). */
function UtmifyBadge({ order: o }: { order: AdminOrder }) {
  const rr = (o.report_result ?? {}) as Record<
    string,
    { ok?: boolean; status?: number; error?: string } | undefined
  >;
  const r = isPaid(o) ? rr["utmify"] : rr["utmifyPending"];
  if (!r) return <span className="text-xs text-[#98a2b3]">—</span>;
  if (r.ok) return <Pill tone="green">Enviado</Pill>;
  return (
    <span title={`${r.status ?? ""} ${r.error ?? ""}`.trim()} className="cursor-help">
      <Pill tone="red">
        {r.error === "Token não configurado"
          ? "Sem token"
          : `Recusado${r.status ? ` (${r.status})` : ""}`}
      </Pill>
    </span>
  );
}

/** Na tabela, a UTMify só aparece quando o envio falhou (o detalhe mostra sempre). */
function UtmifyFalha({ order: o }: { order: AdminOrder }) {
  const rr = (o.report_result ?? {}) as Record<string, { ok?: boolean } | undefined>;
  const r = isPaid(o) ? rr["utmify"] : rr["utmifyPending"];
  if (!r || r.ok) return null;
  return <UtmifyBadge order={o} />;
}

/** Pix copia e cola gerado para o pedido, com botão de copiar (para reenviar ao cliente). */
function PixCode({ code, paid }: { code: string; paid: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // área de transferência indisponível
    }
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#98a2b3]">
          Pix copia e cola
        </h3>
        <GhostButton onClick={copy} className="h-8">
          <Copy /> {copied ? "Copiado!" : "Copiar código"}
        </GhostButton>
      </div>
      <p className="max-h-24 overflow-y-auto break-all rounded-xl border border-[#eef0f3] bg-[#f9fafb] p-3 font-mono text-[11px] text-[#475467]">
        {code}
      </p>
      <p className="mt-1.5 text-xs text-[#667085]">
        {paid
          ? "Este Pix já foi pago."
          : "O código vale por 30 minutos depois de gerado. Depois disso, o cliente precisa gerar um novo."}
      </p>
    </div>
  );
}
