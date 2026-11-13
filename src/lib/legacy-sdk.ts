/**
 * SDK do LegacyPay no navegador: tokeniza o cartão e resolve o 3DS da Legacy Ecom. A Legacy
 * recusa cartão cru (INVALID_DATA com "Gere o pagamento pelo SDK LegacyPay e tente novamente"),
 * então todo cartão passa por aqui antes de chegar ao servidor.
 * Docs: https://developers.legacyecombrasil.com/docs/3ds
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- SDK sem tipos publicados */

export type LegacyPrepared = {
  payinCard: Record<string, unknown>;
  antifraud?: { skipped?: boolean; sessionId?: string | null } | null;
  card?: { token?: string; brand?: string; last4?: string } | null;
  threeDS?: { skipped?: boolean; status?: string } | null;
};

export type LegacyClient = {
  prepareCardPayment: (p: {
    amount: number;
    installments: number;
    referenceId: string;
    card: {
      holderName: string;
      number: string;
      expirationMonth: string;
      expirationYear: string;
      cvv: string;
    };
    customer: Record<string, unknown>;
  }) => Promise<LegacyPrepared>;
  handlePendingThreeDS: (payinResponse: any, extras?: Record<string, unknown>) => Promise<any>;
  /** Monta o payload do /payin a partir dos campos base + `prepared` do SDK. */
  buildPayinPayload?: (
    base: Record<string, unknown>,
    prepared: LegacyPrepared,
  ) => Record<string, unknown>;
  /** Cobrança com cartão salvo: devolve um `prepared` do mesmo formato do prepareCardPayment. */
  payWithSavedCard?: (p: {
    token: string;
    cvv?: string;
    amount: number;
    referenceId: string;
    installments: number;
    customer: Record<string, unknown>;
  }) => Promise<LegacyPrepared>;
  /** Lista tokens ativos do CPF. */
  listSavedCards?: (p: { document: string }) => Promise<Array<Record<string, unknown>>>;
  getConfig?: () => Promise<any>;
};

type SdkGlobal = {
  init: (opts: { publicKey: string; apiBaseUrl?: string }) => LegacyClient;
};

let loading: Promise<SdkGlobal> | null = null;

function globalSdk(): SdkGlobal | null {
  const w = window as unknown as { LegacyPay?: SdkGlobal };
  return w.LegacyPay ?? null;
}

/** Carrega o script uma vez por aba. Chame antes de `prepareCard`. */
export function loadLegacy(sdkUrl: string): Promise<SdkGlobal> {
  const existing = globalSdk();
  if (existing) return Promise.resolve(existing);
  if (loading) return loading;
  loading = new Promise<SdkGlobal>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = sdkUrl;
    s.async = true;
    s.onload = () => {
      const sdk = globalSdk();
      if (sdk) resolve(sdk);
      else reject(new Error("LegacyPay não ficou disponível depois de carregar o SDK."));
    };
    s.onerror = () => reject(new Error("Não foi possível carregar o SDK do LegacyPay."));
    document.head.appendChild(s);
  });
  return loading;
}

let clientRef: { pk: string; client: LegacyClient } | null = null;

export async function legacyClient(
  sdkUrl: string,
  publicKey: string,
  apiBaseUrl: string,
): Promise<LegacyClient> {
  if (clientRef && clientRef.pk === publicKey) return clientRef.client;
  const sdk = await loadLegacy(sdkUrl);
  const client = sdk.init({ publicKey, apiBaseUrl });
  clientRef = { pk: publicKey, client };
  return client;
}
