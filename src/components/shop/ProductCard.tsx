import { Link } from "@tanstack/react-router";
import { usePayInfo } from "@/hooks/usePayInfo";
import { brl, discountPct, installment, type Bundle } from "@/lib/bundles";
import { cn } from "@/lib/utils";

/**
 * Card da vitrine: foto 3:4 (troca pela 2ª foto no hover), selos e preço.
 * Kits mostram quanto sai cada peça; peças avulsas, as parcelas (com o cartão liberado).
 */
export function ProductCard({ p, priority = false }: { p: Bundle; priority?: boolean }) {
  const pay = usePayInfo();
  const off = discountPct(p);
  const second = p.images.find((i) => i !== p.img);
  const pieces = p.kit?.length ?? 0;
  return (
    <Link to="/produto" search={{ plano: p.id }} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--tile)]">
        <img
          src={p.img}
          alt={p.name}
          loading={priority ? "eager" : "lazy"}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition duration-700",
            second && "md:group-hover:opacity-0",
          )}
        />
        {second && (
          <img
            src={second}
            alt=""
            loading="lazy"
            className="absolute inset-0 hidden h-full w-full object-cover opacity-0 transition duration-700 md:block md:group-hover:opacity-100"
          />
        )}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {pieces > 0 && (
            <span className="bg-[var(--primary)] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--on-blue)]">
              Kit {pieces} peças
            </span>
          )}
          {p.badge && (
            <span className="bg-[var(--card-bg)] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink)]">
              {p.badge}
            </span>
          )}
        </div>
        {off > 0 && !p.soldOut && (
          <span className="absolute right-2 top-2 bg-[var(--lime)] px-2 py-1 text-[10.5px] font-extrabold text-[var(--on-lime)]">
            -{off}%
          </span>
        )}
        {p.soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-[var(--chip-bg)] py-2 text-center text-[11px] font-bold uppercase tracking-[0.14em]">
            Esgotado
          </span>
        )}
      </div>
      <div className="pt-3">
        <h3 className="line-clamp-2 text-[12.5px] font-semibold uppercase leading-snug tracking-[0.02em] text-[var(--ink)] md:text-[13px]">
          {p.name}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-[15px] font-extrabold text-[var(--ink)]">{brl(p.price)}</span>
          {p.compareAtPrice && (
            <s className="text-[12.5px] text-[var(--ink)]">{brl(p.compareAtPrice)}</s>
          )}
        </div>
        {pieces > 0 ? (
          <p className="mt-0.5 text-[12px] font-semibold text-[var(--primary)]">
            {brl(Math.round((p.price / pieces) * 100) / 100)} cada peça
          </p>
        ) : (
          pay.card && (
            <p className="mt-0.5 text-[12px] text-[var(--ink)]">
              ou {pay.installments}x de {installment(p.price, pay.installments)}
            </p>
          )
        )}
      </div>
    </Link>
  );
}
