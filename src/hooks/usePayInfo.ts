import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCardConfig } from "@/lib/pix.functions";
import { CARD_MAX_INSTALLMENTS, PIX_DISCOUNT } from "@/lib/payment-pricing";

/**
 * O que a vitrine pode prometer sobre pagamento: cartão, parcelas e desconto no Pix só aparecem com a
 * Legacy Ecom cadastrada (mesma regra do checkout, via getCardConfig).
 */
export function usePayInfo() {
  const cardConfigFn = useServerFn(getCardConfig);
  const { data } = useQuery({
    queryKey: ["card-config"],
    queryFn: () => cardConfigFn({ data: {} }),
    staleTime: 60_000,
  });
  const card = data?.enabled === true;
  return {
    card,
    installments: CARD_MAX_INSTALLMENTS,
    pixOff: data?.pixDiscount ? PIX_DISCOUNT : 0,
  };
}
