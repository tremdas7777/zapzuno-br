import { createFileRoute } from "@tanstack/react-router";
import { absUrl } from "@/lib/seo";
import { PolicyPage } from "@/components/site/PolicyPage";
import { brand } from "@/lib/brand";
import { FREE_SHIPPING_LABEL } from "@/lib/bundles";

export const Route = createFileRoute("/politica-envio")({
  head: () => ({
    meta: [
      { title: `Política de Envio | ${brand.name}` },
      { name: "description", content: `Saiba como funciona o envio dos pedidos da ${brand.name}.` },
      { property: "og:title", content: "Política de Envio" },
      { property: "og:description", content: "Envio para todo o Brasil com rastreamento." },
      { property: "og:url", content: absUrl("/politica-envio") },
    ],
    links: [{ rel: "canonical", href: absUrl("/politica-envio") }],
  }),
  component: () => (
    <PolicyPage title="Política de Envio" intro={`${FREE_SHIPPING_LABEL}, com rastreamento.`}>
      <h2>Prazo de envio</h2>
      <p>Os pedidos são processados em até 2 dias úteis após a confirmação do pagamento.</p>
      <h2>Prazo de entrega</h2>
      <p>
        O prazo médio é de {brand.prazoEntrega}, podendo variar de acordo com a região. O prazo é uma
        estimativa, não uma data garantida.
      </p>
      <h2>Rastreamento</h2>
      <p>Você recebe o código de rastreio por e-mail assim que o pedido for despachado.</p>
      <h2>Frete</h2>
      <p>
        O frete é grátis para todo o Brasil em todos os kits. No checkout você também pode escolher um
        frete mais rápido, com o valor exibido antes do pagamento.
      </p>
    </PolicyPage>
  ),
});
