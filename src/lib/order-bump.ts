import { brand } from "@/lib/brand";

/**
 * Order bumps do checkout ("leve junto"): itens SEM variação (não pedem tamanho/cor), como
 * meias, cuecas em kit fechado ou acessórios. Preços usados no servidor — o cliente só exibe.
 *
 * Lista vazia = o checkout não mostra a oferta. Exemplo de item:
 * {
 *   id: "meias3",
 *   name: "Kit 3 pares de meias",
 *   fullName: "Kit 3 pares de meias cano médio",
 *   gatewayName: `${brand.gatewayName} Meias`,
 *   price: 29.9,
 *   compareAt: 49.9,
 *   img: "/produtos/meias.webp",
 *   question: "Que tal levar as meias junto?",
 *   body: "Três pares de meias cano médio, no mesmo pacote do seu pedido.",
 *   benefits: ["3 pares", "Vai na mesma caixa, sem frete extra"],
 *   cta: "Sim! Quero as meias por +",
 * }
 */
export type BumpId = string;

export type OrderBumpItem = {
  id: BumpId;
  name: string;
  fullName: string;
  /** Nome genérico enviado ao gateway (fatura). */
  gatewayName: string;
  price: number;
  /** Preço "de" (riscado). Sem ele, a oferta mostra só o preço. */
  compareAt?: number;
  img: string;
  /** Texto de venda da oferta. */
  question: string;
  body: string;
  benefits: readonly string[];
  /** Texto do botão; o preço vai no fim ("Sim! Quero por + R$ 29,90"). */
  cta: string;
  /** Linha abaixo do preço. Sem ela: "Vai na mesma caixa do seu pedido — sem frete extra." */
  note?: string;
};

export const ORDER_BUMPS: readonly OrderBumpItem[] = [
  {
    id: "presente",
    name: "Embrulho de presente",
    fullName: "Embrulho de presente com cartão",
    gatewayName: `${brand.gatewayName} Embrulho`,
    price: 9.9,
    img: "/produtos/embrulho-presente.webp",
    question: "Vai dar de presente? A gente embrulha pra você!",
    body: "Seu kit chega embrulhado em papel de presente, com laço e um cartãozinho para a dedicatória. É só entregar.",
    benefits: [
      "Papel de presente e laço",
      "Cartão para escrever a dedicatória",
      "Chega pronto para entregar",
    ],
    cta: "Sim! Quero embrulhado para presente por +",
    note: "Seu pedido chega embrulhado — sem frete extra.",
  },
];

/** Nome da loja na fatura dos bumps (use em `gatewayName`). */
export const BUMP_GATEWAY_PREFIX = brand.gatewayName;

/** Bumps escolhidos, na ordem do checkout (ids repetidos ou desconhecidos são ignorados). */
export const getBumps = (ids: readonly string[]) => ORDER_BUMPS.filter((b) => ids.includes(b.id));

/** Soma dos bumps escolhidos, em reais. */
export const bumpsTotal = (ids: readonly string[]) =>
  Math.round(getBumps(ids).reduce((s, b) => s + b.price * 100, 0)) / 100;
