/** Número de WhatsApp da loja: guardado só com dígitos, em E.164 (55 + DDD + número). */

/**
 * "(11) 98765-4321", "011987654321" ou "+55 11 98765-4321" → "5511987654321".
 * Devolve null quando não é um número brasileiro válido.
 */
export function normalizeWhatsapp(input: string): string | null {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  // "+" com outro DDI (ex.: +1 415…) não é número brasileiro.
  if (input.trim().startsWith("+") && !digits.startsWith("55")) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

/** "5511987654321" → "+55 (11) 98765-4321". */
export function formatWhatsapp(e164: string): string {
  if (!/^55\d{10,11}$/.test(e164)) return e164 ? `+${e164}` : "";
  const ddd = e164.slice(2, 4);
  const rest = e164.slice(4);
  return `+55 (${ddd}) ${rest.slice(0, -4)}-${rest.slice(-4)}`;
}

/** Link wa.me com a mensagem pronta (sem mensagem, abre a conversa em branco). */
export function whatsappLink(e164: string, message: string): string {
  const text = message.trim();
  return `https://wa.me/${e164}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
