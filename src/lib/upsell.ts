import { productLabel, withVariantPrice, type Bundle } from "@/lib/bundles";
import { brand } from "@/lib/brand";
import { pilhasDoKit } from "@/lib/laser";

/** Upsell pós-compra (Pix e cartão): mais 1 unidade igual à comprada, com desconto. */
export const UPSELL_DISCOUNT = 0.5;

/** Nome do produto enviado ao gateway na cobrança de upsell no cartão. */
export const UPSELL_GATEWAY_NAME = brand.gatewayName;

/**
 * O produto como foi comprado: nome e preço da variação do pedido (ex.: 2 kits · 4 jogadores),
 * achada pelo nome salvo no pedido. Sem variação reconhecida, fica o produto base.
 */
export function boughtBundle(base: Bundle, itemName: string | undefined): Bundle {
  const v = itemName
    ? base.variants?.find((x) => productLabel(base, x.values) === itemName)
    : undefined;
  return v ? { ...withVariantPrice(base, v.values), name: productLabel(base, v.values) } : base;
}

export const upsellPrice = (bundle: Bundle) =>
  Math.round(bundle.price * (1 - UPSELL_DISCOUNT) * 100) / 100;

/**
 * Pilhas recarregáveis com carregador (página própria, logo depois do pagamento): 3 AAA em cada
 * pistola + 2 AA no projetor, por kit. O cliente escolhe o pacote do tamanho do pedido.
 * Preços SUGERIDOS (confirme): R$ 49,90 / 79,90 / 109,90.
 */
export const BATTERY_PACKS = [
  { id: "pilhas1", kits: 1, price: 49.9 },
  { id: "pilhas2", kits: 2, price: 79.9 },
  { id: "pilhas3", kits: 3, price: 109.9 },
] as const;
export type BatteryPackId = (typeof BATTERY_PACKS)[number]["id"];
export const BATTERY_GATEWAY_NAME = "Pilhas recarregáveis com carregador";

export const batteryPack = (id: string) => BATTERY_PACKS.find((b) => b.id === id);
export const batteryContents = (kits: number) => {
  const { aaa, aa } = pilhasDoKit(kits);
  return `${aaa} pilhas AAA + ${aa} AA recarregáveis + carregador`;
};
export const batteryLabel = (b: (typeof BATTERY_PACKS)[number]) =>
  `${batteryContents(b.kits)} (${b.kits} ${b.kits === 1 ? "kit" : "kits"})`;

/** Pacote de pilhas do tamanho do pedido (pelo nome da variação, ex.: "… 2 kits · 4 jogadores"). */
export function batteryPackFor(bundleName: string | undefined): BatteryPackId {
  const n = Number(bundleName?.match(/(\d+)\s*kits?\b/i)?.[1]);
  return (BATTERY_PACKS.find((b) => b.kits === n) ?? BATTERY_PACKS[0]).id;
}

/** Ofertas do pós-compra (pilhas, depois kit/seguro, depois envio expresso). */
export const UPSELL_PRODUCTS = [
  "pilhas1",
  "pilhas2",
  "pilhas3",
  "kit",
  "seguro",
  "expresso",
] as const;
export type UpsellProduct = (typeof UPSELL_PRODUCTS)[number];

/**
 * Etapas do pós-compra, cada uma com página e cobrança próprias: pilhas → ofertas (kit e/ou
 * seguro) → envio expresso.
 */
export type UpsellStep = "pilhas" | "ofertas" | "expresso";
export function upsellStepOf(products: readonly string[]): UpsellStep {
  if (products.includes("expresso")) return "expresso";
  if (products.some((p) => batteryPack(p))) return "pilhas";
  return "ofertas";
}

/** Seguro de entrega (pós-compra): reenvio ou reembolso em caso de extravio ou dano no transporte. */
export const SHIPPING_INSURANCE = {
  name: "Seguro de entrega",
  fullName: "Seguro de entrega — reenvio ou reembolso",
  /** Nome enviado ao gateway. */
  gatewayName: "Seguro de entrega",
  price: 29.9,
} as const;

/** Envio expresso: página própria depois da tela de ofertas (cobrança separada). */
export const EXPRESS_SHIPPING = {
  name: "Envio expresso",
  /** Nome enviado ao gateway. */
  gatewayName: "Envio expresso",
  price: 19.9,
} as const;

/**
 * O que o cliente escolheu na tela pós-compra, numa cobrança só (preços do servidor).
 * Itens repetidos ou desconhecidos são ignorados; a ordem segue UPSELL_PRODUCTS.
 */
export function upsellSelection(bundle: Bundle, chosen: readonly string[]) {
  const products = UPSELL_PRODUCTS.filter((p) => chosen.includes(p));
  const items = products.map((p) => {
    if (p === "kit")
      return {
        product: p,
        title: UPSELL_GATEWAY_NAME,
        price: upsellPrice(bundle),
        label: `Mais 1 unidade 50% OFF - ${bundle.name}`,
      };
    const b = batteryPack(p);
    if (b)
      return { product: p, title: BATTERY_GATEWAY_NAME, price: b.price, label: batteryLabel(b) };
    const o = p === "seguro" ? SHIPPING_INSURANCE : EXPRESS_SHIPPING;
    return { product: p, title: o.gatewayName, price: o.price, label: o.name };
  });
  const total = Math.round(items.reduce((s, i) => s + i.price * 100, 0)) / 100;
  return { products, items, total, label: items.map((i) => i.label).join(" + ") };
}
