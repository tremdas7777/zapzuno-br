import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Crosshair, PhoneOff, Trophy } from "lucide-react";
import { SiteLayout } from "@/components/site/Layout";
import { Display, Eyebrow, FaqList, FinalCta, LimeLink, TextLink, Ticker } from "@/components/br/ui";
import { Comparativo, EmAcao } from "@/components/br/KitSections";
import { brand } from "@/lib/brand";
import { brl, discountPct, FREE_SHIPPING_LABEL, getBundle, withVariantPrice } from "@/lib/bundles";
import { ARTIGOS } from "@/lib/artigos";
import { FAQ_HOME, KIT_HANDLE, KITS_PADRAO, kitsDe } from "@/lib/laser";
import { seo, storeJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () =>
    seo({
      path: "/",
      title: `Projetor Laser Tag: qualquer parede vira o alvo | ${brand.name}`,
      description:
        "Laser tag com projetor para a família: aponte para a parede, apague a luz e jogue. Projetor + 2 pistolas + 4 cartões de alvo. 1, 2 ou 3 kits com frete grátis para todo o Brasil.",
      imageAlt: `${brand.name}: projetor de laser tag com 2 pistolas`,
      jsonLd: storeJsonLd(),
    }),
  component: Home,
});

/**
 * Banners do topo (arte pronta em public/banners: computador 1920×760, celular 1080×1350).
 * `variante` abre a página do produto já com aquela quantidade marcada.
 */
const BANNERS = [
  {
    id: "parede",
    alt: "Qualquer parede vira o alvo: projetor de laser tag com 2 pistolas, a partir de R$ 67 com frete grátis",
    variante: undefined,
  },
  {
    id: "dupla",
    alt: "Mais vendido: 2 kits para 4 jogadores por R$ 97",
    variante: "2 kits · 4 jogadores",
  },
  {
    id: "presente",
    alt: "O presente que tira as crianças da tela: laser tag com projetor",
    variante: undefined,
  },
] as const;

const INTERVALO = 6000;

function Banners() {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const toque = useRef<number | null>(null);
  const n = BANNERS.length;
  const go = useCallback((k: number) => setI(((k % n) + n) % n), [n]);

  useEffect(() => {
    if (pausa) return;
    const t = window.setTimeout(() => go(i + 1), INTERVALO);
    return () => window.clearTimeout(t);
  }, [i, pausa, go]);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques da loja"
      className="relative overflow-hidden"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      onTouchStart={(e) => {
        toque.current = e.touches[0]?.clientX ?? null;
        setPausa(true);
      }}
      onTouchEnd={(e) => {
        const x0 = toque.current;
        const x1 = e.changedTouches[0]?.clientX;
        if (x0 != null && x1 != null && Math.abs(x1 - x0) > 40) go(x1 < x0 ? i + 1 : i - 1);
        toque.current = null;
        setPausa(false);
      }}
    >
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {BANNERS.map((b, k) => (
          <Link
            key={b.id}
            to="/produto"
            search={b.variante ? { variante: b.variante } : {}}
            hash={b.variante ? "escolha-o-kit" : undefined}
            aria-hidden={k !== i || undefined}
            tabIndex={k === i ? 0 : -1}
            className="block w-full shrink-0"
          >
            <picture>
              <source media="(max-width: 767px)" srcSet={`/banners/${b.id}-m.webp`} width={1080} height={1350} />
              <img
                src={`/banners/${b.id}.webp`}
                alt={b.alt}
                width={1920}
                height={760}
                fetchPriority={k === 0 ? "high" : "low"}
                loading={k === 0 ? "eager" : "lazy"}
                className="aspect-[4/5] w-full object-cover md:aspect-[1920/760]"
              />
            </picture>
          </Link>
        ))}
      </div>
      <button
        type="button"
        aria-label="Banner anterior"
        onClick={() => go(i - 1)}
        className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur transition hover:bg-black/60 md:grid"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Próximo banner"
        onClick={() => go(i + 1)}
        className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur transition hover:bg-black/60 md:grid"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 md:bottom-5">
        {BANNERS.map((b, k) => (
          <button
            key={b.id}
            type="button"
            aria-label={`Ver banner ${k + 1}`}
            aria-current={k === i || undefined}
            onClick={() => go(k)}
            className={cn(
              "h-2 rounded-full transition-all",
              k === i ? "w-7 bg-[var(--lime)]" : "w-2 bg-white/60 hover:bg-white",
            )}
          />
        ))}
      </div>
    </section>
  );
}

const VANTAGENS = [
  { n: "01", Icon: PhoneOff, title: "Zero tela.", text: "A sala vira fliperama, sem TV nem tablet." },
  { n: "02", Icon: Crosshair, title: "Qualquer parede.", text: "É só uma parede lisa e a luz apagada." },
  { n: "03", Icon: Trophy, title: "Placar digital.", text: "Ninguém discute quem ganhou." },
];

function Vantagens() {
  return (
    <section className="container-edge py-16 md:py-24">
      <div className="md:flex md:items-end md:justify-between md:gap-10">
        <div>
          <Eyebrow>Laser tag com projetor para a família</Eyebrow>
          <Display top="Menos tela." em="Mais risada." className="mt-4 text-[52px] md:text-[76px]" />
        </div>
        <p className="mt-5 text-[14.5px] leading-relaxed text-[var(--slate)] md:mt-0 md:text-right">
          Aponte, apague a luz e jogue.
          <br />A revanche vem sozinha.
        </p>
      </div>
      <ul className="mt-10 grid gap-3 md:grid-cols-3 md:gap-5">
        {VANTAGENS.map(({ n, Icon, title, text }, k) => (
          <li
            key={n}
            className={cn(
              "card-soft relative flex items-center gap-5 overflow-hidden px-6 py-6",
              k === 1
                ? "!bg-[linear-gradient(135deg,var(--card-bg),var(--tint-lime))]"
                : "!bg-[linear-gradient(135deg,var(--card-bg),var(--tint-blue))]",
            )}
          >
            <Icon className="h-6 w-6 shrink-0 text-[var(--blue)]" strokeWidth={1.8} />
            <div>
              <p className="text-[15px] font-bold text-[var(--ink)]">{title}</p>
              <p className="mt-1 text-[12.5px] text-[var(--slate)]">{text}</p>
            </div>
            <span className="pointer-events-none absolute -bottom-3 right-4 font-display text-[72px] font-extrabold leading-none text-[var(--blue)]/[0.08]">
              {n}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Os 3 kits lado a lado, cada um abrindo a página do produto já marcado. */
function Kits() {
  const p = getBundle(KIT_HANDLE);
  const kits = (p.options[0]?.values ?? []).map((label) => ({ label, ...kitsDe(label), priced: withVariantPrice(p, [label]) }));
  return (
    <section className="band-sky border-y border-[var(--line)]">
      <div className="container-edge py-16 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Escolha seu kit</Eyebrow>
            <Display top="Quanto mais gente," em="melhor a partida" className="mt-4 text-[48px] md:text-[68px]" />
          </div>
          <p className="max-w-xs text-[13.5px] text-[var(--slate)]">
            Cada kit traz 1 projetor, 2 pistolas e 4 cartões de alvo. {FREE_SHIPPING_LABEL}.
          </p>
        </div>
        <ul className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
          {kits.map((k) => {
            const best = k.kits === KITS_PADRAO;
            const off = discountPct(k.priced);
            return (
              <li key={k.label}>
                <Link
                  to="/produto"
                  search={{ variante: k.label }}
                  hash="escolha-o-kit"
                  className={cn(
                    "card-soft relative flex h-full flex-col overflow-hidden transition hover:-translate-y-1",
                    best && "border-[var(--blue)] !bg-[linear-gradient(160deg,var(--tint-lime),var(--card-bg))]",
                  )}
                >
                  {best && (
                    <span className="absolute right-4 top-4 z-10 rotate-2 rounded-md bg-[var(--blue)] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-[var(--on-blue)] shadow-md">
                      ✦ Mais vendido
                    </span>
                  )}
                  <img
                    src="/fotos/kit-limpa.webp"
                    alt=""
                    width={1254}
                    height={1254}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover object-[50%_55%]"
                  />
                  <div className="flex flex-1 flex-col p-5">
                    <p className="font-display text-[34px] font-extrabold uppercase leading-none text-[var(--ink)]">
                      {k.kits} {k.kits === 1 ? "kit" : "kits"}
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--slate)]">
                      {k.jogadores} jogadores · {k.kits * 2} pistolas · {k.kits * 4} cartões
                    </p>
                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        {k.priced.compareAtPrice && (
                          <p className="text-[12px] text-[var(--slate)] line-through">{brl(k.priced.compareAtPrice)}</p>
                        )}
                        <p className="font-display text-[34px] font-extrabold leading-none text-[var(--ink)]">
                          {brl(k.priced.price)}
                        </p>
                      </div>
                      {off > 0 && (
                        <span className="rounded bg-[var(--lime)] px-2 py-1 text-[10px] font-extrabold text-[var(--on-lime)]">
                          −{off}% OFF
                        </span>
                      )}
                    </div>
                    <span className="btn-lime mt-5 h-12 px-5">
                      Escolher <ArrowUpRight className="h-5 w-5" strokeWidth={2.4} />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Presente() {
  return (
    <section className="container-edge grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24">
      <div className="relative overflow-hidden rounded-2xl shadow-[0_30px_60px_-30px_rgba(0,0,0,0.75)]">
        <img
          src="/fotos/fliperama-limpa.webp"
          alt="Projetor mostrando tubarão, dino, pinguim e robô na parede, com as duas pistolas"
          width={1254}
          height={1254}
          loading="lazy"
          className="aspect-square w-full object-cover"
        />
        <span className="absolute bottom-4 left-4 -rotate-3 bg-[var(--lime)] px-3 py-2 font-display text-[19px] font-extrabold uppercase leading-[0.95] text-[var(--on-lime)] shadow-md md:text-[24px]">
          <span className="block font-sans text-[10px] font-bold tracking-[0.12em]">Presente certeiro</span>
          para a criançada
        </span>
      </div>
      <div>
        <Eyebrow>Natal, aniversário, Dia das Crianças</Eyebrow>
        <Display top="Dê de presente" em="uma noite de fliperama" className="mt-4 text-[52px] md:text-[68px]" />
        <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-[var(--slate)]">
          Um presente para dividir: irmãos, primos e pais no mesmo jogo, na mesma sala, sem tela nenhuma.
        </p>
        <ul className="mt-6 space-y-3 text-[13.5px] text-[var(--ink)]">
          {["2 jogadores já na caixa", "A partir de 5 anos", "Nada sai da pistola: só luz infravermelha"].map((t) => (
            <li key={t} className="flex items-center gap-3">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--lime)] text-[var(--on-lime)]">
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.6} />
              </span>
              {t}
            </li>
          ))}
        </ul>
        <LimeLink to="/produto" hash="escolha-o-kit" className="mt-8 w-full max-w-[330px]">
          Escolher o presente
        </LimeLink>
        <p className="mt-3 text-[11.5px] text-[var(--slate)]">
          {FREE_SHIPPING_LABEL} · Garantia de {brand.garantiaDias} dias
        </p>
      </div>
    </section>
  );
}

/** Links para os artigos do Diário de Jogo (/diario). */
function Diario() {
  return (
    <section className="border-t border-[var(--line)]">
      <div className="container-edge py-16 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Diário de Jogo</Eyebrow>
            <Display top="Ideias para" em="a noite de jogo." className="mt-4 text-[48px] md:text-[68px]" />
          </div>
          <TextLink to="/diario" className="w-full max-w-[260px]">
            Ver todos os guias
          </TextLink>
        </div>
        <ul className="mt-10 grid gap-x-8 gap-y-3 border-t border-[var(--line)] pt-6 md:grid-cols-2">
          {ARTIGOS.map((a) => (
            <li key={a.slug}>
              <Link
                to="/diario/$slug"
                params={{ slug: a.slug }}
                className="flex items-start justify-between gap-3 text-[14.5px] font-semibold leading-snug text-[var(--ink)] hover:text-[var(--blue)]"
              >
                {a.title}
                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--blue)]" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Perguntas() {
  return (
    <section className="container-edge grid gap-10 py-16 md:grid-cols-[1fr_1.4fr] md:gap-16 md:py-24">
      <div>
        <Eyebrow>Respostas rápidas. Depois, jogo.</Eyebrow>
        <Display top="Antes de" em="começar." className="mt-4 text-[52px] md:text-[72px]" />
        <TextLink to="/produto" hash="perguntas" className="mt-8 w-full max-w-[260px]">
          Ver todas as dúvidas
        </TextLink>
      </div>
      <FaqList items={FAQ_HOME} />
    </section>
  );
}

function Home() {
  return (
    <SiteLayout>
      <Banners />
      <Ticker items={["5+ anos", "Sem TV, sem videogame", "Sem projéteis", "1, 2 ou 3 kits", FREE_SHIPPING_LABEL]} />
      <Vantagens />
      <EmAcao />
      <Kits />
      <Presente />
      <Comparativo />
      <Perguntas />
      <Diario />
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
