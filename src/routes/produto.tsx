import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ShieldCheck, Truck, Undo2 } from "lucide-react";
import { SiteLayout } from "@/components/site/Layout";
import { Gallery } from "@/components/br/Gallery";
import { Display, Eyebrow, FaqList, FinalCta, Ticker } from "@/components/br/ui";
import { Reviews } from "@/components/reviews/Reviews";
import { Alvos, ComoJogar, Comparativo, EmAcao, JeitosDeJogar, ModosTiro, NaCaixa } from "@/components/br/KitSections";
import { usePayInfo } from "@/hooks/usePayInfo";
import { brand } from "@/lib/brand";
import { metaTrack } from "@/lib/meta-pixel";
import { trackCheckoutClick } from "@/lib/analytics";
import { markCartCheckout } from "@/lib/cart";
import { bundleIdFromSearch, planSearchSchema } from "@/lib/plan-search";
import {
  brl,
  discountPct,
  encodeVariant,
  FREE_SHIPPING_LABEL,
  getBundle,
  installment,
  productLabel,
  withVariantPrice,
  type Bundle,
} from "@/lib/bundles";
import { FAQ_KIT, KITS_PADRAO, kitsDe, NA_CAIXA } from "@/lib/laser";
import { productJsonLd, productPath, seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produto")({
  validateSearch: planSearchSchema,
  loaderDeps: ({ search }) => ({ plano: search.plano }),
  // Só repassa o id: o catálogo é carregado na raiz (pode vir do banco).
  loader: ({ deps }) => ({ plano: deps.plano ?? null }),
  head: ({ loaderData }) => {
    const p = getBundle(bundleIdFromSearch({ plano: loaderData?.plano ?? undefined }));
    return seo({
      path: productPath(p),
      // O nome do produto já leva a marca: sem o "| ZAPZUNO" no fim para não repetir.
      title: p.name.includes(brand.name)
        ? `${p.name}: tiro ao alvo na parede com 2 pistolas`
        : `${p.name}: qualquer parede vira o alvo | ${brand.name}`,
      description: `${p.name}: projetor de alvos + 2 pistolas de laser tag + 4 cartões (tubarão, dino, pinguim e robô). 1, 2 ou 3 kits a partir de ${brl(p.price)}. ${FREE_SHIPPING_LABEL}.`,
      image: p.img,
      imageAlt: p.name,
      type: "product",
      jsonLd: productJsonLd(p),
    });
  },
  component: Page,
});

/** Uma opção de quantidade ("2 kits · 4 jogadores"), com o preço da variação. */
type Opcao = { label: string; kits: number; jogadores: number; priced: Bundle };

function opcoes(p: Bundle): Opcao[] {
  const values = p.options[0]?.values ?? [];
  return values.map((label) => ({ label, ...kitsDe(label), priced: withVariantPrice(p, [label]) }));
}

const SELOS: Record<number, string> = { 2: "✦ Mais vendido", 3: "Presente pra turma" };

function SquadCard({ o, on, selo, onPick }: { o: Opcao; on: boolean; selo?: string; onPick: () => void }) {
  const off = discountPct(o.priced);
  const economia = o.priced.compareAtPrice ? o.priced.compareAtPrice - o.priced.price : 0;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={cn(
        "relative flex w-full items-center gap-4 rounded-2xl border-2 bg-[var(--card-bg)] px-4 py-4 text-left backdrop-blur transition md:px-5",
        on
          ? "border-[var(--blue)] shadow-[0_18px_40px_-22px_rgba(255,122,26,0.45)]"
          : "border-[var(--line)] hover:border-[var(--blue)]/40",
      )}
    >
      {selo && (
        <span className="absolute -top-3 right-4 rotate-2 rounded-md bg-[var(--blue)] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-[var(--on-blue)] shadow-md">
          {selo}
        </span>
      )}
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
          on ? "border-[var(--blue)]" : "border-[var(--input)]",
        )}
      >
        {on && <span className="h-2.5 w-2.5 rounded-full bg-[var(--blue)]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold text-[var(--ink)]">
            {o.kits} {o.kits === 1 ? "kit" : "kits"}{" "}
            <span className="font-semibold text-[var(--slate)]">· {o.jogadores} jogadores</span>
          </span>
          {off > 0 && (
            <span className="rounded bg-[var(--lime)] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[var(--on-lime)]">
              −{off}% OFF
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[11.5px] text-[var(--slate)]">
          {o.kits} {o.kits === 1 ? "projetor" : "projetores"} + {o.kits * 2} pistolas + {o.kits * 4} cartões de alvo
        </span>
        {economia > 0 && (
          <span className="mt-0.5 block text-[11px] font-semibold text-[var(--save)]">
            Você economiza {brl(economia)}
          </span>
        )}
      </span>
      <span className="text-right">
        {o.priced.compareAtPrice && (
          <span className="block text-[11px] text-[var(--slate)] line-through">{brl(o.priced.compareAtPrice)}</span>
        )}
        <span className="block font-display text-[26px] font-extrabold leading-none text-[var(--ink)]">
          {brl(o.priced.price)}
        </span>
        <span className="mt-1 block text-[10.5px] text-[var(--slate)]">
          {brl(Math.round((o.priced.price / o.jogadores) * 100) / 100)} / jogador
        </span>
      </span>
    </button>
  );
}

function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const pay = usePayInfo();
  const p = getBundle(bundleIdFromSearch(search));
  const lista = opcoes(p);
  const inicial =
    lista.find((o) => o.label === search.variante) ??
    lista.find((o) => o.kits === KITS_PADRAO) ??
    lista[0];
  const [escolha, setEscolha] = useState(inicial?.label);
  const atual = lista.find((o) => o.label === escolha) ?? inicial;
  const priced = atual?.priced ?? p;
  const values = atual ? [atual.label] : [];

  useEffect(() => {
    metaTrack("ViewContent", { value: priced.price, contentName: p.name });
  }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const variante = values.length ? { variante: encodeVariant(values) } : {};
  const buy = () => {
    markCartCheckout(false);
    trackCheckoutClick({
      source: "product_page",
      bundleId: p.id,
      bundleName: productLabel(p, values).slice(0, 80),
      value: priced.price,
    });
    navigate({ to: "/checkout", search: { plano: p.id, ...variante } });
  };

  const pixPrice = pay.pixOff ? Math.round(priced.price * (1 - pay.pixOff) * 100) / 100 : 0;

  return (
    <SiteLayout>
      <section>
        <div className="container-edge grid gap-8 py-6 md:grid-cols-[1fr_1fr] md:gap-12 md:py-10 lg:gap-16">
          <div className="md:sticky md:top-[calc(var(--site-chrome-h,7rem)+1.5rem)] md:self-start">
            <Gallery images={p.images} alt={p.name} chip="Qualquer parede vira o alvo" />
          </div>

          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[var(--slate)]">{brand.name}</p>
            <Display as="h1" top="Projetor" em="Laser Tag" className="mt-2 text-[48px] md:text-[64px]" />
            <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-[var(--slate)]">
              Aponte para uma parede, apague a luz e um tubarão, um dino, um pinguim ou um robô aparece. Quem
              acertar primeiro leva o ponto.
            </p>
            <ul className="mt-4 space-y-1.5 text-[13.5px] text-[var(--ink)]">
              {[
                ["🎯", "Qualquer parede lisa vira o alvo"],
                ["🦈", "4 cartões: tubarão, dino, pinguim e robô"],
                ["🎮", "4 modos de tiro, com luz e som"],
                ["📺", "Sem TV, sem videogame, sem sensores"],
              ].map(([e, t]) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span aria-hidden>{e}</span>
                  {t}
                </li>
              ))}
            </ul>
            <ul className="mt-4 flex flex-wrap gap-2">
              {["5+ anos", "2 jogadores por kit", "Sem projéteis"].map((t) => (
                <li
                  key={t}
                  className="rounded-md border border-[var(--line)] bg-[var(--card-bg)] px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink)]"
                >
                  {t}
                </li>
              ))}
            </ul>

            <div id="escolha-o-kit" className="mt-7 scroll-mt-32">
              <div className="mb-3 flex items-end justify-between gap-3">
                <p className="text-[15px] font-bold text-[var(--ink)]">Escolha seu kit</p>
                <p className="text-[11px] text-[var(--slate)]">Cada kit = 2 jogadores</p>
              </div>
              <div role="radiogroup" aria-label="Quantidade de kits" className="space-y-3.5">
                {lista.map((o) => (
                  <SquadCard
                    key={o.label}
                    o={o}
                    on={o.label === atual?.label}
                    selo={SELOS[o.kits]}
                    onPick={() => setEscolha(o.label)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--lime-deep)]/40 bg-[linear-gradient(135deg,var(--tint-lime),var(--card-bg))] backdrop-blur">
              <p className="flex items-center gap-2 px-4 pt-3 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[var(--ink)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-deep)]" /> Vem no seu pedido ✦
              </p>
              <ul className="divide-y divide-[var(--line)]">
                {NA_CAIXA.map((c) => (
                  <li key={c.item} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--tint-blue)] font-display text-[20px] font-extrabold text-[var(--blue)]">
                      {c.n * (atual?.kits ?? 1)}×
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-[var(--ink)]">{c.item}</span>
                      <span className="block text-[11px] text-[var(--slate)]">{c.nota}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5">
              <button type="button" onClick={buy} className="btn-buy h-[70px] w-full text-[18px] md:text-[19px]">
                Comprar agora
              </button>
              {(pixPrice > 0 || pay.card) && (
                <p className="mt-2.5 text-center text-[12px] text-[var(--slate)]">
                  {pixPrice > 0 && (
                    <>
                      <b className="text-[var(--ink)]">{brl(pixPrice)}</b> no Pix ({Math.round(pay.pixOff * 100)}% OFF)
                    </>
                  )}
                  {pixPrice > 0 && pay.card && " ou "}
                  {pay.card && (
                    <>
                      {pay.installments}x de {installment(priced.price, pay.installments)} no cartão
                    </>
                  )}
                </p>
              )}
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[12px] text-[var(--ink)]">
                <Check className="h-3.5 w-3.5 text-[var(--lime)]" strokeWidth={3} />
                {FREE_SHIPPING_LABEL} em todo pedido
              </p>
              <p className="mt-2 text-center text-[11.5px] text-[var(--slate)]">
                Prazo médio de entrega: {brand.prazoEntrega}
              </p>
            </div>

            <ul className="mt-6 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-5 text-[10.5px] leading-tight text-[var(--slate)]">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--blue)]" strokeWidth={1.6} />
                Pagamento seguro
              </li>
              <li className="flex items-center gap-2">
                <Truck className="h-5 w-5 shrink-0 text-[var(--blue)]" strokeWidth={1.6} />
                Frete grátis para o Brasil
              </li>
              <li className="flex items-center gap-2">
                <Undo2 className="h-5 w-5 shrink-0 text-[var(--blue)]" strokeWidth={1.6} />
                Garantia de {brand.garantiaDias} dias
              </li>
            </ul>
          </div>
        </div>
      </section>

      <Ticker big items={["Qualquer parede vira o alvo", "Placar digital", "4 modos de tiro", "Diversão sem tela"]} />
      <EmAcao />
      <Alvos />
      <ModosTiro />
      <JeitosDeJogar />
      <Comparativo />
      <ComoJogar />
      <NaCaixa />
      <Reviews />

      <section id="perguntas" className="container-edge grid scroll-mt-28 gap-10 py-16 md:grid-cols-[1fr_1.4fr] md:gap-16 md:py-24">
        <div>
          <Eyebrow>Antes da primeira rodada</Eyebrow>
          <Display top="Suas dúvidas" em="respondidas" className="mt-4 text-[52px] md:text-[72px]" />
          <p className="mt-5 text-[13.5px] text-[var(--slate)]">Precisa de outra ajuda?</p>
          <Link to="/contato" className="mt-1 inline-block border-b border-[var(--blue)] text-[13.5px] font-semibold text-[var(--blue)]">
            Fale com a gente ↗
          </Link>
        </div>
        <FaqList items={FAQ_KIT} />
      </section>

      <FinalCta
        eyebrow="Luz apagada. Jogo ligado."
        top="Leve o fliperama"
        em="para a sua parede"
        cta="Quero o meu"
        note={`${FREE_SHIPPING_LABEL} · Garantia de ${brand.garantiaDias} dias`}
      />

    </SiteLayout>
  );
}
