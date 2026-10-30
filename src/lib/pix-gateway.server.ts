// Gateway do Pix escolhido no /admin: PixGate (padrão), Umbrella, SagacePay, PayShark, Koku ou Pix Black.
// Somente servidor.
// A escolha vale para os próximos Pix. Cada pedido guarda no id qual gateway gerou o Pix, então a
// consulta de status e o webhook continuam no gateway certo mesmo depois de uma troca.
// Se o gateway ativo falhar (conta desligada, chave recusada, fora do ar), o Pix sai pelo próximo
// gateway com chave, sem esperar alguém trocar no /admin.
import { getPixgateKey, PIXGATE_API } from "@/lib/pixgate.server";
import { brand } from "@/lib/brand";
import { PayerDataError } from "@/lib/pix-errors";
import {
  createUmbrellaPix,
  getUmbrellaKey,
  getUmbrellaTransaction,
  type UmbrellaAddress,
} from "@/lib/umbrella.server";
import { getSagacePayKey, sagaceCashin, sagaceStatus } from "@/lib/sagacepay.server";
import { getPaySharkKey, paysharkCashin, paysharkStatus } from "@/lib/payshark.server";
import { getKokuKey, kokuCashin, kokuStatus } from "@/lib/koku.server";
import { getPixBlackKey, pixblackCashin, pixblackStatus } from "@/lib/pixblack.server";

export const PIX_GATEWAYS = [
  "pixgate",
  "umbrella",
  "sagacepay",
  "payshark",
  "koku",
  "pixblack",
] as const;
export type PixGateway = (typeof PIX_GATEWAYS)[number];
export const PIX_GATEWAY_LABEL: Record<PixGateway, string> = {
  umbrella: "Umbrella",
  pixgate: "PixGate",
  sagacepay: "SagacePay",
  payshark: "PayShark",
  koku: "Koku",
  pixblack: "Pix Black",
};

/** Pedidos Pix da Umbrella são guardados com este prefixo (os da PixGate ficam sem prefixo). */
export const UMBRELLA_ORDER_PREFIX = "um_";
export const isUmbrellaOrderId = (id: string) => id.startsWith(UMBRELLA_ORDER_PREFIX);
/** Pedidos Pix da SagacePay são guardados com este prefixo. */
export const SAGACEPAY_ORDER_PREFIX = "sg_";
export const isSagacePayOrderId = (id: string) => id.startsWith(SAGACEPAY_ORDER_PREFIX);
/** Pedidos Pix da PayShark são guardados com este prefixo. */
export const PAYSHARK_ORDER_PREFIX = "ps_";
export const isPaySharkOrderId = (id: string) => id.startsWith(PAYSHARK_ORDER_PREFIX);
/** Pedidos Pix da Koku são guardados com este prefixo. */
export const KOKU_ORDER_PREFIX = "ko_";
export const isKokuOrderId = (id: string) => id.startsWith(KOKU_ORDER_PREFIX);
/** Pedidos Pix da Pix Black são guardados com este prefixo. */
export const PIXBLACK_ORDER_PREFIX = "pb_";
export const isPixBlackOrderId = (id: string) => id.startsWith(PIXBLACK_ORDER_PREFIX);

/** O Pix da SagacePay e da Koku expira em 30 minutos (mesmo prazo mostrado no checkout). */
const PIX_EXPIRES_IN_SECONDS = 30 * 60;

const SETTING = "pix_gateway";
const DEFAULT_GATEWAY: PixGateway = "pixgate";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const isGateway = (v: unknown): v is PixGateway => PIX_GATEWAYS.includes(v as PixGateway);

/** Gateway escolhido no /admin (null = nunca escolhido). Sem cache: a troca vale na hora. */
async function savedChoice(): Promise<PixGateway | null> {
  const { data } = await (
    await db()
  )
    .from("private_settings")
    .select("value")
    .eq("key", SETTING)
    .maybeSingle();
  return isGateway(data?.value) ? data.value : null;
}

/** Quais gateways têm chave cadastrada (painel ou secret do Lovable). */
async function configured(): Promise<Record<PixGateway, boolean>> {
  const [umbrella, pixgate, sagacepay, payshark, koku, pixblack] = await Promise.all([
    getUmbrellaKey().catch(() => null),
    getPixgateKey().catch(() => null),
    getSagacePayKey().catch(() => null),
    getPaySharkKey().catch(() => null),
    getKokuKey().catch(() => null),
    getPixBlackKey().catch(() => null),
  ]);
  return {
    umbrella: !!umbrella,
    pixgate: !!pixgate,
    sagacepay: !!sagacepay,
    payshark: !!payshark,
    koku: !!koku,
    pixblack: !!pixblack,
  };
}

/**
 * Gateway que gera os próximos Pix: o escolhido no /admin (padrão: PixGate). Se o escolhido estiver
 * sem chave e outro tiver, usa o outro para o checkout não parar.
 */
export async function getPixGatewayState(): Promise<{
  selected: PixGateway;
  active: PixGateway;
  configured: Record<PixGateway, boolean>;
}> {
  const [choice, keys] = await Promise.all([savedChoice(), configured()]);
  const selected = choice ?? DEFAULT_GATEWAY;
  const fallback = PIX_GATEWAYS.find((g) => g !== selected && keys[g]);
  const active = !keys[selected] && fallback ? fallback : selected;
  return { selected, active, configured: keys };
}

export async function savePixGateway(gateway: PixGateway): Promise<void> {
  const keys = await configured();
  if (!keys[gateway]) {
    throw new Error(`Cadastre a chave da ${PIX_GATEWAY_LABEL[gateway]} antes de ativá-la.`);
  }
  const { error } = await (
    await db()
  )
    .from("private_settings")
    .upsert({ key: SETTING, value: gateway, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export type PixCustomer = { name: string; email: string; phone: string; cpf: string };

type PixInput = {
  amount: number;
  customer: PixCustomer;
  address?: UmbrellaAddress | undefined;
  /** Nome genérico enviado ao gateway — sem detalhes do produto real. */
  description: string;
  origin: string;
  ip?: string | null | undefined;
};
type PixCharge = { id: string; qrcode: string; status: string };

/** Última vez que o Pix saiu pelo gateway reserva porque o ativo falhou (aparece no /admin). */
export type PixFallback = { from: PixGateway; to: PixGateway; reason: string; at: string };
const FALLBACK_SETTING = "pix_gateway_fallback";

/**
 * Gera a cobrança Pix no gateway ativo. Valor em centavos. O id devolvido já vem com o prefixo.
 * Se o ativo falhar por motivo do gateway, tenta uma vez o próximo com chave (ordem de PIX_GATEWAYS).
 * Dado do cliente recusado (PayerDataError) não troca de gateway: o reserva recusaria igual.
 */
export async function createPix(o: PixInput): Promise<PixCharge> {
  const { active, configured: keys } = await getPixGatewayState();
  try {
    return await chargeWith(active, o);
  } catch (e) {
    if (e instanceof PayerDataError) throw e;
    // A PayShark exige endereço: sem ele, ela não serve de reserva.
    const next = PIX_GATEWAYS.find(
      (g) => g !== active && keys[g] && (g !== "payshark" || !!o.address),
    );
    if (!next) throw e;
    const reason = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    // Só gateway e motivo no log (sem dados pessoais).
    console.warn(`pix-fallback ${active} -> ${next} ${reason}`);
    let charge: PixCharge;
    try {
      charge = await chargeWith(next, o);
    } catch (e2) {
      console.error(`pix-fallback-failed ${next}`, e2 instanceof Error ? e2.message : e2);
      // Se o reserva apontou o dado errado do cliente, essa mensagem ajuda mais que a do ativo.
      throw e2 instanceof PayerDataError ? e2 : e;
    }
    await saveFallback({ from: active, to: next, reason, at: new Date().toISOString() });
    return charge;
  }
}

async function saveFallback(f: PixFallback): Promise<void> {
  try {
    const { error } = await (
      await db()
    )
      .from("private_settings")
      .upsert({ key: FALLBACK_SETTING, value: JSON.stringify(f), updated_at: f.at });
    if (error) console.error("pix-fallback-save", error.message);
  } catch (e) {
    console.error("pix-fallback-save", e instanceof Error ? e.message : e);
  }
}

/** Última troca automática de gateway (null = nunca houve). */
export async function getLastPixFallback(): Promise<PixFallback | null> {
  const { data } = await (
    await db()
  )
    .from("private_settings")
    .select("value")
    .eq("key", FALLBACK_SETTING)
    .maybeSingle();
  try {
    const f = JSON.parse(String(data?.value ?? ""));
    if (!isGateway(f?.from) || !isGateway(f?.to) || typeof f?.at !== "string") return null;
    return { from: f.from, to: f.to, reason: String(f.reason ?? ""), at: f.at };
  } catch {
    return null;
  }
}

/** Gera a cobrança num gateway específico. O id devolvido já vem com o prefixo do gateway. */
async function chargeWith(gateway: PixGateway, o: PixInput): Promise<PixCharge> {
  // Sempre o domínio oficial: o navegador não escolhe para onde o gateway manda os avisos.
  const webhook = `${brand.siteUrl}/api/public/pix-webhook`;
  if (gateway === "umbrella") {
    const tx = await createUmbrellaPix({
      amount: o.amount,
      customer: o.customer,
      address: o.address,
      description: o.description,
      postbackUrl: `${webhook}?gw=um`,
      ip: o.ip,
    });
    return { ...tx, id: `${UMBRELLA_ORDER_PREFIX}${tx.id}` };
  }
  if (gateway === "sagacepay") {
    const tx = await sagaceCashin({
      amountCents: o.amount,
      customer: o.customer,
      description: o.description,
      postbackUrl: `${webhook}?gw=sg`,
      externalId: crypto.randomUUID(),
      expiresInSeconds: PIX_EXPIRES_IN_SECONDS,
    });
    return { ...tx, id: `${SAGACEPAY_ORDER_PREFIX}${tx.id}` };
  }
  if (gateway === "payshark") {
    const tx = await paysharkCashin({
      amountCents: o.amount,
      customer: o.customer,
      description: o.description,
      notificationUrl: `${webhook}?gw=ps`,
      externalRef: crypto.randomUUID(),
      ip: o.ip,
      address: o.address,
    });
    return { ...tx, id: `${PAYSHARK_ORDER_PREFIX}${tx.id}` };
  }
  if (gateway === "koku") {
    // Sem postback por cobrança: o webhook da Koku é cadastrado na conta (Testar no /admin cadastra).
    const tx = await kokuCashin({
      amountCents: o.amount,
      customer: o.customer,
      description: o.description,
      orderReference: crypto.randomUUID(),
      expiresInSeconds: PIX_EXPIRES_IN_SECONDS,
    });
    return { ...tx, id: `${KOKU_ORDER_PREFIX}${tx.id}` };
  }
  if (gateway === "pixblack") {
    // Sem postback por cobrança: o webhook da Pix Black é cadastrado no painel deles.
    const tx = await pixblackCashin({
      amountCents: o.amount,
      customer: o.customer,
      description: o.description,
      externalReference: crypto.randomUUID(),
    });
    return { ...tx, id: `${PIXBLACK_ORDER_PREFIX}${tx.id}` };
  }
  return pixgateCashin({ ...o, postback: webhook });
}

/** Status real de um pedido Pix no gateway que gerou o Pix. Valor em centavos. */
export async function fetchPixStatus(id: string): Promise<{ status: string; amount: number }> {
  if (isUmbrellaOrderId(id)) {
    const tx = await getUmbrellaTransaction(id.slice(UMBRELLA_ORDER_PREFIX.length));
    return { status: tx?.status ?? "waiting_payment", amount: tx?.amount ?? 0 };
  }
  if (isSagacePayOrderId(id)) return sagaceStatus(id.slice(SAGACEPAY_ORDER_PREFIX.length));
  if (isPaySharkOrderId(id)) return paysharkStatus(id.slice(PAYSHARK_ORDER_PREFIX.length));
  if (isKokuOrderId(id)) return kokuStatus(id.slice(KOKU_ORDER_PREFIX.length));
  if (isPixBlackOrderId(id)) return pixblackStatus(id.slice(PIXBLACK_ORDER_PREFIX.length));
  return pixgateStatus(id);
}

async function pixgateKey(): Promise<string> {
  const key = await getPixgateKey();
  if (!key) throw new Error("Pagamento indisponível no momento.");
  return key;
}

async function pixgateCashin(o: {
  amount: number;
  customer: PixCustomer;
  description: string;
  postback: string;
}) {
  // PixGate recebe o valor em reais (decimal); internamente seguimos em centavos.
  const valor = Number((o.amount / 100).toFixed(2));
  const res = await fetch(`${PIXGATE_API}/v1/cashin`, {
    method: "POST",
    headers: {
      Apikey: await pixgateKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      nome: o.customer.name,
      cpf: o.customer.cpf,
      valor,
      descricao: o.description,
      postback: o.postback,
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  const json = (await res.json().catch(() => null)) as any;
  const txId = json?.id;
  const qrcode = json?.pix;
  if (!res.ok || !txId || !qrcode) {
    console.error("PixGate error", res.status, JSON.stringify(json)?.slice(0, 500));
    throw new Error("Não foi possível gerar o Pix. Confira seus dados e tente novamente.");
  }
  return {
    id: String(txId),
    qrcode: String(qrcode),
    status: String(json?.status ?? "pending").toLowerCase(),
  };
}

async function pixgateStatus(id: string): Promise<{ status: string; amount: number }> {
  const res = await fetch(`${PIXGATE_API}/stats/${encodeURIComponent(id)}`, {
    headers: { Apikey: await pixgateKey(), Accept: "application/json" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  const json = (await res.json().catch(() => null)) as any;
  // Status bruto no log (só status e nomes dos campos, sem dados pessoais) para auditar a regra de "pago".
  console.log(
    "pixgate-status",
    id,
    JSON.stringify(json?.status),
    Object.keys(json ?? {}).join(","),
  );
  // PixGate devolve o valor em reais; mantemos tudo em centavos internamente.
  return {
    status: String(json?.status ?? "pending").toLowerCase(),
    amount: Math.round(Number(json?.value ?? 0) * 100),
  };
}
