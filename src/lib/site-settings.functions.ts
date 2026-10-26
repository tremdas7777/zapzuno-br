import { createServerFn } from "@tanstack/react-start";
import { senhaAdminOk } from "@/lib/admin-guard.server";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { brand } from "@/lib/brand";
import { normalizeWhatsapp } from "@/lib/whatsapp";

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  // Sem banco (ex.: rodando local sem as chaves), vale o padrão de src/lib/brand.ts.
  let data: { key: string; value: unknown }[] | null = null;
  try {
    ({ data } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", ["whatsapp_enabled", "whatsapp_number", "whatsapp_message", "card_enabled"]));
  } catch {
    data = null;
  }
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  const savedPhone = map.get("whatsapp_number");
  const savedMessage = map.get("whatsapp_message");
  return {
    whatsappEnabled: map.get("whatsapp_enabled") === true,
    // Número trocado no admin; enquanto não houver um salvo, vale o de src/lib/brand.ts.
    whatsappPhone: typeof savedPhone === "string" ? savedPhone : brand.whatsapp.phoneE164,
    whatsappMessage: typeof savedMessage === "string" ? savedMessage : brand.whatsapp.message,
    // Cartão começa desligado; só aparece para os clientes depois de ativado no admin.
    cardEnabled: map.get("card_enabled") === true,
  };
});

export const setCardEnabled = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ password: z.string().min(1).max(200), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!senhaAdminOk(data.password)) {
      throw new Error("Unauthorized");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "card_enabled", value: data.enabled, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true, enabled: data.enabled };
  });

export const setWhatsappEnabled = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ password: z.string().min(1).max(200), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!senhaAdminOk(data.password)) {
      throw new Error("Unauthorized");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      key: "whatsapp_enabled",
      value: data.enabled,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, enabled: data.enabled };
  });

export const setWhatsappNumber = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ password: z.string().min(1).max(200), phone: z.string().max(40) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!senhaAdminOk(data.password)) {
      throw new Error("Unauthorized");
    }
    const phone = normalizeWhatsapp(data.phone);
    if (!phone) throw new Error("Número inválido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      key: "whatsapp_number",
      value: phone,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, phone };
  });

export const setWhatsappMessage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ password: z.string().min(1).max(200), message: z.string().max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!senhaAdminOk(data.password)) {
      throw new Error("Unauthorized");
    }
    const message = data.message.trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      key: "whatsapp_message",
      value: message,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, message };
  });
