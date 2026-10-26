import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { brand } from "@/lib/brand";
import { encodeVariant, listedBundles, type Bundle, type Variant } from "@/lib/bundles";
import { ensureCatalog } from "@/lib/catalog.server";
import { KITS_OPTION, kitsDe } from "@/lib/catalog-data";
import { absUrl, productPath } from "@/lib/seo";

/**
 * Feed de produtos do Google Merchant Center (listagens gratuitas do Google Shopping):
 * um item por variação (1, 2 ou 3 kits), com o SKU como id.
 * O Merchant Center busca este endereço uma vez por dia.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "Brinquedos e jogos > Brinquedos > Armas de brinquedo" na taxonomia do Google. */
const GOOGLE_CATEGORY = 3627;

/** Números do prazo de entrega ("7 a 10 dias úteis" → 7 e 10). */
const [PRAZO_MIN = 7, PRAZO_MAX = PRAZO_MIN] = (brand.prazoEntrega.match(/\d+/g) ?? []).map(Number);

const tag = (name: string, value: string | number) => `<g:${name}>${esc(String(value))}</g:${name}>`;

/** Abre a /produto já com a variação escolhida (o preço da página bate com o do anúncio). */
const variantLink = (b: Bundle, v: Variant) => {
  const path = productPath(b);
  if (!v.values.length) return absUrl(path);
  const sep = path.includes("?") ? "&" : "?";
  return absUrl(`${path}${sep}variante=${encodeURIComponent(encodeVariant(v.values))}`);
};

/** Quantos kits tem a variação ("2 kits · 4 jogadores" → 2), ou null em produto sem essa opção. */
const kitsOf = (b: Bundle, v: Variant) => {
  const i = b.options.findIndex((o) => o.name === KITS_OPTION);
  return i < 0 ? null : kitsDe(v.values[i] ?? "").kits;
};

/**
 * Título e descrição do anúncio. Sem preço, frete ou "promoção" no texto (o Google recusa) e sem
 * promessas que o Google não consegue conferir.
 */
function texts(b: Bundle, v: Variant) {
  const n = kitsOf(b, v);
  const variant = v.values.join(" / ");
  const title = [
    `${b.name} ${brand.name}`,
    variant && ` - ${variant}`,
    n && ` (${n} ${n === 1 ? "projetor" : "projetores"} + ${n * 2} pistolas)`,
  ]
    .filter(Boolean)
    .join("");
  const description = [
    b.description?.[0] ?? b.checkoutProductDescription,
    n && `O pedido traz ${n} ${n === 1 ? "projetor" : "projetores"}, ${n * 2} pistolas e ${n * 4} cartões de alvo.`,
    "O jogo é por infravermelho: não dispara bolinha, dardo nem nada. A partir de 5 anos, com supervisão de um adulto.",
  ]
    .filter(Boolean)
    .join(" ");
  return { title: title.slice(0, 150), description: description.slice(0, 5000) };
}

function item(b: Bundle, v: Variant) {
  const { title, description } = texts(b, v);
  const image = absUrl(v.image ?? b.img);
  const extra = [...new Set(b.images.map(absUrl))].filter((i) => i !== image).slice(0, 10);
  const inStock = v.stock === null || v.stock > 0;
  const fields = [
    tag("id", v.sku ?? (v.values.length ? `${b.id}-${v.values.join("-")}` : b.id)),
    tag("item_group_id", b.id),
    tag("title", title),
    tag("description", description),
    tag("link", variantLink(b, v)),
    tag("image_link", image),
    ...extra.map((i) => tag("additional_image_link", i)),
    tag("availability", inStock ? "in_stock" : "out_of_stock"),
    tag("price", `${v.price.toFixed(2)} BRL`),
    tag("condition", "new"),
    tag("brand", brand.name),
    tag("identifier_exists", "no"),
    tag("google_product_category", GOOGLE_CATEGORY),
    tag("product_type", "Brinquedos > Laser tag"),
    `<g:shipping>${tag("country", "BR")}${tag("service", "Frete grátis")}${tag("price", "0.00 BRL")}${tag("min_handling_time", 0)}${tag("max_handling_time", 1)}${tag("min_transit_time", PRAZO_MIN)}${tag("max_transit_time", PRAZO_MAX)}</g:shipping>`,
  ];
  return ["    <item>", ...fields.map((f) => `      ${f}`), "    </item>"].join("\n");
}

export const Route = createFileRoute("/feed.xml")({
  server: {
    handlers: {
      GET: async () => {
        await ensureCatalog();
        const items = listedBundles()
          .filter((b) => !b.kit)
          .flatMap((b) => (b.variants ?? []).filter((v) => v.price > 0).map((v) => item(b, v)));
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">`,
          `  <channel>`,
          `    <title>${esc(brand.name)}</title>`,
          `    <link>${esc(`${brand.siteUrl}/`)}</link>`,
          `    <description>${esc(`${brand.taglineShort}. ${brand.tagline}`)}</description>`,
          ...items,
          `  </channel>`,
          `</rss>`,
        ].join("\n");
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
