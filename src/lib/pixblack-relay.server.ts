// Repasse do aviso de pagamento da Pix Black entre as lojas. Somente servidor.
// Uma conta Pix Black atende todas as lojas, mas o painel aceita só 3 webhooks: a loja que recebe o
// charge.paid de uma cobrança que não é dela repassa o aviso para as outras. Cada loja ignora o que não
// é dela e confirma o pagamento na API da Pix Black antes de marcar pago, então o repasse só leva o id.
import { brand } from "@/lib/brand";

const LOJAS = [
  "https://beamrivals.store",
  "https://zapzuno.shop",
  "https://handspeed.store",
  "https://teiastore.online",
  "https://banguelashop.store",
];

/** Marca o aviso repassado: quem recebe não repassa de novo. */
export const PIXBLACK_RELAY_HEADER = "x-pixblack-relay";

export async function relayPixBlackPaid(chargeId: string): Promise<void> {
  const destinos = LOJAS.filter((u) => u !== brand.siteUrl);
  const body = JSON.stringify({ type: "charge.paid", data: { charge_id: chargeId } });
  // A Pix Black espera a resposta em até 5 s: as lojas são avisadas juntas, cada uma com até 3,5 s.
  const r = await Promise.allSettled(
    destinos.map((u) =>
      fetch(`${u}/api/public/pix-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pixblack-event": "charge.paid",
          [PIXBLACK_RELAY_HEADER]: brand.siteUrl,
        },
        body,
        signal: AbortSignal.timeout(3500),
      }),
    ),
  );
  console.log(
    "pix-webhook pixblack repasse",
    chargeId,
    r
      .map(
        (x, i) =>
          `${new URL(destinos[i]).host}:${x.status === "fulfilled" ? x.value.status : "erro"}`,
      )
      .join(" "),
  );
}
