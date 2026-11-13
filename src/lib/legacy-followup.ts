/**
 * Pós-compra no mesmo cartão pela Legacy Ecom (igual à Petit): o checkout guarda na aba o token do
 * cartão (cvt_live_…) e o CPF; aqui o SDK monta a cobrança com `payWithSavedCard` e o servidor só
 * repassa à /payin (createLegacyCardFollowUpCharge). Sem token ou sem a chave da Legacy, cai no Pix.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createLegacyCardFollowUpCharge, getCardConfig } from "@/lib/pix.functions";
import type { PixSession } from "@/lib/pix-session";
import type { UpsellProduct } from "@/lib/upsell";

export type LegacyCfg = { publicKey: string; sdkUrl: string; apiBaseUrl: string };

/** Config do SDK da Legacy, só quando a sessão tem o token do cartão da compra. */
export function useLegacyFollowUp(session: PixSession | null | undefined) {
  const cardConfigFn = useServerFn(getCardConfig);
  const followUpFn = useServerFn(createLegacyCardFollowUpCharge);
  const [cfg, setCfg] = useState<LegacyCfg | null>(null);
  const [failed, setFailed] = useState(false);
  const token = session?.method === "card" ? session.cardToken : undefined;

  useEffect(() => {
    if (!token) return;
    cardConfigFn({ data: {} })
      .then((c) => {
        if (c.provider === "legacy" && c.publicKey && c.sdkUrl && c.apiBaseUrl) {
          setCfg({ publicKey: c.publicKey, sdkUrl: c.sdkUrl, apiBaseUrl: c.apiBaseUrl });
          import("@/lib/legacy-sdk").then(({ loadLegacy }) =>
            loadLegacy(c.sdkUrl!).catch(() => undefined),
          );
        } else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [token, cardConfigFn]);

  /** Tem token e a config ainda não chegou: o botão espera em vez de piscar entre Pix e cartão. */
  const waiting = !!token && !cfg && !failed;
  const ready = !!token && !!cfg;

  const pay = async (o: { parentId: string; amountCents: number; products: UpsellProduct[] }) => {
    if (!session?.cardToken || !cfg) throw new Error("Cartão salvo indisponível. Pague com Pix.");
    const { legacyClient } = await import("@/lib/legacy-sdk");
    const client = await legacyClient(cfg.sdkUrl, cfg.publicKey, cfg.apiBaseUrl);
    if (!client.payWithSavedCard) throw new Error("Cartão salvo indisponível. Pague com Pix.");
    const prepared = await client.payWithSavedCard({
      token: session.cardToken,
      amount: o.amountCents,
      referenceId: crypto.randomUUID(),
      installments: o.products.includes("kit") ? (session.installments ?? 1) : 1,
      customer: {
        name: session.name,
        email: session.email,
        ...(session.cardOwnerDocument ? { document: session.cardOwnerDocument } : {}),
        ...(session.phone ? { phone: session.phone } : {}),
      },
    });
    return followUpFn({
      data: {
        parentId: o.parentId,
        origin: window.location.origin,
        cardPrepared: prepared.payinCard as Record<string, unknown>,
        antifraudSessionId: prepared.antifraud?.sessionId ?? null,
        cardMeta: {
          ...(prepared.card?.last4 ? { last4: prepared.card.last4 } : {}),
          ...(prepared.card?.brand ? { brand: prepared.card.brand } : {}),
        },
        products: o.products,
      },
    });
  };

  return { ready, waiting, pay };
}
