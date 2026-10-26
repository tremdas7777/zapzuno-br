import { createServerFn } from "@tanstack/react-start";
import { senhaAdminOk } from "@/lib/admin-guard.server";
import { z } from "zod";
import { SEED_COLLECTIONS, SEED_PRODUCTS } from "@/lib/catalog-data";
import { normalize, sameCollection, slugify } from "@/lib/shopify-csv";

function assertAdmin(password: string) {
  if (!senhaAdminOk(password))
    throw new Error("Não autorizado");
}

async function db() {
  const { catalogDbConfigured } = await import("@/lib/catalog.server");
  if (!catalogDbConfigured())
    throw new Error(
      "O banco de dados ainda não está conectado. Conecte o Supabase (Lovable Cloud) e rode as migrações antes de importar.",
    );
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const url = z
  .string()
  .max(1000)
  .refine((s) => /^https?:\/\/\S+$/i.test(s) || /^\/\S*$/.test(s), "link de imagem inválido");

const productSchema = z.object({
  handle: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "handle só com letras minúsculas, números e hífen"),
  title: z.string().min(1).max(200),
  description: z.string().max(8000),
  productType: z.string().max(120).nullable(),
  vendor: z.string().max(120).nullable(),
  tags: z.array(z.string().max(60)).max(30),
  status: z.enum(["active", "draft"]),
  options: z
    .array(z.object({ name: z.string().min(1).max(40), values: z.array(z.string().min(1).max(60)).max(100) }))
    .max(3),
  variants: z
    .array(
      z.object({
        values: z.array(z.string().max(60)).max(3),
        sku: z.string().max(80).nullable(),
        price: z.number().min(0).max(100000),
        compareAtPrice: z.number().min(0).max(100000).nullable(),
        stock: z.number().int().min(0).max(1000000).nullable(),
        image: url.nullable(),
      }),
    )
    .min(1)
    .max(250),
  images: z.array(url).max(30),
  collections: z.array(z.string().min(1).max(80)).max(10),
});
export type ImportProductInput = z.infer<typeof productSchema>;

export type ImportResult = {
  handle: string;
  title: string;
  status: "created" | "updated" | "error";
  message?: string;
  collections: string[];
  variants: number;
};

export type CollectionResult = { name: string; slug: string; created: boolean };

/**
 * Importa produtos (até 50 por chamada; o admin manda o arquivo em partes).
 * Não duplica: acha o produto já cadastrado pelo Handle, depois por qualquer SKU das variações
 * e por último pelo título igual — e atualiza esse produto em vez de criar outro.
 */
export const importProducts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ password: z.string().max(200), products: z.array(z.unknown()).min(1).max(50) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const sb = await db();
    const results: ImportResult[] = [];
    const newCollections: CollectionResult[] = [];

    const cols = await sb.from("collections").select("id,slug,name,sort");
    if (cols.error) throw new Error(cols.error.message);
    const collections = [...cols.data];
    let colSort = Math.max(0, ...collections.map((c) => c.sort));

    const existing = await sb.from("products").select("id,handle,title,sort");
    if (existing.error) throw new Error(existing.error.message);
    const products = [...existing.data];
    let productSort = Math.max(0, ...products.map((p) => p.sort));

    const skuRows = await sb.from("product_variants").select("product_id,sku").not("sku", "is", null);
    if (skuRows.error) throw new Error(skuRows.error.message);
    const skuOwner = new Map(
      skuRows.data.filter((v) => v.sku).map((v) => [v.sku!.toLowerCase(), v.product_id]),
    );

    async function collectionId(name: string) {
      const found = sameCollection(name, collections);
      if (found) return found;
      // Coleções do catálogo inicial mantêm o slug delas (os kits procuram por ele).
      const seed = SEED_COLLECTIONS.find((c) => normalize(c.name) === normalize(name));
      let slug = seed?.slug ?? (slugify(name) || "colecao");
      for (let n = 2; collections.some((c) => c.slug === slug); n++) slug = `${slugify(name)}-${n}`;
      const ins = await sb
        .from("collections")
        .insert({
          slug,
          name: name.trim().slice(0, 80),
          sort: ++colSort,
          ...(seed ? { description: seed.description, image: seed.image } : {}),
        })
        .select("id,slug,name,sort")
        .single();
      if (ins.error) throw new Error(`Coleção "${name}": ${ins.error.message}`);
      collections.push(ins.data);
      newCollections.push({ name: ins.data.name, slug: ins.data.slug, created: true });
      return ins.data;
    }

    for (const raw of data.products) {
      const parsed = productSchema.safeParse(raw);
      const label = (raw as { handle?: string; title?: string }) ?? {};
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        results.push({
          handle: String(label.handle ?? "?"),
          title: String(label.title ?? "?"),
          status: "error",
          message: `Dados inválidos (${issue?.path.join(".")}: ${issue?.message})`,
          collections: [],
          variants: 0,
        });
        continue;
      }
      const p = parsed.data;
      try {
        // 1) Já existe? Handle → SKU → título igual.
        const skus = p.variants.map((v) => v.sku?.toLowerCase()).filter((s): s is string => !!s);
        let match = products.find((x) => x.handle === p.handle);
        let matchedBy = "";
        if (!match) {
          const owner = skus.map((s) => skuOwner.get(s)).find(Boolean);
          match = owner ? products.find((x) => x.id === owner) : undefined;
          if (match) matchedBy = "SKU";
        }
        if (!match) {
          match = products.find((x) => normalize(x.title) === normalize(p.title));
          if (match) matchedBy = "título";
        }

        // 2) SKU usado por OUTRO produto: não grava nada deste (evita apagar variações à toa).
        const conflict = skus.find((s) => {
          const o = skuOwner.get(s);
          return o && o !== match?.id;
        });
        if (conflict) throw new Error(`o SKU "${conflict}" já pertence a outro produto`);

        // 3) Produto.
        const row = {
          title: p.title,
          description: p.description,
          product_type: p.productType,
          vendor: p.vendor,
          tags: p.tags,
          status: p.status,
          options: p.options,
          images: p.images,
          updated_at: new Date().toISOString(),
        };
        let productId: string;
        if (match) {
          const up = await sb.from("products").update(row).eq("id", match.id);
          if (up.error) throw new Error(up.error.message);
          productId = match.id;
        } else {
          const ins = await sb
            .from("products")
            .insert({ ...row, handle: p.handle, sort: ++productSort })
            .select("id,handle,title,sort")
            .single();
          if (ins.error) throw new Error(ins.error.message);
          productId = ins.data.id;
          products.push(ins.data);
        }

        // 4) Variações: substitui todas pelas do arquivo.
        const del = await sb.from("product_variants").delete().eq("product_id", productId);
        if (del.error) throw new Error(del.error.message);
        for (const [s, owner] of skuOwner) if (owner === productId) skuOwner.delete(s);
        const insV = await sb.from("product_variants").insert(
          p.variants.map((v, i) => ({
            product_id: productId,
            position: i,
            option_values: v.values,
            sku: v.sku,
            price: v.price,
            compare_at_price: v.compareAtPrice,
            stock: v.stock,
            image: v.image,
          })),
        );
        if (insV.error) throw new Error(`variações: ${insV.error.message}`);
        for (const s of skus) skuOwner.set(s, productId);

        // 5) Coleções.
        const cs = [];
        for (const name of p.collections.length ? p.collections : ["Outros"])
          cs.push(await collectionId(name));
        const delC = await sb.from("product_collections").delete().eq("product_id", productId);
        if (delC.error) throw new Error(delC.error.message);
        const insC = await sb.from("product_collections").insert(
          [...new Map(cs.map((c) => [c.id, c])).values()].map((c, i) => ({
            product_id: productId,
            collection_id: c.id,
            position: i,
          })),
        );
        if (insC.error) throw new Error(`coleções: ${insC.error.message}`);

        results.push({
          handle: match?.handle ?? p.handle,
          title: p.title,
          status: match ? "updated" : "created",
          ...(matchedBy ? { message: `já existia (achado pelo ${matchedBy}): atualizado` } : {}),
          collections: cs.map((c) => c.name),
          variants: p.variants.length,
        });
      } catch (e) {
        results.push({
          handle: p.handle,
          title: p.title,
          status: "error",
          message: e instanceof Error ? e.message : String(e),
          collections: [],
          variants: 0,
        });
      }
    }

    const { invalidateCatalog } = await import("@/lib/catalog.server");
    invalidateCatalog();
    return { results, newCollections };
  });

export type AdminProductRow = {
  handle: string;
  title: string;
  status: string;
  img: string | null;
  minPrice: number;
  variants: number;
  stock: number | null;
  collections: string[];
  updatedAt: string;
};

/** Visão do catálogo para o admin (produtos e coleções do banco). */
export const getAdminCatalog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { catalogDbConfigured } = await import("@/lib/catalog.server");
    if (!catalogDbConfigured())
      return { configured: false as const, products: [], collections: [] };
    const sb = await db();
    const cols = await sb.from("collections").select("id,slug,name,sort").order("sort");
    if (cols.error) throw new Error(cols.error.message);
    const rows: AdminProductRow[] = [];
    for (let from = 0; ; from += 1000) {
      const page = await sb
        .from("products")
        .select(
          "handle,title,status,images,updated_at,product_variants(price,stock,image),product_collections(collection_id)",
        )
        .order("sort")
        .range(from, from + 999);
      if (page.error) throw new Error(page.error.message);
      for (const p of page.data) {
        const vs = p.product_variants ?? [];
        const tracked = vs.filter((v) => v.stock !== null);
        rows.push({
          handle: p.handle,
          title: p.title,
          status: p.status,
          img: p.images?.[0] ?? vs.find((v) => v.image)?.image ?? null,
          minPrice: vs.length ? Math.min(...vs.map((v) => Number(v.price))) : 0,
          variants: vs.length,
          stock: tracked.length ? tracked.reduce((s, v) => s + (v.stock ?? 0), 0) : null,
          collections: (p.product_collections ?? [])
            .map((pc) => cols.data.find((c) => c.id === pc.collection_id)?.name)
            .filter((n): n is string => !!n),
          updatedAt: p.updated_at,
        });
      }
      if (page.data.length < 1000) break;
    }
    return {
      configured: true as const,
      products: rows,
      collections: cols.data.map((c) => ({
        slug: c.slug,
        name: c.name,
        count: rows.filter((r) => r.collections.includes(c.name)).length,
      })),
    };
  });

/** Mostrar/ocultar produtos na loja. */
export const setProductsStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        password: z.string().max(200),
        handles: z.array(z.string().max(80)).min(1).max(500),
        status: z.enum(["active", "draft"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const sb = await db();
    const { error } = await sb
      .from("products")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .in("handle", data.handles);
    if (error) throw new Error(error.message);
    const { invalidateCatalog } = await import("@/lib/catalog.server");
    invalidateCatalog();
    return { ok: true };
  });

/** Exclui produtos (e as variações deles). */
export const deleteProducts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ password: z.string().max(200), handles: z.array(z.string().max(80)).min(1).max(500) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const sb = await db();
    const { error } = await sb.from("products").delete().in("handle", data.handles);
    if (error) throw new Error(error.message);
    const { invalidateCatalog } = await import("@/lib/catalog.server");
    invalidateCatalog();
    return { ok: true };
  });

/** Produtos do catálogo inicial no formato do importador (botão "Carregar catálogo inicial"). */
export const seedImportProducts = (): ImportProductInput[] =>
  SEED_PRODUCTS.map((p) => ({
    handle: p.handle,
    title: p.title,
    description: p.description,
    productType: p.productType,
    vendor: p.vendor,
    tags: p.tags,
    status: "active",
    options: p.options,
    variants: p.variants,
    images: p.images,
    collections: p.collections.map((s) => SEED_COLLECTIONS.find((c) => c.slug === s)?.name ?? s),
  }));

/** Produto completo para o editor do admin (mesmo formato do importador). */
export const getAdminProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ password: z.string().max(200), handle: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data }): Promise<ImportProductInput | null> => {
    assertAdmin(data.password);
    const sb = await db();
    const { data: p, error } = await sb
      .from("products")
      .select(
        "handle,title,description,product_type,vendor,tags,status,options,images," +
          "product_variants(position,option_values,sku,price,compare_at_price,stock,image)," +
          "product_collections(position,collections(name))",
      )
      .eq("handle", data.handle)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) return null;
    const row = p as unknown as {
      handle: string;
      title: string;
      description: string;
      product_type: string | null;
      vendor: string | null;
      tags: string[] | null;
      status: string;
      options: unknown;
      images: string[] | null;
      product_variants: {
        position: number;
        option_values: string[] | null;
        sku: string | null;
        price: number | string;
        compare_at_price: number | string | null;
        stock: number | null;
        image: string | null;
      }[];
      product_collections: { position: number; collections: { name: string } | null }[];
    };
    const options = Array.isArray(row.options)
      ? (row.options as { name?: unknown; values?: unknown }[])
          .filter((o) => typeof o?.name === "string" && Array.isArray(o.values))
          .map((o) => ({ name: o.name as string, values: (o.values as unknown[]).map(String) }))
      : [];
    return {
      handle: row.handle,
      title: row.title,
      description: row.description,
      productType: row.product_type,
      vendor: row.vendor,
      tags: row.tags ?? [],
      status: row.status === "active" ? "active" : "draft",
      options,
      variants: [...(row.product_variants ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((v) => ({
          values: v.option_values ?? [],
          sku: v.sku,
          price: Number(v.price),
          compareAtPrice: v.compare_at_price === null ? null : Number(v.compare_at_price),
          stock: v.stock,
          image: v.image,
        })),
      images: row.images ?? [],
      collections: [...(row.product_collections ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((pc) => pc.collections?.name)
        .filter((n): n is string => !!n),
    };
  });

const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png", "image/avif", "image/gif"] as const;

/**
 * Envia uma foto do produto para o Supabase Storage (bucket público "produtos") e devolve o
 * link. O admin já reduz a foto no navegador antes de mandar (máx. ~3 MB aqui).
 */
export const uploadProductImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        password: z.string().max(200),
        name: z.string().max(160),
        contentType: z.enum(IMAGE_TYPES),
        base64: z.string().min(10).max(4_200_000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const sb = await db();
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 3_000_000) throw new Error("Foto muito grande (máximo 3 MB depois de reduzida).");
    const ext = data.contentType.split("/")[1] === "jpeg" ? "jpg" : data.contentType.split("/")[1];
    const now = new Date();
    const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${
      slugify(data.name.replace(/\.[a-z0-9]+$/i, "")) || "foto"
    }-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await sb.storage
      .from("produtos")
      .upload(path, bytes, { contentType: data.contentType, cacheControl: "31536000", upsert: false });
    if (up.error) throw new Error(`Não consegui salvar a foto: ${up.error.message}`);
    return { url: sb.storage.from("produtos").getPublicUrl(path).data.publicUrl };
  });
