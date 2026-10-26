import { createServerFn } from "@tanstack/react-start";
import type { CatalogData } from "@/lib/catalog-data";

/** Catálogo da vitrine (produtos, variações e coleções). Lido no servidor, com cache curto. */
export const fetchCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogData> => {
    const { loadCatalog } = await import("@/lib/catalog.server");
    return loadCatalog();
  },
);
