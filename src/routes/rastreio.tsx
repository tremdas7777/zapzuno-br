import { brand } from "@/lib/brand";
import { createFileRoute } from "@tanstack/react-router";
import { absUrl } from "@/lib/seo";
import { SiteLayout } from "@/components/site/Layout";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { trackByCpf, type RastreioStatus } from "@/lib/rastreio.functions";

export const Route = createFileRoute("/rastreio")({
  head: () => ({
    meta: [
      { title: `Rastrear Pedido | ${brand.name}` },
      {
        name: "description",
        content: `Acompanhe a entrega do seu pedido da ${brand.name} pelo CPF do titular.`,
      },
      { property: "og:title", content: "Rastrear Pedido" },
      { property: "og:description", content: "Acompanhe a entrega do seu pedido." },
      { property: "og:url", content: absUrl("/rastreio") },
    ],
    links: [{ rel: "canonical", href: absUrl("/rastreio") }],
  }),
  component: Page,
});

function formatCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

const STEPS: { key: RastreioStatus; title: string; sub: string }[] = [
  { key: "pedido_recebido", title: "Pedido recebido", sub: "Processando no centro" },
  { key: "postado", title: "Postado", sub: "Despachado pela transportadora" },
  { key: "em_transito", title: "Em trânsito", sub: "A caminho da sua cidade" },
  { key: "saiu_entrega", title: "Saiu para entrega", sub: "Com o entregador" },
  { key: "entregue", title: "Entregue", sub: "Pedido finalizado" },
];

function formatRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} dias`;
}

function Page() {
  const [cpf, setCpf] = useState("");
  const trackFn = useServerFn(trackByCpf);
  const mutation = useMutation({
    mutationFn: (cpfValue: string) => trackFn({ data: { cpf: cpfValue } }),
  });

  const result = mutation.data;
  const currentIdx = result ? STEPS.findIndex((s) => s.key === result.status) : -1;

  return (
    <SiteLayout>
      <section className="pt-32 md:pt-44 pb-24">
        <div className="container-edge max-w-2xl">
          <span className="eyebrow text-[var(--primary)] block mb-6">Rastreio</span>
          <h1 className="font-display text-5xl md:text-7xl leading-[0.95] text-balance">
            Acompanhe o <span className="italic">seu pedido.</span>
          </h1>
          <p className="mt-6 text-[var(--ink)] leading-relaxed">
            Informe o CPF do titular do pedido para consultar o status da entrega.
          </p>

          <form
            className="mt-12 border-y border-[var(--line)] py-6 flex gap-4 items-center"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(cpf);
            }}
          >
            <input
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              className="min-w-0 flex-1 bg-transparent border-0 outline-none text-lg placeholder:text-[var(--ink)]"
            />
            <button
              disabled={mutation.isPending}
              className="btn-lime shrink-0 justify-center px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-colors disabled:opacity-50 sm:px-8"
            >
              {mutation.isPending ? "Buscando..." : "Rastrear"}
            </button>
          </form>

          {mutation.isError && (
            <p className="mt-6 text-sm text-red-600">{(mutation.error as Error).message}</p>
          )}

          {result && (
            <div className="mt-16">
              <div className="eyebrow text-[var(--ink)] mb-4">Pedido {result.pedido}</div>
              <div className="font-display text-3xl mb-2">
                {STEPS[currentIdx]?.title ?? "Pedido recebido"}.
              </div>
              <p className="text-sm text-[var(--ink)] mb-10">
                Atualizado {formatRelative(result.data_atualizacao)}
              </p>
              {result.tracking_code && (
                <div className="mb-10 p-6 bg-[var(--tint-blue)] border border-[var(--line)]">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink)] mb-2">
                    Código de rastreio
                  </div>
                  <div className="font-display text-2xl mb-3">{result.tracking_code}</div>
                  {result.tracking_url && (
                    <a
                      href={result.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-[var(--primary)] hover:opacity-80 transition-opacity"
                    >
                      Acompanhar na transportadora →
                    </a>
                  )}
                </div>
              )}
              <ol className="space-y-px bg-[var(--line)]">
                {STEPS.map((step, i) => {
                  const done = i <= currentIdx;
                  return (
                    <li key={step.key} className="bg-[var(--card-bg)] p-6 flex items-center gap-6">
                      <span
                        className={`font-display italic text-2xl ${
                          done ? "text-[var(--primary)]" : "text-[var(--ink)]"
                        }`}
                      >
                        0{i + 1}
                      </span>
                      <div>
                        <div
                          className={`text-sm font-semibold ${done ? "" : "text-[var(--ink)]"}`}
                        >
                          {step.title}
                        </div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink)] mt-1">
                          {done ? step.sub : "Aguardando"}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
