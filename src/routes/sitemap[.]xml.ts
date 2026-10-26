import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getCategories, listedBundles } from "@/lib/bundles";
import { ensureCatalog } from "@/lib/catalog.server";
import { absUrl, productPath } from "@/lib/seo";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Páginas que o Google deve indexar (com as fotos do produto). */
const entries = (): { path: string; images: readonly string[]; lastmod?: string }[] => [
  { path: "/", images: [] },
  ...listedBundles().map((b) => ({ path: productPath(b), images: b.images })),
  ...getCategories().map((c) => ({ path: `/colecao/${c.id}`, images: [] })),
  ...[
    "/sobre",
    "/contato",
    "/faq",
    "/rastreio",
    "/politica-envio",
    "/politica-privacidade",
    "/politica-reembolso",
  ].map((path) => ({ path, images: [] })),
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        await ensureCatalog();
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
          ...entries().map(
            (e) =>
              `  <url><loc>${esc(absUrl(e.path))}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}${e.images
                .map((i) => `<image:image><image:loc>${esc(absUrl(i))}</image:loc></image:image>`)
                .join("")}</url>`,
          ),
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
