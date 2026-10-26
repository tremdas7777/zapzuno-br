/** Tráfego ao vivo: quem está na loja agora e a atividade recente, em tempo real. */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Eye, ShoppingBag, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminFunnel } from "@/lib/admin.functions";
import { brl, fmtDateTime, tempoRelativo } from "@/lib/admin-format";
import {
  EmptyState,
  Kpi,
  PageHeader,
  Panel,
  Pill,
  ProductThumb,
  RefreshButton,
  Segmented,
  type Tone,
} from "./kit";

type FunnelEvent = {
  id: string;
  session_id: string;
  event_type: string;
  path: string | null;
  bundle_id: string | null;
  bundle_name: string | null;
  value: number | null;
  referrer: string | null;
  utm_source: string | null;
  metadata?: { step?: string; source?: string } | null;
  created_at: string;
};

type Funnel = {
  visited: number;
  viewedProduct: number;
  checkout: number;
  totalEvents: number;
  totalSessions: number;
  onlineNow: number;
};

const JANELAS = [
  { value: 15, label: "15 min" },
  { value: 60, label: "1 h" },
  { value: 60 * 6, label: "6 h" },
  { value: 60 * 24, label: "24 h" },
  { value: 60 * 24 * 7, label: "7 dias" },
  { value: 60 * 24 * 30, label: "30 dias" },
] as const;

const ONLINE_MIN = 3;

const ETAPA: Record<string, string> = {
  checkout: "Entrou no checkout",
  dados: "Preencheu os dados",
  entrega: "Preencheu a entrega",
  pix: "Gerou o Pix",
};

function evento(e: FunnelEvent): { label: string; tone: Tone } {
  if (e.event_type === "page_view") return { label: "Visita", tone: "gray" };
  if (e.event_type === "product_view") return { label: "Viu produto", tone: "violet" };
  if (e.event_type === "checkout_click") return { label: "Foi ao checkout", tone: "blue" };
  if (e.event_type === "checkout_step") {
    const step = e.metadata?.step ?? "";
    return { label: ETAPA[step] ?? "Checkout", tone: step === "pix" ? "green" : "amber" };
  }
  return { label: e.event_type, tone: "gray" };
}

const pct = (part?: number, total?: number) =>
  !total || !part ? 0 : Math.round((part / total) * 100);

export function LiveTab({ password }: { password: string }) {
  const fetchFunnel = useServerFn(getAdminFunnel);
  const [janela, setJanela] = useState<number>(60 * 24);
  const [events, setEvents] = useState<FunnelEvent[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setTick] = useState(0);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetchFunnel({
          data: { password, windowMinutes: janela, onlineMinutes: ONLINE_MIN },
        });
        if (!cancelled) {
          setEvents(r.recent as FunnelEvent[]);
          setFunnel(r.funnel);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const channel = supabase
      .channel("funnel_events_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "funnel_events" }, () => {
        // A chave pública não lê funnel_events (guarda contatos dos checkouts): o aviso chega
        // vazio e só dispara a atualização, que busca os eventos pelo servidor com a senha.
        load();
      })
      .subscribe();
    // Atualiza o "há X min" mesmo sem eventos novos.
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [password, fetchFunnel, janela, reload]);

  const recarregar = () => setReload((n) => n + 1);

  return (
    <div>
      <PageHeader
        title="Tráfego ao vivo"
        description="Quem está na loja e o que estão fazendo, atualizado em tempo real."
        actions={
          <>
            <Segmented options={JANELAS} value={janela} onChange={setJanela} />
            <RefreshButton loading={loading} onClick={recarregar} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          tone="brand"
          label="No site agora"
          icon={<Users />}
          value={funnel?.onlineNow ?? 0}
          hint={`ativos nos últimos ${ONLINE_MIN} min`}
        />
        <Kpi
          label="Visitantes"
          icon={<Activity />}
          value={funnel?.visited ?? 0}
          hint="pessoas únicas no período"
        />
        <Kpi
          label="Viram um produto"
          icon={<Eye />}
          value={funnel?.viewedProduct ?? 0}
          hint={`${pct(funnel?.viewedProduct, funnel?.visited)}% dos visitantes`}
        />
        <Kpi
          label="Foram ao checkout"
          icon={<ShoppingBag />}
          value={funnel?.checkout ?? 0}
          hint={`${pct(funnel?.checkout, funnel?.visited)}% dos visitantes`}
        />
      </div>

      <Panel
        className="mt-4"
        title="Atividade recente"
        description={`Últimos ${events.length} eventos`}
        bodyClassName="p-0"
      >
        {events.length === 0 && !loading ? (
          <EmptyState
            icon={<Activity />}
            title="Nenhuma atividade neste período"
            text="Assim que alguém entrar na loja, aparece aqui."
          />
        ) : (
          <ul className="max-h-[720px] divide-y divide-[#eef0f3] overflow-y-auto">
            {events.map((e) => {
              const ev = evento(e);
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <ProductThumb id={e.bundle_id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Pill tone={ev.tone}>{ev.label}</Pill>
                      <span className="truncate text-sm text-[#101828]">
                        {e.bundle_name ?? e.path ?? "—"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#98a2b3]">
                      {e.path}
                      {e.utm_source && ` · ${e.utm_source}`}
                      {` · sessão ${(e.session_id ?? "").slice(0, 6)}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {e.value ? (
                      <p className="text-sm font-semibold tabular-nums text-[#101828]">
                        {brl(e.value)}
                      </p>
                    ) : null}
                    <p className="text-xs text-[#98a2b3]" title={fmtDateTime(e.created_at)}>
                      {tempoRelativo(e.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
