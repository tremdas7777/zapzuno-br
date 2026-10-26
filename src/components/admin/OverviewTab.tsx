/** Visão geral do /admin: o resumo do período em uma tela (vendas, funil, produtos e origem). */
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BadgeCheck, CircleDollarSign, Percent, Receipt } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getAdminFunnel, getAdminOrders, type AdminOrder } from "@/lib/admin.functions";
import {
  brlCents,
  brlCompacto,
  inicioDoPeriodo,
  isPaid,
  origemDoPedido,
  statusLabel,
  tempoRelativo,
} from "@/lib/admin-format";
import { getBundle, parseBundleId } from "@/lib/bundles";
import {
  Avatar,
  EmptyState,
  Kpi,
  PageHeader,
  Panel,
  Pill,
  ProductThumb,
  RefreshButton,
  Segmented,
  nomeEVariacao,
} from "./kit";

const PERIODOS = [
  { value: 1, label: "Hoje" },
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
] as const;

type Funnel = { visited: number; viewedProduct: number; checkout: number };

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

const horaBrt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  hourCycle: "h23",
});
const diaBrt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});

/** Faturamento pago e pedidos por hora (hoje) ou por dia (7/30 dias). */
function serie(orders: AdminOrder[], days: number) {
  const agora = Date.now();
  const buckets: { rotulo: string; faturamento: number; pedidos: number }[] = [];
  const idx = new Map<string, number>();
  if (days === 1) {
    const horaAtual = Number(horaBrt.format(agora));
    for (let h = 0; h <= horaAtual; h++) {
      idx.set(String(h).padStart(2, "0"), buckets.length);
      buckets.push({ rotulo: `${h}h`, faturamento: 0, pedidos: 0 });
    }
  } else {
    const inicio = inicioDoPeriodo(days, agora);
    for (let d = 0; d < days; d++) {
      const rotulo = diaBrt.format(inicio + d * 86_400_000 + 12 * 3_600_000);
      idx.set(rotulo, buckets.length);
      buckets.push({ rotulo, faturamento: 0, pedidos: 0 });
    }
  }
  for (const o of orders) {
    const t = new Date(o.created_at).getTime();
    const chave = days === 1 ? horaBrt.format(t) : diaBrt.format(t);
    const i = idx.get(chave);
    if (i == null) continue;
    buckets[i]!.pedidos++;
    if (isPaid(o)) buckets[i]!.faturamento += o.amount_cents / 100;
  }
  return buckets;
}

function GraficoVendas({ dados }: { dados: ReturnType<typeof serie> }) {
  const temVenda = dados.some((d) => d.faturamento > 0);
  if (!temVenda) return <EmptyState title="Nenhuma venda paga neste período" />;
  return (
    <div className="h-[240px] w-full text-[var(--adm-brand)]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis
            dataKey="rotulo"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#98a2b3" }}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontSize: 11, fill: "#98a2b3" }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `R$${(v / 1000).toLocaleString("pt-BR")}k` : `R$${v}`
            }
          />
          <Tooltip
            cursor={{ fill: "#f2f4f7" }}
            content={({ active, payload, label }) => {
              const p = payload?.[0]?.payload as (typeof dados)[number] | undefined;
              if (!active || !p) return null;
              return (
                <div className="rounded-lg border border-[#e4e7ec] bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold text-[#101828]">{label}</p>
                  <p className="mt-1 text-[#475467]">
                    Faturamento:{" "}
                    <b className="text-[#101828]">{brlCents(Math.round(p.faturamento * 100))}</b>
                  </p>
                  <p className="text-[#475467]">
                    Pedidos: <b className="text-[#101828]">{p.pedidos}</b>
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="faturamento" fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Funil({ etapas }: { etapas: { label: string; n: number }[] }) {
  const topo = etapas[0]?.n ?? 0;
  return (
    <ol className="space-y-4">
      {etapas.map((e, i) => {
        const anterior = i === 0 ? e.n : etapas[i - 1]!.n;
        const largura = topo ? Math.max(2, (e.n / topo) * 100) : 0;
        return (
          <li key={e.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-[#344054]">{e.label}</span>
              <span className="tabular-nums text-[#667085]">
                <b className="text-[#101828]">{e.n.toLocaleString("pt-BR")}</b>
                {i > 0 && <span className="ml-1.5">{pct(e.n, anterior)}% da etapa anterior</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#f2f4f7]">
              <div
                className="h-full rounded-full bg-[var(--adm-brand)] transition-[width] duration-500"
                style={{ width: `${largura}%`, opacity: 1 - i * 0.12 }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function OverviewTab({
  password,
  onVerPedidos,
}: {
  password: string;
  onVerPedidos: () => void;
}) {
  const fetchOrders = useServerFn(getAdminOrders);
  const fetchFunnel = useServerFn(getAdminFunnel);
  const [days, setDays] = useState<number>(1);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const minutos = Math.ceil((Date.now() - inicioDoPeriodo(days)) / 60_000);
      const [o, f] = await Promise.all([
        fetchOrders({ data: { password, days } }),
        fetchFunnel({
          data: {
            password,
            windowMinutes: Math.min(60 * 24 * 30, Math.max(5, minutos)),
            onlineMinutes: 3,
          },
        }),
      ]);
      setOrders(o.orders);
      setFunnel(f.funnel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, days]);

  const s = useMemo(() => {
    const pagos = orders.filter(isPaid);
    const faturamento = pagos.reduce((t, o) => t + o.amount_cents, 0);
    return {
      pagos,
      faturamento,
      gerados: orders.length,
      aguardando: orders.length - pagos.length,
      ticket: pagos.length ? Math.round(faturamento / pagos.length) : 0,
      aprovacao: pct(pagos.length, orders.length),
    };
  }, [orders]);

  const dados = useMemo(() => serie(orders, days), [orders, days]);

  const topProdutos = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; qtd: number; total: number }>();
    for (const o of s.pagos) {
      const bid = parseBundleId(o.bundle_id);
      const nome = bid ? getBundle(bid).name : nomeEVariacao(o.bundle_name).nome;
      const k = bid ?? o.bundle_id;
      const cur = m.get(k) ?? { id: o.bundle_id, nome, qtd: 0, total: 0 };
      cur.qtd++;
      cur.total += o.amount_cents;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [s.pagos]);

  const origens = useMemo(() => {
    const m = new Map<string, { titulo: string; qtd: number; total: number; alerta: boolean }>();
    for (const o of s.pagos) {
      const og = origemDoPedido(o);
      const cur = m.get(og.titulo) ?? { titulo: og.titulo, qtd: 0, total: 0, alerta: !!og.alerta };
      cur.qtd++;
      cur.total += o.amount_cents;
      m.set(og.titulo, cur);
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 6);
  }, [s.pagos]);

  const etapas = [
    { label: "Visitaram a loja", n: funnel?.visited ?? 0 },
    { label: "Viram um produto", n: funnel?.viewedProduct ?? 0 },
    { label: "Foram para o checkout", n: funnel?.checkout ?? 0 },
    { label: "Geraram o Pix", n: s.gerados },
    { label: "Pagaram", n: s.pagos.length },
  ];

  const recentes = orders.slice(0, 6);
  const periodoTexto = days === 1 ? "hoje" : `nos últimos ${days} dias`;

  return (
    <div>
      <PageHeader
        title="Visão geral"
        description={`Como a loja está indo ${periodoTexto}.`}
        actions={
          <>
            <Segmented options={PERIODOS} value={days} onChange={setDays} />
            <RefreshButton loading={loading} onClick={load} />
          </>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg border border-[#fecdca] bg-[#fef3f2] px-4 py-3 text-sm text-[#b42318]">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          tone="brand"
          label="Faturamento"
          icon={<CircleDollarSign />}
          value={brlCompacto(s.faturamento)}
          hint={`${s.pagos.length} ${s.pagos.length === 1 ? "pedido pago" : "pedidos pagos"}`}
        />
        <Kpi
          label="Pedidos pagos"
          icon={<BadgeCheck />}
          value={s.pagos.length}
          hint={`${s.aguardando} aguardando pagamento`}
        />
        <Kpi
          label="Aprovação do Pix"
          icon={<Percent />}
          value={`${s.aprovacao}%`}
          hint={`${s.pagos.length} de ${s.gerados} Pix gerados`}
        />
        <Kpi
          label="Ticket médio"
          icon={<Receipt />}
          value={brlCents(s.ticket)}
          hint={`conversão da loja ${pct(s.pagos.length, funnel?.visited ?? 0)}%`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title={days === 1 ? "Vendas por hora" : "Vendas por dia"}
          description="Faturamento dos pedidos pagos"
        >
          <GraficoVendas dados={dados} />
        </Panel>
        <Panel
          className="lg:col-span-2"
          title="Funil de vendas"
          description="Pessoas únicas em cada etapa"
        >
          <Funil etapas={etapas} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Últimos pedidos"
          action={
            <button
              type="button"
              onClick={onVerPedidos}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--adm-brand)] hover:underline"
            >
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </button>
          }
          bodyClassName="p-0"
        >
          {recentes.length === 0 ? (
            <EmptyState icon={<Receipt />} title="Nenhum pedido neste período" />
          ) : (
            <ul className="divide-y divide-[#eef0f3]">
              {recentes.map((o) => {
                const { nome } = nomeEVariacao(o.bundle_name);
                return (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={o.customer?.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#101828]">
                        {o.customer?.name || "Cliente"}
                      </p>
                      <p className="truncate text-xs text-[#667085]">
                        {nome} · {tempoRelativo(o.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-[#101828]">
                        {brlCents(o.amount_cents)}
                      </p>
                      <Pill tone={isPaid(o) ? "green" : "amber"} className="mt-0.5">
                        {statusLabel(o.status)}
                      </Pill>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="grid min-w-0 gap-4 lg:col-span-2">
          <Panel title="Mais vendidos" description="Pelos pedidos pagos" bodyClassName="p-0">
            {topProdutos.length === 0 ? (
              <EmptyState title="Sem vendas pagas ainda" />
            ) : (
              <ul className="divide-y divide-[#eef0f3]">
                {topProdutos.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-4 text-xs font-semibold tabular-nums text-[#98a2b3]">
                      {i + 1}
                    </span>
                    <ProductThumb id={p.id} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#101828]">{p.nome}</p>
                      <p className="text-xs text-[#667085]">
                        {p.qtd} {p.qtd === 1 ? "pedido" : "pedidos"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-[#101828]">
                      {brlCents(p.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="De onde vêm as vendas" description="Origem dos pedidos pagos">
            {origens.length === 0 ? (
              <p className="text-sm text-[#667085]">Sem vendas pagas ainda.</p>
            ) : (
              <ul className="space-y-3">
                {origens.map((og) => (
                  <li key={og.titulo}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                      <span
                        className={
                          og.alerta ? "font-medium text-[#b54708]" : "font-medium text-[#344054]"
                        }
                      >
                        {og.titulo}
                      </span>
                      <span className="tabular-nums text-[#667085]">
                        {og.qtd} · <b className="text-[#101828]">{brlCents(og.total)}</b>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#f2f4f7]">
                      <div
                        className={og.alerta ? "h-full bg-[#f79009]" : "h-full bg-[#2e90fa]"}
                        style={{ width: `${pct(og.total, s.faturamento)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
