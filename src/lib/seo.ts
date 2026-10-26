/**
 * SEO da loja: endereço oficial de cada página (canonical), tags de compartilhamento e os dados
 * estruturados (JSON-LD) que o Google lê para mostrar preço, frete, devolução e a trilha de
 * navegação nos resultados.
 */
import type { JSX } from "react";
import { brand } from "./brand";
import { listedBundles, type Bundle } from "./bundles";

/** Endereço absoluto no domínio oficial (o Google ignora canonical e og:image relativos). */
export const absUrl = (path: string) =>
  /^https?:\/\//.test(path) ? path : `${brand.siteUrl}${path.startsWith("/") ? "" : "/"}${path}`;

type Meta = Record<string, unknown>;
type MetaTag = JSX.IntrinsicElements["meta"];

/** O TanStack Router vira { "script:ld+json": ... } numa tag JSON-LD, mas o tipo de meta não prevê a chave. */
export const ldJson = (d: Meta) => ({ "script:ld+json": d }) as unknown as MetaTag;

/** Tags de uma página: título, descrição, canonical, Open Graph/Twitter e JSON-LD. */
export function seo(p: {
  path: string;
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "product" | "article";
  jsonLd?: readonly Meta[];
}) {
  const url = absUrl(p.path);
  const image = absUrl(p.image ?? "/og-image.jpg");
  const meta: MetaTag[] = [
    { title: p.title },
    { name: "description", content: p.description },
    { property: "og:title", content: p.title },
    { property: "og:description", content: p.description },
    { property: "og:url", content: url },
    { property: "og:type", content: p.type ?? "website" },
    { property: "og:image", content: image },
    { property: "og:image:alt", content: p.imageAlt ?? p.title },
    { name: "twitter:title", content: p.title },
    { name: "twitter:description", content: p.description },
    { name: "twitter:image", content: image },
    ...(p.jsonLd ?? []).map(ldJson),
  ];
  return { meta, links: [{ rel: "canonical", href: url }] };
}

export const ORG_ID = `${brand.siteUrl}/#loja`;

/** Garantia de devolução do dinheiro (brand.garantiaDias, contados da entrega). */
const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "BR",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: brand.garantiaDias,
  returnMethod: "https://schema.org/ReturnByMail",
  merchantReturnLink: absUrl("/politica-reembolso"),
};

const dias = (minValue: number, maxValue: number) => ({
  "@type": "QuantitativeValue",
  minValue,
  maxValue,
  unitCode: "DAY",
});

/** Números do prazo de entrega ("7 a 10 dias úteis" → 7 e 10). */
const [PRAZO_MIN, PRAZO_MAX] = (brand.prazoEntrega.match(/\d+/g) ?? ["7", "10"]).map(Number);

/** Frete grátis para todo o Brasil (FREE_SHIPPING_MIN = 0). */
const SHIPPING = {
  "@type": "OfferShippingDetails",
  shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "BRL" },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "BR" },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: dias(0, 1),
    transitTime: dias(PRAZO_MIN ?? 7, PRAZO_MAX ?? PRAZO_MIN ?? 10),
  },
};

/** A loja (home): nome, logo, CNPJ, contato e política de devolução. */
export function storeJsonLd(): Meta[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      "@id": ORG_ID,
      name: brand.name,
      alternateName: "ZAPZUNO Brasil",
      url: `${brand.siteUrl}/`,
      logo: absUrl("/apple-touch-icon.png"),
      image: absUrl("/og-image.jpg"),
      description: `${brand.taglineShort}. ${brand.tagline}`,
      ...(/^0+\.0+/.test(brand.cnpj) ? {} : { taxID: brand.cnpj }),
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        telephone: `+${brand.whatsapp.phoneE164}`,
        availableLanguage: "pt-BR",
        areaServed: "BR",
      },
      hasMerchantReturnPolicy: RETURN_POLICY,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${brand.siteUrl}/#site`,
      name: brand.name,
      alternateName: ["Zapzuno", "ZAPZUNO Brasil"],
      url: `${brand.siteUrl}/`,
      inLanguage: "pt-BR",
      publisher: { "@id": ORG_ID },
    },
  ];
}

/** A loja vende um produto só: a página dele é sempre /produto. */
export const productPath = (b: Bundle) =>
  listedBundles()[0]?.id === b.id ? "/produto" : `/produto?plano=${encodeURIComponent(b.id)}`;

export const breadcrumbJsonLd = (items: readonly { name: string; path: string }[]): Meta => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: absUrl(it.path),
  })),
});

const offer = (url: string, price: number, inStock: boolean) => ({
  "@type": "Offer",
  url,
  priceCurrency: "BRL",
  price: price.toFixed(2),
  availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  itemCondition: "https://schema.org/NewCondition",
  seller: { "@id": ORG_ID },
  shippingDetails: SHIPPING,
  hasMerchantReturnPolicy: RETURN_POLICY,
});

/**
 * Produto com as variações (1, 2 ou 3 kits) como ProductGroup: cada variação tem
 * preço e SKU próprios. Produto sem variação vira um Product simples.
 */
export function productJsonLd(b: Bundle): Meta[] {
  const url = absUrl(productPath(b));
  const images = [...new Set(b.images.length ? b.images : [b.img])].slice(0, 8).map(absUrl);
  const description = (
    b.description?.length ? b.description.join(" ") : b.checkoutProductDescription
  )
    .replace(/\s+/g, " ")
    .slice(0, 4900);
  const common = {
    name: b.name,
    url,
    image: images,
    description,
    brand: { "@type": "Brand", name: brand.name },
    category: "Brinquedos > Laser tag",
  };
  const variants = (b.variants ?? []).filter((v) => v.values.length);
  const main =
    variants.length > 1
      ? {
          "@context": "https://schema.org",
          "@type": "ProductGroup",
          "@id": `${url}#produto`,
          ...common,
          productGroupID: b.id,
          hasVariant: variants.map((v) => ({
            "@type": "Product",
            name: `${b.name} - ${v.values.join(" / ")}`,
            ...(v.sku ? { sku: v.sku } : {}),
            image: v.image ? absUrl(v.image) : images[0],
            offers: offer(url, v.price, v.stock === null || v.stock > 0),
          })),
        }
      : {
          "@context": "https://schema.org",
          "@type": "Product",
          "@id": `${url}#produto`,
          ...common,
          sku: variants[0]?.sku ?? b.id,
          offers: offer(url, b.price, !b.soldOut),
        };
  return [
    main,
    breadcrumbJsonLd([
      { name: "Início", path: "/" },
      { name: b.name, path: productPath(b) },
    ]),
  ];
}

/** Perguntas frequentes (FAQPage). */
export const faqJsonLd = (faq: readonly { q: string; a: string }[]): Meta => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

/** Artigo (BlogPosting). */
export const articleJsonLd = (a: {
  path: string;
  title: string;
  description: string;
  image: string;
  publicado: string;
  atualizado?: string;
}): Meta => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "@id": `${absUrl(a.path)}#artigo`,
  mainEntityOfPage: absUrl(a.path),
  headline: a.title,
  description: a.description,
  image: [absUrl(a.image)],
  datePublished: a.publicado,
  dateModified: a.atualizado ?? a.publicado,
  inLanguage: "pt-BR",
  author: { "@type": "Organization", name: brand.name, url: `${brand.siteUrl}/` },
  publisher: { "@id": ORG_ID },
});
