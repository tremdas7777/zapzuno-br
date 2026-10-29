export type Review = {
  name: string;
  rating: 5;
  text: string;
};

export const REVIEWS: readonly Review[] = [
  {
    name: "Mariana S.",
    rating: 5,
    text: "Comprei para presentear meu filho e achei a proposta muito legal. Ele adorou brincar com o pai e se divertiu bastante!",
  },
  {
    name: "Rafael M.",
    rating: 5,
    text: "Uma ideia diferente dos brinquedos de sempre. Aqui em casa virou uma competição para ver quem faz mais pontos.",
  },
  {
    name: "Camila R.",
    rating: 5,
    text: "Estava procurando um presente diferente para aniversário e gostei bastante da ideia. É uma brincadeira para a família toda.",
  },
  {
    name: "Diego A.",
    rating: 5,
    text: "O melhor é poder brincar junto com as crianças. A gente apaga a luz, prepara a parede e começa a disputa.",
  },
];
