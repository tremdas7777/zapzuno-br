import { Check, Crosshair, Lightbulb, Ruler, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { Display, Eyebrow, LimeLink, TextLink } from "@/components/br/ui";
import { ALVOS, JEITOS, MODOS_TIRO, NA_CAIXA } from "@/lib/laser";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

const shadow = "shadow-[0_30px_60px_-34px_rgba(0,0,0,0.75)]";

/** Dígitos vermelhos do visor do projetor. */
export function Digits({ v, className }: { v: string; className?: string }) {
  return (
    <span
      className={cn(
        "font-display font-extrabold tabular-nums text-[#ff3b4f] [text-shadow:0_0_14px_rgba(255,59,79,0.5)]",
        className,
      )}
    >
      {v}
    </span>
  );
}

/** Vídeo curto em loop (sem som), no formato de celular. */
export function VideoLoop({
  src,
  poster,
  label,
  className,
}: {
  src: string;
  poster?: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        `relative overflow-hidden rounded-[1.6rem] border-[5px] border-[#10204a] bg-black ring-1 ring-[var(--line)] ${shadow}`,
        className,
      )}
    >
      <video
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        className="aspect-[9/16] w-full object-cover"
      />
    </div>
  );
}

export function EmAcao() {
  return (
    <section id="em-acao" className="band-sky scroll-mt-28 border-y border-[var(--line)]">
      <div className="container-edge grid items-center gap-12 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
        <div>
          <Eyebrow>Veja em ação</Eyebrow>
          <Display top="Luz apagada." em="Jogo ligado." className="mt-4 text-[52px] md:text-[76px]" />
          <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-[var(--slate)]">
            O alvo aparece na sua parede. Quem acertar primeiro leva o ponto, e o placar do projetor conta tudo.
          </p>
          <ol className="mt-8 space-y-4">
            {["Coloque um cartão e mire numa parede lisa", "Apague a luz", "Aperte start e jogue"].map((t, n) => (
              <li key={t} className="flex items-center gap-4">
                <span className="font-display text-[30px] font-extrabold leading-none text-[var(--blue)]">
                  {n + 1}
                </span>
                <span className="text-[14.5px] text-[var(--ink)]">{t}</span>
              </li>
            ))}
          </ol>
          <TextLink to="/produto" hash="escolha-o-kit" className="mt-9 w-full max-w-[320px]">
            Quero jogar em casa
          </TextLink>
        </div>
        <div className="mx-auto grid w-full max-w-[460px] grid-cols-2 gap-4">
          <VideoLoop src="/videos/jogo-1.mp4" poster="/videos/jogo-1.jpg" label="Criança acertando o alvo projetado na parede" />
          <VideoLoop
            src="/videos/jogo-2.mp4"
            poster="/videos/jogo-2.jpg"
            label="Duas crianças jogando contra os alvos projetados"
            className="mt-10"
          />
          <p className="col-span-2 text-center text-[11px] text-[var(--slate)]">
            Laser tag por infravermelho · Sem projéteis
          </p>
        </div>
      </div>
    </section>
  );
}

export function Alvos() {
  return (
    <section className="container-edge grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24">
      <img
        src="/produtos/alvos.webp"
        alt="Os 4 cartões de alvo: tubarão, dinossauro, pinguim e robô"
        width={1200}
        height={1200}
        loading="lazy"
        className={`aspect-square w-full rounded-2xl object-cover ${shadow}`}
      />
      <div>
        <Eyebrow>4 cartões de alvo</Eyebrow>
        <Display top="Qualquer parede" em="vira o alvo" className="mt-4 text-[52px] md:text-[72px]" />
        <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-[var(--slate)]">
          Encaixe um cartão no projetor e o personagem aparece na parede. Sem TV, sem videogame e sem nada para
          colar: só uma parede lisa e a luz apagada.
        </p>
        <ul className="mt-7 grid grid-cols-2 gap-3">
          {ALVOS.map((a, n) => (
            <li
              key={a.id}
              className={cn(
                "card-soft flex items-center gap-3 px-4 py-3.5",
                n % 2
                  ? "!bg-[linear-gradient(135deg,var(--card-bg),var(--tint-lime))]"
                  : "!bg-[linear-gradient(135deg,var(--card-bg),var(--tint-blue))]",
              )}
            >
              <Crosshair className="h-5 w-5 shrink-0 text-[var(--blue)]" strokeWidth={2.2} />
              <span className="font-display text-[22px] font-extrabold uppercase leading-none text-[var(--ink)]">
                {a.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ModosTiro() {
  return (
    <section className="band-sky border-y border-[var(--line)]">
      <div className="container-edge grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24">
        <div className="md:order-2">
          <img
            src="/produtos/modos-de-tiro.webp"
            alt="Os 4 modos de tiro da pistola: pistola, metralhadora, arma laser e canhão de plasma"
            width={1200}
            height={1200}
            loading="lazy"
            className={`aspect-square w-full rounded-2xl object-cover ${shadow}`}
          />
        </div>
        <div>
          <Eyebrow>Escolha seu estilo de jogo</Eyebrow>
          <Display top="4 modos" em="de tiro" className="mt-4 text-[52px] md:text-[76px]" />
          <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-[var(--slate)]">
            Troque o modo no botão da pistola e mude o jeito da partida. Cada disparo tem luz e som.
          </p>
          <ul className="mt-8 space-y-3">
            {MODOS_TIRO.map((m, n) => (
              <li
                key={m}
                className="flex h-[58px] items-center gap-5 rounded-xl border border-[var(--line)] bg-[var(--card-bg)] px-5 backdrop-blur"
              >
                <span className="text-[10px] font-bold text-[var(--slate)]">0{n + 1}</span>
                <span className="flex-1 font-display text-[24px] font-extrabold uppercase text-[var(--ink)]">{m}</span>
                <Zap className="h-4 w-4 text-[var(--blue)]" strokeWidth={2.4} />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-[var(--slate)]">Jogo por infravermelho · Nada sai da pistola</p>
        </div>
      </div>
    </section>
  );
}

export function JeitosDeJogar() {
  return (
    <section className="container-edge py-16 md:py-24">
      <div className="grid items-end gap-6 md:grid-cols-2">
        <div>
          <Eyebrow>Sozinho, em dupla ou na disputa</Eyebrow>
          <Display top="3 jeitos" em="de jogar" className="mt-4 text-[52px] md:text-[76px]" />
        </div>
        <p className="text-[14.5px] leading-relaxed text-[var(--slate)] md:text-right">
          Placar digital no projetor:
          <br />
          ninguém discute quem ganhou.
        </p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-[1.15fr_1fr]">
        <img
          src="/produtos/3-jeitos.webp"
          alt="Crianças jogando sozinhas, em equipe e um contra um"
          width={1200}
          height={1200}
          loading="lazy"
          className={`aspect-square w-full rounded-2xl object-cover ${shadow}`}
        />
        <div className="flex flex-col gap-3">
          {JEITOS.map((j) => (
            <div key={j.n} className="card-soft flex items-center gap-5 px-5 py-4">
              <span className="font-display text-[34px] font-extrabold leading-none text-[var(--blue)]">{j.n}</span>
              <span>
                <span className="block font-display text-[24px] font-extrabold uppercase leading-tight text-[var(--ink)]">
                  {j.name}
                </span>
                <span className="mt-0.5 block text-[13px] text-[var(--slate)]">{j.text}</span>
              </span>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            {[
              ["L1", "Desafio de níveis", "10 níveis, cada um mais difícil."],
              ["L2", "Competição", "Vence quem fizer mais pontos."],
            ].map(([d, t, x]) => (
              <div key={d} className="card-soft !bg-[linear-gradient(160deg,var(--card-bg),var(--tint-blue))] p-4">
                <span className="inline-block rounded-md bg-black/70 px-2.5 py-1">
                  <Digits v={d!} className="text-[26px] leading-none" />
                </span>
                <p className="mt-3 text-[14px] font-bold text-[var(--ink)]">{t}</p>
                <p className="mt-0.5 text-[12px] text-[var(--slate)]">{x}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Comparativo() {
  const tela = [
    "Criança grudada na tela",
    "Precisa de TV ou tablet",
    "Quase sempre joga sozinha",
    "Cabos, apps e cadastro",
    "Mais tempo de tela",
  ];
  const zz = [
    "Criança correndo e rindo",
    "Qualquer parede lisa serve",
    "2 jogadores já na caixa",
    "Coloca as pilhas e joga",
    "Zero tempo de tela",
  ];
  return (
    <section className="band-sky border-y border-[var(--line)]">
      <div className="container-edge py-16 md:py-24">
        <Eyebrow className="justify-center">Por que isso e não mais uma tela?</Eyebrow>
        <Display
          top={brand.name}
          em="× brinquedos de tela"
          className="mx-auto mt-4 text-center text-[48px] md:text-[72px]"
        />
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
          <div className="card-soft p-6 opacity-90">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--slate)]">
              📺 Brinquedos de tela
            </p>
            <ul className="mt-4 space-y-3">
              {tela.map((t) => (
                <li key={t} className="flex items-center gap-3 text-[14px] text-[var(--slate)]">
                  <X className="h-4 w-4 shrink-0 text-[#ff5a6a]" strokeWidth={3} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="card-soft border-[var(--blue)]/60 !bg-[linear-gradient(160deg,var(--tint-lime),var(--card-bg))] p-6">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--blue)]">
              🎯 Projetor {brand.name}
            </p>
            <ul className="mt-4 space-y-3">
              {zz.map((t) => (
                <li key={t} className="flex items-center gap-3 text-[14px] font-semibold text-[var(--ink)]">
                  <Check className="h-4 w-4 shrink-0 text-[var(--blue)]" strokeWidth={3} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ComoJogar() {
  const passos = [
    { t: "Coloque as pilhas", d: "3 pilhas AAA em cada pistola e 2 AA no projetor.", x: "As pilhas não vêm no kit." },
    {
      t: "Escolha o alvo",
      d: "Encaixe um cartão, aponte para uma parede lisa e apague a luz.",
      x: "Funciona melhor no escuro.",
    },
    {
      t: "Aperte start",
      d: "Escolha L1 (níveis) ou L2 (competição) e comece a partida.",
      x: "Segure START por 2 segundos para escolher o nível no L1.",
    },
  ];
  return (
    <section id="como-jogar" className="container-edge scroll-mt-28 py-16 md:py-24">
      <Eyebrow>Fácil de começar</Eyebrow>
      <Display top="Monte. Escolha." em="Jogue." className="mt-4 text-[52px] md:text-[76px]" />
      <div className="mt-10 grid gap-5 md:grid-cols-[1fr_1.4fr] md:items-center">
        <img
          src="/produtos/projetor.webp"
          alt="Botões do projetor: liga/desliga, reiniciar, iniciar/pausar e modo"
          width={1200}
          height={1200}
          loading="lazy"
          className={`aspect-square w-full rounded-2xl object-cover ${shadow}`}
        />
        <ul className="grid gap-4">
          {passos.map((p, n) => (
            <li
              key={p.t}
              className="card-soft relative overflow-hidden !bg-[linear-gradient(160deg,var(--card-bg),var(--tint-blue))] p-6 after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-[linear-gradient(90deg,#3fd0ff,var(--lime))]"
            >
              <div className="flex items-baseline gap-4">
                <p className="font-display text-[44px] font-extrabold leading-none text-[var(--blue)]">0{n + 1}</p>
                <p className="font-display text-[26px] font-extrabold uppercase text-[var(--ink)]">{p.t}</p>
              </div>
              <p className="mt-2 text-[13.5px] text-[var(--slate)]">{p.d}</p>
              <p className="mt-3 text-[10.5px] text-[var(--slate)] opacity-80">{p.x}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function NaCaixa() {
  return (
    <section className="band-sky border-y border-[var(--line)]">
      <div className="container-edge grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24">
        <div>
          <Eyebrow>O que vem em cada kit</Eyebrow>
          <Display top="Pequeno no tamanho." em="Gigante na diversão." className="mt-4 text-[52px] md:text-[68px]" />
          <ul className="mt-7 space-y-5">
            {NA_CAIXA.map((c) => (
              <li key={c.item} className="flex items-center gap-5">
                <span className="w-10 font-display text-[30px] font-extrabold italic leading-none text-[var(--blue)]">
                  {c.n}×
                </span>
                <span>
                  <span className="block text-[14px] font-bold text-[var(--ink)]">{c.item}</span>
                  <span className="text-[12px] text-[var(--slate)]">{c.nota}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="card-soft mt-8 p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--blue)]">Bom saber</p>
            <ul className="mt-3 grid gap-2.5 text-[12.5px] text-[var(--slate)] sm:grid-cols-2">
              {[
                [Sparkles, "A partir de 5 anos, com supervisão de um adulto"],
                [Ruler, "Projetor: 17,5 × 16 × 11,8 cm"],
                [Zap, "Pilhas não inclusas: 3 AAA por pistola, 2 AA no projetor"],
                [Lightbulb, "Funciona melhor com a luz apagada"],
                [ShieldCheck, "Mire na parede, não nas pessoas"],
              ].map(([Icon, t]) => {
                const I = Icon as typeof Zap;
                return (
                  <li key={t as string} className="flex items-start gap-2">
                    <I className="mt-0.5 h-4 w-4 shrink-0 text-[var(--blue)]" strokeWidth={2} />
                    {t as string}
                  </li>
                );
              })}
            </ul>
          </div>
          <LimeLink to="/produto" hash="escolha-o-kit" className="mt-7 w-full max-w-[300px]">
            Escolher meu kit
          </LimeLink>
        </div>
        <img
          src="/produtos/kit-completo.webp"
          alt="Kit completo: projetor, 2 pistolas e 4 cartões de alvo"
          width={1200}
          height={1200}
          loading="lazy"
          className={`aspect-square w-full rounded-2xl object-cover ${shadow}`}
        />
      </div>
    </section>
  );
}
