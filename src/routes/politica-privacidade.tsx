import { createFileRoute } from "@tanstack/react-router";
import { absUrl } from "@/lib/seo";
import { PolicyPage } from "@/components/site/PolicyPage";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/politica-privacidade")({
  head: () => ({
    meta: [
      { title: `Política de Privacidade | ${brand.name}` },
      { name: "description", content: `Como a ${brand.name} protege os seus dados pessoais.` },
      { property: "og:title", content: "Política de Privacidade" },
      { property: "og:description", content: `Proteção de dados na ${brand.name}.` },
      { property: "og:url", content: absUrl("/politica-privacidade") },
    ],
    links: [{ rel: "canonical", href: absUrl("/politica-privacidade") }],
  }),
  component: () => (
    <PolicyPage
      title="Política de Privacidade"
      intro={`A ${brand.name} respeita e protege os seus dados de acordo com a LGPD.`}
    >
      <h2>Dados coletados</h2>
      <p>
        Coletamos apenas os dados necessários para processar pedidos, enviar produtos e oferecer
        suporte.
      </p>
      <h2>Uso dos dados</h2>
      <ul>
        <li>Processamento de pedidos e pagamentos</li>
        <li>Envio dos produtos e comunicação sobre o pedido</li>
        <li>Suporte ao cliente</li>
      </ul>
      <h2>Segurança</h2>
      <p>Utilizamos criptografia, SSL e provedores certificados para proteger suas informações.</p>
      <h2>Seus direitos</h2>
      <p>
        Você pode solicitar acesso, correção ou exclusão dos seus dados pela nossa{" "}
        <a href="/contato">página de contato</a>.
      </p>
    </PolicyPage>
  ),
});
