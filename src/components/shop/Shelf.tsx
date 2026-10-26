import { Children, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Prateleira com deslize lateral: no celular arrasta com o dedo (encaixa card a card),
 * no computador tem setas. `itemClassName` controla a largura de cada card.
 */
export function Shelf({
  children,
  label,
  itemClassName = "w-[46%] sm:w-[31%] md:w-[23.4%]",
}: {
  children: ReactNode;
  label: string;
  itemClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    el.scrollBy({ left: dir * ((first?.offsetWidth ?? 280) + 16) * 2, behavior: "smooth" });
  };
  const arrow =
    "absolute top-[36%] z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center border border-[var(--line)] bg-[var(--card-bg)] text-[var(--ink)] transition hover:bg-[var(--blue)] hover:text-[var(--on-blue)] md:grid";
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`${label}: anteriores`}
        onClick={() => go(-1)}
        className={cn(arrow, "-left-5")}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div
        ref={ref}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:gap-4 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (child) => (
          <div className={cn("shrink-0 snap-start", itemClassName)}>{child}</div>
        ))}
      </div>
      <button
        type="button"
        aria-label={`${label}: próximos`}
        onClick={() => go(1)}
        className={cn(arrow, "-right-5")}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
