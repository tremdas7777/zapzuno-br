import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSiteSettings } from "@/lib/site-settings.functions";
import { CARD_MAX_INSTALLMENTS, PIX_DISCOUNT } from "@/lib/payment-pricing";

/**
 * O que a vitrine pode prometer sobre pagamento: parcelas e desconto no Pix só aparecem com o
 * cartão liberado no admin (o checkout segue a mesma regra).
 */
export function usePayInfo() {
  const fetchSettings = useServerFn(getSiteSettings);
  const { data } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => fetchSettings(),
    staleTime: 60_000,
  });
  const card = data?.cardEnabled ?? false;
  return {
    card,
    installments: CARD_MAX_INSTALLMENTS,
    pixOff: card ? PIX_DISCOUNT : 0,
  };
}
