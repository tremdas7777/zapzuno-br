/**
 * Formato do catálogo como vem do banco (tabelas collections / products / product_variants).
 * A loja monta os produtos da vitrine (src/lib/bundles.ts) a partir disto; o importador CSV
 * do admin grava neste mesmo formato.
 */

export type CatalogCollection = {
  slug: string;
  name: string;
  description: string;
  image: string | null;
  sort: number;
};

export type CatalogVariant = {
  /** Valores na ordem das opções do produto (ex.: ["Preto", "42"]). */
  values: string[];
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  /** null = sem controle de estoque (sempre disponível). */
  stock: number | null;
  image: string | null;
};

export type CatalogProduct = {
  handle: string;
  title: string;
  /** Texto da descrição (parágrafos separados por linha em branco). */
  description: string;
  productType: string | null;
  vendor: string | null;
  tags: string[];
  /** Coleções (slugs); a primeira é a principal. */
  collections: string[];
  options: { name: string; values: string[] }[];
  variants: CatalogVariant[];
  images: string[];
  sort: number;
};

export type CatalogData = {
  collections: CatalogCollection[];
  products: CatalogProduct[];
  /** "db" = veio do banco; "seed" = catálogo inicial do código (banco vazio ou desligado). */
  source: "db" | "seed";
  /** Muda quando o catálogo muda (evita remontar a vitrine à toa). */
  version?: string;
};

/**
 * Catálogo inicial: o Projetor Laser Tag ZAPZUNO, com a quantidade de kits como variação.
 * Cada kit = 1 projetor + 2 pistolas + 4 cartões de alvo (2 jogadores).
 * Preços (os mesmos da BEAM RIVALS): R$ 67 (1 kit), R$ 97 (2 kits) e R$ 127 (3 kits). O "de"
 * (riscado) é PROVISÓRIO: R$ 99,90 por kit — confirme antes de vender.
 */
export const KIT_HANDLE = "projetor-laser-tag";
export const KITS_OPTION = "Kits";

const POR_KIT_CHEIO = 99.9;

export const KITS = [
  { kits: 1, jogadores: 2, price: 67 },
  { kits: 2, jogadores: 4, price: 97 },
  { kits: 3, jogadores: 6, price: 127 },
] as const;

/** "1 kit · 2 jogadores" (o nome da variação; o pós-compra lê o número antes de "jogadores"). */
export const kitLabel = (kits: number) => `${kits} ${kits === 1 ? "kit" : "kits"} · ${kits * 2} jogadores`;

/** Lê "2 kits · 4 jogadores" → { kits: 2, jogadores: 4 }. */
export function kitsDe(label: string) {
  const kits = Number(label.match(/(\d+)\s*kits?/i)?.[1]) || 1;
  const jogadores = Number(label.match(/(\d+)\s*jogadores/i)?.[1]) || kits * 2;
  return { kits, jogadores };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export const SEED_COLLECTIONS: CatalogCollection[] = [
  {
    slug: "laser-tag",
    name: "Laser Tag com Projetor",
    description: "Projetor de alvos e pistolas de laser tag para jogar em casa, com a família e os amigos",
    image: "/produtos/kit-completo.webp",
    sort: 0,
  },
];

export const SEED_PRODUCTS: CatalogProduct[] = [
  {
    handle: KIT_HANDLE,
    title: "Projetor Laser Tag ZAPZUNO",
    description: [
      "Aponte o projetor para uma parede lisa, apague a luz e um tubarão, um dinossauro, um pinguim ou um robô aparece. Quem acertar primeiro leva o ponto.",
      "O jogo é por infravermelho: não dispara bolinha, dardo nem nada. As pistolas têm 4 modos de tiro, com luz e som, e o placar digital do projetor conta os pontos.",
      "Cada kit traz 1 projetor, 2 pistolas e 4 cartões de alvo. A partir de 5 anos, com supervisão de um adulto.",
    ].join("\n\n"),
    productType: "Jogo de laser tag com projetor",
    vendor: "ZAPZUNO",
    tags: ["laser-tag", "projetor"],
    collections: ["laser-tag"],
    options: [{ name: KITS_OPTION, values: KITS.map((k) => kitLabel(k.kits)) }],
    variants: KITS.map((k) => ({
      values: [kitLabel(k.kits)],
      sku: `ZZ-PROJ-${k.kits}K`,
      price: k.price,
      compareAtPrice: r2(k.kits * POR_KIT_CHEIO),
      stock: null,
      image: null,
    })),
    images: [
      "/produtos/kit-completo.webp",
      "/produtos/fliperama.webp",
      "/produtos/3-jeitos.webp",
      "/produtos/alvos.webp",
      "/produtos/detalhes.webp",
      "/produtos/pistola.webp",
      "/produtos/modos-de-tiro.webp",
      "/produtos/projetor.webp",
    ],
    sort: 0,
  },
];

export const SEED_CATALOG: CatalogData = {
  collections: SEED_COLLECTIONS,
  products: SEED_PRODUCTS,
  source: "seed",
};
