import { createServerFn } from "@tanstack/react-start";
import { senhaAdminOk } from "@/lib/admin-guard.server";
import { z } from "zod";
import {
  getLastPixFallback,
  getPixGatewayState,
  PIX_GATEWAYS,
  savePixGateway,
} from "./pix-gateway.server";
import {
  deletePixgateKey,
  getPixgateKeySource,
  savePixgateKey,
  testPixgateKey,
} from "./pixgate.server";
import {
  deleteUmbrellaKey,
  getUmbrellaKeySource,
  saveUmbrellaKey,
  testUmbrellaKey,
} from "./umbrella.server";
import {
  deleteSagacePayKey,
  getSagacePayKeySource,
  saveSagacePayKey,
  testSagacePayKey,
} from "./sagacepay.server";
import {
  deletePaySharkKey,
  getPaySharkKeySource,
  savePaySharkKey,
  testPaySharkKey,
} from "./payshark.server";
import { deleteKokuKey, getKokuKeySource, saveKokuKey, testKokuKey } from "./koku.server";
import {
  deletePixBlackKey,
  getPixBlackKeySource,
  savePixBlackKey,
  testPixBlackKey,
} from "./pixblack.server";
import {
  deleteLegacyKey,
  getLegacyFlags,
  getLegacyKeySource,
  saveLegacyFlag,
  saveLegacyKey,
  testLegacyKey,
} from "./legacy.server";

const pw = z.object({ password: z.string().min(1).max(200) });

function assertAdmin(password: string) {
  if (!senhaAdminOk(password)) throw new Error("Não autorizado");
}

function mask(token: string): string {
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

/**
 * Gateway escolhido, gateway em uso, chaves de cada gateway do Pix (mascaradas) e a última troca
 * automática para o gateway reserva.
 */
export const getPixGatewayStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const [state, pixgate, umbrella, sagacepay, payshark, koku, pixblack, legacy, lastFallback, legacyFlags] =
      await Promise.all([
        getPixGatewayState(),
        getPixgateKeySource(),
        getUmbrellaKeySource(),
        getSagacePayKeySource(),
        getPaySharkKeySource(),
        getKokuKeySource(),
        getPixBlackKeySource(),
        getLegacyKeySource(),
        getLastPixFallback().catch(() => null),
        getLegacyFlags().catch(() => ({ card: true, pix: true })),
      ]);
    return {
      ...state,
      lastFallback,
      legacyFlags,
      keys: {
        pixgate: { key: pixgate.key ? mask(pixgate.key) : null, source: pixgate.source },
        umbrella: { key: umbrella.key ? mask(umbrella.key) : null, source: umbrella.source },
        sagacepay: { key: sagacepay.key ? mask(sagacepay.key) : null, source: sagacepay.source },
        payshark: { key: payshark.key ? mask(payshark.key) : null, source: payshark.source },
        koku: { key: koku.key ? mask(koku.key) : null, source: koku.source },
        pixblack: { key: pixblack.key ? mask(pixblack.key) : null, source: pixblack.source },
        // Par pk_…:sk_…: mostra só o começo da chave pública; a secreta nunca volta para a tela.
        legacy: {
          key: legacy.key ? `${legacy.key.split(":")[0]!.slice(0, 8)}••••:••••` : null,
          source: legacy.source,
        },
      },
    };
  });

export const setPixGatewayFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.extend({ gateway: z.enum(PIX_GATEWAYS) }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await savePixGateway(data.gateway);
    return { ok: true };
  });

export const savePixgateKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.extend({ key: z.string().trim().min(10).max(500) }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await savePixgateKey(data.key);
    return { ok: true };
  });

export const deletePixgateKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await deletePixgateKey();
    return { ok: true };
  });

export const saveUmbrellaKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.extend({ key: z.string().trim().min(10).max(500) }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await saveUmbrellaKey(data.key);
    return { ok: true };
  });

export const deleteUmbrellaKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await deleteUmbrellaKey();
    return { ok: true };
  });

/** Valida a chave da Umbrella sem gerar cobrança nenhuma. */
export const testUmbrellaFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    return testUmbrellaKey();
  });

/** Valida a chave da PixGate sem gerar cobrança nenhuma. */
export const testPixgateFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    return testPixgateKey();
  });

export const saveSagacePayKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.extend({ key: z.string().trim().min(10).max(500) }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await saveSagacePayKey(data.key);
    return { ok: true };
  });

export const deleteSagacePayKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await deleteSagacePayKey();
    return { ok: true };
  });

/** Valida a chave da SagacePay sem gerar cobrança nenhuma. */
export const testSagacePayFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    return testSagacePayKey();
  });

export const savePaySharkKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.extend({ key: z.string().trim().min(10).max(500) }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await savePaySharkKey(data.key);
    return { ok: true };
  });

export const deletePaySharkKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await deletePaySharkKey();
    return { ok: true };
  });

/** Valida a chave da PayShark sem gerar cobrança nenhuma. */
export const testPaySharkFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    return testPaySharkKey();
  });

export const saveKokuKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.extend({ key: z.string().trim().min(10).max(500) }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await saveKokuKey(data.key);
    return { ok: true };
  });

export const deleteKokuKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await deleteKokuKey();
    return { ok: true };
  });

/** Valida a chave da Koku sem gerar cobrança e cadastra o webhook da loja na Koku se faltar. */
export const testKokuFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    return testKokuKey();
  });

export const savePixBlackKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.extend({ key: z.string().trim().min(10).max(500) }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await savePixBlackKey(data.key);
    return { ok: true };
  });

export const deletePixBlackKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await deletePixBlackKey();
    return { ok: true };
  });

/** Valida a chave da Pix Black sem gerar cobrança nenhuma. */
export const testPixBlackFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    return testPixBlackKey();
  });

/** Par de chaves da Legacy Ecom (pk_…:sk_…). O formato é conferido em saveLegacyKey. */
export const saveLegacyKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.extend({ key: z.string().trim().min(10).max(500) }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await saveLegacyKey(data.key);
    return { ok: true };
  });

export const deleteLegacyKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await deleteLegacyKey();
    return { ok: true };
  });

/** Valida o par da Legacy sem gerar cobrança nenhuma (GET /whoami). */
export const testLegacyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    return testLegacyKey();
  });

/** Liga/desliga separado o cartão e o Pix da Legacy (cada um é uma chave em private_settings). */
export const setLegacyFlagFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    pw.extend({ kind: z.enum(["card", "pix"]), on: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await saveLegacyFlag(data.kind, data.on);
    return { ok: true };
  });
