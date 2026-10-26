import { useSyncExternalStore } from "react";
import {
  getBundle,
  parseBundleId,
  parseVariant,
  priceOf,
  productLabel,
  variantLabel,
  type Bundle,
  type BundleId,
} from "@/lib/bundles";

/**
 * Carrinho da loja, salvo no navegador (localStorage). O checkout recebe os itens pela URL e o
 * servidor recalcula todos os preços pelo catálogo — o carrinho só guarda escolhas.
 */
export type CartItem = { plano: BundleId; variante?: string | undefined; qtd: number };
export type Cart = { items: CartItem[] };

export const MAX_QTD = 10;
const MAX_ITENS = 20;
const KEY = "loja-carrinho";
const CHECKOUT_FLAG = "loja-carrinho-checkout";
const EMPTY: Cart = { items: [] };

let state: Cart = EMPTY;
let loaded = false;
let open = false;
const listeners = new Set<() => void>();

const validItem = (i: unknown): i is CartItem => {
  const it = i as CartItem;
  const id = parseBundleId(it?.plano);
  return (
    !!id &&
    Number.isInteger(it.qtd) &&
    it.qtd >= 1 &&
    it.qtd <= MAX_QTD &&
    !!parseVariant(getBundle(id), it.variante)
  );
};

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<Cart> | null;
    const items = Array.isArray(raw?.items) ? raw.items.filter(validItem).slice(0, MAX_ITENS) : [];
    state = { items };
  } catch {
    state = EMPTY;
  }
}

function commit(next: Cart) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Sem armazenamento (aba anônima etc.): o carrinho vale só nesta página.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

const snapshot = () => {
  load();
  return state;
};

/** Carrinho atual (vazio na renderização do servidor). */
export const useCart = () => useSyncExternalStore(subscribe, snapshot, () => EMPTY);

/** Gaveta do carrinho aberta ou fechada. */
export const useCartOpen = () =>
  useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
export function setCartOpen(v: boolean) {
  open = v;
  listeners.forEach((l) => l());
}

export function addToCart(item: { plano: BundleId; variante?: string | undefined }, qtd = 1) {
  load();
  const items = [...state.items];
  const same = items.findIndex((i) => i.plano === item.plano && i.variante === item.variante);
  if (same >= 0) {
    const cur = items[same]!;
    items[same] = { ...cur, qtd: Math.min(MAX_QTD, cur.qtd + qtd) };
  } else if (items.length < MAX_ITENS) {
    items.push({ ...item, qtd: Math.min(MAX_QTD, qtd) });
  }
  commit({ ...state, items });
}

export function setItemQty(index: number, qtd: number) {
  load();
  const items = state.items
    .map((it, i) => (i === index ? { ...it, qtd: Math.min(MAX_QTD, qtd) } : it))
    .filter((it) => it.qtd > 0);
  commit({ ...state, items });
}

export const removeItem = (index: number) => setItemQty(index, 0);

export const clearCart = () => commit(EMPTY);

export type CartLine = {
  key: string;
  bundle: Bundle;
  title: string;
  detail: string;
  qtd: number;
  price: number;
};

/** Linhas para exibir (nome, opções, quantidade e preço da variação escolhida). */
export function cartLines(items: readonly CartItem[]): CartLine[] {
  return items.map((it, i) => {
    const bundle = getBundle(it.plano);
    const values = parseVariant(bundle, it.variante) ?? [];
    return {
      key: `${it.plano}-${it.variante ?? ""}-${i}`,
      bundle,
      title: bundle.checkoutProductName,
      detail: values.length ? variantLabel(values, bundle) : "",
      qtd: it.qtd,
      price: Math.round(priceOf(bundle, values) * it.qtd * 100) / 100,
    };
  });
}

export const cartCount = (c: Cart) => c.items.reduce((s, i) => s + i.qtd, 0);

export const cartSubtotal = (c: Cart) =>
  Math.round(cartLines(c.items).reduce((s, l) => s + l.price, 0) * 100) / 100;

/** Nome do item no pedido ("2x Produto - opções"). */
export const cartItemName = (it: CartItem) => {
  const bundle = getBundle(it.plano);
  const label = productLabel(bundle, parseVariant(bundle, it.variante) ?? []);
  return it.qtd > 1 ? `${it.qtd}x ${label}` : label;
};

/**
 * URL do checkout: o 1º produto vai como plano principal (como no "Comprar agora") e o resto
 * como itens extras.
 */
export function checkoutSearch(c: Cart) {
  const [first, ...rest] = c.items;
  if (!first) return null;
  const itens = [...(first.qtd > 1 ? [{ ...first, qtd: first.qtd - 1 }] : []), ...rest];
  return {
    plano: first.plano,
    ...(first.variante ? { variante: first.variante } : {}),
    ...(itens.length ? { itens } : {}),
  };
}

/** Marca que o checkout veio do carrinho (para esvaziar depois da compra). */
export function markCartCheckout(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(CHECKOUT_FLAG, "1");
    else window.sessionStorage.removeItem(CHECKOUT_FLAG);
  } catch {
    // ignore
  }
}

/** Depois da compra: esvazia o carrinho se o checkout veio dele. */
export function clearCartAfterPurchase() {
  try {
    if (window.sessionStorage.getItem(CHECKOUT_FLAG) !== "1") return;
    window.sessionStorage.removeItem(CHECKOUT_FLAG);
  } catch {
    return;
  }
  clearCart();
}
