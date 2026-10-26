import { z } from "zod";
import { defaultBundleId, parseBundleId, type BundleId } from "@/lib/bundles";

/** Query string do produto: ?plano=<id>&variante=<valores separados por "|">. */
export const planSearchSchema = z.object({
  plano: z.string().max(80).optional().catch(undefined),
  variante: z.string().max(400).optional().catch(undefined),
  /** Demais produtos do carrinho (o 1º vai em plano/variante). Validados no checkout e no servidor. */
  itens: z
    .array(
      z.object({
        plano: z.string().max(80),
        variante: z.string().max(400).optional(),
        qtd: z.number().int().min(1).max(10),
      }),
    )
    .max(20)
    .optional()
    .catch(undefined),
});

export type PlanSearch = z.infer<typeof planSearchSchema>;

export function bundleIdFromSearch(search: Pick<PlanSearch, "plano">): BundleId {
  return parseBundleId(search.plano) ?? defaultBundleId();
}
