/** Sessão do Pix compartilhada entre /checkout e /pedido/$id (client-side). */
export type PixSession = {
  id: string;
  qrcode: string;
  /** Valor em centavos. */
  amount: number;
  email: string;
  name: string;
  bundleId: string;
  bundleName: string;
  /** Unidades do produto principal nesta cobrança (0 = só seguro/frete). */
  units: number;
  productPrice: number;
  /** Order bumps aceitos no checkout (valor em reais). */
  bumps?: { name: string; price: number }[];
  /** Formato antigo (um só bump). */
  bump?: { name: string; price: number };
  /** Upsell pós-compra: id do pedido original. */
  isUpsell?: boolean;
  parentId?: string;
  /** Upsell: o que foi comprado nesta cobrança (1 pacote de pilhas, kit/seguro, ou só "expresso"). */
  upsellItems?: string[];
  /** Pedido principal: cobranças pós-compra já pagas (pilhas, ofertas e envio expresso). */
  bateriasId?: string;
  upsellId?: string;
  expressId?: string;
  frete: number;
  discount: number;
  createdAt: number;
  phone?: string;
  cpf?: string;
  utm?: Record<string, string | null>;
  fbp?: string | null;
  fbc?: string | null;
  /** Pedido pago no cartão (sem código Pix). */
  method?: "pix" | "card";
  installments?: number;
  /** Token do cartão gerado pela HyperCash (expira em ~15 min). Só nesta aba, nunca no banco. */
  cardHash?: string;
  /** A tela /pedido já viu o pagamento (eventos de compra disparados uma vez só). */
  paidSeen?: boolean;
};

const key = (id: string) => `pix:${id}`;

/**
 * Cópia no localStorage: o navegador do Instagram costuma recarregar a página (ou abrir outra aba)
 * quando o cliente volta do app do banco, e o sessionStorage some — sem ela o cliente pulava o
 * pós-compra. Vai sem o token do cartão, CPF e telefone (esses ficam só na aba) e expira em 48 h.
 */
const KEEP_MS = 48 * 60 * 60 * 1000;
type Kept = PixSession & { savedAt?: number };

function keep(s: PixSession) {
  const { cardHash: _card, cpf: _cpf, phone: _phone, ...rest } = s;
  localStorage.setItem(key(s.id), JSON.stringify({ ...rest, savedAt: Date.now() }));
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k?.startsWith("pix:")) continue;
    try {
      const old = JSON.parse(localStorage.getItem(k) || "null") as Kept | null;
      if (!old || Date.now() - (old.savedAt ?? old.createdAt ?? 0) > KEEP_MS)
        localStorage.removeItem(k);
    } catch {
      localStorage.removeItem(k);
    }
  }
}

function kept(id: string): PixSession | null {
  const raw = localStorage.getItem(key(id));
  if (!raw) return null;
  const s = JSON.parse(raw) as Kept;
  if (Date.now() - (s.savedAt ?? s.createdAt ?? 0) > KEEP_MS) {
    localStorage.removeItem(key(id));
    return null;
  }
  return s;
}

export function savePixSession(s: PixSession): void {
  try {
    sessionStorage.setItem(key(s.id), JSON.stringify(s));
  } catch {
    // storage indisponível — a tela /pedido cai no fallback
  }
  try {
    keep(s);
  } catch {
    // localStorage cheio ou bloqueado: segue só com a aba
  }
}

export function loadPixSession(id: string): PixSession | null {
  try {
    const raw = sessionStorage.getItem(key(id));
    if (raw) return JSON.parse(raw) as PixSession;
  } catch {
    // segue para a cópia
  }
  try {
    return kept(id);
  } catch {
    return null;
  }
}

/** Cobranças geradas há pouco cujo pagamento a tela /pedido ainda não viu (mais recentes primeiro). */
export function pendingPixIds(maxAgeMs: number): string[] {
  const out: { id: string; at: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith("pix:")) continue;
      const s = kept(k.slice(4));
      if (s && !s.paidSeen && Date.now() - s.createdAt < maxAgeMs)
        out.push({ id: s.id, at: s.createdAt });
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.at - a.at).map((x) => x.id);
}
