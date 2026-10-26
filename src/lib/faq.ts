import { CARD_MAX_INSTALLMENTS, PIX_DISCOUNT } from "@/lib/payment-pricing";
import { FAQ_KIT } from "@/lib/laser";

/** Perguntas frequentes da página /faq: as do kit e as de pagamento e entrega. */
export const FAQ: readonly { q: string; a: string }[] = [
  ...FAQ_KIT,
  {
    q: "Quais as formas de pagamento?",
    a: `Pix e cartão de crédito em até ${CARD_MAX_INSTALLMENTS}x, quando o cartão estiver disponível na loja. Nesse caso o Pix tem ${Math.round(PIX_DISCOUNT * 100)}% de desconto.`,
  },
  {
    q: "Como acompanho meu pedido?",
    a: "Você recebe o código de rastreio por e-mail assim que o pedido sai. Também dá para consultar na página Rastrear pedido, pelo CPF de quem comprou.",
  },
];
