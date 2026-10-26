import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { useAntiCopy } from "@/hooks/useAntiCopy";
import { useTrackPageView } from "@/hooks/useTrackPageView";
import { META_PIXEL_ID } from "@/lib/meta-pixel";
import { PIXELS } from "@/lib/pixels";
import { brand } from "@/lib/brand";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { PixPaidWatcher } from "@/components/site/PixPaidWatcher";
import { fetchCatalog } from "@/lib/catalog.functions";
import { setCatalogData } from "@/lib/bundles";

import appCss from "../styles.css?url";

const TITLE = `Projetor Laser Tag para crianças e família | ${brand.name}`;
const DESCRIPTION =
  "Laser tag com projetor: qualquer parede vira o alvo. Projetor + 2 pistolas + 4 cartões de alvo (tubarão, dino, pinguim e robô), placar digital e 4 modos de tiro. 1, 2 ou 3 kits com frete grátis para todo o Brasil.";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou mudou de endereço.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar para a loja
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: import("@tanstack/react-router").ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado do nosso lado. Tente atualizar a página ou volte para a loja.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar para a loja
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Catálogo (banco ou catálogo inicial) para todas as páginas. O servidor guarda por 30s.
  loader: async () => {
    const catalog = await fetchCatalog();
    setCatalogData(catalog);
    return { catalog };
  },
  staleTime: 60_000,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      {
        name: "keywords",
        content:
          "laser tag, kit laser tag, laser tag infantil, pistola laser tag, brinquedo para família, jogo para festa de aniversário, presente dia das crianças",
      },
      { name: "robots", content: "index,follow" },
      { property: "og:site_name", content: brand.name },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: brand.colors.primary },
      { property: "og:title", content: TITLE },
      { name: "twitter:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { name: "twitter:description", content: DESCRIPTION },
      // Padrão das páginas sem imagem própria (as da loja trocam via seo() em src/lib/seo.ts).
      { property: "og:image", content: `${brand.siteUrl}/og-image.jpg` },
      { property: "og:image:alt", content: `${brand.name}: kit de laser tag para a família` },
      { name: "twitter:image", content: `${brand.siteUrl}/og-image.jpg` },
      { property: "og:locale", content: "pt_BR" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,800&family=DM+Sans:opsz,wght@9..40,400..800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      // O Google só mostra no resultado ícone com lado múltiplo de 48 px.
      { rel: "icon", type: "image/png", sizes: "144x144", href: "/favicon-144.png" },
      { rel: "icon", type: "image/png", sizes: "64x64", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    // Pixels de navegador: cada um só carrega se tiver ID em src/lib/pixels.ts.
    scripts: [
      ...(META_PIXEL_ID
        ? [
            {
              type: "text/javascript",
              // Meta Pixel (código oficial) inicializado já no <head>, antes da UTMify e do app.
              // Sem PageView aqui: o app envia o PageView com event_id, igual ao da API de Conversões (sem duplicar).
              children: `(function(){if(location.pathname.indexOf("/admin")===0)return;!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');window.__metaHeadPixel='${META_PIXEL_ID}';})();`,
            },
          ]
        : []),
      ...(PIXELS.tiktok
        ? [
            {
              type: "text/javascript",
              children: `location.pathname.indexOf("/admin")!==0&&!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script"),n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${PIXELS.tiktok}');ttq.page()}(window,document,'ttq');`,
            },
          ]
        : []),
      ...(PIXELS.utmify
        ? [
            {
              type: "text/javascript",
              children: `(function(){if(location.pathname.indexOf("/admin")===0)return;if(document.querySelector('script[src*="cdn.utmify.com.br/scripts/pixel/pixel.js"]'))return;window.pixelId="${PIXELS.utmify}";var s=document.createElement("script");s.src="https://cdn.utmify.com.br/scripts/pixel/pixel.js";s.async=true;s.defer=true;(document.head||document.documentElement).appendChild(s);})();`,
            },
          ]
        : []),
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {META_PIXEL_ID && (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        )}
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Antes de desenhar as páginas: a vitrine e o carrinho leem o catálogo daqui.
  setCatalogData(Route.useLoaderData().catalog);
  useAntiCopy();
  useTrackPageView();
  useMetaPixel();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <PixPaidWatcher />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
