import { Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { brl, FREE_SHIPPING_MIN, isFreeShippingEligible } from "@/lib/bundles";
import {
  cartCount,
  cartLines,
  cartSubtotal,
  checkoutSearch,
  markCartCheckout,
  MAX_QTD,
  removeItem,
  setCartOpen,
  setItemQty,
  useCart,
  useCartOpen,
} from "@/lib/cart";
import { trackCheckoutClick } from "@/lib/analytics";

const qtyBtn =
  "grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--ink)] disabled:opacity-35";

/** Gaveta do carrinho (lado direito), aberta pelo ícone do header ou ao adicionar um produto. */
export function CartDrawer() {
  const cart = useCart();
  const open = useCartOpen();
  const navigate = useNavigate();
  const lines = cartLines(cart.items);
  const subtotal = cartSubtotal(cart);
  const count = cartCount(cart);
  const freeOk = isFreeShippingEligible(subtotal);
  const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_MIN) * 100));

  const finalizar = () => {
    const search = checkoutSearch(cart);
    if (!search) return;
    trackCheckoutClick({
      source: "cart",
      bundleId: search.plano,
      bundleName: lines.map((l) => l.title).join(" + "),
      value: subtotal,
    });
    markCartCheckout(true);
    setCartOpen(false);
    navigate({ to: "/checkout", search });
  };

  return (
    <Sheet open={open} onOpenChange={setCartOpen}>
      <SheetContent side="right" className="galaxy flex w-[92%] max-w-md flex-col gap-0 border-[var(--line)] bg-[#0a1030] p-0 text-[var(--ink)]">
        <div className="border-b border-[var(--line)] px-5 pb-4 pt-5">
          <SheetTitle className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-[var(--ink)]">
            Carrinho {count > 0 && `(${count})`}
          </SheetTitle>
          <SheetDescription className="sr-only">Produtos escolhidos e total</SheetDescription>
          {count > 0 && (
            <div className="mt-4 rounded-lg bg-[var(--tint-blue)] px-3 py-3 text-[13px] text-[var(--night)]">
              <p className="flex items-center gap-2 font-semibold">
                <Truck className="h-4 w-4 shrink-0" />
                {freeOk ? (
                  <span>Seu pedido ganhou frete grátis</span>
                ) : (
                  <span>
                    Faltam <b>{brl(FREE_SHIPPING_MIN - subtotal)}</b> para o frete grátis
                  </span>
                )}
              </p>
              <div className="mt-2.5 h-1 overflow-hidden rounded bg-[var(--tile)]">
                <div
                  className="h-full bg-[var(--lime)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {count === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="h-10 w-10 text-[var(--night)]" />
            <p className="font-display text-[26px] font-extrabold uppercase leading-none text-[var(--ink)]">Sua próxima rodada começa aqui</p>
            <p className="text-[13px] text-[var(--slate)]">Escolha seu kit. Apague a luz e jogue.</p>
            <Link
              to="/produto"
              onClick={() => setCartOpen(false)}
              className="btn-lime mt-2 h-12 justify-center px-7"
            >
              Ver o kit
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-[var(--line)] overflow-y-auto px-5">
              {lines.map((l, i) => (
                <li key={l.key} className="flex gap-3 py-4">
                  <img
                    src={l.bundle.img}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-lg bg-[var(--tile)] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-bold uppercase leading-snug tracking-[0.02em] text-[var(--ink)]">
                      {l.title}
                    </p>
                    {l.detail && <p className="mt-0.5 text-[12px] text-[var(--slate)]">{l.detail}</p>}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Diminuir quantidade"
                        className={qtyBtn}
                        onClick={() => setItemQty(i, l.qtd - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-[14px] font-bold">{l.qtd}</span>
                      <button
                        type="button"
                        aria-label="Aumentar quantidade"
                        className={qtyBtn}
                        disabled={l.qtd >= MAX_QTD}
                        onClick={() => setItemQty(i, l.qtd + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remover do carrinho"
                        className="ml-auto grid h-8 w-8 place-items-center text-[var(--slate)]"
                        onClick={() => removeItem(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <span className="text-[14px] font-bold text-[var(--night)]">{brl(l.price)}</span>
                </li>
              ))}
            </ul>

            <div className="border-t border-[var(--line)] px-5 pb-5 pt-4 [padding-bottom:max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between text-[15px]">
                <span className="font-semibold">Subtotal</span>
                <b className="text-[18px] text-[var(--night)]">{brl(subtotal)}</b>
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--slate)]">
                Frete e desconto do Pix no checkout
              </p>
              <button
                type="button"
                onClick={finalizar}
                className="btn-lime mt-3 h-14 w-full justify-center text-[13px]"
              >
                Finalizar compra
              </button>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="mt-2 w-full py-1 text-[13px] font-semibold text-[var(--slate)] underline underline-offset-2"
              >
                Continuar comprando
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Ícone do carrinho com a quantidade, para o header. */
export function CartButton({ className }: { className: string }) {
  const count = cartCount(useCart());
  return (
    <button
      type="button"
      aria-label={count ? `Carrinho com ${count} ${count === 1 ? "item" : "itens"}` : "Carrinho"}
      className={`${className} relative`}
      onClick={() => setCartOpen(true)}
    >
      <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--lime)] px-1 text-[10px] font-extrabold text-[var(--on-lime)]">
          {count}
        </span>
      )}
    </button>
  );
}
