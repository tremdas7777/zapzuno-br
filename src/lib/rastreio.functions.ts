import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isPaidStatus } from "@/lib/pix-status";

function normalizeCpf(input: string): string {
  return (input || "").replace(/\D/g, "").slice(0, 11);
}

/** CPF com os dois dígitos verificadores certos. */
function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(cpf[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

export type RastreioStatus =
  "pedido_recebido" | "postado" | "em_transito" | "saiu_entrega" | "entregue";

export function computeStatus(dataCriacao: string): RastreioStatus {
  const start = new Date(dataCriacao).getTime();
  const days = (Date.now() - start) / (1000 * 60 * 60 * 24);
  if (days >= 21) return "entregue";
  if (days >= 18) return "saiu_entrega";
  if (days >= 7) return "em_transito";
  if (days >= 3) return "postado";
  return "pedido_recebido";
}

/**
 * Rastreio pelo CPF, só para quem tem pedido pago. Nada é gravado: antes a consulta criava um
 * pedido de mentira para qualquer CPF e guardava o CPF numa tabela aberta (rastreios).
 */
export const trackByCpf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ cpf: z.string().max(20) }).parse(input))
  .handler(async ({ data }) => {
    const cpf = normalizeCpf(data.cpf);
    if (!isValidCpf(cpf)) {
      throw new Error("CPF inválido. Confira os 11 números.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pedido pago mais recente desse CPF; o código e o link reais vêm da Rotasync.
    const { data: orders } = await supabaseAdmin
      .from("pix_orders")
      .select("id, status, created_at, updated_at, report_result")
      .filter("customer->>cpf", "eq", cpf)
      .order("created_at", { ascending: false })
      .limit(10);
    const order = (orders ?? []).find((o) => isPaidStatus(o.status));
    if (!order) {
      throw new Error(
        "Não encontramos pedido pago com esse CPF. Confira os números ou fale com a gente pelo WhatsApp.",
      );
    }

    const rastro = (
      order.report_result as {
        rastro?: { ok?: boolean; trackingCode?: string; trackingUrl?: string };
      } | null
    )?.rastro;

    return {
      pedido: `#${order.id.replace(/[^\w]/g, "").slice(-8).toUpperCase()}`,
      status: computeStatus(order.created_at),
      data_criacao: order.created_at,
      data_atualizacao: order.updated_at ?? order.created_at,
      tracking_code: (rastro?.ok ? rastro.trackingCode : undefined) ?? null,
      tracking_url: (rastro?.ok ? rastro.trackingUrl : undefined) ?? null,
    };
  });
