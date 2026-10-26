import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/site/Layout";
import { ProductCard } from "@/components/shop/ProductCard";
import { brand } from "@/lib/brand";
import { findCollection, getCategories } from "@/lib/bundles";
import { breadcrumbJsonLd, seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/colecao/$id")({
  head: ({ params }) => {
    const c = findCollection(params.id);
    if (!c) return { meta: [{ title: `Coleção não encontrada | ${brand.name}` }] };
    return seo({
      path: `/colecao/${c.id}`,
      title: `${c.name}: 1, 2 ou 3 kits | ${brand.name}`,
      description: `${c.desc}. Projetor de alvos e pistolas de laser tag, com frete grátis para todo o Brasil.`,
      image: c.img,
      imageAlt: c.name,
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: c.name, path: `/colecao/${c.id}` },
        ]),
      ],
    });
  },
  component: Page,
});

const SORTS = [
  { id: "rel", label: "Destaques" },
  { id: "menor", label: "Menor preço" },
  { id: "maior", label: "Maior preço" },
] as const;
type Sort = (typeof SORTS)[number]["id"];

function Page() {
  const { id } = Route.useParams();
  const c = findCollection(id);
  const [sort, setSort] = useState<Sort>("rel");

  if (!c)
    return (
      <SiteLayout>
        <div className="container-edge py-24 text-center">
          <h1 className="display text-[40px]">Coleção não encontrada</h1>
          <Link
            to="/"
            className="mt-6 inline-block btn-lime px-6 py-3.5 text-[12px]"
          >
            Voltar para a loja
          </Link>
        </div>
      </SiteLayout>
    );

  const items = [...c.items].sort((a, b) =>
    sort === "menor" ? a.price - b.price : sort === "maior" ? b.price - a.price : 0,
  );
  const cats = [...getCategories(), { id: "todos", name: "Ver tudo" }];

  return (
    <SiteLayout>
      <div className="container-edge pb-16 pt-6 md:pb-24 md:pt-10">
        <nav
          aria-label="Navegação"
          className="flex items-center gap-1 text-[11.5px] uppercase tracking-[0.08em] text-[var(--ink)]"
        >
          <Link to="/" className="hover:text-[var(--ink)]">
            Início
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[var(--ink)]">{c.name}</span>
        </nav>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-[44px] md:text-[72px]">{c.name}</h1>
            <p className="mt-2 text-[14px] text-[var(--ink)]">{c.desc}</p>
          </div>
        </div>

        <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
          {cats.map((x) => (
            <Link
              key={x.id}
              to="/colecao/$id"
              params={{ id: x.id }}
              className={cn(
                "shrink-0 border px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] transition",
                x.id === c.id
                  ? "border-[var(--blue)] bg-[var(--blue)] text-[var(--on-blue)]"
                  : "border-[var(--line)] hover:border-[var(--ink)]",
              )}
            >
              {x.name}
            </Link>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between border-y border-[var(--line)] py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--ink)]">
            {items.length} {items.length === 1 ? "produto" : "produtos"}
          </p>
          <label className="relative flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em]">
            <span className="text-[var(--ink)]">Ordenar</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="cursor-pointer appearance-none bg-transparent pr-5 font-bold uppercase outline-none"
              aria-label="Ordenar produtos"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 h-3.5 w-3.5" />
          </label>
        </div>

        {items.length === 0 ? (
          <p className="py-20 text-center text-[14px] text-[var(--ink)]">
            Nenhum produto nesta coleção ainda.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-3 md:gap-x-4 lg:grid-cols-4">
            {items.map((p, i) => (
              <ProductCard key={p.id} p={p} priority={i < 4} />
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
