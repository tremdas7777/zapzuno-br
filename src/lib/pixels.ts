/**
 * IDs dos pixels de navegador da loja. Vazio = o script não é carregado.
 *
 * - `meta`: opcional. O pixel do Meta também é cadastrado no /admin (card Meta Pixel) e carregado
 *   de lá; preencha aqui só se quiser iniciar o pixel já no <head>, antes do app.
 * - `tiktok`: ID do pixel do TikTok (ex.: "C0XXXXXXXXXXXXXXXXXX").
 * - `utmify`: pixelId da UTMify para o script de rastreio de UTMs no navegador.
 */
export const PIXELS = {
  meta: "",
  tiktok: "",
  utmify: "",
} as const;
