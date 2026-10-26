/**
 * Leitura de CSV de produtos no formato da Shopify (exportação padrão: Handle, Title,
 * Body (HTML), Type, Tags, Option1 Name/Value..., Variant SKU, Variant Price,
 * Variant Compare At Price, Variant Inventory Qty, Image Src, Variant Image, Status).
 * Também aceita cabeçalhos em português ("Título", "Preço", "Estoque", "Coleção"...) e
 * arquivos do Excel separados por ";".
 *
 * Roda no navegador (prévia do admin) e no servidor (que valida de novo antes de gravar).
 */

import type { CatalogVariant } from "./catalog-data";

export type CsvIssue = {
  /** Linha do arquivo (1 = cabeçalho). */
  row: number;
  handle?: string;
  level: "error" | "warning";
  message: string;
};

export type CategorySource = "coluna" | "tipo" | "título" | "categoria" | "padrão";

export type ImportProduct = {
  handle: string;
  title: string;
  description: string;
  productType: string | null;
  vendor: string | null;
  tags: string[];
  status: "active" | "draft";
  options: { name: string; values: string[] }[];
  variants: CatalogVariant[];
  images: string[];
  /** Nomes das coleções (o servidor liga a uma existente ou cria uma nova). */
  collections: string[];
  categorySource: CategorySource;
  /** Primeira linha do produto no arquivo (para mensagens). */
  row: number;
};

export type ParseResult = {
  products: ImportProduct[];
  issues: CsvIssue[];
  /** Linhas de dados lidas (sem o cabeçalho). */
  rowCount: number;
  /** Colunas reconhecidas → nome no arquivo. */
  columns: Partial<Record<Field, string>>;
};

/* ------------------------------------------------------------------ CSV */

/** Separa o texto em linhas/células (RFC 4180: aspas, "" e quebras de linha dentro de aspas). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n/) === -1 ? src.length : src.search(/\r?\n/));
  const delim = countOutsideQuotes(firstLine, ";") > countOutsideQuotes(firstLine, ",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function countOutsideQuotes(line: string, ch: string) {
  let n = 0;
  let q = false;
  for (const c of line) {
    if (c === '"') q = !q;
    else if (c === ch && !q) n++;
  }
  return n;
}

/** Gera uma linha CSV (com aspas quando precisa). */
export function toCsvRow(cells: readonly (string | number | null | undefined)[]) {
  return cells
    .map((c) => {
      const s = c === null || c === undefined ? "" : String(c);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

/* -------------------------------------------------------------- colunas */

export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const slugify = (s: string) =>
  normalize(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const FIELDS = {
  handle: ["handle", "url handle", "identificador", "slug"],
  title: ["title", "titulo", "nome", "nome do produto", "produto"],
  body: ["body (html)", "body html", "body", "descricao", "description", "descricao (html)"],
  vendor: ["vendor", "fornecedor", "fabricante", "marca"],
  productCategory: ["product category", "categoria do produto", "google shopping / google product category"],
  type: ["type", "product type", "tipo", "tipo de produto", "categoria"],
  tags: ["tags", "etiquetas"],
  published: ["published", "publicado"],
  status: ["status", "situacao"],
  collection: ["collection", "collections", "colecao", "colecoes", "custom collections", "colecao personalizada"],
  o1n: ["option1 name", "option 1 name", "opcao1 nome", "opcao 1 nome", "opcao1 name"],
  o1v: ["option1 value", "option 1 value", "opcao1 valor", "opcao 1 valor", "opcao1 value"],
  o2n: ["option2 name", "option 2 name", "opcao2 nome", "opcao 2 nome"],
  o2v: ["option2 value", "option 2 value", "opcao2 valor", "opcao 2 valor"],
  o3n: ["option3 name", "option 3 name", "opcao3 nome", "opcao 3 nome"],
  o3v: ["option3 value", "option 3 value", "opcao3 valor", "opcao 3 valor"],
  sku: ["variant sku", "sku", "sku da variacao", "codigo"],
  price: ["variant price", "price", "preco", "preco da variacao", "valor"],
  compareAt: [
    "variant compare at price",
    "compare at price",
    "compare-at price",
    "preco comparativo",
    "preco de",
    "preco antigo",
  ],
  stock: [
    "variant inventory qty",
    "inventory qty",
    "inventory quantity",
    "variant inventory quantity",
    "estoque",
    "quantidade",
    "quantidade em estoque",
  ],
  tracker: ["variant inventory tracker", "inventory tracker"],
  variantImage: ["variant image", "imagem da variacao", "variant image src"],
  image: ["image src", "image", "imagem", "image url", "url da imagem", "imagem principal"],
  imagePosition: ["image position", "posicao da imagem"],
  size: ["tamanho", "size"],
  color: ["cor", "color", "colour"],
} as const;
export type Field = keyof typeof FIELDS;

function mapColumns(header: readonly string[]) {
  const idx: Partial<Record<Field, number>> = {};
  const names: Partial<Record<Field, string>> = {};
  const norm = header.map(normalize);
  for (const f of Object.keys(FIELDS) as Field[]) {
    const i = norm.findIndex((h) => (FIELDS[f] as readonly string[]).includes(h));
    if (i !== -1) {
      idx[f] = i;
      names[f] = header[i]!.trim();
    }
  }
  return { idx, names };
}

/* ---------------------------------------------------------------- valores */

/** "189.90", "189,90", "R$ 1.189,90", "1,189.90" → número (ou null se vazio/inválido). */
export function parseMoney(raw: string): number | null | "invalid" {
  let s = raw.replace(/R\$|\s/gi, "").trim();
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "invalid";
}

const truthy = (s: string) => /^(true|sim|yes|1|verdadeiro|ativo|active)$/i.test(s.trim());
const falsy = (s: string) => /^(false|nao|não|no|0|falso|inativo|draft|rascunho|archived|arquivado)$/i.test(s.trim());

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s) || /^\/[^\s]*$/.test(s);

/** Texto da descrição a partir do HTML do CSV (sem tags: a loja nunca injeta HTML do arquivo). */
export function htmlToText(html: string) {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* -------------------------------------------------------------- coleções */

/** Tipo de peça pelo nome/tipo (texto sem acento): nome da coleção criada quando não existe uma. */
const KEYWORDS: readonly [RegExp, string][] = [
  [/\btrico/, "Tricô"],
  [/\balfaiataria\b/, "Alfaiataria"],
  [/\bbermudas?\b|\bberma\b|\bshorts?\b/, "Bermudas"],
  [/\bcalcas?\b|\bjeans\b|\bpants?\b|\btrousers?\b/, "Calças"],
  [/\bconjuntos?\b/, "Conjuntos"],
  [/\bcamisetas?\b|\bt-?shirts?\b|\btees?\b/, "Camisetas"],
  [/\bpolos?\b/, "Polos"],
  [/\bcamisas?\b|\bshirts?\b/, "Camisas"],
  [/\bregatas?\b|\btank\b/, "Regatas"],
  [/\bmoletons?\b|\bhoodies?\b|\bsweatshirts?\b|\bcasacos?\b|\bjaquetas?\b|\bjackets?\b|\bcorta.?ventos?\b/, "Jaquetas e Casacos"],
  [/\btenis\b|\bsneakers?\b|\bshoes?\b/, "Tênis"],
  [/\bchinelos?\b|\bslides?\b|\bsandalias?\b|\bsandals?\b/, "Chinelos"],
  [/\bbones?\b|\bcaps?\b|\bhats?\b/, "Bonés"],
  [/\bmeias?\b|\bsocks?\b/, "Meias"],
  [/\bcuecas?\b|\bunderwear\b/, "Cuecas"],
  [/\bcintos?\b|\bbelts?\b/, "Cintos"],
  [/\bbolsas?\b|\bbags?\b|\bpochetes?\b|\bmochilas?\b|\bbackpacks?\b/, "Bolsas e Mochilas"],
  [/\boculos\b|\bsunglasses\b/, "Óculos"],
  [/\brelogios?\b|\bwatch(es)?\b/, "Relógios"],
  [/\bcorrentes?\b|\bpulseiras?\b|\baneis\b|\banel\b|\bcolar(es)?\b|\bjewelry\b/, "Acessórios"],
];

const STOP = new Set(["de", "da", "do", "das", "dos", "e", "com", "em", "para", "a", "o", "the", "and", "of"]);
const tokens = (s: string) =>
  normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));

export type ExistingCollection = { slug: string; name: string };

/**
 * Coleção existente que combina com o texto: todas as palavras do nome da coleção aparecem
 * no texto ("Calças Jogador" combina com "Calça Jogador Jeans Chumbo"). Vence a mais específica.
 */
export function matchCollection(text: string, existing: readonly ExistingCollection[]) {
  const words = new Set(tokens(text));
  const slugText = slugify(text);
  let best: ExistingCollection | undefined;
  let bestScore = 0;
  for (const c of existing) {
    if (slugText === c.slug || normalize(text) === normalize(c.name)) return c;
    const t = tokens(c.name);
    if (t.length && t.every((w) => words.has(w)) && t.length > bestScore) {
      best = c;
      bestScore = t.length;
    }
  }
  return best;
}

/** Coleção com o mesmo nome/slug (para não criar duplicada). */
export const sameCollection = <T extends ExistingCollection>(name: string, existing: readonly T[]) =>
  existing.find((c) => c.slug === slugify(name) || normalize(c.name) === normalize(name));

function detectCollections(
  p: { title: string; productType: string | null; tags: string[]; category: string | null; explicit: string[] },
  existing: readonly ExistingCollection[],
): { names: string[]; source: CategorySource } {
  if (p.explicit.length) {
    const names = p.explicit.map((n) => sameCollection(n, existing)?.name ?? n.trim());
    return { names: [...new Set(names)], source: "coluna" };
  }
  const tries: [string | null, CategorySource][] = [
    [p.productType, "tipo"],
    [p.title, "título"],
    [p.category?.split(">").at(-1)?.trim() ?? null, "categoria"],
  ];
  for (const [text, source] of tries) {
    if (!text) continue;
    const m = matchCollection(text, existing);
    if (m) return { names: [m.name], source };
  }
  for (const [text, source] of tries) {
    if (!text) continue;
    const k = KEYWORDS.find(([re]) => re.test(normalize(text)));
    if (k) return { names: [sameCollection(k[1], existing)?.name ?? k[1]], source };
  }
  if (p.productType?.trim()) return { names: [p.productType.trim()], source: "tipo" };
  return { names: ["Outros"], source: "padrão" };
}

/* ---------------------------------------------------------------- leitura */

const MAX_PRODUCTS = 2000;

/**
 * Lê o CSV e agrupa as linhas por produto (Handle), como a Shopify:
 * a 1ª linha do produto traz os dados gerais; as seguintes trazem só variações e/ou fotos.
 */
export function parseShopifyCsv(text: string, existing: readonly ExistingCollection[] = []): ParseResult {
  const rows = parseCsv(text);
  const issues: CsvIssue[] = [];
  if (rows.length < 2) {
    return {
      products: [],
      issues: [{ row: 1, level: "error", message: "O arquivo está vazio ou só tem o cabeçalho." }],
      rowCount: 0,
      columns: {},
    };
  }
  const { idx, names } = mapColumns(rows[0]!);
  if (idx.handle === undefined && idx.title === undefined) {
    issues.push({
      row: 1,
      level: "error",
      message:
        'Não achei as colunas "Handle" nem "Title" no cabeçalho. Confira se é o CSV de produtos da Shopify (ou se tem uma coluna "Título").',
    });
    return { products: [], issues, rowCount: rows.length - 1, columns: names };
  }
  if (idx.price === undefined)
    issues.push({ row: 1, level: "error", message: 'Falta a coluna de preço ("Variant Price" ou "Preço").' });

  const get = (r: string[], f: Field) => (idx[f] === undefined ? "" : (r[idx[f]!] ?? "").trim());

  type Draft = ImportProduct & {
    optionNames: string[];
    keys: Set<string>;
    imagePositions: { url: string; pos: number }[];
    explicit: string[];
    category: string | null;
  };
  const byHandle = new Map<string, Draft>();
  const skus = new Map<string, string>();
  let last: Draft | undefined;

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const title = get(r, "title");
    let handle = slugify(get(r, "handle"));
    // Sem Handle: linha nova com título = produto novo; sem título = continua o anterior.
    if (!handle) handle = title ? slugify(title) : (last?.handle ?? "");
    if (!handle) {
      issues.push({ row: line, level: "error", message: "Linha sem Handle e sem Título: ignorada." });
      return;
    }
    let p = byHandle.get(handle);
    if (!p) {
      if (!title) {
        issues.push({
          row: line,
          handle,
          level: "error",
          message: `Primeira linha do produto "${handle}" está sem título: produto ignorado.`,
        });
        return;
      }
      if (byHandle.size >= MAX_PRODUCTS) {
        issues.push({ row: line, level: "error", message: `Limite de ${MAX_PRODUCTS} produtos por arquivo.` });
        return;
      }
      const status = get(r, "status");
      const published = get(r, "published");
      const draft = (status && falsy(status)) || (published && falsy(published) && !truthy(status));
      const optionNames = [get(r, "o1n"), get(r, "o2n"), get(r, "o3n")];
      // Planilha simples: colunas "Cor"/"Tamanho" no lugar de Option1/Option2 (só as que o
      // produto usa na 1ª linha).
      if (!optionNames.some(Boolean)) {
        const simple = [get(r, "color") && "Cor", get(r, "size") && "Tamanho"].filter(Boolean);
        simple.forEach((n, k) => (optionNames[k] = n as string));
      }
      p = {
        handle,
        title: title.slice(0, 200),
        description: htmlToText(get(r, "body")).slice(0, 8000),
        productType: get(r, "type") || null,
        vendor: get(r, "vendor") || null,
        tags: get(r, "tags")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 30),
        status: draft ? "draft" : "active",
        options: [],
        variants: [],
        images: [],
        collections: [],
        categorySource: "padrão",
        row: line,
        optionNames,
        keys: new Set(),
        imagePositions: [],
        explicit: get(r, "collection")
          .split(/[,;|]/)
          .map((c) => c.trim())
          .filter(Boolean),
        category: get(r, "productCategory") || null,
      };
      byHandle.set(handle, p);
    }
    last = p;

    // Foto do produto (linhas só de imagem também entram aqui).
    const image = get(r, "image");
    if (image) {
      if (isUrl(image)) {
        const pos = Number(get(r, "imagePosition")) || 1000 + p.imagePositions.length;
        if (!p.imagePositions.some((x) => x.url === image)) p.imagePositions.push({ url: image, pos });
      } else
        issues.push({ row: line, handle, level: "warning", message: `Imagem ignorada (não é um link): ${image.slice(0, 60)}` });
    }

    // Variação: linha com valor de opção, preço ou SKU.
    const rawValues = [get(r, "o1v"), get(r, "o2v"), get(r, "o3v")];
    if (idx.o1n === undefined)
      p.optionNames.forEach((n, k) => {
        if (n === "Cor") rawValues[k] = get(r, "color");
        if (n === "Tamanho") rawValues[k] = get(r, "size");
      });
    const sku = get(r, "sku");
    const priceRaw = get(r, "price");
    const hasVariant = rawValues.some(Boolean) || !!priceRaw || !!sku;
    if (!hasVariant) return;

    const values: string[] = [];
    let bad = false;
    p.optionNames.forEach((n, k) => {
      if (!n) return;
      const v = rawValues[k] ?? "";
      if (!v) {
        bad = true;
        issues.push({ row: line, handle, level: "error", message: `Variação sem valor para "${n}": ignorada.` });
      }
      values.push(v.slice(0, 60));
    });
    if (bad) return;
    // "Title / Default Title" da Shopify = produto sem variação.
    const isDefault = p.optionNames[0]?.toLowerCase() === "title" && /^default title$/i.test(values[0] ?? "");
    const finalValues = isDefault ? [] : values;

    const price = parseMoney(priceRaw);
    if (price === "invalid" || price === null) {
      issues.push({
        row: line,
        handle,
        level: "error",
        message: price === null ? "Variação sem preço: ignorada." : `Preço inválido "${priceRaw}": variação ignorada.`,
      });
      return;
    }
    const compareRaw = get(r, "compareAt");
    const compare = parseMoney(compareRaw);
    if (compare === "invalid")
      issues.push({ row: line, handle, level: "warning", message: `Preço "de" inválido "${compareRaw}": ignorado.` });

    const stockRaw = get(r, "stock");
    let stock: number | null = null;
    if (stockRaw) {
      const n = Number(stockRaw.replace(",", "."));
      if (!Number.isFinite(n)) {
        issues.push({ row: line, handle, level: "warning", message: `Estoque inválido "${stockRaw}": ficou sem controle de estoque.` });
      } else if (n < 0) {
        stock = 0;
        issues.push({ row: line, handle, level: "warning", message: `Estoque negativo (${n}) virou 0.` });
      } else stock = Math.floor(n);
    }

    const key = finalValues.join(" / ");
    if (p.keys.has(key)) {
      issues.push({
        row: line,
        handle,
        level: "warning",
        message: `Variação repetida (${key || "sem opções"}): mantive a primeira.`,
      });
      return;
    }
    if (sku) {
      const owner = skus.get(sku.toLowerCase());
      if (owner) {
        issues.push({
          row: line,
          handle,
          level: "error",
          message: `SKU "${sku}" repetido (já usado em "${owner}"): variação ignorada.`,
        });
        return;
      }
      skus.set(sku.toLowerCase(), handle);
    }
    const vImage = get(r, "variantImage");
    if (vImage && !isUrl(vImage))
      issues.push({ row: line, handle, level: "warning", message: "Imagem da variação ignorada (não é um link)." });
    p.keys.add(key);
    p.variants.push({
      values: finalValues,
      sku: sku ? sku.slice(0, 80) : null,
      price,
      compareAtPrice: typeof compare === "number" && compare > price ? compare : null,
      stock,
      image: vImage && isUrl(vImage) ? vImage : null,
    });
  });

  const products: ImportProduct[] = [];
  for (const d of byHandle.values()) {
    if (!d.variants.length) {
      issues.push({ row: d.row, handle: d.handle, level: "error", message: `"${d.title}" não tem nenhuma variação válida (preço): produto ignorado.` });
      continue;
    }
    const usesOptions = d.variants.some((v) => v.values.length);
    const options = usesOptions
      ? d.optionNames
          .filter(Boolean)
          .map((name, k) => ({ name: name.slice(0, 40), values: [...new Set(d.variants.map((v) => v.values[k]!))] }))
      : [];
    const images = [
      ...d.imagePositions.sort((a, b) => a.pos - b.pos).map((x) => x.url),
      ...d.variants.map((v) => v.image).filter((x): x is string => !!x),
    ];
    const col = detectCollections(
      { title: d.title, productType: d.productType, tags: d.tags, category: d.category, explicit: d.explicit },
      existing,
    );
    if (!images.length)
      issues.push({ row: d.row, handle: d.handle, level: "warning", message: `"${d.title}" está sem foto.` });
    products.push({
      handle: d.handle,
      title: d.title,
      description: d.description,
      productType: d.productType,
      vendor: d.vendor,
      tags: d.tags,
      status: d.status,
      options,
      variants: usesOptions ? d.variants : d.variants.slice(0, 1).map((v) => ({ ...v, values: [] })),
      images: [...new Set(images)].slice(0, 30),
      collections: col.names,
      categorySource: col.source,
      row: d.row,
    });
  }
  issues.sort((a, b) => a.row - b.row);
  return { products, issues, rowCount: rows.length - 1, columns: names };
}

/** Cabeçalho do CSV modelo (mesmo da exportação da Shopify, só as colunas que a loja usa). */
export const TEMPLATE_HEADER = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Type",
  "Tags",
  "Collection",
  "Status",
  "Option1 Name",
  "Option1 Value",
  "Option2 Name",
  "Option2 Value",
  "Variant SKU",
  "Variant Price",
  "Variant Compare At Price",
  "Variant Inventory Qty",
  "Variant Image",
  "Image Src",
  "Image Position",
] as const;
