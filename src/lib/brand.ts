/**
 * Marca da loja.
 * PREENCHA `cnpj` e `whatsapp` com os dados da sua empresa antes de vender.
 */
export const brand = {
  name: "ZAPZUNO",
  /** Endereço oficial da loja. PROVISÓRIO até o domínio da loja do Brasil ser comprado. */
  siteUrl: "https://zapzuno-br.vercel.app",
  /** Linha pequena embaixo do nome no logo. */
  logoTagline: "Laser tag com projetor",
  productName: "Projetor Laser Tag ZAPZUNO",
  /** Nome genérico que aparece na fatura do cliente (gateways Pix e cartão). */
  gatewayName: "ZAPZUNO",
  tagline: "Qualquer parede vira o alvo.",
  taglineShort: "Laser tag com projetor para a família",
  manufacturer: "ZAPZUNO",
  manufacturerTagline: "Laser tag com projetor",
  /** Cidade da loja (entregas por motoboy). Vazio = não mostra. */
  city: "" as string,
  cnpj: "64.756.111/0001-05",
  /** Ex.: "@sualoja". Vazio = não mostra. */
  instagram: "" as string,
  whatsapp: {
    /**
     * Número inicial em E.164 (55 + DDD + número), sem símbolos. Depois de trocado no
     * admin (Configurações da loja → Botão de WhatsApp), vale o do admin. Vazio = oculto.
     */
    phoneE164: "5585958549956",
    /** Mensagem pronta do link. O número atende várias lojas, então ela diz de qual o cliente veio. */
    message: "Olá! Vim pelo site da ZAPZUNO e quero saber mais sobre o projetor de laser tag.",
  },
  /** Prazo de entrega mostrado na loja (o mesmo do frete grátis no checkout). */
  prazoEntrega: "7 a 10 dias úteis",
  /** Garantia de devolução do dinheiro, em dias contados da entrega. */
  garantiaDias: 30,
  colors: {
    primary: "#ff7a1a",
    primaryDark: "#d95f08",
    primaryDeep: "#06162e",
    onPrimary: "#06162e",
    surfaceTint: "#f2fbff",
  },
} as const;
