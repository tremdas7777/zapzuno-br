/** Pós-compra no /admin: quantos Pix de upsell foram gerados e pagos em cada etapa (só cliente). */
export type EtapaUpsell = "pilhas" | "ofertas" | "expresso";

export type LinhaUpsell = {
  etapa: EtapaUpsell;
  gerados: number;
  pagos: number;
  /** Centavos. */
  valorGerado: number;
  /** Centavos. */
  valorPago: number;
};

type PedidoResumo = {
  status: string;
  amount_cents: number;
  customer?: {
    upsellOf?: string;
    upsellItems?: readonly string[];
    testOf?: string;
  } | null;
};

/** Etapa da cobrança pelo que foi comprado nela (sem itens = só o kit extra, o formato antigo). */
export function etapaDoUpsell(itens: readonly string[] | undefined): EtapaUpsell {
  if (itens?.includes("expresso")) return "expresso";
  if (itens?.some((p) => p.startsWith("pilhas"))) return "pilhas";
  return "ofertas";
}

/**
 * `etapas`: as da loja, na ordem do pós-compra. Aparecem mesmo zeradas, porque zero também responde
 * "não está saindo". Cobrança de teste do admin não conta.
 */
export function resumoUpsell(orders: readonly PedidoResumo[], etapas: readonly EtapaUpsell[]) {
  const linhas = new Map<EtapaUpsell, LinhaUpsell>(
    etapas.map((etapa) => [etapa, { etapa, gerados: 0, pagos: 0, valorGerado: 0, valorPago: 0 }]),
  );
  let pedidosPagos = 0;
  for (const o of orders) {
    const c = o.customer;
    if (c?.testOf) continue;
    const pago = o.status === "paid";
    if (!c?.upsellOf) {
      if (pago) pedidosPagos++;
      continue;
    }
    const etapa = etapaDoUpsell(c.upsellItems);
    const linha = linhas.get(etapa) ?? { etapa, gerados: 0, pagos: 0, valorGerado: 0, valorPago: 0 };
    linhas.set(etapa, linha);
    linha.gerados++;
    linha.valorGerado += o.amount_cents;
    if (pago) {
      linha.pagos++;
      linha.valorPago += o.amount_cents;
    }
  }
  const todas = [...linhas.values()];
  return {
    pedidosPagos,
    linhas: todas,
    gerados: todas.reduce((s, l) => s + l.gerados, 0),
    pagos: todas.reduce((s, l) => s + l.pagos, 0),
    valorGerado: todas.reduce((s, l) => s + l.valorGerado, 0),
    valorPago: todas.reduce((s, l) => s + l.valorPago, 0),
  };
}
