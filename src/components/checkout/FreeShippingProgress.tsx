import { Truck } from "lucide-react";
import { FREE_SHIPPING_MIN, isFreeShippingEligible } from "@/lib/bundles";
import { cn } from "@/lib/utils";
import { brl } from "./parts";

/** Barra "faltam R$ X para frete grátis". */
export function FreeShippingProgress({
  subtotal,
  className,
}: {
  subtotal: number;
  className?: string;
}) {
  const eligible = isFreeShippingEligible(subtotal);
  const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_MIN) * 100));

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-[13px]",
        eligible ? "border-[var(--ck-ok)] bg-[var(--ck-badge)]/40" : "border-amber-300 bg-amber-50",
        className,
      )}
    >
      <p className="flex items-center gap-2">
        <Truck
          className={cn("h-4 w-4 shrink-0", eligible ? "text-[var(--ck-ok)]" : "text-amber-600")}
        />
        {eligible ? (
          <span>
            Parabéns! Você ganhou <b className="text-[var(--ck-ok)]">FRETE GRÁTIS</b>
          </span>
        ) : (
          <span>
            Faltam <b>{brl(FREE_SHIPPING_MIN - subtotal)}</b> para você ganhar <b>FRETE GRÁTIS</b>
          </span>
        )}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            eligible ? "bg-[var(--ck-ok)]" : "bg-amber-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
