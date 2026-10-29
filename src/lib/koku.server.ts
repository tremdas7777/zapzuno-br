// Gateway Pix Koku Pay. Somente servidor (a Koku recusa chamada direta do navegador).
// Docs: https://docs.kokupay.com. Só Pix, valores em centavos, sem ambiente de teste.
// Chave (koku_live_...) criada no painel da Koku em Desenvolvedores → Chaves de API, com os escopos
// charges:write, charges:read, webhooks:read e webhooks:write. Cadastrada no /admin
// (private_settings, só service role). O secret KOKU_API_KEY serve de reserva.
import { brand } from "@/lib/brand";
import { PayerDataError } from "@/lib/pix-errors";

export const KOKU_API = "https://api.kokupay.com/v1";

const KEY = "koku_api_key";
// A tela do pedido consulta o status a cada poucos segundos: guarda a chave por 1 minuto.
const CACHE_MS = 60_000;
let cache: { value: string | null; at: number } | null = null;

/** Escopos sem os quais o checkout não funciona. */
const REQUIRED_SCOPES = ["charges:write", "charges:read"];

/**
 * O webhook da Koku é cadastrado por conta (não por cobrança), então vai sem ?gw: a rota reconhece a
 * Koku pelo cabeçalho x-koku-event-id. Só o evento de pagamento interessa.
 */
export const KOKU_WEBHOOK_URL = `${brand.siteUrl}/api/public/pix-webhook`;
const KOKU_WEBHOOK_EVENTS = ["charge.paid"];

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Chave salva no /admin (se houver). */
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

/** Chave em uso: a do /admin ou, sem ela, o secret KOKU_API_KEY. */
export async function getKokuKey(): Promise<string | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = (await savedKey()) || process.env["KOKU_API_KEY"] || null;
  cache = { value, at: Date.now() };
  return value;
}

/** De onde vem a chave em uso (para mostrar no /admin). */
export async function getKokuKeySource(): Promise<{
  key: string | null;
  source: "admin" | "secret" | null;
}> {
  const saved = await savedKey();
  if (saved) return { key: saved, source: "admin" };
  const env = process.env["KOKU_API_KEY"] || null;
  return { key: env, source: env ? "secret" : null };
}

export async function saveKokuKey(value: string): Promise<void> {
  // Formato koku_<ambiente>_<prefixo>_<segredo>: pega colagem errada antes de quebrar o checkout.
  if (!/^koku_\S{10,}$/.test(value)) {
    throw new Error("A chave da Koku começa com koku_live_ (copie a chave inteira do painel da Koku).");
  }
  const { error } = await (
    await db()
  )
    .from("private_settings")
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cache = null;
}

export async function deleteKokuKey(): Promise<void> {
  const { error } = await (await db()).from("private_settings").delete().eq("key", KEY);
  if (error) throw new Error(error.message);
  cache = null;
}

async function requireKey(): Promise<string> {
  const key = await getKokuKey();
  if (!key) throw new Error("Pagamento indisponível no momento.");
  return key;
}

/** GET sem corpo: a Koku recusa Content-Type JSON em requisição vazia. */
const authHeaders = (key: string) => ({ Authorization: `Bearer ${key}`, Accept: "application/json" });
const jsonHeaders = (key: string) => ({ ...authHeaders(key), "Content-Type": "application/json" });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const digits = (v: string) => v.replace(/\D/g, "");

/** Erro da Koku sem dados pessoais: código, motivo, campos recusados e correlation id. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
function errorSummary(json: any): string {
  const e = json?.error;
  const fields = Array.isArray(e?.details?.fields)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
      e.details.fields.map((f: any) => `${f?.field}:${f?.rule}`).join(",")
    : "";
  return [e?.code, e?.details?.reason, fields, e?.correlation_id].filter(Boolean).join(" ");
}

/** Mensagem para o cliente quando a Koku recusa algum dado do pagador. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
function payerMessage(json: any): string | null {
  const fields: string = Array.isArray(json?.error?.details?.fields)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
      json.error.details.fields.map((f: any) => String(f?.field ?? "")).join(" ")
    : "";
  if (fields.includes("document")) return "Confira o CPF e tente novamente.";
  if (fields.includes("phone")) return "Confira o celular com DDD e tente novamente.";
  if (fields.includes("email")) return "Confira o e-mail e tente novamente.";
  if (fields.includes("name")) return "Confira o nome completo e tente novamente.";
  return null;
}

/** Vale repetir com a mesma Idempotency-Key (rede, 429, 500, 503), menos conta sem Pix habilitado. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
const retriable = (status: number, json: any) =>
  (status === 429 || status >= 500) && json?.error?.details?.reason !== "account_not_enabled";

/**
 * Gera a cobrança Pix (POST /pix/charges). Valor em centavos. O id vem em "id" e o copia e cola em
 * "pix.qr_code_payload" (a Koku não manda imagem: o checkout desenha o QR a partir do texto).
 */
export async function kokuCashin(o: {
  amountCents: number;
  customer: { name: string; cpf: string; email: string; phone: string };
  /** Aparece só no painel da Koku (nome da loja). */
  description: string;
  /** Único por conta; um novo a cada cobrança. */
  orderReference: string;
  expiresInSeconds: number;
}): Promise<{ id: string; qrcode: string; status: string }> {
  const key = await requireKey();
  const body = JSON.stringify({
    order_reference: o.orderReference,
    amount_cents: o.amountCents,
    currency: "BRL",
    description: o.description.slice(0, 500),
    payer: {
      name: o.customer.name.trim().slice(0, 200),
      document: digits(o.customer.cpf),
      email: o.customer.email.trim(),
      phone: digits(o.customer.phone),
    },
    expires_in_seconds: o.expiresInSeconds,
  });

  // Mesma Idempotency-Key nas novas tentativas: a Koku devolve a mesma cobrança, sem duplicar.
  let res: Response | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  let json: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(1000 * attempt);
    try {
      res = await fetch(`${KOKU_API}/pix/charges`, {
        method: "POST",
        headers: { ...jsonHeaders(key), "Idempotency-Key": `pix-${o.orderReference}` },
        body,
      });
      json = await res.json().catch(() => null);
    } catch (e) {
      console.error("Koku fetch failed", attempt, e instanceof Error ? e.message : e);
      res = null;
      continue;
    }
    if (!retriable(res.status, json)) break;
    console.error("Koku retry", res.status, errorSummary(json));
  }

  if (!res || !res.ok) {
    console.error("Koku error", res?.status, errorSummary(json));
    const payer = payerMessage(json);
    if (payer) throw new PayerDataError(payer);
    throw new Error("Não foi possível gerar o Pix. Confira seus dados e tente novamente.");
  }

  let charge = json;
  // "created" sem QR = emissão ainda em andamento: consulta de novo em vez de criar outra cobrança.
  for (let i = 0; i < 5 && charge?.status === "created" && !charge?.pix?.qr_code_payload; i++) {
    await sleep(1200);
    charge = (await getCharge(key, String(json.id)).catch(() => null)) ?? charge;
  }

  const qrcode = charge?.pix?.qr_code_payload;
  if (charge?.status === "failed" || !charge?.id || !qrcode) {
    console.error(
      "Koku sem QR",
      charge?.id,
      charge?.status,
      String(charge?.failure_message ?? "").slice(0, 200),
    );
    const motivo = charge?.status === "failed" && charge?.failure_message;
    throw new Error(
      motivo ? `Não foi possível gerar o Pix: ${motivo}` : "Não foi possível gerar o Pix agora. Tente de novo.",
    );
  }
  console.log("koku-create", charge.id, charge.status);
  return { id: String(charge.id), qrcode: String(qrcode), status: String(charge.status) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
async function getCharge(key: string, id: string): Promise<any> {
  const res = await fetch(`${KOKU_API}/pix/charges/${encodeURIComponent(id)}`, {
    headers: authHeaders(key),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Koku HTTP ${res.status} ${errorSummary(json)}`);
  return json;
}

/**
 * Status real da cobrança (GET /pix/charges/:id). Valor em centavos.
 * Status da Koku: created, pending, paid, partially_refunded, refunded, expired, cancelled, failed.
 * Só "paid" é venda (a regra única de "pago" fica em pix-status.ts).
 */
export async function kokuStatus(id: string): Promise<{ status: string; amount: number }> {
  const charge = await getCharge(await requireKey(), id);
  // Só status no log (sem dados pessoais). Pagamento depois de expirar abre análise na Koku.
  console.log("koku-status", id, charge?.status, charge?.late_payment ? "late_payment" : "");
  return {
    status: String(charge?.status ?? "pending").toLowerCase(),
    amount: Math.round(Number(charge?.amount_cents ?? 0)),
  };
}

/**
 * Confere se o aviso de pagamento (webhook) desta loja está cadastrado na Koku e cadastra se faltar.
 * Devolve uma frase para o /admin.
 */
async function ensureWebhook(key: string, scopes: string[]): Promise<string> {
  const manual = `Cadastre no painel da Koku em Desenvolvedores → Webhooks → Novo endpoint: URL ${KOKU_WEBHOOK_URL}, evento charge.paid.`;
  if (!scopes.includes("webhooks:read")) {
    return `Não deu para conferir o aviso de pagamento (a chave não tem o escopo webhooks:read). ${manual}`;
  }
  const list = await fetch(`${KOKU_API}/webhooks/endpoints`, { headers: authHeaders(key) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  const json = (await list.json().catch(() => null)) as any;
  if (!list.ok) return `Não deu para conferir o aviso de pagamento (Koku ${list.status}). ${manual}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  const items: any[] = Array.isArray(json?.items) ? json.items : [];
  const mine = items.find(
    (w) => String(w?.url ?? "").replace(/\/+$/, "") === KOKU_WEBHOOK_URL && w?.status !== "disabled",
  );
  if (mine) {
    return mine.paused_until || mine.consecutive_failures > 0
      ? `Aviso de pagamento cadastrado, mas com ${mine.consecutive_failures} falha(s) de entrega na Koku.`
      : "Aviso de pagamento (webhook) já cadastrado na Koku.";
  }
  if (!scopes.includes("webhooks:write")) {
    return `Falta o aviso de pagamento (a chave não tem o escopo webhooks:write). ${manual}`;
  }
  const res = await fetch(`${KOKU_API}/webhooks/endpoints`, {
    method: "POST",
    headers: jsonHeaders(key),
    body: JSON.stringify({ url: KOKU_WEBHOOK_URL, event_types: KOKU_WEBHOOK_EVENTS }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  const created = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    console.error("Koku webhook create failed", res.status, errorSummary(created));
    return `Não consegui cadastrar o aviso de pagamento (Koku ${res.status}). ${manual}`;
  }
  // A rota confirma cada aviso consultando a cobrança na API, então o signing_secret não é guardado.
  console.log("koku-webhook-created", created?.id);
  return `Aviso de pagamento (webhook) cadastrado na Koku: ${KOKU_WEBHOOK_URL}.`;
}

/**
 * Testa a chave sem criar cobrança (GET /api-keys/current), confere os escopos e garante o webhook
 * da loja na Koku. 401 = chave recusada.
 */
export async function testKokuKey(): Promise<{
  ok: boolean;
  status?: number | undefined;
  error?: string | undefined;
  note?: string | undefined;
}> {
  const key = await getKokuKey();
  if (!key) return { ok: false, error: "Nenhuma chave cadastrada" };
  try {
    const res = await fetch(`${KOKU_API}/api-keys/current`, { headers: authHeaders(key) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error:
          res.status === 401
            ? "Chave recusada pela Koku"
            : String(json?.error?.message ?? `Erro ${res.status}`).slice(0, 200),
      };
    }
    const scopes: string[] = Array.isArray(json?.scopes) ? json.scopes.map(String) : [];
    const missing = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
    if (missing.length) {
      return {
        ok: false,
        status: res.status,
        error: `a chave não tem os escopos ${missing.join(" e ")}. Crie outra chave na Koku com eles.`,
      };
    }
    const note = await ensureWebhook(key, scopes).catch(
      (e) => `Não deu para conferir o aviso de pagamento: ${e instanceof Error ? e.message : e}`,
    );
    return { ok: true, status: res.status, note };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha de conexão" };
  }
}
