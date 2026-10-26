import { createFileRoute } from "@tanstack/react-router";
import { absUrl } from "@/lib/seo";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/Layout";
import { brand } from "@/lib/brand";
import { getSiteSettings } from "@/lib/site-settings.functions";
import { formatWhatsapp, whatsappLink } from "@/lib/whatsapp";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: `Contato | ${brand.name}` },
      { name: "description", content: `Fale com a equipe da ${brand.name}. Atendimento humano.` },
      { property: "og:title", content: `Contato ${brand.name}` },
      { property: "og:description", content: `Fale com a equipe da ${brand.name}.` },
      { property: "og:url", content: absUrl("/contato") },
    ],
    links: [{ rel: "canonical", href: absUrl("/contato") }],
  }),
  component: Page,
});

function Page() {
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
    <SiteLayout>
      <section className="pt-32 md:pt-44 pb-24">
        <div className="container-edge grid lg:grid-cols-12 gap-16">
          <div className="lg:col-span-5">
            <span className="eyebrow text-[var(--primary)]">Atendimento</span>
            <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mt-6 text-balance">
              Estamos aqui <br />
              <span className="italic">para ajudar.</span>
            </h1>
            <p className="mt-6 text-[var(--ink)] leading-relaxed max-w-sm">
              Nossa equipe responde em até 24 horas em dias úteis.
            </p>
            <ul className="mt-12 space-y-6 text-sm">
              {whatsappEnabled && (
                <li className="border-b border-[var(--line)] pb-5">
                  <div className="eyebrow text-[var(--ink)] mb-2">WhatsApp</div>
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-[var(--primary)] hover:underline"
                    aria-label={`Chamar no WhatsApp ${formatWhatsapp(whatsappPhone)}`}
                  >
                    {formatWhatsapp(whatsappPhone)}
                  </a>
                </li>
              )}
              <li className="border-b border-[var(--line)] pb-5">
                <div className="eyebrow text-[var(--ink)] mb-2">Atendimento</div>
                <div>Online, para todo o Brasil</div>
              </li>
            </ul>
          </div>

          {whatsappEnabled && (
            <form
              className="lg:col-span-7 bg-[var(--card-bg)] p-10 md:p-12 border border-[var(--line)] rounded-xl space-y-8"
              onSubmit={(e) => {
                e.preventDefault();
                // Abre o WhatsApp da loja com a mensagem já escrita (a loja não tem e-mail).
                const f = new FormData(e.currentTarget);
                const text = `${settings?.whatsappMessage ?? brand.whatsapp.message}\n\n${f.get("mensagem") ?? ""}\n\n— ${f.get("nome") ?? ""}`;
                window.open(whatsappLink(whatsappPhone, text), "_blank", "noreferrer");
              }}
            >
              <Field label="Nome" name="nome" />
              <Field label="Mensagem" name="mensagem" textarea />
              <button className="btn-lime w-full justify-center py-5 text-xs font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-colors">
                Enviar pelo WhatsApp
              </button>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

function Field({
  label,
  name,
  type = "text",
  textarea,
}: {
  label: string;
  name: string;
  type?: string;
  textarea?: boolean;
}) {
  const cls =
    "mt-3 w-full border-0 border-b border-[var(--input)] bg-transparent px-0 py-3 focus:outline-none focus:border-[var(--ink)] transition-colors text-base";
  return (
    <label className="block">
      <span className="eyebrow text-[var(--ink)]">{label}</span>
      {textarea ? (
        <textarea required name={name} rows={5} className={cls} />
      ) : (
        <input required name={name} type={type} className={cls} />
      )}
    </label>
  );
}
