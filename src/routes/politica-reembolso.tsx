import { createFileRoute } from "@tanstack/react-router";
import { absUrl } from "@/lib/seo";
import { PolicyPage } from "@/components/site/PolicyPage";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/politica-reembolso")({
  head: () => ({
    meta: [
      { title: `Garantia e Devoluções | ${brand.name}` },
      {
        name: "description",
        content: `Garantia de ${brand.garantiaDias} dias, direito de arrependimento e devoluções na ${brand.name}.`,
      },
      { property: "og:title", content: "Garantia e Devoluções" },
      {
        property: "og:description",
        content: `Garantia de ${brand.garantiaDias} dias ou seu dinheiro de volta na ${brand.name}.`,
      },
      { property: "og:url", content: absUrl("/politica-reembolso") },
    ],
    links: [{ rel: "canonical", href: absUrl("/politica-reembolso") }],
  }),
  component: () => (
    <PolicyPage
      title="Garantia e Devoluções"
      intro={`Garantia de ${brand.garantiaDias} dias ou seu dinheiro de volta, além dos seus direitos pelo Código de Defesa do Consumidor.`}
    >
      <h2>Garantia de {brand.garantiaDias} dias</h2>
      <p>
        Você tem {brand.garantiaDias} dias a partir da entrega para pedir a devolução do dinheiro.
        Fale com a gente dentro desse prazo para começar a devolução.
      </p>
      <h2>Direito de arrependimento</h2>
      <p>
        Pelo art. 49 do CDC, você pode desistir da compra em até 7 dias após o recebimento, sem
        precisar explicar o motivo.
      </p>
      <h2>Produto com defeito</h2>
      <p>
        Se algum aparelho chegar com defeito, avise em até 90 dias (art. 26 do CDC). Trocamos a peça
        ou devolvemos o valor.
      </p>
      <h2>Como solicitar</h2>
      <p>
        Fale com a gente pela <a href="/contato">página de contato</a> com o número do pedido e, se
        for defeito, uma foto ou vídeo.
      </p>
      <h2>Prazo de reembolso</h2>
      <p>
        O reembolso é feito em até 7 dias úteis depois que o produto chega ao nosso centro de
        distribuição, pelo mesmo meio de pagamento da compra.
      </p>
    </PolicyPage>
  ),
});
