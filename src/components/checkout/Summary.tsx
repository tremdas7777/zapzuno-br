import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Bundle } from "@/lib/bundles";
import { bumpsTotal, getBumps, type BumpId } from "@/lib/order-bump";
import type { CartLine } from "@/lib/cart";
import { brl } from "./parts";
import { FreeShippingProgress } from "./FreeShippingProgress";

/** `bundle` já com o preço da variação escolhida; `variant`: opções formatadas ("Tamanho: 42"). */
type Props = {
  bundle: Bundle;
  frete: number;
  discount: number;
  bumps?: BumpId[];
  /** Demais produtos do carrinho. */
  itens?: CartLine[];
  variant?: string;
};

const productsOf = ({ bundle, bumps = [], itens = [] }: Props) =>
  bundle.price + bumpsTotal(bumps) + itens.reduce((s, l) => s + l.price, 0);
const totalOf = (p: Props) => productsOf(p) - p.discount + p.frete;

function Body(p: Props) {
  const { bundle, frete, discount, bumps = [], variant } = p;
  const total = totalOf(p);
  return (
    <>
      <FreeShippingProgress subtotal={productsOf(p)} className="mb-5" />
      <div className="space-y-2 text-[13px]">
        <div className="flex justify-between">
          <span>Produtos</span>
          <span>{brl(productsOf(p))}</span>
        </div>
        <div className="flex justify-between">
          <span>Frete</span>
          <span className="text-[var(--ck-ok)]">{frete ? brl(frete) : "Grátis"}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Desconto Pix</span>
            <span className="text-[var(--ck-ok)]">-{brl(discount)}</span>
          </div>
        )}
        <div className="flex justify-between pt-1 text-base font-semibold">
          <span>Total</span>
          <span>{brl(total)}</span>
        </div>
      </div>
      <div className="mt-6 flex gap-3 border-t border-border pt-6">
        <img
          src={bundle.img}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 rounded-md border border-border object-cover"
        />
        <div className="flex-1 text-[13px]">
          <p>{bundle.checkoutProductName}</p>
          <p className="mt-1 text-muted-foreground">
            {variant ? `${variant} · 1 unidade` : "1 unidade"}
          </p>
        </div>
        <span className="text-[13px]">{brl(bundle.price)}</span>
      </div>
      {(p.itens ?? []).map((l) => (
        <div key={l.key} className="mt-4 flex gap-3">
          <img
            src={l.bundle.img}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-md border border-border object-cover"
          />
          <div className="flex-1 text-[13px]">
            <p>{l.title}</p>
            <p className="mt-1 text-muted-foreground">
              {l.detail ? `${l.detail} · ` : ""}
              {l.qtd} {l.qtd === 1 ? "unidade" : "unidades"}
            </p>
          </div>
          <span className="text-[13px]">{brl(l.price)}</span>
        </div>
      ))}
      {getBumps(bumps).map((b) => (
        <div key={b.id} className="mt-4 flex gap-3">
          <img
            src={b.img}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-md border border-border object-cover"
          />
          <div className="flex-1 text-[13px]">
            <p>{b.fullName}</p>
            <p className="mt-1 text-muted-foreground">1 unidade · oferta do checkout</p>
          </div>
          <span className="text-[13px]">{brl(b.price)}</span>
        </div>
      ))}
    </>
  );
}

export function SummaryDesktop(p: Props) {
  return (
    <aside className="hidden h-fit rounded-lg border border-border p-6 lg:block">
      <h2 className="mb-6 text-[15px]">Resumo do pedido</h2>
      <Body {...p} />
    </aside>
  );
}

export function SummaryMobile(p: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-y border-border bg-muted/60 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3"
      >
        <span className="text-[13px]">
          Resumo do pedido (
          {1 + getBumps(p.bumps ?? []).length + (p.itens ?? []).reduce((s, l) => s + l.qtd, 0)}
          )
        </span>
        <span className="flex items-center gap-2 text-lg font-medium">
          {brl(totalOf(p))}{" "}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="ck-surface px-5 py-5">
          <Body {...p} />
        </div>
      )}
    </div>
  );
}
