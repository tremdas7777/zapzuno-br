// Gateway Legacy Ecom (https://developers.legacyecombrasil.com): Pix e cartão numa mesma rota POST /payin.
// Somente servidor. Valores em centavos. Sem ambiente de teste documentado — usamos a conta de produção.
// Chave no formato "pk_live_xxx:sk_live_yyy" (par público:secreto gerado no painel em Integrações),
// cadastrada no /admin (private_settings, só service role). O secret LEGACY_API_KEY serve de reserva.
import { brand } from "@/lib/brand";
import { PayerDataError } from "@/lib/pix-errors";

export const LEGACY_API = "https://api.legacyecom.com.br";

const KEY = "legacy_api_key";
// A tela do pedido consulta o status a cada poucos segundos: guarda a chave por 1 minuto.
const CACHE_MS = 60_000;
let cache: { value: string | null; at: number } | null = null;

export const LEGACY_WEBHOOK_URL = `${brand.siteUrl}/api/public/pix-webhook?gw=le`;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function savedKey(): Promise<string | null> {
  const { data } = await (
    await db()
  )
    .from("private_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  return (data?.value as string | null) || null;
}

export async function getLegacyKey(): Promise<string | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = (await savedKey()) || process.env["LEGACY_API_KEY"] || null;
  cache = { value, at: Date.now() };
  return value;
}

/** Só a parte pública do par (pk_live_…), que vai pro navegador para iniciar o SDK do LegacyPay. */
export async function getLegacyPublicKey(): Promise<string | null> {
  const pair = await getLegacyKey();
  if (!pair) return null;
  const pub = pair.split(":")[0];
  return pub && pub.startsWith("pk_") ? pub : null;
}

export async function getLegacyKeySource(): Promise<{
  key: string | null;
  source: "admin" | "secret" | null;
}> {
  const saved = await savedKey();
  if (saved) return { key: saved, source: "admin" };
  const env = process.env["LEGACY_API_KEY"] || null;
  return { key: env, source: env ? "secret" : null };
}

export async function saveLegacyKey(value: string): Promise<void> {
  // Par pk_live_...:sk_live_... (Basic auth); impede colagem de uma só das chaves.
  if (!/^pk_[A-Za-z0-9_]+:sk_[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(
      "Cole as duas chaves da Legacy juntas, no formato pk_live_xxx:sk_live_yyy (copie do painel em Integrações).",
    );
  }
  const { error } = await (
    await db()
  )
    .from("private_settings")
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cache = null;
}

export async function deleteLegacyKey(): Promise<void> {
  const { error } = await (await db()).from("private_settings").delete().eq("key", KEY);
  if (error) throw new Error(error.message);
  cache = null;
}

async function requireKey(): Promise<string> {
  const key = await getLegacyKey();
  if (!key) throw new Error("Pagamento indisponível no momento.");
  return key;
}

const authHeader = (pair: string) => `Basic ${btoa(pair)}`;
const jsonHeaders = (pair: string) => ({
  Authorization: authHeader(pair),
  "Content-Type": "application/json",
  Accept: "application/json",
});
const getHeaders = (pair: string) => ({
  Authorization: authHeader(pair),
  Accept: "application/json",
});

const digits = (v: string) => v.replace(/\D/g, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
function errorSummary(json: any): string {
  return [json?.code, json?.error, json?.reason, json?.message]
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
function payerMessage(json: any): string | null {
  const code = String(json?.code ?? json?.error ?? "").toUpperCase();
  if (code === "INVALID_DATA" || code === "INVALID_CVV") {
    const fields = String(json?.fields ?? json?.message ?? "").toLowerCase();
    if (fields.includes("document") || fields.includes("cpf"))
      return "Confira o CPF e tente novamente.";
    if (fields.includes("phone") || fields.includes("celular"))
      return "Confira o celular com DDD e tente novamente.";
    if (fields.includes("email")) return "Confira o e-mail e tente novamente.";
    if (fields.includes("name") || fields.includes("nome"))
      return "Confira o nome completo e tente novamente.";
    if (code === "INVALID_CVV") return "CVV inválido. Confira o código de segurança do cartão.";
  }
  if (code === "PAYER_LIMIT_REJECTED") return "Pagamento recusado pelo limite do pagador.";
  if (code === "REJECTED_BY_RISK") return "Pagamento recusado pela análise de risco.";
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
const retriable = (status: number, json: any) =>
  status === 429 || status >= 500 || String(json?.code ?? "") === "PROVIDER_ERROR";

/**
 * Normaliza o status da Legacy para a regra interna de "pago" (pix-status.ts).
 * Legacy: PENDING, APPROVED, REFUSED, FAILED, CANCELED, REFUNDED, CHARGEBACK, MED, EXPIRED.
 */
function normalizeStatus(s: unknown): string {
  const v = String(s ?? "pending").toLowerCase();
  if (v === "approved") return "paid";
  return v;
}

export type LegacyCustomer = { name: string; cpf: string; email: string; phone: string };
export type LegacyAddress = {
  street: string;
  number: string;
  zipCode: string;
  city: string;
  state: string;
  complement?: string;
  neighborhood?: string;
};
export type LegacyItem = {
  title: string;
  unitPrice: number;
  quantity: number;
  description?: string;
};

/** Gera a cobrança Pix (POST /payin). Valor em centavos. */
export async function legacyPixCashin(o: {
  amountCents: number;
  customer: LegacyCustomer;
  address?: LegacyAddress | undefined;
  description: string;
  referenceId: string;
  payerIp: string;
  items: LegacyItem[];
}): Promise<{ id: string; qrcode: string; status: string }> {
  const key = await requireKey();
  const body = JSON.stringify({
    paymentMethod: "PIX",
    amount: o.amountCents,
    referenceId: o.referenceId,
    isPhysicalProduct: true,
    payerIp: o.payerIp,
    webhookUrl: LEGACY_WEBHOOK_URL,
    customer: {
      name: o.customer.name.trim().slice(0, 200),
      document: digits(o.customer.cpf),
      email: o.customer.email.trim(),
      phone: digits(o.customer.phone),
      ...(o.address
        ? {
            address: {
              street: o.address.street,
              number: o.address.number,
              zipCode: digits(o.address.zipCode),
              city: o.address.city,
              state: o.address.state,
              ...(o.address.complement ? { complement: o.address.complement } : {}),
              ...(o.address.neighborhood ? { neighborhood: o.address.neighborhood } : {}),
            },
          }
        : {}),
    },
    items: o.items.map((i) => ({
      title: i.title.slice(0, 200),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      ...(i.description ? { description: i.description.slice(0, 500) } : {}),
    })),
  });

  let res: Response | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  let json: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(1000 * attempt);
    try {
      res = await fetch(`${LEGACY_API}/payin`, { method: "POST", headers: jsonHeaders(key), body });
      json = await res.json().catch(() => null);
    } catch (e) {
      console.error("Legacy fetch failed", attempt, e instanceof Error ? e.message : e);
      res = null;
      continue;
    }
    if (!retriable(res.status, json)) break;
    console.error("Legacy retry", res.status, errorSummary(json));
  }

  if (!res || !res.ok) {
    console.error("Legacy error", res?.status, errorSummary(json));
    const payer = payerMessage(json);
    if (payer) throw new PayerDataError(payer);
    throw new Error("Não foi possível gerar o Pix. Confira seus dados e tente novamente.");
  }

  const qrcode = json?.pix?.qrcode;
  if (!json?.id || !qrcode) {
    console.error("Legacy sem QR", json?.id, json?.status);
    throw new Error("Não foi possível gerar o Pix agora. Tente de novo.");
  }
  console.log("legacy-create", json.id, json.status);
  return { id: String(json.id), qrcode: String(qrcode), status: normalizeStatus(json.status) };
}

export async function legacyStatus(id: string): Promise<{ status: string; amount: number }> {
  const key = await requireKey();
  const res = await fetch(`${LEGACY_API}/payin/${encodeURIComponent(id)}`, {
    headers: getHeaders(key),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Legacy HTTP ${res.status} ${errorSummary(json)}`);
  console.log("legacy-status", id, json?.status);
  return {
    status: normalizeStatus(json?.status),
    amount: Math.round(Number(json?.amount ?? 0)),
  };
}

/**
 * Cria cobrança no cartão (POST /payin). Recebe o payload já preparado pelo SDK LegacyPay no
 * navegador — token, device, userAgent e threeDSecure vêm de `client.prepareCardPayment()`. A
 * Legacy exige 3DS nesta conta, então o cartão cru (number/cvv) é recusado com INVALID_DATA.
 * Devolve a resposta inteira do /payin: se vier com `threeDSecurePending: true`, o navegador
 * precisa passar ela de volta pro SDK em `client.handlePendingThreeDS(response)`.
 */
export async function legacyCardCharge(o: {
  amountCents: number;
  /** `prepared.payinCard` do SDK: { token, installments, threeDSecure, device?, userAgent? }. */
  payinCard: Record<string, unknown>;
  /** `prepared.antifraud.sessionId` (opcional — só quando o SDK rodou o antifraude). */
  antifraudSessionId?: string | null;
  customer: LegacyCustomer;
  address: LegacyAddress;
  description: string;
  referenceId: string;
  payerIp: string;
  items: LegacyItem[];
}): Promise<{
  id: string;
  status: string;
  amount: number;
  threeDSecurePending: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  raw: any;
}> {
  const key = await requireKey();
  const body = JSON.stringify({
    paymentMethod: "CREDIT_CARD",
    amount: o.amountCents,
    referenceId: o.referenceId,
    isPhysicalProduct: true,
    payerIp: o.payerIp,
    webhookUrl: LEGACY_WEBHOOK_URL,
    card: o.payinCard,
    customer: {
      name: o.customer.name.trim().slice(0, 200),
      document: digits(o.customer.cpf),
      email: o.customer.email.trim(),
      phone: digits(o.customer.phone),
      address: {
        street: o.address.street,
        number: o.address.number,
        zipCode: digits(o.address.zipCode),
        city: o.address.city,
        state: o.address.state,
        ...(o.address.complement ? { complement: o.address.complement } : {}),
        ...(o.address.neighborhood ? { neighborhood: o.address.neighborhood } : {}),
      },
    },
    items: o.items.map((i) => ({
      title: i.title.slice(0, 200),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      ...(i.description ? { description: i.description.slice(0, 500) } : {}),
    })),
    ...(o.antifraudSessionId ? { antifraud: { sessionId: o.antifraudSessionId } } : {}),
  });

  const res = await fetch(`${LEGACY_API}/payin`, {
    method: "POST",
    headers: jsonHeaders(key),
    body,
  });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.id) {
    // Nada do cartão no log.
    console.error("Legacy card error", res?.status, errorSummary(json));
    const payer = payerMessage(json);
    if (payer) throw new PayerDataError(payer);
    throw new Error(
      `Não foi possível processar o cartão: ${errorSummary(json) || `erro ${res.status}`}.`,
    );
  }

  console.log("legacy-card-create", json.id, json.status, json.threeDSecurePending ? "3ds" : "");
  return {
    id: String(json.id),
    status: normalizeStatus(json.status),
    amount: Math.round(Number(json.amount ?? 0)),
    threeDSecurePending: !!json.threeDSecurePending,
    raw: json,
  };
}

/**
 * Testa a chave sem criar cobrança (GET /whoami). 401/403 = chave recusada.
 * A Legacy responde 200 com { canTransact, reason } mesmo se a conta ainda não aprovou KYC.
 */
export async function testLegacyKey(): Promise<{
  ok: boolean;
  status?: number | undefined;
  error?: string | undefined;
  note?: string | undefined;
}> {
  const key = await getLegacyKey();
  if (!key) return { ok: false, error: "Nenhuma chave cadastrada" };
  try {
    const res = await fetch(`${LEGACY_API}/whoami`, { headers: getHeaders(key) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
    const json = (await res.json().catch(() => null)) as any;
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, error: "Chave recusada pela Legacy" };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: String(json?.message ?? `Erro ${res.status}`).slice(0, 200),
      };
    }
    if (json?.canTransact === false) {
      const reason = String(json?.reason ?? "KYC não aprovado");
      return {
        ok: false,
        status: res.status,
        error: `Conta Legacy sem autorização para cobrar: ${reason}.`,
      };
    }
    // O webhook é informado no corpo de cada cobrança (webhookUrl), não precisa cadastrar nada no painel.
    return { ok: true, status: res.status, note: "Chave e conta ativas. Pix e cartão prontos." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha de conexão" };
  }
}

/**
 * Liga/desliga separado: cartão e Pix pela Legacy. Sem registro = ligado (como antes).
 * Desligar um não mexe no outro: com o cartão desligado a loja segue com o Pix (no gateway escolhido),
 * e com o Pix desligado o cartão continua pela Legacy.
 */
const FLAG_CARD = "legacy_card_on";
const FLAG_PIX = "legacy_pix_on";

async function flagOn(key: string): Promise<boolean> {
  try {
    const { data } = await (
      await db()
    )
      .from("private_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return data?.value !== "off";
  } catch {
    return true;
  }
}

export async function getLegacyFlags(): Promise<{ card: boolean; pix: boolean }> {
  const [card, pix] = await Promise.all([flagOn(FLAG_CARD), flagOn(FLAG_PIX)]);
  return { card, pix };
}

export async function saveLegacyFlag(kind: "card" | "pix", on: boolean): Promise<void> {
  const { error } = await (
    await db()
  )
    .from("private_settings")
    .upsert({
      key: kind === "card" ? FLAG_CARD : FLAG_PIX,
      value: on ? "on" : "off",
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
}
