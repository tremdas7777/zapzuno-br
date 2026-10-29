/**
 * Artigos do Diário de Jogo (/diario/<slug>): textos pensados para o que as pessoas pesquisam no
 * Google (laser tag com projetor, brincadeiras sem tela, presente, festa, segurança). Cada um vira
 * uma página própria e entra no sitemap. Os fatos do kit vêm de src/lib/laser.ts: não prometa nada
 * que não esteja lá (alcance, duração das pilhas, certificações).
 */

export type Secao = {
  h2: string;
  paragrafos?: readonly string[];
  /** Itens com título em negrito e texto. */
  itens?: readonly { t: string; d: string }[];
  /** Lista simples. */
  lista?: readonly string[];
  numerada?: boolean;
};

export type Artigo = {
  slug: string;
  tag: string;
  leitura: string;
  /** Título da página (H1). */
  title: string;
  /** Título que aparece no Google (sem o nome da loja). */
  seoTitle: string;
  description: string;
  intro: string;
  img: string;
  imgAlt: string;
  imgW: number;
  imgH: number;
  /** Data de publicação (AAAA-MM-DD). */
  publicado: string;
  secoes: readonly Secao[];
  faq?: readonly { q: string; a: string }[];
};

export const ARTIGOS: readonly Artigo[] = [
  {
    slug: "laser-tag-com-projetor-como-funciona",
    tag: "Como jogar",
    leitura: "5 min de leitura",
    title: "Laser tag com projetor: como funciona e como jogar em casa",
    seoTitle: "Laser tag com projetor: como funciona e como jogar",
    description:
      "Entenda o laser tag com projetor: os alvos aparecem na parede, as pistolas de luz infravermelha acertam e o placar conta os pontos. Veja como montar, os modos L1 e L2 e 3 jeitos de jogar.",
    intro:
      "No laser tag com projetor, ninguém mira em ninguém. O projetor joga os alvos na parede, as pistolas disparam luz infravermelha e o placar digital conta quem acertou. É um jogo de pontaria para a sala de casa, que começa em dois minutos e não deixa nada espalhado pelo chão.",
    img: "/fotos/jogando-limpa.webp",
    imgAlt:
      "Duas pistolas de laser tag, uma vermelha e uma azul, mirando nos alvos de tubarão, dinossauro, pinguim e robô projetados na parede da sala",
    imgW: 1254,
    imgH: 859,
    publicado: "2026-10-28",
    secoes: [
      {
        h2: "O que vem na caixa",
        itens: [
          {
            t: "1 projetor de alvos",
            d: "Fica em cima de uma mesa, rack ou cômoda (17,5 × 16 × 11,8 cm). Tem placar digital e 2 modos de jogo, L1 e L2.",
          },
          {
            t: "2 pistolas de laser tag",
            d: "Uma vermelha e uma azul, com luz, som e 4 modos de tiro: pistola, metralhadora, arma laser e canhão de plasma.",
          },
          {
            t: "4 cartões de alvo",
            d: "Tubarão, dinossauro, pinguim e robô. Cada cartão muda o personagem que aparece na parede.",
          },
        ],
      },
      {
        h2: "Como montar em 5 passos",
        numerada: true,
        itens: [
          {
            t: "Coloque as pilhas",
            d: "Cada pistola usa 3 pilhas AAA e o projetor usa 2 pilhas AA: 6 AAA + 2 AA por kit. Elas não vêm na caixa, então deixe separadas antes de abrir o presente.",
          },
          {
            t: "Escolha a parede",
            d: "Uma parede lisa e clara funciona melhor. Não precisa colar nem pendurar nada: a projeção sai e volta sem deixar marca.",
          },
          {
            t: "Apague a luz",
            d: "O jogo é feito para o escuro. Com a luz acesa a projeção fica fraca. Fechar a cortina já ajuda bastante durante o dia.",
          },
          {
            t: "Encaixe um cartão de alvo",
            d: "Comece pelo personagem preferido da criança. Trocar de cartão entre as rodadas deixa o jogo com cara de fase nova.",
          },
          {
            t: "Ligue e escolha o modo",
            d: "L1 para o desafio de níveis, L2 para a competição. O placar mostra o nível ou os pontos de cada rodada.",
          },
        ],
      },
      {
        h2: "Os modos do projetor: L1 e L2",
        paragrafos: [
          "O L1 é o desafio de níveis. São 10 níveis, e cada um fica mais difícil que o anterior. É o modo de quem quer treinar a pontaria sozinho ou bater o próprio recorde.",
          "O L2 é a competição. Vence quem fizer mais pontos na rodada. É o modo das revanches em família: pai contra filho, irmão contra irmã, campeonato com a turma toda.",
        ],
      },
      {
        h2: "3 jeitos de jogar",
        itens: [
          {
            t: "Solo",
            d: "Uma pessoa contra o projetor, subindo de nível no L1. Bom para a criança treinar antes de desafiar os adultos.",
          },
          {
            t: "Em equipe",
            d: "Dois jogadores do mesmo lado, mirando nos mesmos alvos. Ótimo para quem tem filhos de idades diferentes jogarem juntos.",
          },
          {
            t: "Um contra um",
            d: "Cada um com sua pistola. Quem acertar primeiro leva o ponto. Com 2 kits, 4 pessoas jogam na mesma projeção; com 3 kits, 6.",
          },
        ],
      },
      {
        h2: "Dicas para a partida render",
        lista: [
          "Combine antes que a pistola mira só na parede, nunca nas pessoas.",
          "Faça rodadas curtas e troque quem joga: ninguém fica muito tempo esperando.",
          "Anote os recordes do L1 num papel na geladeira. A revanche vem sozinha.",
          "Guarde pistolas, projetor e cartões na própria caixa para não perder nenhum alvo.",
        ],
      },
    ],
    faq: [
      {
        q: "Precisa de quarto escuro para jogar?",
        a: "Sim. Com a luz acesa a projeção fica fraca. À noite ou com a cortina fechada o jogo funciona bem em qualquer parede lisa e clara.",
      },
      {
        q: "A pistola funciona sem o projetor?",
        a: "O jogo é feito para pistola e projetor juntos: é o projetor que mostra os alvos e conta os pontos no placar.",
      },
      {
        q: "Quantas pessoas jogam ao mesmo tempo?",
        a: "Um kit vem com 2 pistolas, para 2 jogadores. Com 2 kits jogam 4 pessoas na mesma projeção; com 3 kits, 6.",
      },
    ],
  },
  {
    slug: "brincadeiras-para-tirar-as-criancas-das-telas",
    tag: "Família",
    leitura: "7 min de leitura",
    title: "15 brincadeiras em casa para tirar as crianças das telas",
    seoTitle: "15 brincadeiras em casa para tirar as crianças das telas",
    description:
      "Ideias de brincadeiras para fazer em casa com as crianças, sem celular nem TV: jogos de movimento, de mesa, de pontaria e de imaginação, com o que você já tem em casa.",
    intro:
      "Proibir a tela quase nunca funciona. O que funciona é ter algo mais divertido para fazer no lugar, de preferência com um adulto junto. Separamos 15 brincadeiras que cabem na rotina de casa, a maioria sem comprar nada, para usar nas noites de semana, nos fins de semana chuvosos e nas férias.",
    img: "/fotos/fliperama-limpa.webp",
    imgAlt: "Projetor de laser tag na mesa da sala com alvos de personagens projetados na parede escura",
    imgW: 1254,
    imgH: 1254,
    publicado: "2026-10-28",
    secoes: [
      {
        h2: "Antes de começar: troque, não proíba",
        paragrafos: [
          "Criança que perde a tela sem ganhar nada em troca vai pedir a tela de volta em cinco minutos. Por isso, combine o horário da brincadeira com antecedência, como um compromisso da família, e participe pelo menos no começo. Quinze minutos de um adulto jogando junto valem mais do que uma hora de brinquedo esquecido no quarto.",
        ],
      },
      {
        h2: "Para gastar energia",
        numerada: true,
        itens: [
          {
            t: "Circuito na sala",
            d: "Almofadas para pular, cadeira para contornar, fita no chão para andar em linha reta. Cronometre e desafie a criança a bater o próprio tempo.",
          },
          {
            t: "Estátua com música",
            d: "Música tocando, todo mundo dança. Música parou, todo mundo congela. Quem se mexer paga uma prenda.",
          },
          {
            t: "Caça ao tesouro",
            d: "Esconda um objeto e deixe pistas em bilhetes pela casa. Para os menores, use desenhos no lugar das palavras.",
          },
          {
            t: "Boliche de garrafa PET",
            d: "Seis garrafas com um pouco de água e uma bola. Cada rodada, a criança anota os pontos.",
          },
        ],
      },
      {
        h2: "Para treinar a pontaria",
        numerada: true,
        itens: [
          {
            t: "Bola de meia no balde",
            d: "Meias enroladas viram bolas. Afaste o balde um passo a cada acerto.",
          },
          {
            t: "Tiro ao alvo de papel",
            d: "Desenhe alvos numa caixa de papelão, recorte buracos de tamanhos diferentes e dê pontos para cada um.",
          },
          {
            t: "Laser tag com projetor",
            d: "Com a luz apagada, o projetor mostra os alvos na parede e o placar conta os pontos. É a brincadeira que mais lembra um videogame, só que com todo mundo de pé, na mesma sala.",
          },
        ],
      },
      {
        h2: "Para a mesa da cozinha",
        numerada: true,
        itens: [
          {
            t: "Jogo da memória feito em casa",
            d: "Cartões de papel com desenhos feitos pela própria criança. Fazer o jogo já é metade da brincadeira.",
          },
          {
            t: "Stop (adedonha)",
            d: "Uma letra sorteada e categorias como nome, animal, fruta e cor. Ótimo para crianças que já escrevem.",
          },
          {
            t: "Massinha caseira",
            d: "Farinha, sal, água e corante. Depois, um desafio: quem faz o bicho mais parecido em dois minutos.",
          },
          {
            t: "Quebra-cabeça em dupla",
            d: "Um adulto e uma criança, um quebra-cabeça e um prazo combinado. Funciona bem antes de dormir.",
          },
        ],
      },
      {
        h2: "Para a imaginação",
        numerada: true,
        itens: [
          {
            t: "Cabana de lençol",
            d: "Cadeiras, lençol e lanterna. Vira castelo, nave ou acampamento, e rende a tarde toda.",
          },
          {
            t: "Teatro de sombras",
            d: "Uma lanterna, uma parede clara e as mãos. Cada um inventa um bicho e conta uma história com ele.",
          },
          {
            t: "Restaurante de mentira",
            d: "A criança anota os pedidos, monta o cardápio e serve a família. Dá para usar o lanche de verdade.",
          },
          {
            t: "Rádio da família",
            d: "Grave com o celular um programa de rádio inventado pelas crianças, com notícia, música e propaganda. A tela vira ferramenta, não passatempo.",
          },
        ],
      },
      {
        h2: "Como fazer virar hábito",
        lista: [
          "Escolha um dia fixo na semana para a noite de jogo da família.",
          "Deixe a criança escolher a brincadeira da vez.",
          "Tenha um placar ou recorde para bater: a vontade de revanche traz todo mundo de volta.",
          "Guarde os jogos à vista e fáceis de pegar, não no alto do armário.",
        ],
      },
    ],
    faq: [
      {
        q: "Quanto tempo de tela é recomendado para criança?",
        a: "As orientações de pediatria costumam recomendar limites menores quanto menor a criança, e sempre com conteúdo acompanhado por um adulto. Converse com o pediatra para definir o que faz sentido na sua casa.",
      },
      {
        q: "Qual brincadeira funciona com crianças de idades diferentes?",
        a: "As de pontaria e de equipe: caça ao tesouro, boliche de garrafa e laser tag com projetor no modo em equipe, em que o mais velho e o mais novo jogam do mesmo lado.",
      },
    ],
  },
  {
    slug: "presente-de-natal-para-crianca-que-tira-da-tela",
    tag: "Presentes",
    leitura: "5 min de leitura",
    title: "Presente de Natal para criança de 5 a 10 anos que tira da tela",
    seoTitle: "Presente de Natal para criança de 5 a 10 anos sem tela",
    description:
      "Como escolher um presente de Natal para criança de 5 a 10 anos que dure além da ceia: o que conferir antes de comprar e por que jogos para brincar em família fazem sucesso.",
    intro:
      "Todo ano tem aquele presente que vira assunto na noite de Natal e some no armário em janeiro. Para a criança de 5 a 10 anos, o que costuma durar é o que dá para brincar junto com alguém, de novo e de novo. Este guia ajuda a escolher sem errar e a chegar no dia 25 com tudo pronto para usar.",
    img: "/fotos/kit-limpa.webp",
    imgAlt: "Kit de laser tag com projetor, pistolas vermelha e azul e quatro cartões de alvo de personagens",
    imgW: 1254,
    imgH: 1254,
    publicado: "2026-10-28",
    secoes: [
      {
        h2: "O que faz um presente durar além da ceia",
        itens: [
          {
            t: "Dá para brincar com outra pessoa",
            d: "Brinquedo que chama o pai, a mãe, o primo ou o irmão para jogar junto sai da caixa mais vezes do que o brinquedo de uma pessoa só.",
          },
          {
            t: "Tem desafio que cresce",
            d: "Níveis, recordes e placar fazem a criança querer jogar de novo para melhorar. Sem isso, a graça acaba no primeiro dia.",
          },
          {
            t: "Funciona dentro de casa",
            d: "Dezembro e janeiro têm chuva em boa parte do Brasil. Presente que funciona na sala salva as férias.",
          },
        ],
      },
      {
        h2: "Checklist antes de comprar",
        lista: [
          "A idade indicada na embalagem bate com a idade da criança?",
          "Precisa de pilha? Quais e quantas? Compre junto, ou o presente fica parado na noite de Natal.",
          "Quantas pessoas brincam ao mesmo tempo? Pense em irmãos e primos que vão estar na casa.",
          "Precisa de espaço grande, de quintal ou de algum outro aparelho para funcionar?",
          "O prazo de entrega chega antes do dia 24? Compre com folga, porque dezembro atrasa entregas.",
        ],
      },
      {
        h2: "Ideias por idade",
        itens: [
          {
            t: "5 e 6 anos",
            d: "Jogos de regra simples, com resultado imediato: acertou, ganhou ponto. Um adulto ainda ajuda a montar e a combinar as regras.",
          },
          {
            t: "7 e 8 anos",
            d: "A criança já comanda o jogo sozinha e gosta de desafio com níveis e recordes. É a idade em que o placar faz diferença.",
          },
          {
            t: "9 e 10 anos",
            d: "Competição com os adultos e com os amigos. Presentes que dão para jogar em grupo viram o programa da festa do pijama.",
          },
        ],
      },
      {
        h2: "Por que o laser tag com projetor entra nessa lista",
        paragrafos: [
          "O projetor mostra os alvos na parede (tubarão, dinossauro, pinguim e robô) e as pistolas disparam luz infravermelha, sem bolinha nem dardo para catar do chão. Tem desafio de 10 níveis para jogar sozinho e modo competição para jogar contra alguém, com placar digital.",
          "É indicado a partir de 5 anos, com supervisão de um adulto. Cada kit é para 2 jogadores; para irmãos ou primos, 2 kits deixam 4 pessoas jogarem ao mesmo tempo. Cada kit usa 6 pilhas AAA e 2 AA, que não vêm na caixa: compre junto para a criança jogar na hora.",
        ],
      },
      {
        h2: "Para o presente chegar pronto no dia 25",
        lista: [
          "Compre até o começo de dezembro para ter folga no prazo de entrega.",
          "Separe as pilhas e um saco de presente do tamanho da caixa.",
          "Teste antes de embrulhar, num cômodo escuro, sem a criança ver.",
          "Escolha a parede da brincadeira antes da ceia: depois da troca de presentes, ninguém quer esperar.",
        ],
      },
    ],
    faq: [
      {
        q: "Qual presente de Natal para criança de 7 anos que goste de videogame?",
        a: "Jogos com placar, níveis e pontaria lembram o videogame, mas tiram a criança do sofá. O laser tag com projetor é um exemplo: alvos na parede, pontos no placar e revanche contra os adultos.",
      },
      {
        q: "Até quando comprar para chegar antes do Natal?",
        a: "O prazo médio de entrega é de 7 a 10 dias úteis depois da confirmação do pagamento. Para o Natal, o ideal é comprar até o começo de dezembro.",
      },
    ],
  },
  {
    slug: "festa-do-pijama-e-aniversario-com-laser-tag",
    tag: "Festas",
    leitura: "5 min de leitura",
    title: "Festa do pijama ou aniversário com laser tag em casa: roteiro de 2 horas",
    seoTitle: "Festa do pijama com laser tag em casa: roteiro de 2 horas",
    description:
      "Roteiro de festa do pijama ou aniversário em casa com laser tag de projetor: preparação, campeonato com chaves, prêmios simples e como manter a criançada animada por 2 horas.",
    intro:
      "Festa em casa não precisa de salão nem de animador. Com um cômodo escuro, um projetor de alvos e um campeonato bem organizado, a criançada passa duas horas disputando ponto a ponto. O roteiro abaixo serve para festas do pijama e aniversários pequenos, de 4 a 8 crianças.",
    img: "/fotos/alvos-limpa.webp",
    imgAlt: "Pistolas de laser tag azul e vermelha ao lado do projetor, com os quatro personagens de alvo",
    imgW: 1254,
    imgH: 1055,
    publicado: "2026-10-28",
    secoes: [
      {
        h2: "Antes da festa",
        lista: [
          "Escolha o cômodo que dá para escurecer e uma parede lisa e clara.",
          "Tire do caminho o que quebra e deixe o chão livre de fios e brinquedos.",
          "Coloque pilhas novas e tenha um jogo extra separado.",
          "Imprima ou desenhe uma tabela do campeonato com o nome de cada criança.",
          "Separe prêmios simples: medalha de papel, adesivo, escolher o sabor da pizza.",
        ],
      },
      {
        h2: "O roteiro, hora a hora",
        numerada: true,
        itens: [
          {
            t: "Chegada e treino (20 min)",
            d: "Cada criança faz uma rodada no L1, o desafio de níveis, para pegar o jeito da pistola. Ninguém é eliminado no treino.",
          },
          {
            t: "Campeonato em duplas (40 min)",
            d: "No L2, o modo competição, as crianças jogam de duas em duas. Quem fizer mais pontos avança na tabela. Troque o cartão de alvo a cada fase: tubarão, dinossauro, pinguim e robô.",
          },
          {
            t: "Lanche e pausa (20 min)",
            d: "Luz acesa, comida na mesa e a tabela pendurada na parede para todo mundo ver quem está na final.",
          },
          {
            t: "Final e revanches (30 min)",
            d: "A final com plateia, depois rodadas livres. É a hora dos adultos desafiarem o campeão.",
          },
          {
            t: "Encerramento (10 min)",
            d: "Entrega das medalhas e foto do campeonato. Para festa do pijama, apague a luz de vez e emende numa história.",
          },
        ],
      },
      {
        h2: "Para ninguém ficar parado esperando",
        paragrafos: [
          "Um kit é para 2 jogadores ao mesmo tempo. Com mais de 4 crianças, a fila de espera cresce e a festa esfria. Com 2 kits, 4 crianças jogam na mesma projeção, e com 3 kits, 6. Outra saída é montar uma segunda estação de brincadeira (desenho, massinha, cabana de lençol) para quem está esperando a vez.",
        ],
      },
      {
        h2: "Regras da casa",
        itens: [
          {
            t: "Mira só na parede",
            d: "A pistola aponta para os alvos projetados, nunca para o rosto de ninguém.",
          },
          {
            t: "Palavra de pausa",
            d: "Quando alguém disser pausa, todo mundo para. Serve para quem tropeçou e para a pizza que chegou.",
          },
          {
            t: "Placar é placar",
            d: "Quem decide o ponto é o projetor, não a discussão. Isso evita a maior parte das brigas.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quantas crianças cabem numa festa com laser tag em casa?",
        a: "Com 1 kit, até 4 crianças se revezando funciona bem. Para 6 a 8 crianças, 2 ou 3 kits deixam a fila curta.",
      },
      {
        q: "Precisa de muito espaço?",
        a: "Não. O jogo é de pontaria, não de correr: basta uma parede livre, um cômodo que escureça e um lugar para o projetor ficar apoiado.",
      },
    ],
  },
  {
    slug: "laser-tag-infantil-e-seguro",
    tag: "Segurança",
    leitura: "4 min de leitura",
    title: "Laser tag infantil é seguro? O que a pistola dispara e a partir de que idade",
    seoTitle: "Laser tag infantil é seguro? Idade e como funciona",
    description:
      "Como funciona o laser tag infantil com projetor, o que a pistola dispara, a partir de que idade a criança pode jogar e os cuidados com pilhas e espaço.",
    intro:
      "A palavra laser assusta muita gente na hora de comprar um brinquedo. No laser tag com projetor, a pistola funciona como um controle remoto de TV: envia um sinal de luz infravermelha para o projetor saber onde ela mirou. Não sai nenhum objeto da pistola. Mesmo assim, alguns cuidados deixam a brincadeira tranquila para a família toda.",
    img: "/produtos/pistola.webp",
    imgAlt: "Pistola de laser tag com botões, visor e luz azul",
    imgW: 1200,
    imgH: 1200,
    publicado: "2026-10-28",
    secoes: [
      {
        h2: "O que a pistola dispara",
        paragrafos: [
          "Luz infravermelha, a mesma tecnologia de um controle remoto. Não há dardo, bolinha de gel, espuma nem água. Não há nada para catar do chão depois, nada que quebre um vaso e nada que machuque quem passa na frente.",
          "Os efeitos de luz e som da pistola, nos 4 modos de tiro, são só para a diversão: quem marca o ponto é o projetor, que mostra os alvos na parede e conta os acertos no placar.",
        ],
      },
      {
        h2: "A partir de que idade",
        paragrafos: [
          "O kit é indicado a partir de 5 anos, com supervisão de um adulto. Por volta dos 7 anos, a criança já liga o projetor, escolhe o modo e comanda o jogo sozinha. Para os menores, o adulto monta, escolhe o modo e joga junto.",
        ],
      },
      {
        h2: "Os cuidados que valem para qualquer brinquedo de pontaria",
        itens: [
          {
            t: "Mire na parede, não nas pessoas",
            d: "O jogo é feito para os alvos projetados. Combinar isso desde a primeira partida cria o hábito certo para qualquer brinquedo de pontaria.",
          },
          {
            t: "Pilhas são assunto de adulto",
            d: "Cada kit usa 6 pilhas AAA e 2 AA. A troca deve ser feita por um adulto, e as pilhas soltas ficam guardadas longe das crianças pequenas.",
          },
          {
            t: "Espaço livre no escuro",
            d: "Como o jogo é com a luz apagada, tire do chão brinquedos, fios e tapetes soltos antes de começar. Uma luz baixa num canto ajuda a enxergar o caminho.",
          },
          {
            t: "Pausas combinadas",
            d: "Rodadas curtas e uma palavra de pausa evitam correria e briga no escuro.",
          },
        ],
      },
      {
        h2: "Laser tag com projetor ou de colete?",
        paragrafos: [
          "No laser tag de colete, cada jogador carrega um alvo no corpo e os outros miram nele. No laser tag com projetor, ninguém é alvo: todo mundo mira na mesma parede e disputa quem acerta primeiro. Para crianças pequenas e para jogar dentro de casa, o projetor é o jeito mais calmo de brincar, porque o jogo é de pontaria, não de correr atrás de ninguém.",
        ],
      },
    ],
    faq: [
      {
        q: "A luz da pistola faz mal aos olhos?",
        a: "A pistola usa luz infravermelha, como um controle remoto de TV, e o jogo é feito para mirar nos alvos da parede. Como em qualquer brinquedo de pontaria, combine com a criança que não se aponta para o rosto de ninguém.",
      },
      {
        q: "Criança de 4 anos pode jogar?",
        a: "A indicação do kit é a partir de 5 anos, com supervisão de um adulto. Abaixo disso, respeite a idade da embalagem.",
      },
      {
        q: "Precisa de pilha recarregável?",
        a: "Não precisa: pilhas comuns funcionam. Quem joga muito costuma preferir recarregáveis, porque cada kit usa 6 AAA e 2 AA.",
      },
    ],
  },
];

export const getArtigo = (slug: string | undefined | null) => ARTIGOS.find((a) => a.slug === slug);
