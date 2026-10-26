/** Configurações do /admin, agrupadas por assunto (pagamento, anúncios, envio, atendimento). */
import type { ReactNode } from "react";
import { HypercashCard } from "./HypercashCard";
import { MetaPixelCard } from "./MetaPixelCard";
import { PixGatewayCard } from "./PixGatewayCard";
import { RotasyncCard } from "./RotasyncCard";
import { UtmifyCard } from "./UtmifyCard";
import { WhatsappCard } from "./WhatsappCard";
import { PageHeader } from "./kit";

function Grupo({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-[#e4e7ec] py-8 first:border-t-0 first:pt-0 lg:grid-cols-[280px_1fr] lg:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold text-[#101828]">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[#667085]">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

export function SettingsTab({ password }: { password: string }) {
  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Pagamento, integrações e atendimento da loja. As mudanças valem na hora."
      />
      <Grupo
        title="Pagamentos"
        description="Quem gera o Pix dos pedidos e se o cartão de crédito aparece no checkout."
      >
        <PixGatewayCard password={password} />
        <HypercashCard password={password} />
      </Grupo>
      <Grupo
        title="Anúncios e rastreamento"
        description="Para onde vão as vendas e os eventos, para os anúncios saberem o que vendeu."
      >
        <UtmifyCard password={password} />
        <MetaPixelCard password={password} />
      </Grupo>
      <Grupo
        title="Envio dos pedidos"
        description="Os pedidos pagos seguem para a logística e o rastreio volta para o cliente."
      >
        <RotasyncCard password={password} />
      </Grupo>
      <Grupo
        title="Atendimento"
        description="O botão de WhatsApp que aparece no site para tirar dúvidas."
      >
        <WhatsappCard password={password} />
      </Grupo>
    </div>
  );
}
