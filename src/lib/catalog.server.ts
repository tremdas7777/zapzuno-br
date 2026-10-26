import { setCatalogData } from "@/lib/bundles";
import {
  SEED_CATALOG,
  type CatalogCollection,
  type CatalogData,
  type CatalogProduct,
} from "@/lib/catalog-data";

/** Catálogo lido do banco, guardado por alguns segundos (a vitrine não consulta a cada clique). */
const TTL_MS = 30_000;
let cache: { at: number; data: CatalogData } | null = null;

/** Banco ligado? (.env de exemplo ou sem a chave do servidor = usa o catálogo inicial). */
export function catalogDbConfigured() {
  const url = process.env["SUPABASE_URL"] ?? "";
  return !!url && !url.includes("seu-projeto-id") && !!(process.env["SUPABASE_SECRET_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"]);
}

type Opt = { name: string; values: string[] };
const asOptions = (j: unknown): Opt[] =>
  Array.isArray(j)
    ? j
        .filter(
          (o): o is Opt =>
            !!o &&
            typeof (o as Opt).name === "string" &&
            Array.isArray((o as Opt).values) &&
            (o as Opt).values.every((v) => typeof v === "string"),
        )
        .map((o) => ({ name: o.name, values: o.values }))
    : [];

async function readDb(): Promise<CatalogData | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cols = await supabaseAdmin
    .from("collections")
    .select("id,slug,name,description,image,sort,updated_at")
    .order("sort");
  if (cols.error) throw new Error(cols.error.message);

  const PAGE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const page = await supabaseAdmin
      .from("products")
      .select(
        "id,handle,title,description,product_type,vendor,tags,options,images,sort,updated_at," +
          "product_variants(position,option_values,sku,price,compare_at_price,stock,image)," +
          "product_collections(position,collection_id)",
      )
      .eq("status", "active")
      .order("sort")
      .order("created_at")
      .range(from, from + PAGE - 1);
    if (page.error) throw new Error(page.error.message);
    rows.push(...(page.data as unknown as DbProduct[]));
    if (page.data.length < PAGE) break;
  }
  if (!rows.length) return null;

  const slugById = new Map(cols.data.map((c) => [c.id, c.slug]));
  const collections: CatalogCollection[] = cols.data.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description,
    image: c.image,
    sort: c.sort,
  }));
  const products: CatalogProduct[] = rows.map((p) => ({
    handle: p.handle,
    title: p.title,
    description: p.description,
    productType: p.product_type,
    vendor: p.vendor,
    tags: p.tags ?? [],
    collections: [...(p.product_collections ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((pc) => slugById.get(pc.collection_id))
      .filter((s): s is string => !!s),
    options: asOptions(p.options),
    variants: [...(p.product_variants ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        values: v.option_values ?? [],
        sku: v.sku,
        price: Number(v.price),
        compareAtPrice: v.compare_at_price === null ? null : Number(v.compare_at_price),
        stock: v.stock,
        image: v.image,
      })),
    images: p.images ?? [],
    sort: p.sort,
  }));
  const stamps = [...rows.map((r) => r.updated_at), ...cols.data.map((c) => c.updated_at)].sort();
  return {
    collections,
    products,
    source: "db",
    version: `db:${products.length}:${stamps.at(-1) ?? ""}`,
  };
}

type DbProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  product_type: string | null;
  vendor: string | null;
  tags: string[] | null;
  options: unknown;
  images: string[] | null;
  sort: number;
  updated_at: string;
  product_variants: {
    position: number;
    option_values: string[] | null;
    sku: string | null;
    price: number | string;
    compare_at_price: number | string | null;
    stock: number | null;
    image: string | null;
  }[];
  product_collections: { position: number; collection_id: string }[];
};

/** Catálogo atual: banco (se tiver produtos) ou o catálogo inicial do código. */
export async function loadCatalog(force = false): Promise<CatalogData> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;
  let data: CatalogData = SEED_CATALOG;
  if (catalogDbConfigured()) {
    try {
      data = (await readDb()) ?? SEED_CATALOG;
    } catch (e) {
      console.error("[catalogo] não consegui ler o banco; usando o catálogo inicial:", e);
      // Mantém o último catálogo bom em vez de voltar ao inicial por uma falha passageira.
      if (cache) data = cache.data;
    }
  }
  cache = { at: Date.now(), data };
  return data;
}

/** Depois de importar/editar produtos: a próxima leitura busca de novo no banco. */
export function invalidateCatalog() {
  cache = null;
}

/** Atualiza o catálogo usado pelas funções do servidor (checkout, Pix, cartão). */
export async function ensureCatalog() {
  setCatalogData(await loadCatalog());
}
