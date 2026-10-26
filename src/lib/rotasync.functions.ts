import { createServerFn } from "@tanstack/react-start";
import { senhaAdminOk } from "@/lib/admin-guard.server";
import { z } from "zod";
import {
  deleteRotasyncKey,
  getRotasyncKeySource,
  saveRotasyncKey,
  testRotasyncKey,
} from "./rotasync.server";
import { enviarPendentesRotasync, listarPendentesRotasync } from "./pix-orders.server";

// Card "RotaSync" do /admin: chave da loja para enviar os pedidos pagos.

const pw = z.object({ password: z.string().min(1).max(200) });

function assertAdmin(password: string) {
  if (!senhaAdminOk(password))
    throw new Error("Não autorizado");
}

function mask(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export const getRotasyncStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { key, source } = await getRotasyncKeySource();
    return { configured: Boolean(key), maskedKey: key ? mask(key) : null, source };
  });

/** Confere a chave na RotaSync antes de salvar: chave recusada não é salva. */
export const saveRotasyncKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.extend({ key: z.string().min(10).max(300) }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const key = data.key.trim();
    const test = await testRotasyncKey(key);
    if (test.status === 401 || test.status === 403) return { ok: false, error: test.error };
    await saveRotasyncKey(key);
    return { ok: true, test };
  });

export const deleteRotasyncKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await deleteRotasyncKey();
    return { ok: true };
  });

export const testRotasyncKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { key } = await getRotasyncKeySource();
    if (!key) return { ok: false, error: "Nenhuma chave cadastrada" };
    return testRotasyncKey(key);
  });

/** Pedidos pagos que ainda não foram para a RotaSync (para enviar os antigos). */
export const listarPendentesRotasyncFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    return listarPendentesRotasync();
  });

export const enviarPendentesRotasyncFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    pw.extend({ ids: z.array(z.string().min(1).max(100)).min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    return enviarPendentesRotasync(data.ids);
  });
