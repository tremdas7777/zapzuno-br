import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowUpRight, ChevronDown } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { brand } from "@/lib/brand";
import { getSiteSettings } from "@/lib/site-settings.functions";
import { formatWhatsapp, whatsappLink } from "@/lib/whatsapp";
import { CARD_MAX_INSTALLMENTS } from "@/lib/payment-pricing";

type L = { label: string; href: string };

const gameLinks: L[] = [
  { label: "Início", href: "/" },
  { label: "Projetor Laser Tag", href: "/produto" },
  { label: "Como jogar", href: "/produto#como-jogar" },
  { label: "Veja em ação", href: "/produto#em-acao" },
  { label: "Diário de Jogo", href: "/diario" },
];

const helpLinks: L[] = [
  { label: "Dúvidas frequentes", href: "/faq" },
  { label: "Rastrear pedido", href: "/rastreio" },
  { label: "Fale conosco", href: "/contato" },
  { label: "Envio e prazos", href: "/politica-envio" },
  { label: "Garantia e devoluções", href: "/politica-reembolso" },
  { label: "Privacidade", href: "/politica-privacidade" },
  { label: "Sobre a loja", href: "/sobre" },
];

function LinkList({ links }: { links: L[] }) {
  return (
    <ul className="space-y-2.5">
      {links.map((item) => (
        <li key={item.label}>
          <a
            href={item.href}
            className="text-[13.5px] text-[var(--slate)] transition-colors hover:text-[var(--blue)]"
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** No celular vira sanfona fechada; no computador, coluna aberta. */
function FooterColumn({ title, links }: { title: string; links: L[] }) {
  return (
    <>
      <details className="group border-b border-[var(--line)] py-4 md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--ink)] [&::-webkit-details-marker]:hidden">
          {title}
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className="pt-4">
          <LinkList links={links} />
        </div>
      </details>
      <div className="hidden md:block">
        <h4 className="mb-5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--ink)]">
          {title}
        </h4>
        <LinkList links={links} />
      </div>
    </>
  );
}

function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  const fetchSettings = useServerFn(getSiteSettings);
  const { data: settings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => fetchSettings(),
    staleTime: 60_000,
  });
  const whatsappPhone = settings?.whatsappPhone ?? "";
  const whatsappEnabled = (settings?.whatsappEnabled ?? false) && !!whatsappPhone;
  const whatsappHref = whatsappLink(
    whatsappPhone,
    settings?.whatsappMessage ?? brand.whatsapp.message,
  );

  return (
    <footer className="bg-[rgb(var(--fade-rgb)/0.72)] text-[var(--ink)] backdrop-blur-sm">
      <div className="container-edge border-t border-[var(--line)] pb-8 pt-14 md:pt-16">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <Link to="/" aria-label={`${brand.name}: início`} className="inline-block">
              <Logo size="lg" />
            </Link>
            <p className="mt-4 text-[14px] leading-relaxed text-[var(--slate)]">
              Qualquer parede
              <br />
              vira o alvo.
            </p>
            <div className="mt-5 space-y-1.5 text-[13.5px]">
              {whatsappEnabled && (
                <div className="pb-3">
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Chamar no WhatsApp ${formatWhatsapp(whatsappPhone)}`}
                    className="btn-whats w-full max-w-[330px] py-3 pl-3 pr-4"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/45">
                      <WhatsappIcon className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block text-[12px] font-semibold text-white">
                        Dúvidas sobre o kit?
                      </span>
                      <span className="block font-display text-[21px] font-extrabold uppercase tracking-[0.02em]">
                        Chamar no WhatsApp
                      </span>
                    </span>
                    <ArrowUpRight className="h-5 w-5 shrink-0" aria-hidden />
                  </a>
                  <p className="mt-2 text-[12.5px] text-[var(--slate)]">
                    {formatWhatsapp(whatsappPhone)}
                  </p>
                </div>
              )}
              {brand.instagram && (
                <a
                  href={`https://instagram.com/${brand.instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-[var(--slate)] hover:text-[var(--blue)]"
                >
                  Instagram {brand.instagram}
                </a>
              )}
            </div>
          </div>
          <div className="md:contents">
            <FooterColumn title="O jogo" links={gameLinks} />
            <FooterColumn title="Estamos aqui" links={helpLinks} />
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[var(--line)] pt-6 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--slate)] md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {brand.name} · CNPJ {brand.cnpj}
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "Pix",
              ...(settings?.cardEnabled ? [`Cartão em até ${CARD_MAX_INSTALLMENTS}x`] : []),
              "Compra segura",
            ].map((t) => (
              <span
                key={t}
                className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[10px] font-bold text-[var(--ink)]"
              >
                {t}
              </span>
            ))}
          </div>
          <a href="#top" className="inline-flex items-center gap-1 text-[var(--blue)]">
            Voltar ao topo <ArrowUp className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
