// Gateway Pix Pix Black. Somente servidor. Docs: https://pixxblack.com/docs/api
// Valores em centavos; o Pix expira em 30 minutos (fixo da Pix Black).
// Chave (pxb_live_...) gerada no painel da Pix Black em Integrações → "Gerar chave de API" (gerar outra
// revoga a anterior). Cadastrada no /admin (private_settings, só service role). O secret
// PIXBLACK_API_KEY serve de reserva. A conta precisa estar verificada (KYC), senão tudo dá 403.
import { brand } from "@/lib/brand";
import { PayerDataError } from "@/lib/pix-errors";

export const PIXBLACK_API = "https://pixxblack.com/api/v1";

const KEY = "pixblack_api_key";
// A tela do pedido consulta o status a cada poucos segundos: guarda a chave por 1 minuto.
const CACHE_MS = 60_000;
let cache: { value: string | null; at: number } | null = null;

/**
 * O webhook da Pix Black é cadastrado no painel deles (Integrações → Webhooks, até 3 URLs), sem
 * ?gw: a rota reconhece a Pix Black pelo cabeçalho x-pixblack-event.
 */
export const PIXBLACK_WEBHOOK_URL = `${brand.siteUrl}/api/public/pix-webhook`;

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

/** Chave em uso: a do /admin ou, sem ela, o secret PIXBLACK_API_KEY. */
export async function getPixBlackKey(): Promise<string | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = (await savedKey()) || process.env["PIXBLACK_API_KEY"] || null;
  cache = { value, at: Date.now() };
  return value;
}

/** De onde vem a chave em uso (para mostrar no /admin). */
export async function getPixBlackKeySource(): Promise<{
  key: string | null;
  source: "admin" | "secret" | null;
}> {
  const saved = await savedKey();
  if (saved) return { key: saved, source: "admin" };
  const env = process.env["PIXBLACK_API_KEY"] || null;
  return { key: env, source: env ? "secret" : null };
}

export async function savePixBlackKey(value: string): Promise<void> {
  // Pega colagem errada antes de quebrar o checkout.
  if (!/^pxb_\S{10,}$/.test(value)) {
    throw new Error("A chave da Pix Black começa com pxb_live_ (copie a chave inteira do painel).");
  }
  const { error } = await (
    await db()
  )
    .from("private_settings")
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cache = null;
}

export async function deletePixBlackKey(): Promise<void> {
  const { error } = await (await db()).from("private_settings").delete().eq("key", KEY);
  if (error) throw new Error(error.message);
  cache = null;
}

async function requireKey(): Promise<string> {
  const key = await getPixBlackKey();
  if (!key) throw new Error("Pagamento indisponível no momento.");
  return key;
}

const authHeaders = (key: string) => ({ Authorization: `Bearer ${key}`, Accept: "application/json" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const digits = (v: string) => v.replace(/\D/g, "");

/** Erro da Pix Black sem dados pessoais: mensagem e campos recusados. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
function errorSummary(json: any): string {
  const issues = Array.isArray(json?.issues)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
      json.issues.map((i: any) => `${i?.path}:${i?.message}`).join(",")
    : "";
  return [json?.message, issues].filter(Boolean).join(" ").slice(0, 400);
}

/** Mensagem para o cliente quando a Pix Black recusa algum dado do pagador. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
function payerMessage(json: any): string | null {
  const paths: string = Array.isArray(json?.issues)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
      json.issues.map((i: any) => String(i?.path ?? "")).join(" ")
    : "";
  if (paths.includes("document")) return "Confira o CPF e tente novamente.";
  if (paths.includes("email")) return "Confira o e-mail e tente novamente.";
  if (paths.includes("name")) return "Confira o nome completo e tente novamente.";
  return null;
}

/**
 * Gera a cobrança Pix (POST /charges). Valor em centavos. O id vem em "id" e o copia e cola em
 * "pix.copy_paste" (sem imagem: o checkout desenha o QR a partir do texto).
 */
export async function pixblackCashin(o: {
  amountCents: number;
  customer: { name: string; cpf: string; email: string };
  /** Nome genérico enviado ao gateway (nome da loja). */
  description: string;
  /** Referência da loja; um novo a cada cobrança. */
  externalReference: string;
}): Promise<{ id: string; qrcode: string; status: string }> {
  const key = await requireKey();
  const body = JSON.stringify({
    amount_cents: o.amountCents,
    description: o.description.slice(0, 140),
    external_reference: o.externalReference,
    payer: {
      name: o.customer.name.trim().slice(0, 120),
      document: digits(o.customer.cpf),
      email: o.customer.email.trim(),
    },
  });

  // Mesma Idempotency-Key nas novas tentativas (429, 503, rede): a Pix Black devolve a mesma cobrança.
  let res: Response | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  let json: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(1000 * attempt);
    try {
      res = await fetch(`${PIXBLACK_API}/charges`, {
        method: "POST",
        headers: {
          ...authHeaders(key),
          "Content-Type": "application/json",
          "Idempotency-Key": `pix-${o.externalReference}`,
        },
        body,
      });
      json = await res.json().catch(() => null);
    } catch (e) {
      console.error("PixBlack fetch failed", attempt, e instanceof Error ? e.message : e);
      res = null;
      continue;
    }
    if (res.status !== 429 && res.status < 500) break;
    console.error("PixBlack retry", res.status, errorSummary(json));
  }

  const qrcode = json?.pix?.copy_paste;
  if (!res || !res.ok || !json?.id || !qrcode) {
    console.error("PixBlack error", res?.status, errorSummary(json));
    const payer = res?.status === 400 ? payerMessage(json) : null;
    if (payer) throw new PayerDataError(payer);
    throw new Error(
      `Não foi possível gerar o Pix (Pix Black ${res?.status ?? "sem resposta"}). Tente novamente.`,
    );
  }
  console.log("pixblack-create", json.id, json.status);
  return { id: String(json.id), qrcode: String(qrcode), status: String(json.status ?? "pending") };
}

/**
 * Status real da cobrança (GET /charges/:id). Valor em centavos.
 * Status da Pix Black: pending, paid, expired, canceled, refunded. Só "paid" é venda (a regra única
 * de "pago" fica em pix-status.ts).
 */
export async function pixblackStatus(id: string): Promise<{ status: string; amount: number }> {
  const res = await fetch(`${PIXBLACK_API}/charges/${encodeURIComponent(id)}`, {
    headers: authHeaders(await requireKey()),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  const json = (await res.json().catch(() => null)) as any;
  // Só status no log (sem dados pessoais).
  console.log("pixblack-status", id, res.status, json?.status);
  if (!res.ok) throw new Error(`Pix Black HTTP ${res.status}`);
  return {
    status: String(json?.status ?? "pending").toLowerCase(),
    amount: Math.round(Number(json?.amount_cents ?? 0)),
  };
}

/**
 * Testa a chave sem criar cobrança: consulta uma cobrança inexistente. 404 = chave aceita;
 * 401 = chave recusada; 403 = IP não autorizado ou conta ainda não verificada.
 */
export async function testPixBlackKey(): Promise<{
  ok: boolean;
  status?: number | undefined;
  error?: string | undefined;
  note?: string | undefined;
}> {
  const key = await getPixBlackKey();
  if (!key) return { ok: false, error: "Nenhuma chave cadastrada" };
  try {
    const res = await fetch(`${PIXBLACK_API}/charges/00000000-0000-4000-8000-000000000000`, {
      headers: authHeaders(key),
    });
    if (res.status === 404 || res.ok) {
      return {
        ok: true,
        status: res.status,
        note: `Confira no painel da Pix Black (Integrações → Webhooks) o aviso de pagamento: URL ${PIXBLACK_WEBHOOK_URL}, evento charge.paid.`,
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
    const json = (await res.json().catch(() => null)) as any;
    return {
      ok: false,
      status: res.status,
      error:
        res.status === 401
          ? "Chave recusada pela Pix Black"
          : res.status === 403
            ? "Pix Black recusou: IP não autorizado ou conta ainda não verificada (KYC)"
            : String(json?.message ?? `Erro ${res.status}`).slice(0, 200),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha de conexão" };
  }
}
