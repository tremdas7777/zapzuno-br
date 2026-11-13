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
  saveComprovante,
} from "@/lib/pix-orders.server";
import { createPix, LEGACY_ORDER_PREFIX } from "@/lib/pix-gateway.server";
import {
  getLegacyKey,
  getLegacyPublicKey,
  legacyCardCharge,
  LEGACY_API,
  type LegacyAddress,
} from "@/lib/legacy.server";
import { PayerDataError } from "@/lib/pix-errors";
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
      pixDiscount: await pixDiscountOn(),
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

export type CardCharge = {
  id: string;
  amount: number;
  status: string;
  paid: boolean;
  /** 3DS pendente na Legacy: o navegador passa `threeDSecure` inteiro pro SDK (handlePendingThreeDS). */
  threeDSecurePending?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  threeDSecure?: any;
  /** Token do cartão (cvt_live_…) da Legacy: só na aba do cliente, pro upsell no mesmo cartão. */
  cardToken?: string;
};

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

/**
 * Desconto do Pix: vale quando o cartão está no ar. Com a chave da Legacy cadastrada o cartão fica
 * sempre liberado, então o desconto também. Usado tanto na tela (getCardConfig) quanto na cobrança
 * do Pix, para o valor cobrado bater com o mostrado.
 */
async function pixDiscountOn(): Promise<boolean> {
  return !!(await getLegacyKey().catch(() => null));
}

/** Com o cartão desligado, quem está logado no admin (mesmo navegador) ainda consegue testar. */
const isAdmin = (pwd?: string) => senhaAdminOk(pwd);

/**
 * Config do cartão para o checkout. Regra: com a chave da Legacy Ecom cadastrada, o cartão passa
 * pela Legacy (o SDK dela tokeniza e resolve o 3DS no navegador) e fica sempre no ar. Sem ela, não
 * há cartão: a loja fica só com Pix.
 */
export const getCardConfig = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ adminPassword: z.string().max(200).optional() })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    const legacyPk = await getLegacyPublicKey().catch(() => null);
    if (legacyPk) {
      // A chave pública (pk_…) e a URL do SDK vão para o navegador; a secreta fica só no servidor.
      return {
        enabled: true as const,
        provider: "legacy" as const,
        publicKey: legacyPk,
        sdkUrl: `${LEGACY_API}/checkout/sdk/legacy-pay.js`,
        apiBaseUrl: LEGACY_API,
        pixDiscount: true,
      };
    }
    // Liberado aos clientes no admin = cartão para todos + desconto do Pix.
    // Sem a chave da Legacy não há cartão: a loja fica só com Pix (sem desconto).
    return {
      enabled: false as const,
      provider: null,
      publicKey: null,
      sdkUrl: null,
      apiBaseUrl: null,
      pixDiscount: false,
    };
  });

/**
 * `prepared.payinCard` do SDK LegacyPay (token + threeDSecure + device + userAgent). Aceito como objeto
 * opaco: o servidor repassa à Legacy sem validar os campos internos, que o SDK monta.
 */
const payinCardSchema = z
  .object({
    token: z.string().min(5).max(200),
    installments: z.number().int().min(1).max(CARD_MAX_INSTALLMENTS),
  })
  .passthrough();

/** Metadado público do cartão vindo de `prepared.card` do SDK (sem CVV nem número). */
const cardMetaSchema = z
  .object({
    last4: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
    brand: z.string().max(40).optional(),
    /** Token do cartão salvo (cvt_live_…) vindo de `prepared.card.token`: volta ao navegador pro upsell. */
    token: z.string().min(5).max(300).optional(),
  })
  .optional();

const cardSchema = customerSchema.extend({
  // Cartão Legacy: payload preparado pelo SDK LegacyPay no navegador. O número do cartão nunca chega aqui.
  cardPrepared: payinCardSchema.optional(),
  cardMeta: cardMetaSchema,
  antifraudSessionId: z.string().min(1).max(300).optional().nullable(),
  installments: z.number().int().min(1).max(CARD_MAX_INSTALLMENTS),
  adminPassword: z.string().max(200).optional(),
});

/** Resultado de uma cobrança no cartão pela Legacy. */
type CardOutcome = {
  id: string;
  status: string;
  paid: boolean;
  card: { lastDigits?: string; brand?: string } | null;
  threeDSecurePending: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  threeDSecure: any;
};

/** Status finais ruins da Legacy (ver /docs/webhooks): nunca grava pedido pago sem ter pago. */
const LEGACY_BAD_STATUSES = [
  "refused",
  "failed",
  "canceled",
  "cancelled",
  "refunded",
  "chargeback",
  "med",
  "expired",
];

/**
 * Cobra no cartão. Preço de tabela, sem o desconto do Pix. Com a chave da Legacy cadastrada, a
 * cobrança vai pela Legacy (payload do SDK LegacyPay); sem ela, não há cartão.
 */
export const createCardCharge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cardSchema.parse(d))
  .handler(async ({ data }): Promise<CardCharge> => {
    await ensureCatalog();
    const legacyKey = await getLegacyKey().catch(() => null);
    if (!legacyKey) throw new Error("Pagamento com cartão indisponível. Pague com Pix.");
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
    const itemsCents = [
      { title: brand.gatewayName, unitPrice: Math.round(bundle.price * 100), quantity: 1 },
      ...chosenExtras(data).map((b) => ({
        title: b.gatewayName,
        unitPrice: Math.round(b.price * 100),
        quantity: 1,
      })),
    ];
    let outcome: CardOutcome;
    if (legacyKey) {
      if (!data.cardPrepared) throw new Error("Pagamento com cartão indisponível. Pague com Pix.");
      const legacyAddress: LegacyAddress = {
        street: a.street,
        number: a.number,
        zipCode: a.zipcode,
        city: a.city,
        state: a.state.toUpperCase(),
        ...(a.complement ? { complement: a.complement } : {}),
        neighborhood: a.neighborhood,
      };
      let tx;
      try {
        tx = await legacyCardCharge({
          amountCents: totals.total,
          payinCard: data.cardPrepared as Record<string, unknown>,
          antifraudSessionId: data.antifraudSessionId ?? null,
          customer: { name: data.name, email: data.email, phone: data.phone, cpf: data.cpf },
          address: legacyAddress,
          description: brand.gatewayName,
          referenceId: crypto.randomUUID(),
          payerIp: ip ?? "0.0.0.0",
          items: itemsCents,
        });
      } catch (e) {
        if (e instanceof PayerDataError) throw new Error(e.message);
        throw e;
      }
      // 3DS pendente não é recusa: o navegador resolve o desafio e a página do pedido confirma depois.
      if (!tx.threeDSecurePending && LEGACY_BAD_STATUSES.includes(tx.status)) {
        throw new Error("Pagamento recusado. Confira os dados do cartão ou pague com Pix.");
      }
      outcome = {
        id: `${LEGACY_ORDER_PREFIX}${tx.id}`,
        status: tx.status,
        paid: isPaidStatus(tx.status),
        // Últimos 4 e bandeira vêm de `prepared.card` do SDK (não de `prepared.payinCard`).
        card: data.cardMeta?.last4
          ? {
              lastDigits: data.cardMeta.last4,
              ...(data.cardMeta.brand ? { brand: data.cardMeta.brand } : {}),
            }
          : null,
        threeDSecurePending: tx.threeDSecurePending,
        threeDSecure: tx.threeDSecurePending ? tx.raw : null,
      };
    } else {
      throw new Error("Pagamento com cartão indisponível. Pague com Pix.");
    }
    const { id, status, paid } = outcome;
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
        ...(outcome.card ? { card: outcome.card } : {}),
      },
      bundleId: bundle.id,
      bundleName: orderName(itemName, data),
      utm: data.utm,
      ip,
      ua,
    };
    await saveOrder(orderData);
    // Aprovado na hora: a conversão é reportada pela página do pedido (getPixStatus → reportPaidOnce).
    // Em análise ou 3DS pendente: avisa a UTMify como pendente, igual ao Pix gerado.
    if (!paid) await reportPendingToUtmify(orderData);
    return {
      id,
      amount: totals.total,
      status,
      paid,
      threeDSecurePending: outcome.threeDSecurePending,
      threeDSecure: outcome.threeDSecure,
      ...(data.cardMeta?.token ? { cardToken: data.cardMeta.token } : {}),
    };
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
 * Upsell no mesmo cartão da compra pela Legacy (payWithSavedCard), igual à Petit. O navegador prepara
 * o payload com `client.payWithSavedCard({ token, amount, referenceId, installments, customer })` e o
 * servidor só repassa à /payin. Token e CVV não são guardados no banco.
 */
export const createLegacyCardFollowUpCharge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        parentId: z.string().regex(/^le_[\w-]{1,64}$/),
        origin: z.string().url(),
        cardPrepared: payinCardSchema,
        antifraudSessionId: z.string().min(1).max(300).optional().nullable(),
        cardMeta: cardMetaSchema,
        products: z
          .array(z.enum(UPSELL_PRODUCTS))
          .min(1)
          .max(UPSELL_PRODUCTS.length)
          .default(["kit"]),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<CardCharge> => {
    if (!(await getLegacyKey().catch(() => null))) {
      throw new Error("Pagamento com cartão indisponível. Pague com Pix.");
    }
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
    const c = parent.customer;
    const a = c.address!;
    const { ip, ua } = requestMeta();
    const address: LegacyAddress = {
      street: a.street,
      number: a.number,
      zipCode: a.zipcode,
      city: a.city,
      state: a.state.toUpperCase(),
      ...(a.complement ? { complement: a.complement } : {}),
      neighborhood: a.neighborhood,
    };
    let tx;
    try {
      tx = await legacyCardCharge({
        amountCents: amount,
        payinCard: data.cardPrepared as Record<string, unknown>,
        antifraudSessionId: data.antifraudSessionId ?? null,
        customer: { name: c.name, email: c.email, phone: c.phone, cpf: c.cpf },
        address,
        description: brand.gatewayName,
        referenceId: crypto.randomUUID(),
        payerIp: ip ?? "0.0.0.0",
        items: sel.items.map((i) => ({
          title: i.title,
          unitPrice: Math.round(i.price * 100),
          quantity: 1,
        })),
      });
    } catch (e) {
      if (e instanceof PayerDataError) throw new Error(e.message);
      throw e;
    }
    if (tx.threeDSecurePending) {
      throw new Error("Este cartão exige nova autenticação. Pague essa oferta com Pix.");
    }
    if (LEGACY_BAD_STATUSES.includes(tx.status)) {
      throw new Error("O banco não aprovou a cobrança neste cartão.");
    }
    const txCard = data.cardMeta?.last4
      ? {
          lastDigits: data.cardMeta.last4,
          ...(data.cardMeta.brand ? { brand: data.cardMeta.brand } : {}),
        }
      : null;
    const id = `${LEGACY_ORDER_PREFIX}${tx.id}`;
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
        installments: parent.customer.installments ?? 1,
        ...(txCard ? { card: txCard } : {}),
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
    await saveOrder(orderData);
    const paid = isPaidStatus(tx.status);
    if (!paid) await reportPendingToUtmify(orderData);
    return { id, amount, status: tx.status, paid };
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
    return { status, paid };
  });

/** Comprovante do Pix enviado pelo cliente na página do pedido (fica salvo junto ao pedido). */
export const enviarComprovantePix = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().regex(/^[\w-]{1,64}$/),
        name: z.string().min(1).max(200),
        type: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
        // Base64 do arquivo. Limite de 3 MB (o corpo da requisição da hospedagem é menor que 5 MB).
        base64: z.string().min(1).max(4_200_000),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length === 0 || bytes.length > 3 * 1024 * 1024) {
      throw new Error("Arquivo inválido. Envie até 3 MB.");
    }
    const ok = await saveComprovante(data.id, { name: data.name, type: data.type, bytes });
    if (!ok) throw new Error("Pedido não encontrado.");
    return { ok: true };
  });
