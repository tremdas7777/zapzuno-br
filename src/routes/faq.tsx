import { createFileRoute } from "@tanstack/react-router";
import { absUrl, faqJsonLd, ldJson } from "@/lib/seo";
import { ChevronDown } from "lucide-react";
import { SiteLayout } from "@/components/site/Layout";
import { brand } from "@/lib/brand";
import { FAQ } from "@/lib/faq";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: `Perguntas Frequentes | ${brand.name}` },
      {
        name: "description",
        content: `Tire suas dúvidas sobre o projetor de laser tag da ${brand.name}: como funciona, pilhas, idade, entrega e garantia.`,
      },
      { property: "og:title", content: `Perguntas frequentes | ${brand.name}` },
      {
        property: "og:description",
        content: "Como funciona o jogo, pilhas, idade, entrega e garantia.",
      },
      { property: "og:url", content: absUrl("/faq") },
      ldJson(faqJsonLd(FAQ)),
    ],
    links: [{ rel: "canonical", href: absUrl("/faq") }],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <section className="container-edge max-w-3xl py-14 md:py-20">
        <span className="eyebrow">Antes da primeira rodada</span>
        <h1 className="display mt-3 text-[52px] md:text-[72px]">
          Dúvidas <em>frequentes</em>
        </h1>
        <div className="mt-10 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card-bg)]">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4 md:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-[var(--blue)] transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink)]">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-[15px] text-[var(--ink)]">
          Não achou sua resposta? Fale com a gente pela página de{" "}
          <a href="/contato" className="font-semibold text-[var(--primary)] hover:underline">
            contato
          </a>
          .
        </p>
      </section>
    </SiteLayout>
  );
}
