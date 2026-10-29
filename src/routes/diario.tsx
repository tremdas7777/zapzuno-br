import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { SiteLayout } from "@/components/site/Layout";
import { Display, Eyebrow, FinalCta } from "@/components/br/ui";
import { brand } from "@/lib/brand";
import { FREE_SHIPPING_LABEL } from "@/lib/bundles";
import { ARTIGOS } from "@/lib/artigos";
import { absUrl, breadcrumbJsonLd, ORG_ID, seo } from "@/lib/seo";

export const Route = createFileRoute("/diario")({
  head: () =>
    seo({
      path: "/diario",
      title: `Diário de Jogo: guias de laser tag em casa | ${brand.name}`,
      description:
        "Guias da ZAPZUNO: como funciona o laser tag com projetor, brincadeiras para tirar as crianças das telas, presente de Natal, festa do pijama e segurança.",
      image: ARTIGOS[0]?.img,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Blog",
          name: `Diário de Jogo ${brand.name}`,
          url: absUrl("/diario"),
          inLanguage: "pt-BR",
          publisher: { "@id": ORG_ID },
          blogPost: ARTIGOS.map((a) => ({
            "@type": "BlogPosting",
            headline: a.title,
            url: absUrl(`/diario/${a.slug}`),
            datePublished: a.publicado,
          })),
        },
        breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Diário de Jogo", path: "/diario" },
        ]),
      ],
    }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <section className="band-sky border-b border-[var(--line)]">
        <div className="container-edge py-14 md:py-20">
          <Eyebrow>O Diário de Jogo {brand.name}</Eyebrow>
          <Display
            as="h1"
            top={
              <>
                <span className="sr-only">Diário de Jogo: guias de laser tag em casa. </span>Luz apagada.
              </>
            }
            em="Família junta."
            className="mt-4 text-[56px] md:text-[88px]"
          />
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--slate)]">
            Como jogar, ideias para tirar as crianças das telas, presentes e festas em casa. Guias curtos para a
            próxima noite de jogo.
          </p>
        </div>
      </section>

      <section className="container-edge py-14 md:py-20">
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ARTIGOS.map((a, i) => (
            <li key={a.slug}>
              <Link
                to="/diario/$slug"
                params={{ slug: a.slug }}
                className="card-soft flex h-full flex-col overflow-hidden transition hover:border-[var(--blue)]/50"
              >
                <img
                  src={a.img}
                  alt={a.imgAlt}
                  width={a.imgW}
                  height={a.imgH}
                  loading={i < 3 ? "eager" : "lazy"}
                  className="aspect-[3/2] w-full object-cover"
                />
                <span className="flex flex-1 flex-col p-5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">
                    {a.tag} · {a.leitura}
                  </span>
                  <span className="mt-3 text-[17px] font-bold leading-snug text-[var(--ink)]">{a.title}</span>
                  <span className="mt-2 text-[13.5px] leading-relaxed text-[var(--slate)]">{a.description}</span>
                  <span className="mt-auto flex items-center gap-1 pt-5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--blue)]">
                    Ler o guia <ArrowUpRight className="h-4 w-4" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <FinalCta
        eyebrow="Luz apagada. Jogo ligado."
        top="Sua parede"
        em="vira o alvo"
        cta="Escolher meu kit"
        note={`${FREE_SHIPPING_LABEL} · Garantia de ${brand.garantiaDias} dias`}
      />
    </SiteLayout>
  );
}
