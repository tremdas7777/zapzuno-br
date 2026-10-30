import { createServerFn } from "@tanstack/react-start";
import { senhaAdminOk } from "@/lib/admin-guard.server";
import { z } from "zod";
import {
  getBundle,
  isFreeShippingEligible,
  parseBundleId,
  parseVariant,
  productLabel,
  variantInStock,
  withVariantPrice,
  FREE_SHIPPING_MIN,
} from "@/lib/bundles";
import { ensureCatalog } from "@/lib/catalog.server";
import { brand } from "@/lib/brand";
import { getBumps } from "@/lib/order-bump";
import {
  saveOrder,
  fetchGatewayStatus,
  reportPaidOnce,
  reportPendingToUtmify,
  getOrder,
  findUpsellOf,
  reconcilePendingPix,
} from "@/lib/pix-orders.server";
import { createCardTransaction, CARD_ORDER_PREFIX, getHypercashKeys } from "@/lib/hypercash.server";
import { createPix } from "@/lib/pix-gateway.server";
import { isPaidStatus } from "@/lib/pix-status";
import { boughtBundle, UPSELL_PRODUCTS, upsellSelection, upsellStepOf } from "@/lib/upsell";
import { getRequest } from "@tanstack/react-start/server";
import { checkoutTotals, CARD_MAX_INSTALLMENTS } from "@/lib/payment-pricing";

const utmSchema = z.record(z.string(), z.string().max(300).nullable()).optional().default({});

function isValidCpf(raw: string): boolean {
  const c = raw.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const t of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += Number(c[i]) * (t + 1 - i);
    const d = ((sum * 10) % 11) % 10;
    if (d !== Number(c[t])) return false;
  }
  return true;
}

const customerSchema = z.object({
  plano: z.string().max(80),
  /** Opções escolhidas (cor/tamanho; nos kits, peça e tamanho de cada vaga), separadas por "|". */
  variante: z.string().max(400).optional(),
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(160),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().min(10).max(11)),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine(isValidCpf, "CPF inválido"),
  origin: z.string().url(),
  frete: z.enum(["gratis", "padrao", "express"]).default("padrao"),
  endereco: z.string().max(300).optional(),
  // Endereço por partes (RastroCode). Opcional: clientes antigos não enviam.
  address: z
    .object({
      street: z.string().trim().min(1).max(200),
      number: z.string().trim().min(1).max(20),
      complement: z.string().trim().max(200).optional(),
      neighborhood: z.string().trim().min(1).max(120),
      city: z.string().trim().min(1).max(120),
      state: z.string().trim().length(2),
      zipcode: z.string().regex(/^\d{8}$/),
    })
    .optional(),
  /** Order bumps marcados (ids desconhecidos são ignorados; preço sempre do servidor). */
  bumps: z.array(z.string().max(40)).max(5).default([]),
  bump: z.boolean().default(false),
  /** Demais produtos do carrinho. Preço sempre do catálogo. */
  itens: z
    .array(
      z.object({
        plano: z.string().max(80),
        variante: z.string().max(400).optional(),
        qtd: z.number().int().min(1).max(10),
      }),
    )
    .max(20)
    .default([]),
  utm: utmSchema,
});

type Extras = {
  bumps: readonly string[];
  bump: boolean;
  itens: readonly { plano: string; variante?: string | undefined; qtd: number }[];
};
/** Demais produtos do carrinho, validados e com preço do catálogo. */
const cartExtras = (d: Extras) =>
  d.itens.map((it) => {
    const { bundle, itemName } = resolveProduct(it);
    const name = it.qtd > 1 ? `${it.qtd}x ${itemName}` : itemName;
    return {
      id: bundle.id,
      name,
      fullName: name,
      gatewayName: brand.gatewayName,
      price: Math.round(bundle.price * it.qtd * 100) / 100,
    };
  });
/** Itens além do produto (carrinho e order bumps), com preço do servidor. */
const chosenExtras = (d: Extras) => [...cartExtras(d), ...getBumps(d.bumps)];
const extrasTotal = (d: Extras) =>
  Math.round(chosenExtras(d).reduce((s, b) => s + b.price * 100, 0)) / 100;
const storedBumps = (d: Extras) =>
  chosenExtras(d).map((b) => ({ id: b.id, name: b.fullName, price: b.price }));
const orderName = (bundleName: string, d: Extras) =>
  [bundleName, ...chosenExtras(d).map((b) => b.name)].join(" + ");

/**
 * Produto + variação validados no servidor. O preço vem só do catálogo (o da variação
 * escolhida), nunca do cliente; variação sem estoque é recusada.
 * Chame `await ensureCatalog()` antes (o catálogo vem do banco).
 */
function resolveProduct(d: { plano: string; variante?: string | undefined }) {
  const id = parseBundleId(d.plano);
  if (!id) throw new Error("Produto inválido. Volte à loja e escolha o produto de novo.");
  const base = getBundle(id);
  const values = parseVariant(base, d.variante);
  if (!values) throw new Error("Escolha as opções do produto (tamanho e cor) antes de pagar.");
  if (!variantInStock(base, values))
    throw new Error(`${base.name}: essa opção acabou de esgotar. Volte e escolha outra.`);
  return { bundle: withVariantPrice(base, values), itemName: productLabel(base, values) };
}

/** Regras de preço do checkout (espelhadas no cliente só para exibição). */
export const FRETES = [
  { id: "gratis", name: "Frete Grátis", eta: "7 a 10 dias úteis", price: 0 },
  { id: "padrao", name: "Frete Padrão", eta: "5 dias úteis", price: 20 },
  { id: "express", name: "Frete Express", eta: "1 a 2 dias úteis", price: 37.53 },
] as const;
export type FreteId = (typeof FRETES)[number]["id"];
export const getFrete = (id: FreteId) => FRETES.find((f) => f.id === id) ?? FRETES[0];

export type PixCharge = { id: string; qrcode: string; amount: number; status: string };

function requestMeta() {
  const h = getRequest()?.headers;
  return {
    ip: h?.get("cf-connecting-ip") ?? h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    ua: h?.get("user-agent") ?? null,
  };
}

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => customerSchema.parse(d))
  .handler(async ({ data }): Promise<PixCharge> => {
    // Preço sempre definido no servidor — nunca confiar no cliente.
    await ensureCatalog();
    const { bundle, itemName } = resolveProduct(data);
    if (data.frete === "gratis" && !isFreeShippingEligible(bundle.price + extrasTotal(data))) {
      throw new Error(
        `Frete grátis disponível apenas para compras acima de R$ ${FREE_SHIPPING_MIN}.`,
      );
    }
    const freteOpt = getFrete(data.frete);
    // Pix: 10% de desconto nos produtos (o frete não entra no desconto).
    const totals = checkoutTotals({
      products: bundle.price + extrasTotal(data),
      frete: freteOpt.price,
      method: "pix",
      pixDiscount: await isCardEnabled().catch(() => false),
    });
    const amount = totals.total;
    const { ip, ua } = requestMeta();
    // Gateway escolhido no /admin (Umbrella ou PixGate).
    const charge = await createPix({
      amount,
      customer: { name: data.name, email: data.email, phone: data.phone, cpf: data.cpf },
      address: data.address,
      // Nome genérico enviado ao gateway — sem detalhes do produto real.
      description: brand.gatewayName,
      origin: data.origin,
      ip,
    });
    // Guarda o pedido no servidor para reportar a aprovação mesmo sem o cliente na página.
    const orderData = {
      createdAt: Date.now(),
      id: charge.id,
      amountCents: amount,
      customer: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        cpf: data.cpf,
        endereco: data.endereco?.replace(/\s+/g, " ").trim(),
        ...(data.address ? { address: data.address } : {}),
        // Pix copia e cola, para o admin poder reenviar ao cliente.
        qrcode: charge.qrcode,
        frete: { id: freteOpt.id, name: freteOpt.name, price: freteOpt.price },
        bumps: storedBumps(data),
        itemName,
        method: "pix" as const,
        discount: totals.discount / 100,
      },
      bundleId: bundle.id,
      bundleName: orderName(itemName, data),
      utm: data.utm,
      ip,
      ua,
    };
    await saveOrder(orderData);
    // Pix gerado → UTMify como pendente (não é conversão; só "paid" conta como venda).
    await reportPendingToUtmify(orderData);
    return { id: charge.id, qrcode: charge.qrcode, amount, status: charge.status };
  });

export type CardCharge = { id: string; amount: number; status: string; paid: boolean };

/** Liga/desliga do cartão no admin (site_settings.card_enabled). DESLIGADO até ativar no painel. */
async function isCardEnabled(): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "card_enabled")
    .maybeSingle();
  return data?.value === true;
}

/** Com o cartão desligado, quem está logado no admin (mesmo navegador) ainda consegue testar. */
const isAdmin = (pwd?: string) => senhaAdminOk(pwd);

/** Chave PÚBLICA da HyperCash (pode ir para o navegador; a secreta fica só no servidor). */
export const getCardConfig = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ adminPassword: z.string().max(200).optional() })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    // Liberado aos clientes no admin = cartão para todos + desconto do Pix.
    const publicOn = await isCardEnabled().catch(() => false);
    const enabled = publicOn || isAdmin(data?.adminPassword);
    const publicKey = enabled ? (await getHypercashKeys().catch(() => null))?.public : null;
    return { enabled: enabled && !!publicKey, publicKey: publicKey ?? null, pixDiscount: publicOn };
  });

const cardSchema = customerSchema.extend({
  // Token gerado pelo SDK da HyperCash no navegador. O número do cartão nunca chega aqui.
  cardHash: z.string().min(10).max(4000),
  installments: z.number().int().min(1).max(CARD_MAX_INSTALLMENTS),
  adminPassword: z.string().max(200).optional(),
});

/** Cobra no cartão (HyperCash). Preço de tabela, sem o desconto do Pix. */
export const createCardCharge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cardSchema.parse(d))
  .handler(async ({ data }): Promise<CardCharge> => {
    await ensureCatalog();
    if (!isAdmin(data.adminPassword) && !(await isCardEnabled()))
      throw new Error("Pagamento com cartão indisponível. Pague com Pix.");
    const { bundle, itemName } = resolveProduct(data);
    if (data.frete === "gratis" && !isFreeShippingEligible(bundle.price + extrasTotal(data))) {
      throw new Error(
        `Frete grátis disponível apenas para compras acima de R$ ${FREE_SHIPPING_MIN}.`,
      );
    }
    if (!data.address) throw new Error("Confira o CEP e o endereço de entrega.");
    const freteOpt = getFrete(data.frete);
    const totals = checkoutTotals({
      products: bundle.price + extrasTotal(data),
      frete: freteOpt.price,
      method: "card",
      pixDiscount: false,
    });
    const { ip, ua } = requestMeta();
    const a = data.address;
    const address = {
      street: a.street,
      streetNumber: a.number,
      complement: a.complement || "Sem complemento",
      zipCode: a.zipcode,
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state.toUpperCase(),
      country: "BR" as const,
    };
    const tx = await createCardTransaction({
      amount: totals.total,
      cardHash: data.cardHash,
      installments: data.installments,
      customer: { name: data.name, email: data.email, phone: data.phone, cpf: data.cpf },
      address,
      shippingFee: totals.frete,
      // Nome genérico (igual ao Pix) — sem detalhes do produto real na fatura.
      items: [
        { title: brand.gatewayName, unitPrice: Math.round(bundle.price * 100), quantity: 1 },
        ...chosenExtras(data).map((b) => ({
          title: b.gatewayName,
          unitPrice: Math.round(b.price * 100),
          quantity: 1,
        })),
      ],
      postbackUrl: `${brand.siteUrl}/api/public/pix-webhook?gw=hc`,
      ip,
    });
    if (["refused", "canceled", "cancelled", "failed"].includes(tx.status)) {
      throw new Error(
        `Pagamento recusado: ${tx.refusedReason ?? "o banco emissor não informou o motivo"}. Confira os dados do cartão ou pague com Pix.`,
      );
    }
    const id = `${CARD_ORDER_PREFIX}${tx.id}`;
    const orderData = {
      createdAt: Date.now(),
      id,
      amountCents: totals.total,
      customer: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        cpf: data.cpf,
        endereco: data.endereco?.replace(/\s+/g, " ").trim(),
        address: data.address,
        frete: { id: freteOpt.id, name: freteOpt.name, price: freteOpt.price },
        bumps: storedBumps(data),
        itemName,
        method: "card" as const,
        installments: data.installments,
        ...(tx.card ? { card: tx.card } : {}),
      },
      bundleId: bundle.id,
      bundleName: orderName(itemName, data),
      utm: data.utm,
      ip,
      ua,
    };
    await saveOrder(orderData);
    const paid = isPaidStatus(tx.status);
    // Aprovado na hora: a conversão é reportada pela página do pedido (getPixStatus → reportPaidOnce).
    // Em análise: avisa a UTMify como pendente, igual ao Pix gerado.
    if (!paid) await reportPendingToUtmify(orderData);
    return { id, amount: totals.total, status: tx.status, paid };
  });

/**
 * Etapa do pós-compra: pilhas (um pacote), ofertas (kit e/ou seguro) ou envio expresso, cada uma com
 * página e cobrança próprias. Devolve a cobrança já feita nesta etapa, se houver.
 */
async function upsellStep(parentId: string, products: readonly string[]) {
  const step = upsellStepOf(products);
  if (step !== "ofertas" && products.length > 1) throw new Error("Oferta inválida.");
  return { existing: await findUpsellOf(parentId, step) };
}

/**
 * Upsell no MESMO cartão da compra (o token do cartão volta do navegador; nada é guardado no banco).
 * Só roda quando o cliente clica em aceitar a oferta.
 */
export const createCardFollowUpCharge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        parentId: z.string().regex(/^hc_[\w-]{1,64}$/),
        origin: z.string().url(),
        cardHash: z.string().min(10).max(4000),
        // Etapa do pós-compra: 1 pacote de pilhas, ou kit extra e/ou seguro, ou envio expresso.
        products: z
          .array(z.enum(UPSELL_PRODUCTS))
          .min(1)
          .max(UPSELL_PRODUCTS.length)
          .default(["kit"]),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<CardCharge & { refusedReason?: string | null }> => {
    await ensureCatalog();
    const parent = await getOrder(data.parentId);
    if (
      !parent ||
      parent.customer?.upsellOf ||
      parent.customer?.testOf ||
      parent.customer?.method !== "card"
    )
      throw new Error("Pedido não encontrado.");
    if (!parent.customer.address) throw new Error("Pedido sem endereço.");
    if (!isPaidStatus(parent.status)) {
      const { status } = await fetchGatewayStatus(parent.id);
      if (!isPaidStatus(status)) throw new Error("Pedido ainda não foi pago.");
    }
    // Nunca cobra duas vezes a mesma etapa do upsell para o mesmo pedido.
    const { existing } = await upsellStep(parent.id, data.products);
    if (existing) {
      return {
        id: existing.id,
        amount: existing.amount_cents,
        status: existing.status,
        paid: isPaidStatus(existing.status),
      };
    }

    const bundle = boughtBundle(getBundle(parent.bundle_id), parent.customer.itemName);
    const sel = upsellSelection(bundle, data.products);
    if (!sel.products.length) throw new Error("Escolha uma oferta.");
    const amount = Math.round(sel.total * 100);
    // Com o kit, parcela como a compra; pilhas, seguro e expresso, à vista.
    const installments = sel.products.includes("kit") ? (parent.customer.installments ?? 1) : 1;
    const c = parent.customer;
    const a = c.address!;
    const { ip, ua } = requestMeta();
    const tx = await createCardTransaction({
      amount,
      cardHash: data.cardHash,
      installments,
      customer: { name: c.name, email: c.email, phone: c.phone, cpf: c.cpf },
      address: {
        street: a.street,
        streetNumber: a.number,
        complement: a.complement || "Sem complemento",
        zipCode: a.zipcode,
        neighborhood: a.neighborhood,
        city: a.city,
        state: a.state.toUpperCase(),
        country: "BR",
      },
      shippingFee: 0,
      items: sel.items.map((i) => ({
        title: i.title,
        unitPrice: Math.round(i.price * 100),
        quantity: 1,
      })),
      postbackUrl: `${brand.siteUrl}/api/public/pix-webhook?gw=hc`,
      ip,
    });
    const refused = ["refused", "canceled", "cancelled", "failed"].includes(tx.status);
    const id = `${CARD_ORDER_PREFIX}${tx.id}`;
    const orderData = {
      createdAt: Date.now(),
      id,
      amountCents: amount,
      customer: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        cpf: c.cpf,
        endereco: c.endereco,
        address: c.address,
        frete: { id: "junto", name: `Junto com o pedido ${parent.id}`, price: 0 },
        method: "card" as const,
        installments,
        ...(tx.card ? { card: tx.card } : {}),
        upsellOf: parent.id,
        upsellItems: sel.products,
      },
      bundleId: bundle.id,
      bundleName: `Upsell: ${sel.label}`,
      utm: parent.utm ?? undefined,
      ip,
      ua,
      fbp: parent.fbp,
      fbc: parent.fbc,
    };
    if (refused)
      throw new Error(
        `O banco não aprovou a cobrança neste cartão: ${tx.refusedReason ?? "motivo não informado"}.`,
      );
    await saveOrder(orderData);
    const paid = isPaidStatus(tx.status);
    if (!paid) await reportPendingToUtmify(orderData);
    return { id, amount, status: tx.status, paid, refusedReason: tx.refusedReason };
  });

/**
 * Upsell pós-compra no Pix: kit extra (mais 1 kit igual ao do pedido pago, com desconto) e/ou seguro de
 * entrega, num Pix só.
 * Usa os dados já salvos do pedido original — o cliente não digita nada de novo.
 */
export const createUpsellCharge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        parentId: z.string().regex(/^[\w-]{1,64}$/),
        origin: z.string().url(),
        // Etapa do pós-compra: 1 pacote de pilhas, ou kit extra e/ou seguro, ou envio expresso.
        products: z
          .array(z.enum(UPSELL_PRODUCTS))
          .min(1)
          .max(UPSELL_PRODUCTS.length)
          .default(["kit"]),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<PixCharge> => {
    await ensureCatalog();
    const parent = await getOrder(data.parentId);
    if (!parent || parent.customer?.upsellOf) throw new Error("Pedido não encontrado.");
    if (!isPaidStatus(parent.status)) {
      const { status } = await fetchGatewayStatus(parent.id);
      if (!isPaidStatus(status)) throw new Error("Pedido ainda não foi pago.");
    }

    // Já existe esta etapa do upsell para este pedido: reaproveita em vez de gerar outra cobrança.
    const { existing } = await upsellStep(parent.id, data.products);
    if (existing?.customer.qrcode) {
      return {
        id: existing.id,
        qrcode: existing.customer.qrcode,
        amount: existing.amount_cents,
        status: existing.status,
      };
    }

    const bundle = boughtBundle(getBundle(parent.bundle_id), parent.customer.itemName);
    const sel = upsellSelection(bundle, data.products);
    if (!sel.products.length) throw new Error("Escolha uma oferta.");
    const amount = Math.round(sel.total * 100);
    const c = parent.customer;
    const { ip, ua } = requestMeta();
    const charge = await createPix({
      amount,
      customer: { name: c.name, email: c.email, phone: c.phone, cpf: c.cpf },
      address: c.address,
      description: brand.gatewayName,
      origin: data.origin,
      ip,
    });
    const orderData = {
      createdAt: Date.now(),
      id: charge.id,
      amountCents: amount,
      customer: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        cpf: c.cpf,
        endereco: c.endereco,
        ...(c.address ? { address: c.address } : {}),
        frete: { id: "junto", name: `Junto com o pedido ${parent.id}`, price: 0 },
        upsellOf: parent.id,
        upsellItems: sel.products,
        qrcode: charge.qrcode,
      },
      bundleId: bundle.id,
      bundleName: `Upsell: ${sel.label}`,
      utm: parent.utm ?? undefined,
      ip,
      ua,
      fbp: parent.fbp,
      fbc: parent.fbc,
    };
    await saveOrder(orderData);
    // Pix gerado → UTMify como pendente (não é conversão; só "paid" conta como venda).
    await reportPendingToUtmify(orderData);
    return { id: charge.id, qrcode: charge.qrcode, amount, status: charge.status };
  });

export const getPixStatus = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().regex(/^[\w-]{1,64}$/),
        report: z
          .object({
            fbp: z.string().max(200).nullable().optional(),
            fbc: z.string().max(300).nullable().optional(),
            url: z.string().max(1000).optional(),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ status: string; paid: boolean }> => {
    const { status, amount } = await fetchGatewayStatus(data.id);
    const paid = isPaidStatus(status);
    // Só pagamento confirmado pelo gateway (servidor) vira conversão — reportado uma única vez.
    if (paid) {
      const h = getRequest()?.headers;
      await reportPaidOnce(data.id, amount, {
        fbp: data.report?.fbp,
        fbc: data.report?.fbc,
        url: data.report?.url,
        ip: h?.get("cf-connecting-ip") ?? h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        ua: h?.get("user-agent") ?? null,
      });
    }
    // A tela do Pix também dispara a conferência dos outros pendentes (no máximo 1 rodada a cada 50 s).
    await reconcilePendingPix().catch((e) => console.error("pix-reconcile failed", e));
    return { status, paid };
  });
