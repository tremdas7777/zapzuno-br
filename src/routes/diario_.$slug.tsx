import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowUpRight, Check, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/site/Layout";
import { FaqList, FinalCta, LimeLink } from "@/components/br/ui";
import { brand } from "@/lib/brand";
import { brl, FREE_SHIPPING_LABEL, listedBundles } from "@/lib/bundles";
import { ARTIGOS, getArtigo, type Secao } from "@/lib/artigos";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, seo } from "@/lib/seo";

/** Artigo do Diário de Jogo: /diario/<slug> (fora do layout da página /diario). */
export const Route = createFileRoute("/diario_/$slug")({
  loader: ({ params }) => {
    if (!getArtigo(params.slug)) throw notFound();
    return { slug: params.slug };
  },
  head: ({ loaderData }) => {
    const a = getArtigo(loaderData?.slug);
    if (!a) return {};
    const path = `/diario/${a.slug}`;
    return seo({
      path,
      title: `${a.seoTitle} | ${brand.name}`,
      description: a.description,
      image: a.img,
      imageAlt: a.imgAlt,
      type: "article",
      jsonLd: [
        articleJsonLd({
          path,
          title: a.title,
          description: a.description,
          image: a.img,
          publicado: a.publicado,
        }),
        breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Diário de Jogo", path: "/diario" },
          { name: a.title, path },
        ]),
        ...(a.faq?.length ? [faqJsonLd(a.faq)] : []),
      ],
    });
  },
  component: Page,
});

function Bloco({ s }: { s: Secao }) {
  const Lista = s.numerada ? "ol" : "ul";
  return (
    <section className="mt-12">
      <h2 className="font-display text-[30px] font-extrabold uppercase leading-[0.95] text-[var(--ink)] md:text-[38px]">
        {s.h2}
      </h2>
      {s.paragrafos?.map((p) => (
        <p key={p} className="mt-4 text-[15.5px] leading-relaxed text-[var(--slate)]">
          {p}
        </p>
      ))}
      {s.itens && (
        <Lista className="mt-6 space-y-5">
          {s.itens.map((it, i) => (
            <li key={it.t} className="grid grid-cols-[2.25rem_1fr] gap-3">
              <span className="font-display text-[26px] font-extrabold leading-none text-[var(--blue)]">
                {s.numerada ? `${i + 1}.` : "✦"}
              </span>
              <div>
                <h3 className="text-[16.5px] font-bold text-[var(--ink)] [font-family:var(--font-sans)]">
                  {it.t}
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--slate)]">{it.d}</p>
              </div>
            </li>
          ))}
        </Lista>
      )}
      {s.lista && (
        <Lista className="mt-5 space-y-3">
          {s.lista.map((it) => (
            <li key={it} className="flex gap-3 text-[15px] leading-relaxed text-[var(--ink)]">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--lime)] text-[var(--on-lime)]">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              {it}
            </li>
          ))}
        </Lista>
      )}
    </section>
  );
}

function Page() {
  const { slug } = Route.useLoaderData();
  const a = getArtigo(slug)!;
  const kit = listedBundles()[0];
  const outros = ARTIGOS.filter((x) => x.slug !== a.slug);

  return (
    <SiteLayout>
      <article className="container-edge pb-6 pt-6 md:pt-10">
        <nav
          aria-label="Navegação"
          className="flex flex-wrap items-center gap-1 text-[11.5px] uppercase tracking-[0.08em] text-[var(--slate)]"
        >
          <Link to="/" className="hover:text-[var(--ink)]">
            Início
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/diario" className="hover:text-[var(--ink)]">
            Diário de Jogo
          </Link>
        </nav>

        <div className="mx-auto max-w-3xl">
          <p className="eyebrow mt-8">
            {a.tag} · {a.leitura}
          </p>
          <h1 className="display mt-4 text-balance text-[40px] md:text-[60px]">{a.title}</h1>
          <p className="mt-6 text-[16.5px] leading-relaxed text-[var(--slate)]">{a.intro}</p>
          <img
            src={a.img}
            alt={a.imgAlt}
            width={a.imgW}
            height={a.imgH}
            fetchPriority="high"
            className="mx-auto mt-8 h-auto max-h-[560px] w-auto max-w-full rounded-2xl object-contain shadow-[0_30px_60px_-34px_rgba(0,0,0,0.6)]"
          />

          {a.secoes.map((s) => (
            <Bloco key={s.h2} s={s} />
          ))}

          <aside className="card-soft mt-14 p-6 md:p-8">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">
              Projetor Laser Tag {brand.name}
            </p>
            <p className="mt-3 font-display text-[30px] font-extrabold uppercase leading-[0.95] text-[var(--ink)]">
              Qualquer parede vira o alvo
            </p>
            <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--slate)]">
              Projetor + 2 pistolas + 4 cartões de alvo. 1, 2 ou 3 kits
              {kit ? `, a partir de ${brl(kit.price)}` : ""}. {FREE_SHIPPING_LABEL}.
            </p>
            <LimeLink to="/produto" hash="escolha-o-kit" className="mt-6 w-full max-w-[330px]">
              Ver o kit
            </LimeLink>
          </aside>

          {a.faq?.length ? (
            <section className="mt-14">
              <h2 className="mb-4 font-display text-[30px] font-extrabold uppercase leading-[0.95] text-[var(--ink)] md:text-[38px]">
                Perguntas frequentes
              </h2>
              <FaqList items={a.faq} />
            </section>
          ) : null}

          <section className="mt-14">
            <p className="eyebrow">Mais do Diário de Jogo</p>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {outros.map((o) => (
                <li key={o.slug}>
                  <Link
                    to="/diario/$slug"
                    params={{ slug: o.slug }}
                    className="card-soft flex h-full items-start justify-between gap-4 p-5 transition hover:border-[var(--blue)]/50"
                  >
                    <span>
                      <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">
                        {o.tag}
                      </span>
                      <span className="mt-2 block text-[15px] font-bold leading-snug text-[var(--ink)]">
                        {o.title}
                      </span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--blue)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>

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
