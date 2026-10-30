/**
 * Dados fictícios para ver o /admin no ambiente local (`/admin?demo` com o servidor de
 * desenvolvimento). Só é carregado quando `import.meta.env.DEV`: não entra no site publicado.
 * Responde às chamadas do painel no próprio navegador; nada vai para o banco nem para os gateways.
 */
import type { AbandonedCheckout, AdminOrder } from "@/lib/admin.functions";
import { allBundles, getBundle, parseBundleId } from "@/lib/bundles";
import { inicioDoPeriodo } from "@/lib/admin-format";

/** Gerador previsível: a mesma demonstração a cada recarga. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const NOMES = [
  "Ana Clara Ribeiro",
  "Bruno Henrique Lima",
  "Camila Ferreira",
  "Diego Araújo",
  "Eduarda Martins",
  "Felipe Costa",
  "Gabriela Nunes",
  "Henrique Duarte",
  "Isabela Rocha",
  "João Pedro Alves",
  "Larissa Moura",
  "Mateus Carvalho",
  "Natália Gomes",
  "Otávio Pires",
  "Paula Teixeira",
  "Rafael Monteiro",
  "Sabrina Lopes",
  "Thiago Barros",
  "Vitória Cardoso",
  "Yasmin Freitas",
];
const CIDADES: [string, string][] = [
  ["São Paulo", "SP"],
  ["Curitiba", "PR"],
  ["Belo Horizonte", "MG"],
  ["Recife", "PE"],
  ["Porto Alegre", "RS"],
  ["Goiânia", "GO"],
  ["Campinas", "SP"],
  ["Salvador", "BA"],
];
/** Produtos do catálogo (o projetor em 1, 2 ou 3 kits). */
const PRODUTOS = allBundles().map((b) => b.id);
const ORIGENS: { utm: Record<string, string> | null; ua: string }[] = [
  {
    utm: {
      utm_source: "fb",
      utm_medium: "paid",
      utm_campaign: "CBO Kigurumi|1203",
      utm_content: "Criativo 3|8812",
    },
    ua: "Mozilla/5.0 (iPhone) Instagram 320.0",
  },
  {
    utm: {
      utm_source: "fb",
      utm_medium: "paid",
      utm_campaign: "CBO Pelúcia|1207",
      utm_content: "Criativo 1|8790",
    },
    ua: "Mozilla/5.0 (Linux; Android 14) FBAV/450",
  },
  { utm: { utm_source: "google", utm_medium: "organic" }, ua: "Mozilla/5.0 (Linux; Android 13)" },
  { utm: null, ua: "Mozilla/5.0 (iPhone) Instagram 318.0" },
];

const fakeCpf = (r: () => number) => String(Math.floor(r() * 1e11)).padStart(11, "0");
const fakePhone = (r: () => number) => `119${String(Math.floor(r() * 1e8)).padStart(8, "0")}`;

function pedidos(days: number): AdminOrder[] {
  const r = rng(days * 97 + 13);
  const agora = Date.now();
  const inicio = inicioDoPeriodo(days, agora);
  const porDia = 7;
  const total = Math.max(4, Math.round(((agora - inicio) / 86_400_000) * porDia));
  const lista: AdminOrder[] = [];
  for (let i = 0; i < total; i++) {
    const criado = agora - Math.floor(r() * (agora - inicio));
    const nome = NOMES[Math.floor(r() * NOMES.length)]!;
    const id = PRODUTOS[Math.floor(r() * PRODUTOS.length)]!;
    const b = getBundle(parseBundleId(id));
    const frete =
      r() < 0.6
        ? { id: "padrao", name: "Frete Padrão", price: 20 }
        : { id: "gratis", name: "Frete Grátis", price: 0 };
    const og = ORIGENS[Math.floor(r() * ORIGENS.length)]!;
    const [cidade, uf] = CIDADES[Math.floor(r() * CIDADES.length)]!;
    const pago = agora - criado > 35 * 60_000 ? r() < 0.55 : r() < 0.2;
    const iso = new Date(criado).toISOString();
    lista.push({
      id: `demo_${i.toString(36)}${Math.floor(r() * 1e6).toString(36)}`,
      status: pago ? "paid" : "waiting_payment",
      amount_cents: Math.round((b.price + frete.price) * 100),
      customer: {
        name: nome,
        email: `${nome.split(" ")[0]!.toLowerCase()}@exemplo.com`,
        phone: fakePhone(r),
        cpf: fakeCpf(r),
        endereco: `Rua Exemplo, ${Math.floor(r() * 900) + 10} - Centro, ${cidade}/${uf}`,
        frete,
        qrcode: "00020126580014BR.GOV.BCB.PIX0136demonstracao-sem-valor5204000053039865802BR",
        method: "pix",
      },
      bundle_id: b.id,
      bundle_name: b.name,
      utm: og.utm,
      fbp: null,
      fbc: null,
      ip: "200.0.0.1",
      ua: og.ua,
      url: `https://exemplo.com/checkout?plano=${b.id}`,
      paid_reported_at: pago ? new Date(criado + 4 * 60_000).toISOString() : null,
      report_result: pago ? { utmify: { ok: true } } : { utmifyPending: { ok: true } },
      created_at: iso,
      updated_at: iso,
    });
  }
  return lista.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function funil(windowMinutes: number) {
  const r = rng(windowMinutes);
  const dias = Math.max(windowMinutes / 1440, 0.02);
  const visited = Math.round(dias * 420 + 6);
  const viewedProduct = Math.round(visited * 0.62);
  const checkout = Math.round(viewedProduct * 0.21);
  const tipos = ["page_view", "product_view", "product_view", "checkout_click", "checkout_step"];
  const passos = ["checkout", "dados", "entrega", "pix"];
  const recent = Array.from({ length: Math.min(60, visited * 2) }, (_, i) => {
    const event_type = tipos[Math.floor(r() * tipos.length)]!;
    const id = PRODUTOS[Math.floor(r() * PRODUTOS.length)]!;
    const b = getBundle(parseBundleId(id));
    const comProduto = event_type !== "page_view";
    return {
      id: `ev${i}`,
      session_id: Math.floor(r() * 1e12).toString(16),
      event_type,
      path: comProduto ? `/produto?plano=${b.id}` : "/",
      bundle_id: comProduto ? b.id : null,
      bundle_name: comProduto ? b.name : null,
      value: comProduto ? b.price : null,
      referrer: null,
      utm_source: r() < 0.6 ? "fb" : r() < 0.5 ? "google" : null,
      metadata:
        event_type === "checkout_step" ? { step: passos[Math.floor(r() * passos.length)] } : {},
      created_at: new Date(
        Date.now() - i * Math.max(20_000, (windowMinutes * 60_000) / 80),
      ).toISOString(),
    };
  });
  return {
    recent,
    funnel: {
      visited,
      viewedProduct,
      checkout,
      totalEvents: visited * 4,
      totalSessions: visited,
      onlineNow: 7,
      windowMinutes,
      onlineMinutes: 3,
    },
  };
}

function abandonos(days: number) {
  const r = rng(days * 31 + 5);
  const passos: AbandonedCheckout["step"][] = [
    "checkout",
    "checkout",
    "dados",
    "entrega",
    "pix",
    "pix",
  ];
  const rows: AbandonedCheckout[] = Array.from({ length: days * 5 + 6 }, (_, i) => {
    const step = passos[Math.floor(r() * passos.length)]!;
    const nome = step === "checkout" ? null : NOMES[Math.floor(r() * NOMES.length)]!;
    const b = getBundle(parseBundleId(PRODUTOS[Math.floor(r() * PRODUTOS.length)]!));
    const [cidade, uf] = CIDADES[Math.floor(r() * CIDADES.length)]!;
    const quando = new Date(Date.now() - Math.floor(r() * days * 86_400_000)).toISOString();
    return {
      sessionId: `s${i}`,
      step,
      pixPending: step === "pix" && i % 5 === 0,
      firstAt: quando,
      lastAt: quando,
      name: nome,
      email: nome ? `${nome.split(" ")[0]!.toLowerCase()}@exemplo.com` : null,
      phone: nome ? fakePhone(r) : null,
      plano: b.name,
      value: b.price + (r() < 0.5 ? 20 : 0),
      cidade: step === "entrega" || step === "pix" ? cidade : null,
      uf: step === "entrega" || step === "pix" ? uf : null,
      bump: false,
      bumps: r() < 0.2 ? ["Pilhas extras"] : [],
      pixId: null,
      utmSource: r() < 0.7 ? "fb" : null,
    };
  }).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const c = { checkout: 0, dados: 0, entrega: 0, pix: 0 };
  for (const x of rows) c[x.step]++;
  const pago = Math.round(days * 4.5 + 3);
  return {
    funnel: {
      checkout: c.checkout + c.dados + c.entrega + c.pix + pago,
      dados: c.dados + c.entrega + c.pix + pago,
      entrega: c.entrega + c.pix + pago,
      pix: c.pix + pago,
      pago,
    },
    rows,
  };
}

const chave = (k: string) => ({
  key: `${k.slice(0, 4)}••••••${k.slice(-4)}`,
  source: "admin" as const,
});

function responder(nome: string, dados: Record<string, unknown>): unknown {
  switch (nome) {
    case "verifyAdminPassword":
      return { ok: true };
    case "getAdminOrders":
      return { orders: pedidos(Number(dados["days"] ?? 30)) };
    case "getAdminFunnel":
      return funil(Number(dados["windowMinutes"] ?? 1440));
    case "getAbandonedCheckouts":
      return abandonos(Number(dados["days"] ?? 7));
    case "getSiteSettings":
      return {
        whatsappEnabled: true,
        whatsappPhone: "5511900000000",
        whatsappMessage: "Olá! Vim pelo site e queria tirar uma dúvida.",
        cardEnabled: false,
      };
    case "getPixGatewayStatus":
      return {
        selected: "pixgate",
        active: "pixgate",
        configured: {
          pixgate: true,
          umbrella: true,
          sagacepay: false,
          payshark: true,
          koku: true,
          pixblack: true,
        },
        keys: {
          pixgate: chave("pg_demo_1234abcd"),
          umbrella: chave("um_demo_5678efgh"),
          sagacepay: { key: null, source: null },
          payshark: chave("ps_demo_9012ijkl"),
          koku: chave("koku_live_demo_3456mnop"),
          pixblack: chave("pxb_live_demo_7890qrst"),
        },
        lastFallback: {
          from: "umbrella",
          to: "koku",
          reason: "Não foi possível gerar o Pix. Confira seus dados e tente novamente.",
          at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
        },
      };
    case "getHypercashStatus":
      return { secret: null, public: null };
    case "getUtmifyStatus":
      return { configured: true, maskedToken: "Ab12••••••••Yz90" };
    case "getMetaAdmin":
      return { pixelId: "", testCode: "", hasToken: false, tokenHint: "" };
    case "getRotasyncStatus":
      return { configured: true, maskedKey: "rs_d••••••••0a1b", source: "admin" };
    case "getAdminCatalog": {
      const rows = allBundles().map((b) => ({
        handle: b.id,
        title: b.name,
        status: "active",
        img: b.img,
        minPrice: b.price,
        variants: 1,
        stock: null,
        collections: [b.kit ? "Kits" : "Peças"],
        updatedAt: new Date().toISOString(),
      }));
      return {
        configured: true,
        products: rows,
        collections: ["Kits", "Peças"].map((name) => ({
          slug: name.toLowerCase(),
          name,
          count: rows.filter((r) => r.collections.includes(name)).length,
        })),
      };
    }
    case "listarPendentesRotasyncFn":
      return { pendentes: [], semEndereco: 0 };
    case "testPixgateFn":
    case "testUmbrellaFn":
    case "testPaySharkFn":
    case "testKokuFn":
    case "testPixBlackFn":
    case "testSagacePayFn":
    case "testHypercashFn":
    case "testRotasyncKeyFn":
      return { ok: true, status: 404 };
    case "approveOrderFn":
      return { approved: true, manual: false, gatewayStatus: "paid" };
    default:
      return { ok: true };
  }
}

/** Nome da função a partir do id de desenvolvimento (base64 de {"file", "export"}). */
function nomeDaFuncao(url: string): string | null {
  const id = url.split("/_serverFn/")[1]?.split(/[?#]/)[0];
  if (!id) return null;
  try {
    const json = JSON.parse(atob(id.replace(/-/g, "+").replace(/_/g, "/"))) as { export?: string };
    return json.export?.replace(/_createServerFn_handler$/, "") ?? null;
  } catch {
    return null;
  }
}

/**
 * Lê números do corpo serializado pelo seroval, onde cada objeto guarda as chaves em `k` e os
 * valores em `v` (ex.: {k:["password","days"], v:[{s:"x"},{s:30}]}).
 */
function camposNumericos(no: unknown, campos: string[], achados: Record<string, number> = {}) {
  if (!no || typeof no !== "object") return achados;
  const o = no as { k?: unknown; v?: unknown };
  if (Array.isArray(o.k) && Array.isArray(o.v)) {
    o.k.forEach((k, i) => {
      const v = (o.v as unknown[])[i] as { s?: unknown } | number | undefined;
      const n = typeof v === "number" ? v : typeof v?.s === "number" ? v.s : null;
      if (typeof k === "string" && campos.includes(k) && n != null) achados[k] = n;
    });
  }
  for (const filho of Object.values(no)) camposNumericos(filho, campos, achados);
  return achados;
}

let ligado = false;

/** Passa a responder às chamadas do painel com os dados fictícios acima. */
export function ligarDemoAdmin() {
  if (ligado || typeof window === "undefined") return;
  ligado = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const nome = url.includes("/_serverFn/") ? nomeDaFuncao(url) : null;
    if (!nome) return original(input, init);
    let dados: Record<string, unknown> = {};
    try {
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null;
      dados = camposNumericos(body, ["days", "windowMinutes"]);
    } catch {
      dados = {};
    }
    await new Promise((r) => setTimeout(r, 150));
    // Mesmo envelope que o servidor manda: o cliente lê `result`.
    return new Response(JSON.stringify({ result: responder(nome, dados), context: {} }), {
      headers: { "content-type": "application/json" },
    });
  };
}
