// Pedidos Pix guardados no servidor para que a aprovação seja reportada
// (UTMify + Meta CAPI) mesmo que o cliente feche a página. Somente servidor.
import { sendUtmifyOrder, type UtmParams } from "@/lib/utmify.server";
import { sendCapiEvent } from "@/lib/meta.server";
import {
  sendRotasyncOrder,
  type RotasyncAddress,
  type RotasyncOrder,
  type RotasyncResult,
} from "@/lib/rotasync.server";
import {
  batteryLabel,
  batteryPack,
  EXPRESS_SHIPPING,
  SHIPPING_INSURANCE,
  upsellStepOf,
  type UpsellProduct,
  type UpsellStep,
} from "@/lib/upsell";
import { getBundle } from "@/lib/bundles";
import { brand } from "@/lib/brand";
import { isPaidStatus } from "@/lib/pix-status";
import { getCardTransaction, isCardOrderId, CARD_ORDER_PREFIX } from "@/lib/hypercash.server";
import { fetchPixStatus } from "@/lib/pix-gateway.server";

export type StoredCustomer = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  endereco?: string;
  /** Endereço por partes (pedidos a partir da integração com a RastroCode). */
  address?: RotasyncAddress;
  frete?: { id: string; name: string; price: number };
  bumps?: { id: string; name: string; price: number }[];
  /** Produto principal com a variação escolhida (cor, tamanho, personagem), para o envio. */
  itemName?: string;
  /** Formato antigo (um só bump). */
  bump?: { id: string; name: string; price: number };
  /** Id do pedido original quando este é um upsell pós-compra. */
  upsellOf?: string;
  /** Ofertas pós-compra desta cobrança (sem o campo = só o kit extra). */
  upsellItems?: UpsellProduct[];
  /** Código Pix copia-e-cola (guardado no upsell para reexibir sem cobrar de novo). */
  qrcode?: string;
  /** Forma de pagamento (pedidos antigos não têm: são Pix). */
  method?: "pix" | "card";
  installments?: number;
  card?: { brand?: string; lastDigits?: string };
  /** Desconto do Pix aplicado (reais). */
  discount?: number;
  /** Cobrança de teste (admin) feita após o pedido indicado. Não é reportada a lugar nenhum. */
  testOf?: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Tabela nova ainda não presente nos tipos gerados.
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

export async function saveOrder(o: {
  id: string;
  amountCents: number;
  customer: StoredCustomer;
  bundleId: string;
  bundleName: string;
  utm?: UtmParams;
  ip?: string | null;
  ua?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  /** Momento da criação (ms). O mesmo valor vai para a UTMify no "pendente" e no "pago". */
  createdAt?: number;
}): Promise<void> {
  try {
    const db = await admin();
    const { error } = await db.from("pix_orders").upsert({
      id: o.id,
      ...(o.createdAt ? { created_at: new Date(o.createdAt).toISOString() } : {}),
      amount_cents: o.amountCents,
      customer: o.customer,
      bundle_id: o.bundleId,
      bundle_name: o.bundleName,
      utm: o.utm ?? {},
      ip: o.ip ?? null,
      ua: o.ua ?? null,
      fbp: o.fbp ?? null,
      fbc: o.fbc ?? null,
    });
    if (error) console.error("saveOrder error", error.message);
  } catch (e) {
    console.error("saveOrder failed", e);
  }
}

export type StoredOrder = {
  id: string;
  status: string;
  amount_cents: number;
  customer: StoredCustomer;
  bundle_id: string;
  bundle_name: string;
  utm: UtmParams | null;
  fbp: string | null;
  fbc: string | null;
};

export async function getOrder(id: string): Promise<StoredOrder | null> {
  const db = await admin();
  const { data } = await db.from("pix_orders").select("*").eq("id", id).maybeSingle();
  return (data as StoredOrder | null) ?? null;
}

/**
 * Upsell já gerado para um pedido (evita cobranças duplicadas). São três etapas independentes:
 * as pilhas, as ofertas (kit e/ou seguro) e, por fim, o envio expresso.
 */
export async function findUpsellOf(
  parentId: string,
  step: UpsellStep,
): Promise<StoredOrder | null> {
  const db = await admin();
  const { data } = await db
    .from("pix_orders")
    .select("*")
    .eq("customer->>upsellOf", parentId)
    .order("created_at", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as StoredOrder[];
  return rows.find((o) => upsellStepOf(o.customer?.upsellItems ?? ["kit"]) === step) ?? null;
}

/**
 * Avisa a UTMify que o Pix foi gerado (status "waiting_payment"). Isso NÃO conta como venda/conversão:
 * a UTMify só considera venda quando o mesmo orderId chega depois com status "paid".
 */
export async function reportPendingToUtmify(o: {
  id: string;
  amountCents: number;
  customer: StoredCustomer;
  bundleId: string;
  bundleName: string;
  utm?: UtmParams;
  ip?: string | null;
  createdAt: number;
}): Promise<void> {
  // Upsell não vira pedido próprio na UTMify: quando pago, soma no pedido principal (sendUtmifyMainOrder).
  if (o.customer.upsellOf) return;
  const r = await sendUtmifyOrder({
    orderId: o.id,
    status: "waiting_payment",
    // A UTMify exige a MESMA data de criação no envio pendente e no pago.
    createdAt: o.createdAt,
    approvedAt: null,
    customer: {
      name: o.customer.name,
      email: o.customer.email,
      phone: o.customer.phone,
      document: o.customer.cpf,
      ip: o.ip ?? null,
    },
    products: [
      { id: o.bundleId, name: `${brand.name} -${o.bundleName}`, priceInCents: o.amountCents },
    ],
    amountCents: o.amountCents,
    utm: o.utm ?? {},
    paymentMethod: o.customer.method === "card" ? "credit_card" : "pix",
  });
  if (!r.ok) console.error("UTMify pending failed", o.id, r.error);
  // Guarda a resposta no pedido para aparecer no admin (seção Técnico).
  try {
    const db = await admin();
    await db
      .from("pix_orders")
      .update({ report_result: { utmifyPending: { ...r, at: new Date().toISOString() } } })
      .eq("id", o.id)
      .is("paid_reported_at", null);
  } catch (e) {
    console.error("UTMify pending save failed", e);
  }
}

export { isPaidStatus };

/** Consulta o status real no gateway. */
export async function fetchGatewayStatus(id: string): Promise<{ status: string; amount: number }> {
  if (isCardOrderId(id)) {
    const tx = await getCardTransaction(id.slice(CARD_ORDER_PREFIX.length));
    // HyperCash já devolve o valor em centavos.
    return { status: tx?.status ?? "processing", amount: tx?.amount ?? 0 };
  }
  // Pix: Umbrella ("um_"), SagacePay ("sg_"), PayShark ("ps_"), Koku ("ko_") ou PixGate (sem prefixo).
  return fetchPixStatus(id);
}

/**
 * UTMify: o pedido principal com os upsells já pagos somados (pilhas, kit/seguro e envio expresso), para cada
 * cliente ser 1 venda com o total certo. Reenviado a cada pagamento (principal ou upsell): a UTMify
 * atualiza o mesmo pedido pelo orderId.
 */
async function sendUtmifyMainOrder(mainId: string) {
  const db = await admin();
  const { data: main } = await db.from("pix_orders").select("*").eq("id", mainId).maybeSingle();
  if (!main) return { ok: false, error: "Pedido principal não encontrado" };
  const { data: ups } = await db
    .from("pix_orders")
    .select("*")
    .eq("customer->>upsellOf", mainId)
    .order("created_at", { ascending: true });
  const paidUpsells = ((ups ?? []) as StoredOrder[]).filter((u) => isPaidStatus(u.status));
  const c = main.customer as StoredCustomer;
  const products = [
    {
      id: main.bundle_id,
      name: `${brand.name} -${main.bundle_name}`,
      priceInCents: main.amount_cents,
    },
    ...paidUpsells.map((u) => ({
      id: `upsell-${(u.customer.upsellItems ?? ["kit"]).join("-")}`,
      name: u.bundle_name,
      priceInCents: u.amount_cents,
    })),
  ];
  return sendUtmifyOrder({
    orderId: mainId,
    status: "paid",
    createdAt: new Date(main.created_at).getTime(),
    approvedAt: main.paid_reported_at ? new Date(main.paid_reported_at).getTime() : Date.now(),
    customer: { name: c.name, email: c.email, phone: c.phone, document: c.cpf, ip: main.ip },
    products,
    amountCents: products.reduce((s, p) => s + p.priceInCents, 0),
    utm: main.utm ?? {},
    paymentMethod: c.method === "card" ? "credit_card" : "pix",
  });
}

/**
 * Reporta a venda aprovada uma única vez (idempotente via paid_reported_at).
 * `extra` traz cookies do Meta/URL quando a chamada vem do navegador.
 */
export async function reportPaidOnce(
  id: string,
  gatewayAmount: number,
  extra?: {
    fbp?: string | null;
    fbc?: string | null;
    url?: string;
    ip?: string | null;
    ua?: string | null;
  },
): Promise<void> {
  try {
    const db = await admin();
    // Trava atômica: só quem conseguir marcar paid_reported_at envia.
    const { data: rows, error } = await db
      .from("pix_orders")
      .update({
        status: "paid",
        paid_reported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("paid_reported_at", null)
      .select("*");
    if (error) {
      console.error("reportPaidOnce lock error", error.message);
      return;
    }
    const o = rows?.[0];
    if (!o) return; // já reportado ou pedido desconhecido

    // Cobrança de teste do admin: marca como paga, mas não vira venda em lugar nenhum.
    if ((o.customer as StoredCustomer)?.testOf) {
      await db
        .from("pix_orders")
        .update({
          report_result: { skipped: "cobrança de teste do admin", at: new Date().toISOString() },
        })
        .eq("id", id);
      return;
    }

    const amount =
      Number.isFinite(gatewayAmount) && gatewayAmount > 0 ? gatewayAmount : o.amount_cents;
    const c = o.customer as StoredCustomer;
    const productName = `${brand.name} -${o.bundle_name}`;
    // Upsell (kit/seguro, envio expresso) não é venda nova: na UTMify soma no pedido principal; no Meta
    // vai como evento "Upsell" (não conta como compra da campanha).
    const upsellOf = c.upsellOf;
    // Canal que já confirmou o recebimento numa tentativa anterior não recebe de novo (sem duplicar venda).
    const done = (o.report_result ?? {}) as { utmify?: { ok?: boolean }; meta?: { ok?: boolean } };
    const utmify = done.utmify?.ok ? done.utmify : await sendUtmifyMainOrder(upsellOf ?? id);
    const meta = done.meta?.ok
      ? done.meta
      : await sendCapiEvent({
          eventName: upsellOf ? "Upsell" : "Purchase",
          eventId: `${upsellOf ? "upsell" : "purchase"}-${id}`,
          url: extra?.url,
          user: {
            email: c.email,
            phone: c.phone,
            name: c.name,
            cpf: c.cpf,
            fbp: extra?.fbp ?? o.fbp ?? null,
            fbc: extra?.fbc ?? o.fbc ?? null,
            ip: extra?.ip ?? o.ip ?? null,
            ua: extra?.ua ?? o.ua ?? null,
          },
          customData: {
            value: amount / 100,
            currency: "BRL",
            content_name: productName,
            content_ids: [o.bundle_id],
            content_type: "product",
            order_id: id,
          },
        });
    // Rastreio (Rotasync). Se a API já respondeu de forma definitiva (sucesso, 422, 401, 402, 403),
    // não reenvia; pedidos que ficaram de fora vão pelo /admin (RotaSync → Pedidos antigos).
    const prev = (o.report_result as { rastro?: RastroSalvo } | null)?.rastro;
    const rastroDone =
      !!prev && (jaNaRotasync(prev) || [401, 402, 403, 413, 415, 422].includes(prev.status ?? 0));
    const pedido = rastroDone ? null : await pedidoRotasync(o as StoredOrder);
    const rastro = !pedido
      ? prev
      : "skipped" in pedido
        ? { ok: false, skipped: pedido.skipped }
        : await sendRotasyncOrder(pedido);
    // O rastreio fica fora do allOk: é idempotente por external_id e um 422 não deve ser retentado.
    const allOk = utmify.ok && meta.ok;
    console.log("reportPaidOnce", id, JSON.stringify({ utmify, meta, rastro }));
    // Guarda o resultado; se algo falhou, libera a trava para nova tentativa.
    await db
      .from("pix_orders")
      .update({
        report_result: {
          ...((o.report_result as Record<string, unknown> | null) ?? {}),
          utmify,
          meta,
          rastro,
          at: new Date().toISOString(),
        },
        ...(allOk ? {} : { paid_reported_at: null }),
        ...(extra?.fbp ? { fbp: extra.fbp } : {}),
        ...(extra?.fbc ? { fbc: extra.fbc } : {}),
      })
      .eq("id", id);
  } catch (e) {
    console.error("reportPaidOnce failed", e);
  }
}

// ---------------------------------------------------------------------------------------------
// RotaSync: o mesmo pedido serve para o envio automático (reportPaidOnce) e para o /admin.

type RastroSalvo = { ok?: boolean; status?: number; skipped?: string; error?: string };

/** Já está na RotaSync (os "pulados" antigos do pós-compra eram ok:true sem ter ido). */
const jaNaRotasync = (r?: RastroSalvo | null) => !!r?.ok && !r.skipped;

/** Nome de cada oferta do pós-compra para o estoque (a unidade extra leva a variação do pedido). */
function itemPosCompra(p: UpsellProduct, principal: string): string {
  if (p === "kit") return `Mais 1 unidade - ${brand.name} - ${principal}`;
  const b = batteryPack(p);
  if (b) return batteryLabel(b);
  return p === "seguro" ? SHIPPING_INSURANCE.name : EXPRESS_SHIPPING.name;
}

/**
 * Produto principal com a variação. Pedidos novos guardam em itemName; nos antigos o nome do
 * pedido é "produto + extras" e os extras já vão como itens próprios, então tira do fim
 * os extras (senão o estoque separa em dobro).
 */
function produtoPrincipal(o: StoredOrder): string {
  const c = o.customer;
  if (c.itemName) return c.itemName;
  let nome = o.bundle_name || getBundle(o.bundle_id).name;
  for (const b of [...(c.bumps ?? (c.bump ? [c.bump] : []))].reverse()) {
    if (nome.endsWith(` + ${b.name}`)) nome = nome.slice(0, -(b.name.length + 3));
    else {
      // O nome curto do extra (no pedido) pode diferir do completo (nos itens): tira o último.
      const i = nome.lastIndexOf(" + ");
      if (i > 0) nome = nome.slice(0, i);
    }
  }
  return nome;
}

/** Pedido pago no formato da RotaSync, ou o motivo de não ir. */
async function pedidoRotasync(o: StoredOrder): Promise<RotasyncOrder | { skipped: string }> {
  const c = o.customer;
  if (c.testOf) return { skipped: "cobrança de teste do admin" };
  // Pós-compra: o pedido original já foi enviado quando foi pago, então vai como complemento,
  // com o endereço do original.
  if (c.upsellOf) {
    const main = await getOrder(c.upsellOf);
    const mc = main?.customer;
    if (!main || !mc?.address) return { skipped: "pedido original sem endereço por partes" };
    const principal = produtoPrincipal(main);
    return {
      transactionId: o.id,
      customer: { name: mc.name, email: mc.email, phone: mc.phone, document: mc.cpf },
      address: mc.address,
      products: (c.upsellItems ?? ["kit"]).map((p) => ({
        name: `Complemento do pedido ${main.id}: ${itemPosCompra(p, principal)}`,
        quantity: 1,
        price: 0,
      })),
    };
  }
  if (!c.address) return { skipped: "pedido sem endereço por partes" };
  return {
    transactionId: o.id,
    customer: { name: c.name, email: c.email, phone: c.phone, document: c.cpf },
    address: c.address,
    products: [
      {
        // Produto com a variação escolhida (só ele: os extras vêm a seguir).
        name: `${brand.name} - ${produtoPrincipal(o)}`,
        quantity: 1,
        price: getBundle(o.bundle_id).price,
      },
      ...(c.bumps ?? (c.bump ? [c.bump] : [])).map((b) => ({
        name: b.name,
        quantity: 1,
        price: b.price,
      })),
    ],
  };
}

export type RotasyncPendente = {
  id: string;
  criadoEm: string;
  cliente: string;
  itens: string[];
  totalCents: number;
};

type PedidoSalvo = StoredOrder & { created_at: string; report_result?: unknown };
const rastroDe = (o: PedidoSalvo) =>
  (o.report_result as { rastro?: RastroSalvo } | null)?.rastro ?? null;

/** Pedidos pagos (entre os 500 mais recentes) que ainda não chegaram à RotaSync. */
export async function listarPendentesRotasync(): Promise<{
  pendentes: RotasyncPendente[];
  semEndereco: number;
}> {
  const db = await admin();
  const { data, error } = await db
    .from("pix_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const pendentes: RotasyncPendente[] = [];
  let semEndereco = 0;
  for (const o of (data ?? []) as PedidoSalvo[]) {
    if (!isPaidStatus(o.status) || o.customer?.testOf || jaNaRotasync(rastroDe(o))) continue;
    const pedido = await pedidoRotasync(o);
    if ("skipped" in pedido) {
      semEndereco++;
      continue;
    }
    pendentes.push({
      id: o.id,
      criadoEm: o.created_at,
      cliente: o.customer.name,
      itens: pedido.products.map((p) => p.name),
      totalCents: o.amount_cents,
    });
  }
  return { pendentes, semEndereco };
}

/** Envia os pedidos escolhidos no /admin (a RotaSync ignora repetidos pelo external_id). */
export async function enviarPendentesRotasync(
  ids: string[],
): Promise<{ id: string; ok: boolean; error?: string; trackingCode?: string }[]> {
  const db = await admin();
  const out: { id: string; ok: boolean; error?: string; trackingCode?: string }[] = [];
  for (const id of ids) {
    const { data } = await db.from("pix_orders").select("*").eq("id", id).maybeSingle();
    const o = data as PedidoSalvo | null;
    if (!o || !isPaidStatus(o.status)) {
      out.push({ id, ok: false, error: "pedido não está pago" });
      continue;
    }
    if (jaNaRotasync(rastroDe(o))) {
      out.push({ id, ok: true, error: "já estava na RotaSync" });
      continue;
    }
    const pedido = await pedidoRotasync(o);
    if ("skipped" in pedido) {
      out.push({ id, ok: false, error: pedido.skipped });
      continue;
    }
    const r: RotasyncResult = await sendRotasyncOrder(pedido);
    await db
      .from("pix_orders")
      .update({
        report_result: {
          ...((o.report_result as Record<string, unknown> | null) ?? {}),
          rastro: r,
          rastroManualEm: new Date().toISOString(),
        },
      })
      .eq("id", id);
    const detalhe = (r.details as { error?: { message?: string } } | undefined)?.error?.message;
    out.push({
      id,
      ok: r.ok,
      error: r.ok ? undefined : [r.error, detalhe].filter(Boolean).join(": "),
      trackingCode: r.trackingCode,
    });
  }
  return out;
}

/** Status da Koku e da Pix Black que encerram a cobrança, gravados com o nome que o /admin já mostra. */
const KOKU_FINAL: Record<string, string> = {
  expired: "expired",
  cancelled: "expired",
  canceled: "expired",
  failed: "refused",
  refunded: "refunded",
};
let lastKokuReconcile = 0;

/**
 * Pedidos Koku e Pix Black ainda pendentes das últimas 72 h: consulta no gateway e reporta os pagos
 * (loja, UTMify e RotaSync). Cobre quem pagou no app do banco e não voltou para a tela do pedido
 * enquanto o aviso de pagamento da loja não estava cadastrado no gateway. Roda quando o /admin carrega
 * os pedidos, no máximo 1 vez por minuto por instância; cobrança encerrada sai da lista.
 */
export async function reconcilePendingPix(): Promise<{ checked: number; paid: number }> {
  if (Date.now() - lastKokuReconcile < 60_000) return { checked: 0, paid: 0 };
  lastKokuReconcile = Date.now();
  const db = await admin();
  const { data, error } = await db
    .from("pix_orders")
    .select("id")
    .or("id.like.ko_%,id.like.pb_%")
    .is("paid_reported_at", null)
    .not("status", "in", "(paid,expired,refused,refunded)")
    .gte("created_at", new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("pix-reconcile query", error.message);
    return { checked: 0, paid: 0 };
  }
  const ids = ((data ?? []) as { id: string }[]).map((o) => o.id).filter((id) => id.startsWith("ko_") || id.startsWith("pb_"));
  let paid = 0;
  for (let i = 0; i < ids.length; i += 5) {
    await Promise.all(
      ids.slice(i, i + 5).map(async (id) => {
        try {
          const { status, amount } = await fetchGatewayStatus(id);
          if (isPaidStatus(status)) {
            await reportPaidOnce(id, amount);
            paid++;
          } else if (KOKU_FINAL[status]) {
            await db
              .from("pix_orders")
              .update({ status: KOKU_FINAL[status], updated_at: new Date().toISOString() })
              .eq("id", id)
              .is("paid_reported_at", null);
          }
        } catch (e) {
          console.error("pix-reconcile", id, e instanceof Error ? e.message : e);
        }
      }),
    );
  }
  console.log("pix-reconcile", ids.length, "conferidos,", paid, "pagos");
  return { checked: ids.length, paid };
}
