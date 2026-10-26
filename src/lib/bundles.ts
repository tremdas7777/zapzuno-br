/**
 * Catálogo da loja: produtos (vindos do banco ou do catálogo inicial) e kits.
 *
 * O checkout vende um produto por vez (`?plano=<id>&variante=<opções>`); o preço é sempre
 * recalculado no servidor a partir daqui (preço da variação escolhida) — o cliente só exibe.
 *
 * Os produtos vêm de `setCatalogData` (banco, via importador CSV do admin). Enquanto o banco
 * estiver vazio ou desligado, vale o catálogo inicial de src/lib/catalog-data.ts.
 *
 * Kit = várias peças por um preço só. Cada vaga do kit puxa os produtos de uma coleção; o
 * cliente escolhe a peça e a variação (tamanho/cor) de cada vaga.
 */

import {
  SEED_CATALOG,
  type CatalogData,
  type CatalogProduct,
  type CatalogVariant,
} from "./catalog-data";

export type BundleId = string;
export type CategoryId = string;

/** Valor mínimo (produtos, sem frete) para liberar o frete grátis. 0 = frete grátis sempre. */
export const FREE_SHIPPING_MIN = 0;
export const FREE_SHIPPING_LABEL =
  FREE_SHIPPING_MIN > 0
    ? `Frete grátis em compras acima de R$ ${FREE_SHIPPING_MIN}`
    : "Frete grátis para todo o Brasil";

export const isFreeShippingEligible = (subtotal: number) => subtotal >= FREE_SHIPPING_MIN;

/** Selo de frete do produto: grátis quando ele sozinho já passa do mínimo. */
export const bundleShippingLabel = (b: { price: number }) =>
  isFreeShippingEligible(b.price) ? "Frete grátis para todo o Brasil" : FREE_SHIPPING_LABEL;

export type ProductOption = { name: string; values: readonly string[] };
export type Variant = CatalogVariant;

/** Uma vaga do kit: o cliente escolhe uma peça de `pool` e a variação dela. */
export type KitSlot = { label: string; collection: string; pool: readonly BundleId[] };

export type Bundle = {
  id: BundleId;
  name: string;
  /** Frase curta do card. */
  tag: string;
  /** Menor preço entre as variações (kits: preço fechado). */
  price: number;
  compareAtPrice?: number;
  img: string;
  images: readonly string[];
  /** Opções que o cliente escolhe (tamanho, cor...). Vazio = produto sem variação. */
  options: readonly ProductOption[];
  /** Foto mostrada ao escolher um valor de opção (ex.: a cor). */
  optionImages?: Readonly<Record<string, string>>;
  benefits: readonly string[];
  /** Coleção principal (slug). */
  category: CategoryId;
  /** Todas as coleções do produto (slugs). */
  collections: readonly CategoryId[];
  checkoutProductName: string;
  checkoutProductDescription: string;
  checkoutUrl: string;
  badge?: string;
  /** Kits: as vagas, na ordem em que o cliente escolhe. */
  kit?: readonly KitSlot[];
  /** Variações com preço, SKU, estoque e foto próprios (produtos importados). */
  variants?: readonly Variant[];
  /** Texto da aba "Descrição" (um parágrafo por item). */
  description?: readonly string[];
  /** Aba "Detalhes": pares rótulo/valor. */
  specs?: readonly (readonly [string, string])[];
  /** Produtos do mesmo grupo aparecem como opções na mesma página. */
  group?: string;
  groupLabel?: string;
  /** false = não aparece nas vitrines. */
  listed?: boolean;
  /** Todas as variações sem estoque. */
  soldOut?: boolean;
};

export type Category = { id: CategoryId; name: string; desc: string; img: string };

/**
 * Kits montados (várias peças por um preço só). Cada vaga puxa as peças de uma coleção (slug).
 */
type KitDef = {
  id: BundleId;
  name: string;
  tag: string;
  price: number;
  badge?: string;
  slots: readonly { label: string; collection: string }[];
};

// Esta loja vende o projetor de laser tag com a quantidade de kits como variação; não usa kits montados.
const KITS: readonly KitDef[] = [];

export const KIT_COLLECTION: Category = {
  id: "kits",
  name: "Kits",
  desc: "Monte o seu kit e pague menos por peça",
  img: "/produtos/kit-completo.webp",
};

export const kitModelOption = (i: number) => `Peça ${i + 1}`;
export const kitSizeOption = (i: number) => `Tamanho ${i + 1}`;

/** Chave legível de uma variação: "Preto / 42". */
export const variantKey = (values: readonly string[]) => values.join(" / ");

const inStock = (v: Variant) => v.stock === null || v.stock > 0;

const r2 = (n: number) => Math.round(n * 100) / 100;

const paragraphs = (t: string) =>
  t
    .split(/\n\s*\n/)
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const COLOR_OPTION = /^(cor|cores|color|colour)$/i;
const ORDER = ["PP", "P", "M", "G", "GG", "XG", "G1", "G2", "G3", "G4"];
const sizeRank = (v: string) => {
  const n = Number(v.replace(",", "."));
  if (Number.isFinite(n)) return n;
  const i = ORDER.indexOf(v.toUpperCase());
  return i === -1 ? 1000 : 500 + i;
};

function productBundle(p: CatalogProduct, collectionName: (slug: string) => string): Bundle {
  const variants = p.variants.length
    ? p.variants
    : [{ values: [], sku: null, price: 0, compareAtPrice: null, stock: null, image: null }];
  const sellable = variants.filter(inStock);
  const base = (sellable.length ? sellable : variants).reduce((a, b) => (b.price < a.price ? b : a));
  const images = [
    ...new Set([...p.images, ...variants.map((v) => v.image).filter((x): x is string => !!x)]),
  ];
  const img = images[0] ?? "/placeholder.svg";
  const colorIdx = p.options.findIndex((o) => COLOR_OPTION.test(o.name));
  const optionImages: Record<string, string> = {};
  if (colorIdx >= 0)
    for (const v of variants) {
      const c = v.values[colorIdx];
      if (c && v.image && !optionImages[c]) optionImages[c] = v.image;
    }
  const category = p.collections[0] ?? "outros";
  const sizeOpt = p.options.find((o) => /tamanho|size|numera/i.test(o.name));
  const sizes = sizeOpt ? [...sizeOpt.values].sort((a, b) => sizeRank(a) - sizeRank(b)) : [];
  const tag = p.productType || collectionName(category) || "";
  return {
    id: p.handle,
    name: p.title,
    tag,
    price: base.price,
    ...(base.compareAtPrice && base.compareAtPrice > base.price
      ? { compareAtPrice: base.compareAtPrice }
      : {}),
    img,
    images,
    options: p.options.map((o) =>
      o === sizeOpt ? { name: o.name, values: sizes } : { name: o.name, values: o.values },
    ),
    ...(Object.keys(optionImages).length ? { optionImages } : {}),
    benefits: [],
    category,
    collections: p.collections,
    variants,
    description: paragraphs(p.description),
    specs: [
      ...(p.productType ? ([["Tipo", p.productType]] as const) : []),
      ...(sizes.length
        ? ([["Tamanhos", sizes.length > 1 ? `${sizes[0]} ao ${sizes.at(-1)}` : sizes[0]!]] as const)
        : []),
    ],
    soldOut: !sellable.length,
    checkoutProductName: p.title,
    checkoutProductDescription: tag ? `${p.title}. ${tag}.` : p.title,
    checkoutUrl: `/checkout?plano=${encodeURIComponent(p.handle)}`,
  };
}

function kitBundle(k: KitDef, products: readonly Bundle[]): Bundle | null {
  const slots: KitSlot[] = k.slots.map((s) => ({
    label: s.label,
    collection: s.collection,
    pool: products
      .filter((p) => !p.soldOut && p.listed !== false && p.collections.includes(s.collection))
      .map((p) => p.id),
  }));
  if (slots.some((s) => !s.pool.length)) return null;
  const byId = new Map(products.map((p) => [p.id, p]));
  const avulso = r2(
    slots.reduce((s, slot) => s + Math.min(...slot.pool.map((id) => byId.get(id)!.price)), 0),
  );
  const cover = `/produtos/kit-${k.id}.webp`;
  const pieces = [...new Set(slots.flatMap((s) => s.pool))].map((id) => byId.get(id)!);
  return {
    id: k.id,
    name: k.name,
    tag: k.tag,
    price: k.price,
    ...(avulso > k.price ? { compareAtPrice: avulso } : {}),
    img: cover,
    images: [cover, ...pieces.slice(0, 6).map((p) => p.img)],
    options: slots.flatMap((slot, i) => {
      const keys = new Set<string>();
      for (const id of slot.pool)
        for (const v of byId.get(id)!.variants ?? []) if (inStock(v)) keys.add(variantKey(v.values));
      return [
        { name: kitModelOption(i), values: slot.pool },
        { name: kitSizeOption(i), values: [...keys].sort((a, b) => sizeRank(a) - sizeRank(b)) },
      ];
    }),
    kit: slots,
    benefits: [
      `${slots.length} peças por ${brl(k.price)}`,
      "Você escolhe o modelo e o tamanho de cada peça",
      "Pode repetir o mesmo modelo em tamanhos diferentes",
    ],
    category: KIT_COLLECTION.id,
    collections: [KIT_COLLECTION.id],
    ...(k.badge ? { badge: k.badge } : {}),
    description: [
      `No ${k.name} você monta o kit do seu jeito: escolhe o modelo e o tamanho de cada peça e paga um preço fechado, menor do que comprando separado.`,
      "Pode levar modelos diferentes ou repetir o mesmo em tamanhos diferentes.",
    ],
    checkoutProductName: k.name,
    checkoutProductDescription: `${k.name}: ${k.tag.toLowerCase()}.`,
    checkoutUrl: `/checkout?plano=${k.id}`,
  };
}

type Built = {
  version: string;
  source: CatalogData["source"];
  bundles: Bundle[];
  byId: Map<string, Bundle>;
  categories: Category[];
};

function build(data: CatalogData): Built {
  const cols = [...data.collections].sort((a, b) => a.sort - b.sort);
  const colName = (slug: string) => cols.find((c) => c.slug === slug)?.name ?? "";
  const products = [...data.products]
    .sort((a, b) => a.sort - b.sort)
    .map((p) => productBundle(p, colName));
  const kits = KITS.map((k) => kitBundle(k, products)).filter((b): b is Bundle => !!b);
  const bundles = [...kits, ...products];
  const used = new Set(products.flatMap((p) => p.collections));
  const categories: Category[] = [
    ...(kits.length ? [KIT_COLLECTION] : []),
    ...cols
      .filter((c) => used.has(c.slug))
      .map((c) => ({
        id: c.slug,
        name: c.name,
        desc: c.description,
        img: c.image ?? products.find((p) => p.collections.includes(c.slug))?.img ?? "",
      })),
  ];
  return {
    version: data.version ?? `${data.source}:${data.products.length}`,
    source: data.source,
    bundles,
    byId: new Map(bundles.map((b) => [b.id, b])),
    categories,
  };
}

let built: Built = build(SEED_CATALOG);

/** Troca o catálogo da loja (dados do banco). Sem efeito se for a mesma versão. */
export function setCatalogData(data: CatalogData) {
  const v = data.version ?? `${data.source}:${data.products.length}`;
  if (v === built.version) return;
  built = build(data);
}

export const catalogVersion = () => built.version;
export const catalogSource = () => built.source;

/** Todos os produtos e kits. */
export const allBundles = () => built.bundles;
/** Produtos que aparecem nas vitrines. */
export const listedBundles = () => built.bundles.filter((b) => b.listed !== false);
export const kitBundles = () => listedBundles().filter((b) => b.kit);
export const pieceBundles = () => listedBundles().filter((b) => !b.kit);
export const getCategories = () => built.categories;

export const defaultBundleId = () => built.bundles[0]?.id ?? "";

export function parseBundleId(raw: string | undefined | null): BundleId | undefined {
  return raw && built.byId.has(raw) ? raw : undefined;
}

export function findBundle(id: string | undefined | null): Bundle | undefined {
  return id ? built.byId.get(id) : undefined;
}

export function getBundle(id: string | undefined | null): Bundle {
  return findBundle(id) ?? built.bundles[0]!;
}

export function getCheckoutUrl(id: string | undefined) {
  return getBundle(id).checkoutUrl;
}

export const bundlesByCategory = (cat: CategoryId) =>
  listedBundles().filter((b) => b.collections.includes(cat));

/** Encontra uma coleção ("todos" = tudo) e devolve os produtos dela. */
export function findCollection(id: string) {
  if (id === "todos")
    return {
      id,
      name: "Todos os produtos",
      desc: "Kits de laser tag",
      img: KIT_COLLECTION.img,
      items: listedBundles(),
    };
  const c = built.categories.find((x) => x.id === id);
  if (!c) return undefined;
  return { ...c, items: bundlesByCategory(c.id) };
}

/** Opções do mesmo grupo, na ordem do catálogo. */
export const groupBundles = (b: Bundle) =>
  b.group ? built.bundles.filter((x) => x.group === b.group) : [];

export const discountPct = (b: Pick<Bundle, "price" | "compareAtPrice">) =>
  b.compareAtPrice ? Math.round((1 - b.price / b.compareAtPrice) * 100) : 0;

/** Variação escolhida na URL: valores na ordem das opções, separados por "|". */
export const encodeVariant = (values: readonly string[]) => values.join("|");

/** Variação do produto com exatamente estes valores. */
export const findVariant = (b: Bundle, values: readonly string[]) =>
  b.variants?.find(
    (v) => v.values.length === values.length && v.values.every((x, i) => x === values[i]),
  );

/**
 * Valida a variação contra as opções do produto.
 * Devolve os valores escolhidos (`[]` para produto sem variação) ou `null` se faltar/for inválida.
 * Kits: cada peça precisa ser da vaga certa e ter a variação escolhida.
 */
export function parseVariant(b: Bundle, raw: string | undefined | null): string[] | null {
  if (!b.options.length) return [];
  if (!raw) return null;
  const values = raw.split("|");
  if (values.length !== b.options.length) return null;
  if (!b.options.every((o, i) => o.values.includes(values[i]!))) return null;
  if (b.kit) {
    const ok = b.kit.every((slot, i) => {
      const piece = findBundle(values[i * 2]);
      return (
        !!piece &&
        slot.pool.includes(piece.id) &&
        !!piece.variants?.some((v) => variantKey(v.values) === values[i * 2 + 1])
      );
    });
    return ok ? values : null;
  }
  if (b.variants?.length && !findVariant(b, values)) return null;
  return values;
}

/** Peça e variação escolhidas em cada vaga do kit. */
export function kitChoices(b: Bundle, values: readonly string[]) {
  return (b.kit ?? []).map((slot, i) => {
    const piece = findBundle(values[i * 2]);
    const variant = piece?.variants?.find((v) => variantKey(v.values) === values[i * 2 + 1]);
    return { slot, piece, variant, size: values[i * 2 + 1] };
  });
}

/** A variação escolhida tem estoque? (kits: todas as peças). */
export function variantInStock(b: Bundle, values: readonly string[]) {
  if (b.kit) return kitChoices(b, values).every((c) => !!c.variant && inStock(c.variant));
  const v = findVariant(b, values);
  return v ? inStock(v) : !b.soldOut;
}

/** Valores de uma opção que ainda têm estoque, dado o que já foi escolhido nas outras. */
export function availableValues(b: Bundle, optionIndex: number, chosen: readonly (string | undefined)[]) {
  if (!b.variants?.length) return new Set(b.options[optionIndex]?.values ?? []);
  const out = new Set<string>();
  for (const v of b.variants) {
    if (!inStock(v)) continue;
    if (v.values.every((x, i) => i === optionIndex || !chosen[i] || chosen[i] === x))
      out.add(v.values[optionIndex]!);
  }
  return out;
}

/** Preço do produto com a variação escolhida (kits: preço fechado). */
export function priceOf(b: Bundle, values: readonly string[]) {
  if (b.kit) return b.price;
  return findVariant(b, values)?.price ?? b.price;
}

/** O produto com o preço (e o "de") da variação escolhida. */
export function withVariantPrice(b: Bundle, values: readonly string[] | null | undefined): Bundle {
  if (b.kit || !values?.length) return b;
  const v = findVariant(b, values);
  if (!v) return b;
  const { compareAtPrice: _old, ...rest } = b;
  return {
    ...rest,
    price: v.price,
    ...(v.compareAtPrice && v.compareAtPrice > v.price ? { compareAtPrice: v.compareAtPrice } : {}),
  };
}

/** Variação legível. Kits: "Calça X (40) + Calça Y (42)"; produtos: "Cor: Preto · Tamanho: 42". */
export const variantLabel = (values: readonly string[], b?: Bundle) => {
  if (b?.kit)
    return kitChoices(b, values)
      .map((c) => `${c.piece?.name ?? "?"} (${c.size ?? "?"})`)
      .join(" + ");
  return values.map((v, i) => (b?.options[i] ? `${b.options[i]!.name}: ${v}` : v)).join(" · ");
};

/** Nome do item com a variação, como vai para o pedido no admin. */
export const productLabel = (b: Bundle, values: readonly string[]) =>
  values.length ? `${b.name} — ${variantLabel(values, b)}` : b.name;

export function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Valor da parcela no cartão (só exibição). */
export const installment = (price: number, n: number) => brl(Math.ceil((price / n) * 100) / 100);
