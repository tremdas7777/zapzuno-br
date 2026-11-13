import { beforeEach, describe, expect, mock, test } from "bun:test";

// Banco falso: só o upsert da chave da Legacy (private_settings), para testar o formato sem rede.
const saved = new Map<string, string>();
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      upsert: async (row: { key: string; value: string }) => {
        saved.set(row.key, row.value);
        return { error: null };
      },
    }),
  },
}));

const { saveLegacyKey } = await import("./legacy.server");
const { PIX_GATEWAYS, PIX_GATEWAY_LABEL, isLegacyOrderId, LEGACY_ORDER_PREFIX } =
  await import("./pix-gateway.server");

beforeEach(() => saved.clear());

describe("chave da Legacy Ecom", () => {
  test("par pk_…:sk_… é aceito e guardado junto", async () => {
    await saveLegacyKey("pk_live_abc123:sk_live_def456");
    expect(saved.get("legacy_api_key")).toBe("pk_live_abc123:sk_live_def456");
  });

  test("só uma das duas chaves é recusada, sem gravar nada", async () => {
    await expect(saveLegacyKey("pk_live_abc123")).rejects.toThrow("pk_live_xxx:sk_live_yyy");
    await expect(saveLegacyKey("sk_live_def456")).rejects.toThrow("pk_live_xxx:sk_live_yyy");
    expect(saved.size).toBe(0);
  });

  test("ordem trocada (sk antes de pk) é recusada", async () => {
    await expect(saveLegacyKey("sk_live_def456:pk_live_abc123")).rejects.toThrow();
    expect(saved.size).toBe(0);
  });
});

describe("gateway Legacy no Pix", () => {
  test("pedidos da Legacy têm prefixo le_ e são reconhecidos pelo id", () => {
    expect(LEGACY_ORDER_PREFIX).toBe("le_");
    expect(isLegacyOrderId("le_abc123")).toBe(true);
    expect(isLegacyOrderId("ko_abc123")).toBe(false);
    expect(isLegacyOrderId("abc123")).toBe(false);
  });

  test("está na lista de gateways com rótulo próprio", () => {
    expect(PIX_GATEWAYS).toContain("legacy");
    expect(PIX_GATEWAY_LABEL.legacy).toBe("Legacy Ecom");
  });
});
