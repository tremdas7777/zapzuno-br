import { brand } from "@/lib/brand";
import { FREE_SHIPPING_LABEL } from "@/lib/bundles";
import { KIT_HANDLE, KITS, KITS_OPTION, kitLabel, kitsDe } from "@/lib/catalog-data";

export { KIT_HANDLE, KITS, KITS_OPTION, kitLabel, kitsDe };

/** Quantidade de kits mais vendida (vem marcada na página do produto). */
export const KITS_PADRAO = 2;

/** O que vem em cada kit (multiplica pela quantidade escolhida). */
export const NA_CAIXA = [
  { n: 1, item: "Projetor de alvos", nota: "Placar digital e 2 modos de jogo (L1 e L2)" },
  { n: 2, item: "Pistolas de laser tag", nota: "Vermelha e azul, com luz e som" },
  { n: 4, item: "Cartões de alvo", nota: "Tubarão, dinossauro, pinguim e robô" },
] as const;

/** Pilhas por kit: 3 AAA em cada pistola (2 pistolas) + 2 AA no projetor. */
export const pilhasDoKit = (kits: number) => ({ aaa: kits * 6, aa: kits * 2 });

export const ALVOS = [
  { id: "tubarao", name: "Tubarão" },
  { id: "dino", name: "Dinossauro" },
  { id: "pinguim", name: "Pinguim" },
  { id: "robo", name: "Robô" },
] as const;

/** Os 4 modos de tiro da pistola (troca no botão de modo de tiro). */
export const MODOS_TIRO = ["Pistola", "Metralhadora", "Arma Laser", "Canhão de Plasma"] as const;

export const JEITOS = [
  { n: "01", name: "Solo", text: "Uma pessoa contra o projetor, subindo de nível no L1." },
  { n: "02", name: "Em equipe", text: "Dois jogadores do mesmo lado, mirando nos mesmos alvos." },
  { n: "03", name: "Um contra um", text: "Cada um com sua pistola. Quem acertar primeiro leva o ponto." },
] as const;

/** Perguntas da página do produto e de /faq. */
export const FAQ_KIT: readonly { q: string; a: string }[] = [
  {
    q: "O que vem em cada kit?",
    a: "Cada kit traz 1 projetor de alvos, 2 pistolas de laser tag e 4 cartões de alvo (tubarão, dinossauro, pinguim e robô). Com 2 kits, 4 pessoas jogam ao mesmo tempo; com 3 kits, 6.",
  },
  {
    q: "Para qual idade é?",
    a: "A partir de 5 anos, com supervisão de um adulto. Por volta dos 7 anos a criança já comanda o jogo sozinha.",
  },
  {
    q: "É seguro? O que a pistola dispara?",
    a: "Luz infravermelha. Não sai nada da pistola: sem dardo, sem bolinha, nada para catar do chão. Mire na parede, não nas pessoas.",
  },
  {
    q: "Precisa de quarto escuro?",
    a: "Sim. Com a luz acesa a projeção fica fraca. Qualquer parede lisa e clara serve, sem precisar colar nada.",
  },
  {
    q: "Quais pilhas preciso?",
    a: "Cada pistola usa 3 pilhas AAA e o projetor usa 2 pilhas AA: são 6 AAA + 2 AA por kit. As pilhas não vêm no kit; se for presente, vale já levar.",
  },
  {
    q: "Quantas pessoas jogam?",
    a: "Um kit é para 2 jogadores. Com 2 kits, 4 pessoas jogam na mesma projeção. Com 3 kits, a turma toda entra na brincadeira.",
  },
  {
    q: "O que são L1 e L2?",
    a: "São os modos do projetor. L1 é o desafio de níveis: 10 níveis, cada um mais difícil. L2 é o modo competição, em que vence quem fizer mais pontos. O placar digital mostra o nível ou os pontos.",
  },
  {
    q: "Qual o tamanho do projetor?",
    a: "17,5 × 16 × 11,8 cm. Cabe em cima de uma mesa, rack ou cômoda.",
  },
  {
    q: "Quando meu pedido chega?",
    a: `${FREE_SHIPPING_LABEL}. O prazo médio é de ${brand.prazoEntrega} depois da confirmação do pagamento. Você recebe o código de rastreio quando o pedido sai. O prazo é uma estimativa, não uma data garantida.`,
  },
  {
    q: "Como funciona a garantia?",
    a: `Você tem ${brand.garantiaDias} dias a partir da entrega para pedir a devolução do dinheiro. Fale com a gente dentro desse prazo para começar. As regras completas estão na página de garantia e devoluções.`,
  },
];

/** As 4 primeiras, para a home. */
export const FAQ_HOME = [FAQ_KIT[0]!, FAQ_KIT[1]!, FAQ_KIT[3]!, FAQ_KIT[8]!];
