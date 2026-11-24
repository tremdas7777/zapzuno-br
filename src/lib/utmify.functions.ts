import { createServerFn } from "@tanstack/react-start";
import { senhaAdminOk } from "@/lib/admin-guard.server";
import { z } from "zod";
import { brand } from "@/lib/brand";
import {
  deleteUtmifyToken,
  getUtmifyToken,
  saveUtmifyToken,
  sendUtmifyOrder,
} from "./utmify.server";

const pw = z.object({ password: z.string().min(1).max(200) });

function assertAdmin(password: string) {
  if (!senhaAdminOk(password)) throw new Error("Não autorizado");
}

function mask(token: string): string {
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export const getUtmifyStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const token = await getUtmifyToken();
    return { configured: Boolean(token), maskedToken: token ? mask(token) : null };
  });

export const saveUtmifyTokenFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.extend({ token: z.string().min(10).max(200) }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await saveUtmifyToken(data.token.trim());
    return { ok: true };
  });

export const deleteUtmifyTokenFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await deleteUtmifyToken();
    return { ok: true };
  });

export const sendUtmifyTest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    pw.extend({ status: z.enum(["paid", "waiting_payment"]).default("paid") }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const pending = data.status === "waiting_payment";
    // Teste pago: isTest (a UTMify valida, mas NÃO entra no faturamento).
    // Teste pendente: vai como pedido pendente de verdade (R$ 1,00, nunca aprovado) para disparar a
    // notificação de venda pendente no app da UTMify. Fica só em "Vendas pendentes", não no faturamento.
    return sendUtmifyOrder({
      isTest: !pending,
      orderId: `teste-${pending ? "pendente" : "pago"}-${Date.now()}`,
      status: data.status,
      createdAt: Date.now(),
      approvedAt: pending ? null : Date.now(),
      customer: {
        name: "TESTE PAINEL (ignorar)",
        email: "teste.painel@exemplo.com",
        phone: "11999999999",
        document: "52998224725",
      },
      products: [{ id: "teste", name: `TESTE - ${brand.productName}`, priceInCents: 100 }],
      amountCents: 100,
      utm: { utm_source: "teste" },
    });
  });
