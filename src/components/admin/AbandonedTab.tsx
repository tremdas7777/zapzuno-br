import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CircleDollarSign, MessageCircle, QrCode, ShoppingCart, UserRound } from "lucide-react";
import {
  getAbandonedCheckouts,
  type AbandonedCheckout,
  type AbandonStep,
} from "@/lib/admin.functions";
import { brand } from "@/lib/brand";
import { brl, fmtDateTime, fmtPhone, tempoRelativo, whatsappUrl } from "@/lib/admin-format";
import {
  Avatar,
  EmptyState,
  Kpi,
  PageHeader,
  Panel,
  Pill,
  RefreshButton,
  Segmented,
  type Tone,
} from "./kit";

const PERIODS = [
  { value: 1, label: "Hoje" },
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
] as const;

/** Onde a pessoa parou (etapa mais avançada que ela chegou). */
const STEP_INFO: Record<AbandonStep, { label: string; tone: Tone }> = {
  checkout: { label: "Entrou e saiu", tone: "gray" },
  dados: { label: "Parou na entrega", tone: "amber" },
  entrega: { label: "Parou no pagamento", tone: "orange" },
  pix: { label: "Gerou Pix e não pagou", tone: "red" },
};

const FUNNEL: { key: AbandonStep | "pago"; label: string }[] = [
  { key: "checkout", label: "Entraram no checkout" },
  { key: "dados", label: "Preencheram os dados" },
  { key: "entrega", label: "Preencheram a entrega" },
  { key: "pix", label: "Geraram o Pix" },
  { key: "pago", label: "Pagaram" },
];

function mensagem(r: AbandonedCheckout) {
  const first = (r.name ?? "").split(/\s+/)[0];
  const produto = r.plano ?? brand.name;
  return r.step === "pix"
    ? `Oi ${first}! Vi que você gerou o Pix do seu pedido (${produto}) e ainda não finalizou. Posso te ajudar com alguma dúvida?`
    : `Oi ${first}! Vi que você começou seu pedido (${produto}) no nosso site. Ficou alguma dúvida? Estou aqui pra te ajudar.`;
}

function StepPill({ r }: { r: AbandonedCheckout }) {
  const info = STEP_INFO[r.step];
  return r.pixPending ? (
    <Pill tone="blue">Pix gerado (aguardando)</Pill>
  ) : (
    <Pill tone={info.tone}>{info.label}</Pill>
  );
}

function ChamarButton({ r, compact }: { r: AbandonedCheckout; compact?: boolean }) {
  if (!r.phone) return null;
  return (
    <a
      href={whatsappUrl(r.phone, mensagem(r))}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#16a34a] px-2.5 text-xs font-semibold text-white hover:bg-[#15803d]"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {compact ? "Chamar" : "Chamar no WhatsApp"}
    </a>
  );
}

export function AbandonedTab({ password }: { password: string }) {
  const fetchFn = useServerFn(getAbandonedCheckouts);
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    funnel: Record<AbandonStep | "pago", number>;
    rows: AbandonedCheckout[];
  } | null>(null);
  const [filter, setFilter] = useState<AbandonStep | "todos">("todos");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchFn({ data: { password, days } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, days]);

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    // "Entrou e saiu" não tem contato; só aparece quando filtrado.
    return filter === "todos"
      ? all.filter((r) => r.step !== "checkout")
      : all.filter((r) => r.step === filter);
  }, [data, filter]);

  const counts = useMemo(() => {
    const c: Record<AbandonStep, number> = { checkout: 0, dados: 0, entrega: 0, pix: 0 };
    for (const r of data?.rows ?? []) c[r.step]++;
    return c;
  }, [data]);

  const comContato = (data?.rows ?? []).filter((r) => r.step !== "checkout");
  const valorParado = comContato.reduce((t, r) => t + (r.value ?? 0), 0);
  const top = data?.funnel.checkout || 0;

  return (
    <div>
      <PageHeader
        title="Carrinhos abandonados"
        description="Quem começou a comprar e não terminou. Chame no WhatsApp para recuperar a venda."
        actions={
          <>
            <Segmented options={PERIODS} value={days} onChange={setDays} />
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
          label="Para recuperar"
          icon={<UserRound />}
          value={comContato.length}
          hint="deixaram nome e telefone"
        />
        <Kpi
          label="Pix não pagos"
          icon={<QrCode />}
          value={counts.pix}
          hint="geraram o Pix e saíram"
        />
        <Kpi
          label="Valor parado"
          icon={<CircleDollarSign />}
          value={brl(valorParado)}
          hint="soma dos carrinhos com contato"
        />
        <Kpi
          label="Entraram e saíram"
          icon={<ShoppingCart />}
          value={counts.checkout}
          hint="sem deixar contato"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-1 lg:self-start"
          title="Onde as pessoas desistem"
          description="Do checkout até o pagamento"
        >
          <ol className="space-y-4">
            {FUNNEL.map((f, i) => {
              const n = data?.funnel[f.key] ?? 0;
              const prev = i === 0 ? n : (data?.funnel[FUNNEL[i - 1]!.key] ?? 0);
              const pct = top ? Math.round((n / top) * 100) : 0;
              const lost = i === 0 ? 0 : prev - n;
              return (
                <li key={f.key}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-medium text-[#344054]">{f.label}</span>
                    <span className="tabular-nums text-[#667085]">
                      <b className="text-[#101828]">{n}</b> · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f2f4f7]">
                    <div
                      className={
                        f.key === "pago"
                          ? "h-full rounded-full bg-[#17b26a]"
                          : "h-full rounded-full bg-[var(--adm-brand)]"
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {lost > 0 && (
                    <p className="mt-1 text-xs text-[#b42318]">−{lost} desistiram aqui</p>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-5 text-xs leading-relaxed text-[#98a2b3]">
            Quem pagou (mesmo em outra visita, pelo e-mail) não aparece como abandono.
          </p>
        </Panel>

        <Panel className="lg:col-span-2" bodyClassName="p-0">
          <div className="border-b border-[#eef0f3] p-4">
            <Segmented
              options={[
                {
                  value: "todos" as const,
                  label: "Com contato",
                  count: counts.dados + counts.entrega + counts.pix,
                },
                { value: "pix" as const, label: "Pix não pago", count: counts.pix },
                { value: "entrega" as const, label: "No pagamento", count: counts.entrega },
                { value: "dados" as const, label: "Na entrega", count: counts.dados },
                { value: "checkout" as const, label: "Sem contato", count: counts.checkout },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </div>

          {rows.length === 0 && !loading ? (
            <EmptyState
              icon={<ShoppingCart />}
              title="Nenhum carrinho abandonado aqui"
              text="Mude o período ou o filtro para ver outros."
            />
          ) : (
            <ul className="max-h-[720px] divide-y divide-[#eef0f3] overflow-y-auto">
              {rows.map((r) => (
                <li
                  key={r.sessionId}
                  className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Avatar name={r.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-sm font-semibold text-[#101828]">
                          {r.name ?? "Sem nome"}
                        </p>
                        <StepPill r={r} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#667085]">
                        {[r.plano, r.bumps.length ? `+ ${r.bumps.join(" + ")}` : null]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-[#98a2b3]">
                        <span title={fmtDateTime(r.lastAt)}>{tempoRelativo(r.lastAt)}</span>
                        {r.phone && ` · ${fmtPhone(r.phone)}`}
                        {r.cidade && ` · ${r.cidade}/${r.uf ?? ""}`}
                        {r.utmSource && ` · ${r.utmSource}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-12 sm:justify-end sm:pl-0">
                    <span className="text-sm font-semibold tabular-nums text-[#101828]">
                      {brl(r.value)}
                    </span>
                    <ChamarButton r={r} compact />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
