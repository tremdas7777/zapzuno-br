/** Formatação e regras de exibição compartilhadas pelas telas do /admin (só cliente). */
import type { AdminOrder } from "@/lib/admin.functions";

/** Centavos → "R$ 1.234,56". */
export const brlCents = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Reais → "R$ 1.234,56" ("—" sem valor). */
export const brl = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Valor curto para os números grandes do painel: "R$ 12,3 mil". */
export const brlCompacto = (cents: number) =>
  cents >= 1_000_000
    ? `R$ ${(cents / 100_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : brlCents(cents);

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** "agora", "há 5 min", "há 2 h", "ontem 14:30", "12/10 09:15". */
export function tempoRelativo(iso: string, agora = Date.now()) {
  const diff = Math.max(0, agora - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 6) return `há ${h} h`;
  const d = new Date(iso);
  const hoje = new Date(agora);
  const ontem = new Date(agora - 86_400_000);
  const hora = fmtTime(iso);
  if (d.toDateString() === hoje.toDateString()) return `hoje ${hora}`;
  if (d.toDateString() === ontem.toDateString()) return `ontem ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}

export const fmtCpf = (v: string) =>
  v.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

export const fmtPhone = (v: string) => {
  const d = v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length === 11
    ? d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
    : d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
};

export const whatsappUrl = (phone: string, text?: string) =>
  `https://wa.me/55${phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}${
    text ? `?text=${encodeURIComponent(text)}` : ""
  }`;

/** Iniciais para o avatar do cliente ("Ana Paula Souza" → "AS"). */
export function iniciais(nome: string | null | undefined) {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const a = partes[0]![0] ?? "";
  const b = partes.length > 1 ? (partes.at(-1)![0] ?? "") : "";
  return (a + b).toUpperCase();
}

// No banco, "paid" só é gravado depois da confirmação do gateway (reportPaidOnce).
export const isPaid = (o: Pick<AdminOrder, "status">) => o.status === "paid";

export function statusLabel(status: string) {
  if (status === "paid") return "Pago";
  if (status === "waiting_payment" || status === "pending") return "Aguardando";
  if (status === "expired") return "Expirado";
  if (status === "refunded") return "Reembolsado";
  if (status === "refused") return "Recusado";
  return status;
}

/**
 * Início do período no horário de Brasília (UTC−3, sem horário de verão), igual ao do servidor.
 * "Hoje" (1 dia) = desde a meia-noite de hoje; N dias = desde a meia-noite de N−1 dias atrás.
 */
export function inicioDoPeriodo(days: number, now = Date.now()) {
  const BRT = 3 * 60 * 60 * 1000;
  const DAY = 24 * 60 * 60 * 1000;
  const midnightBrt = Math.floor((now - BRT) / DAY) * DAY + BRT;
  return midnightBrt - (days - 1) * DAY;
}

export type Origem = { titulo: string; detalhe?: string | undefined; alerta?: boolean };

/** "Nome|123456" (formato da UTMify) → "Nome". */
const semId = (v?: string | null) => (v ?? "").split("|")[0]!.trim();
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Nome conhecido da origem (utm_source) para exibir. */
const NOMES: Record<string, string> = {
  ig: "Instagram",
  "instagram.com": "Instagram",
  "facebook.com": "Facebook",
  "chatgpt.com": "ChatGPT",
};

/**
 * De onde veio o pedido, legível: anúncio do Meta (campanha · anúncio), busca orgânica, outro site.
 * Pedido sem UTM nenhuma: o navegador (app do Instagram/Facebook) ainda diz de onde veio.
 */
export function origemDoPedido(o: Pick<AdminOrder, "utm" | "ua">): Origem {
  const u = o.utm ?? {};
  const src = (u["utm_source"] ?? "").trim();
  if (!src) {
    const ua = o.ua ?? "";
    if (/Instagram/.test(ua))
      return { titulo: "Instagram sem UTM", detalhe: "link sem parâmetros", alerta: true };
    if (/FBAN|FBAV|FB_IAB/.test(ua))
      return { titulo: "Facebook sem UTM", detalhe: "link sem parâmetros", alerta: true };
    return { titulo: "Sem UTM", detalhe: "direto ou site sem parâmetros", alerta: true };
  }
  // O Meta não trocou {{campaign.name}} etc.: a UTMify não consegue ligar a venda ao anúncio.
  if (Object.values(u).some((v) => v?.includes("{{")))
    return { titulo: "Meta", detalhe: "anúncio com UTMs não preenchidas", alerta: true };
  const medium = (u["utm_medium"] ?? "").trim();
  if (/^(fb|facebook|meta)$/i.test(src)) {
    const partes = [semId(u["utm_campaign"]), semId(u["utm_content"])].filter(Boolean);
    return { titulo: "Meta Ads", detalhe: partes.join(" · ") || undefined };
  }
  if (medium === "organic") return { titulo: `${maiuscula(src)} (busca orgânica)` };
  const nome = NOMES[src.toLowerCase()] ?? src;
  if (medium === "referral") return { titulo: nome, detalhe: "link sem UTM" };
  const partes = [medium, u["utm_campaign"], u["utm_content"]].map(semId).filter(Boolean);
  return { titulo: nome, detalhe: partes.join(" · ") || undefined };
}

export const origemTexto = (o: Pick<AdminOrder, "utm" | "ua">) =>
  (({ titulo, detalhe }) => [titulo, detalhe].filter(Boolean).join(" · "))(origemDoPedido(o));
