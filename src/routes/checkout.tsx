import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import {
  getBundle,
  isFreeShippingEligible,
  FREE_SHIPPING_MIN,
  encodeVariant,
  parseVariant,
  productLabel,
  variantLabel,
  withVariantPrice,
} from "@/lib/bundles";
import { brand } from "@/lib/brand";
import { bundleIdFromSearch, planSearchSchema } from "@/lib/plan-search";
import {
  createCardCharge,
  createPixCharge,
  FRETES,
  getCardConfig,
  getFrete,
  type FreteId,
} from "@/lib/pix.functions";
import { CARD_MAX_INSTALLMENTS, checkoutTotals, PIX_DISCOUNT } from "@/lib/payment-pricing";
import { loadHypercash, tokenizeCard } from "@/lib/hypercash-sdk";
import { savePixSession } from "@/lib/pix-session";
import { getSessionId, getStoredUtms } from "@/lib/tracking";
import { trackCheckoutStep, type CheckoutStep } from "@/lib/checkout-tracking.functions";
import { getMetaCookies, metaTrack } from "@/lib/meta-pixel";
import { trackCheckoutClick } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import {
  brl,
  Card,
  CardHead,
  CheckoutFooter,
  Field,
  GreenButton,
  PixIcon,
} from "@/components/checkout/parts";
import { SummaryDesktop, SummaryMobile } from "@/components/checkout/Summary";
import { OrderBump } from "@/components/checkout/OrderBump";
import { Reviews } from "@/components/reviews/Reviews";
import { FreeShippingProgress } from "@/components/checkout/FreeShippingProgress";
import { ORDER_BUMPS, bumpsTotal, getBumps, type BumpId } from "@/lib/order-bump";
import { cartItemName, cartLines } from "@/lib/cart";

export const Route = createFileRoute("/checkout")({
  validateSearch: planSearchSchema,
  head: () => ({
    meta: [
      { title: `Checkout Seguro | ${brand.name}` },
      {
        name: "description",
        content: `Finalize sua compra na ${brand.name} com segurança. Pagamento seguro via Pix. Frete grátis acima de R$ ${FREE_SHIPPING_MIN}.`,
      },
      { property: "og:title", content: `Checkout Seguro | ${brand.name}` },
      {
        property: "og:description",
        content: `Pagamento seguro via Pix. Frete grátis acima de R$ ${FREE_SHIPPING_MIN} para todo o Brasil.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

const digits = (v: string) => v.replace(/\D/g, "");
const maskCpf = (v: string) =>
  digits(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskPhone = (v: string) =>
  digits(v)
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
const maskCep = (v: string) =>
  digits(v)
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");
/** Senha do admin salva na aba (login no /admin): libera o cartão para teste mesmo desligado. */
const adminPwd = () => {
  try {
    return sessionStorage.getItem("bshop_admin_pwd") ?? undefined;
  } catch {
    return undefined;
  }
};
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const maskCard = (v: string) =>
  digits(v)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
const maskExp = (v: string) =>
  digits(v)
    .slice(0, 4)
    .replace(/(\d{2})(\d)/, "$1/$2");
/** Dígito verificador do cartão (Luhn) — só para avisar erro de digitação antes de enviar. */
function luhnOk(raw: string) {
  const d = digits(raw);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return sum % 10 === 0;
}
function expOk(v: string) {
  const [m, y] = v.split("/");
  if (!m || !y || y.length !== 2) return false;
  const month = Number(m);
  const year = 2000 + Number(y);
  const now = new Date();
  return (
    month >= 1 &&
    month <= 12 &&
    (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1))
  );
}

type Step = 1 | 2 | 3;
type Addr = {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  complemento: string;
  cidade: string;
  uf: string;
};

function Page() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const base = getBundle(bundleIdFromSearch(search));
  // null = o produto pede tamanho/cor e a URL não trouxe (o servidor também recusa).
  const variantValues = parseVariant(base, search.variante);
  const variant = variantValues?.length ? variantLabel(variantValues, base) : undefined;
  const itemName = productLabel(base, variantValues ?? []);
  // Preço da variação escolhida (o servidor recalcula do mesmo jeito).
  const bundle = withVariantPrice(base, variantValues);
  // Demais produtos do carrinho (só os com opções válidas; o servidor valida de novo).
  const itens = (search.itens ?? []).filter((it) => parseVariant(getBundle(it.plano), it.variante));
  const itemLines = cartLines(itens);
  const itensTotal = itemLines.reduce((s, l) => s + l.price, 0);
  useEffect(() => {
    metaTrack("InitiateCheckout", {
      value: bundle.price + itensTotal,
      contentName: bundle.name,
    });
  }, [bundle.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState<Step>(1);
  const [id, setId] = useState({ name: "", email: "", cpf: "", phone: "" });
  const [addr, setAddr] = useState<Addr>({
    cep: "",
    rua: "",
    numero: "",
    bairro: "",
    complemento: "",
    cidade: "",
    uf: "",
  });
  const [bumps, setBumps] = useState<BumpId[]>([]);
  const toggleBump = (id: BumpId, on: boolean) =>
    setBumps((cur) => (on ? [...cur.filter((b) => b !== id), id] : cur.filter((b) => b !== id)));
  // Pix vem pré-selecionado (10% de desconto); cartão em até 12x pelo preço de tabela.
  const [pay, setPay] = useState<"pix" | "card">("pix");
  const [card, setCard] = useState({ number: "", name: "", exp: "", cvv: "" });
  const [installments, setInstallments] = useState(1);
  // Frete grátis só a partir de FREE_SHIPPING_MIN em produtos (validado também no servidor).
  const subtotal = bundle.price + bumpsTotal(bumps) + itensTotal;
  const freeEligible = isFreeShippingEligible(subtotal);
  const [frete, setFrete] = useState<FreteId>(() =>
    isFreeShippingEligible(subtotal) ? "gratis" : "padrao",
  );
  const wasEligible = useRef(freeEligible);
  useEffect(() => {
    if (!freeEligible && frete === "gratis") setFrete("padrao");
    // Acabou de liberar o frete grátis (ex.: trocou de plano): já seleciona para o cliente.
    if (freeEligible && !wasEligible.current) setFrete("gratis");
    wasEligible.current = freeEligible;
  }, [freeEligible, frete]);
  const createFn = useServerFn(createPixCharge);
  const cardFn = useServerFn(createCardCharge);
  const cardConfigFn = useServerFn(getCardConfig);
  const stepFn = useServerFn(trackCheckoutStep);

  const freteOpt = getFrete(frete);
  const freteValue = freteOpt.price;
  const products = subtotal;
  // Desconto do Pix só depois de liberar o cartão no admin (o servidor aplica a mesma regra).
  const [pixDiscountOn, setPixDiscountOn] = useState(false);
  const pixT = checkoutTotals({
    products,
    frete: freteValue,
    method: "pix",
    pixDiscount: pixDiscountOn,
  });
  const cardT = checkoutTotals({ products, frete: freteValue, method: "card", pixDiscount: false });
  const pixTotal = pixT.total / 100;
  const cardTotal = cardT.total / 100;
  const payTotal = pay === "pix" ? pixTotal : cardTotal;
  const discount = pay === "pix" ? pixT.discount / 100 : 0;

  // Cartão pode ser desativado no admin: a opção só aparece se estiver ativa.
  const [cardEnabled, setCardEnabled] = useState(false);
  const [cardKey, setCardKey] = useState<string | null>(null);
  useEffect(() => {
    cardConfigFn({ data: { adminPassword: adminPwd() } })
      .then((c) => {
        setCardEnabled(c.enabled);
        setPixDiscountOn(c.pixDiscount);
        setCardKey(c.publicKey);
      })
      .catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Carrega o SDK assim que o cliente escolhe cartão.
  useEffect(() => {
    if (pay === "card" && cardKey) loadHypercash(cardKey).catch(() => undefined);
  }, [pay, cardKey]);
  useEffect(() => {
    if (!cardEnabled && pay === "card") setPay("pix");
  }, [cardEnabled, pay]);

  // Busca de endereço pelo CEP (ViaCEP, API pública)
  useEffect(() => {
    const c = digits(addr.cep);
    if (c.length !== 8) return;
    let alive = true;
    fetch(`https://viacep.com.br/ws/${c}/json/`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive || j.erro) return;
        setAddr((a) => ({
          ...a,
          rua: a.rua || j.logradouro,
          bairro: a.bairro || j.bairro,
          cidade: j.localidade,
          uf: j.uf,
        }));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [addr.cep]);

  // Registra cada etapa para a aba "Checkouts abandonados" do admin (nunca bloqueia a compra).
  const track = (s: CheckoutStep, extra: { pixId?: string } = {}) => {
    void stepFn({
      data: {
        sessionId: getSessionId(),
        step: s,
        plano: bundle.id,
        planoNome: itemName.slice(0, 80),
        value: payTotal,
        utm: getStoredUtms(),
        ...(s !== "checkout"
          ? {
              name: id.name,
              email: id.email,
              phone: id.phone,
              bump: bumps.length + itens.length > 0,
              bumps: [
                ...getBumps(bumps).map((b) => b.name),
                ...itens.map(cartItemName),
              ]
                .map((n) => n.slice(0, 80))
                .slice(0, 5),
              frete,
            }
          : {}),
        ...(s === "entrega" || s === "pix" ? { cidade: addr.cidade, uf: addr.uf } : {}),
        ...extra,
      },
    }).catch(() => undefined);
  };
  useEffect(() => {
    track("checkout");
  }, [bundle.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const idValid =
    id.name.trim().split(" ").length >= 2 &&
    emailOk(id.email) &&
    digits(id.cpf).length === 11 &&
    digits(id.phone).length >= 10;
  const addrValid = digits(addr.cep).length === 8 && addr.rua && addr.numero && addr.bairro;

  // Por partes para a RastroCode/cartão; só vai se o CEP trouxe cidade/UF (nunca trava o Pix).
  const structuredAddress = () =>
    addr.cidade.trim() && addr.uf.trim().length === 2 && digits(addr.cep).length === 8
      ? {
          street: addr.rua.trim(),
          number: addr.numero.trim(),
          ...(addr.complemento.trim() ? { complement: addr.complemento.trim() } : {}),
          neighborhood: addr.bairro.trim(),
          city: addr.cidade.trim(),
          state: addr.uf.trim(),
          zipcode: digits(addr.cep),
        }
      : undefined;
  const orderPayload = () => ({
    ...id,
    plano: bundle.id,
    ...(variantValues?.length ? { variante: encodeVariant(variantValues) } : {}),
    frete,
    bumps,
    itens,
    origin: window.location.origin,
    utm: getStoredUtms(),
    endereco: `${addr.rua}, ${addr.numero} ${addr.complemento} - ${addr.bairro}, ${addr.cidade}/${addr.uf} ${addr.cep}`,
    address: structuredAddress(),
  });
  const sessionBase = () => ({
    email: id.email,
    name: id.name,
    bundleId: bundle.id,
    bundleName: itemName,
    units: 1,
    productPrice: bundle.price,
    bumps: [
      ...itens.map((it, i) => ({ name: cartItemName(it), price: itemLines[i]?.price ?? 0 })),
      ...getBumps(bumps).map((b) => ({
        name: b.fullName,
        price: b.price,
      })),
    ],
    frete: freteValue,
    createdAt: Date.now(),
    phone: id.phone.replace(/\D/g, ""),
    cpf: id.cpf.replace(/\D/g, ""),
    utm: getStoredUtms(),
    ...getMetaCookies(),
  });

  const mutation = useMutation({
    mutationFn: () => createFn({ data: orderPayload() }),
    onSuccess: (c) => {
      savePixSession({
        ...sessionBase(),
        id: c.id,
        qrcode: c.qrcode,
        amount: c.amount,
        discount: pixT.discount / 100,
        method: "pix",
      });
      metaTrack("AddPaymentInfo", { value: pixTotal, contentName: bundle.name });
      trackCheckoutClick({
        source: "pix_generated",
        bundleId: bundle.id,
        bundleName: itemName,
        value: pixTotal,
      });
      track("pix", { pixId: c.id });
      navigate({ to: "/pedido/$id", params: { id: c.id }, replace: true });
    },
  });

  const cardValid =
    luhnOk(card.number) &&
    card.name.trim().length >= 3 &&
    expOk(card.exp) &&
    digits(card.cvv).length >= 3;
  // Banco autenticando o cartão (3DS): a janela do banco pode abrir por cima do checkout.
  const [threeDS, setThreeDS] = useState(false);
  const cardMutation = useMutation({
    mutationFn: async () => {
      const address = structuredAddress();
      if (!cardKey || !address) throw new Error("Cartão indisponível no momento. Tente o Pix.");
      const [mm, yy] = card.exp.split("/");
      const cardHash = await tokenizeCard(
        cardKey,
        {
          number: digits(card.number),
          holderName: card.name.trim().toUpperCase(),
          expMonth: mm!,
          expYear: `20${yy}`,
          cvv: digits(card.cvv),
        },
        {
          amount: cardT.total,
          installments,
          customer: { name: id.name, email: id.email, phoneNumber: digits(id.phone) },
          address: {
            street: address.street,
            streetNumber: address.number,
            complement: address.complement || "Sem complemento",
            zipCode: address.zipcode,
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state,
            country: "BR",
          },
        },
        setThreeDS,
      ).catch((e) => {
        const reason = e instanceof Error && e.message ? `: ${e.message}` : "";
        throw new Error(
          `Não foi possível validar o cartão${reason}. Confira os dados e tente novamente.`,
        );
      });
      const res = await cardFn({
        data: { ...orderPayload(), cardHash, installments, adminPassword: adminPwd() },
      });
      return { ...res, cardHash };
    },
    onSuccess: (c) => {
      savePixSession({
        ...sessionBase(),
        id: c.id,
        qrcode: "",
        amount: c.amount,
        discount: 0,
        method: "card",
        installments,
        // Token do gateway (não é o cartão): permite o upsell no mesmo cartão sem redigitar.
        cardHash: c.cardHash,
      });
      metaTrack("AddPaymentInfo", { value: cardTotal, contentName: bundle.name });
      trackCheckoutClick({
        source: "card_submitted",
        bundleId: bundle.id,
        bundleName: itemName,
        value: cardTotal,
      });
      track("pix", { pixId: c.id });
      // A página do pedido confirma o pagamento no servidor e segue para o upsell/obrigado.
      navigate({ to: "/pedido/$id", params: { id: c.id }, replace: true });
    },
  });

  const submitId = (e: FormEvent) => {
    e.preventDefault();
    if (idValid) {
      track("dados");
      setStep(addrValid ? 3 : 2);
    }
  };
  const submitAddr = (e: FormEvent) => {
    e.preventDefault();
    if (addrValid) {
      track("entrega");
      setStep(3);
    }
  };

  const idCard =
    step === 1 ? (
      <Card>
        <CardHead
          title="Identificação"
          step="1 de 3"
          sub="Preencha seus dados para envio do pedido."
        />
        <form onSubmit={submitId} className="mt-6 space-y-4">
          <Field
            label="Nome completo"
            autoComplete="name"
            required
            value={id.name}
            ok={id.name.trim().split(" ").length >= 2}
            onChange={(e) => setId({ ...id, name: e.target.value })}
          />
          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={id.email}
            ok={emailOk(id.email)}
            onChange={(e) => setId({ ...id, email: e.target.value })}
          />
          <Field
            label="CPF"
            wrap="sm:max-w-[240px]"
            inputMode="numeric"
            required
            value={id.cpf}
            ok={digits(id.cpf).length === 11}
            onChange={(e) => setId({ ...id, cpf: maskCpf(e.target.value) })}
          />
          <Field
            label="Celular/Whatsapp"
            wrap="sm:max-w-[240px]"
            prefix="+55"
            inputMode="tel"
            required
            value={id.phone}
            ok={digits(id.phone).length >= 10}
            onChange={(e) => setId({ ...id, phone: maskPhone(e.target.value) })}
          />
          <GreenButton type="submit" disabled={!idValid}>
            Ir Para Entrega
          </GreenButton>
        </form>
      </Card>
    ) : (
      <Card done>
        <CardHead title="Identificação" onEdit={() => setStep(1)} />
        <p className="mt-3 text-[13px] font-semibold">{id.name}</p>
        <p className="mt-1 text-[13px]">{id.email}</p>
        <p className="mt-1 text-[13px]">{id.phone}</p>
      </Card>
    );

  const addrCard =
    step === 2 ? (
      <Card>
        <CardHead title="Entrega" step="2 de 3" sub="Informe o endereço de entrega" />
        <form onSubmit={submitAddr} className="mt-6 space-y-4">
          <div className="flex items-end gap-4">
            <Field
              label="CEP"
              wrap="w-2/3"
              inputMode="numeric"
              required
              value={addr.cep}
              ok={digits(addr.cep).length === 8}
              onChange={(e) => setAddr({ ...addr, cep: maskCep(e.target.value) })}
            />
            {addr.uf && (
              <span className="pb-3.5 text-xs">
                {addr.uf}/{addr.cidade}
              </span>
            )}
          </div>
          <Field
            label="Endereço"
            required
            value={addr.rua}
            ok={!!addr.rua}
            onChange={(e) => setAddr({ ...addr, rua: e.target.value })}
          />
          <div className="flex gap-2">
            <Field
              label="N°"
              wrap="w-1/4"
              required
              value={addr.numero}
              ok={!!addr.numero}
              onChange={(e) => setAddr({ ...addr, numero: e.target.value })}
            />
            <Field
              label="Bairro"
              wrap="flex-1"
              required
              value={addr.bairro}
              ok={!!addr.bairro}
              onChange={(e) => setAddr({ ...addr, bairro: e.target.value })}
            />
          </div>
          <Field
            label={
              <>
                Complemento <span className="text-[11px] text-muted-foreground">(Opcional)</span>
              </>
            }
            value={addr.complemento}
            onChange={(e) => setAddr({ ...addr, complemento: e.target.value })}
          />
          <p className="pt-2 text-base font-medium">Escolha o frete:</p>
          <FreeShippingProgress subtotal={subtotal} />
          {FRETES.map(({ id: v, name: t, eta: d, price }) => {
            const locked = v === "gratis" && !freeEligible;
            const p = locked ? `Acima de ${brl(FREE_SHIPPING_MIN)}` : price ? brl(price) : "Grátis";
            return (
              <button
                key={v}
                type="button"
                disabled={locked}
                onClick={() => setFrete(v)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-lg border px-4 py-5 text-left",
                  frete === v ? "border-[var(--ck-blue)] bg-muted/60" : "border-border",
                  locked && "cursor-not-allowed opacity-50",
                )}
              >
                <Radio on={frete === v} />
                <span className="flex-1">
                  <span className="block text-[13px] font-medium">{t}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {locked ? `Faltam ${brl(FREE_SHIPPING_MIN - subtotal)} em produtos` : d}
                  </span>
                </span>
                <span className="text-[13px] font-semibold">{p}</span>
              </button>
            );
          })}
          <GreenButton type="submit" disabled={!addrValid}>
            Ir Para Pagamento
          </GreenButton>
        </form>
      </Card>
    ) : step === 3 ? (
      <Card done>
        <CardHead title="Enviar para" onEdit={() => setStep(2)} />
        <p className="mt-3 text-[13px]">
          {addr.rua}, {addr.numero}
          {addr.complemento && ` - ${addr.complemento}`}
        </p>
        <p className="mt-1 text-[13px]">
          {addr.bairro}, {addr.cidade}/{addr.uf} {addr.cep}
        </p>
        <p className="mt-4 text-[13px] font-semibold">Frete selecionado</p>
        <p className="text-[13px]">
          {freteOpt.name} - {freteValue ? brl(freteValue) : "Grátis"}
        </p>
      </Card>
    ) : (
      <Card muted>
        <CardHead
          title="Entrega"
          step="2 de 3"
          sub="Preencha os dados pessoais para continuar"
          muted
        />
      </Card>
    );

  const payCard =
    step < 3 ? (
      <Card muted={step === 1}>
        <CardHead
          title="Pagamento"
          step="3 de 3"
          muted={step === 1}
          sub={
            step === 1
              ? "Preencha os dados de entrega para continuar"
              : "Todas as transações são seguras e criptografadas."
          }
        />
      </Card>
    ) : (
      <Card>
        <CardHead
          title="Pagamento"
          step="3 de 3"
          sub="Todas as transações são seguras e criptografadas."
        />
        <div className="mt-6 space-y-6">
          {ORDER_BUMPS.filter((b) => b.id !== bundle.id).map((b, i) => (
            <OrderBump
              key={b.id}
              bump={b}
              reveal={i > 0}
              checked={bumps.includes(b.id)}
              onChange={(on) => toggleBump(b.id, on)}
            />
          ))}
          <div
            className={cn(
              "rounded-lg border",
              pay === "pix" ? "border-[var(--ck-blue)] bg-muted/60" : "border-border",
            )}
          >
            <button
              type="button"
              onClick={() => setPay("pix")}
              className="flex w-full items-center gap-3 p-3 text-left"
            >
              <Radio on={pay === "pix"} />
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <PixIcon className="h-5 w-5" />
              </span>
              <span className="flex-1 text-[15px]">PIX</span>
              <span className="rounded bg-[var(--ck-badge)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--ck-ok)]">
                {pixDiscountOn ? `${Math.round(PIX_DISCOUNT * 100)}% OFF` : "Oferta"}
              </span>
            </button>
            {pay === "pix" && (
              <div className="px-3 pb-3">
                <p className="px-4 pt-4 text-sm text-muted-foreground">
                  O código Pix expira em 30 minutos após finalizar a compra.
                </p>
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  Valor no Pix: <b className="text-[var(--ck-green)]">{brl(pixTotal)}</b>{" "}
                  {pixT.discount > 0 && (
                    <span className="text-[12px]">(economia de {brl(pixT.discount / 100)})</span>
                  )}
                </p>
                {mutation.isError && (
                  <p role="alert" className="px-4 pb-3 text-sm text-destructive">
                    {/* Mensagem do gateway quando legível; erro técnico de validação vira o texto padrão. */}
                    {mutation.error instanceof Error && /^[^[{]/.test(mutation.error.message)
                      ? mutation.error.message
                      : "Não foi possível gerar o Pix agora. Confira seus dados e tente novamente."}
                  </p>
                )}
                <GreenButton
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Finalizar
                  Compra
                </GreenButton>
              </div>
            )}
          </div>

          {cardEnabled && (
            <div
              className={cn(
                "rounded-lg border",
                pay === "card" ? "border-[var(--ck-blue)] bg-muted/60" : "border-border",
              )}
            >
              <button
                type="button"
                onClick={() => setPay("card")}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <Radio on={pay === "card"} />
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </span>
                <span className="text-[15px]">Cartão de crédito</span>
              </button>
              {pay === "card" && (
                <div className="space-y-4 px-3 pb-3">
                  <Field
                    label="Número do cartão"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={card.number}
                    ok={luhnOk(card.number)}
                    onChange={(e) => setCard({ ...card, number: maskCard(e.target.value) })}
                  />
                  <Field
                    label="Nome impresso no cartão"
                    autoComplete="cc-name"
                    value={card.name}
                    ok={card.name.trim().length >= 3}
                    onChange={(e) => setCard({ ...card, name: e.target.value })}
                  />
                  <div className="flex gap-3">
                    <Field
                      label="Validade"
                      wrap="flex-1"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM/AA"
                      value={card.exp}
                      ok={expOk(card.exp)}
                      onChange={(e) => setCard({ ...card, exp: maskExp(e.target.value) })}
                    />
                    <Field
                      label="CVV"
                      wrap="flex-1"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      value={card.cvv}
                      ok={digits(card.cvv).length >= 3}
                      onChange={(e) =>
                        setCard({ ...card, cvv: digits(e.target.value).slice(0, 4) })
                      }
                    />
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-[13px] font-medium">Parcelas</span>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="ck-surface h-[46px] w-full rounded-lg border border-border px-3 text-base outline-none focus-visible:border-foreground md:text-[13px]"
                    >
                      {Array.from({ length: CARD_MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n === 1
                            ? `1x de ${brl(cardTotal)} à vista`
                            : `${n}x de ${brl(cardTotal / n)} sem juros`}
                        </option>
                      ))}
                    </select>
                  </label>
                  {pixDiscountOn && (
                    <p className="rounded-md bg-[var(--ck-badge)]/50 px-3 py-2 text-[12px] text-muted-foreground">
                      No Pix sai por <b className="text-[var(--ck-ok)]">{brl(pixTotal)}</b> (
                      {Math.round(PIX_DISCOUNT * 100)}% de desconto).{" "}
                      <button
                        type="button"
                        onClick={() => setPay("pix")}
                        className="font-semibold text-[var(--ck-ok)] underline"
                      >
                        Pagar com Pix
                      </button>
                    </p>
                  )}
                  {cardMutation.isError && (
                    <p role="alert" className="text-sm text-destructive">
                      {cardMutation.error instanceof Error
                        ? cardMutation.error.message
                        : "Não foi possível processar o cartão."}
                    </p>
                  )}
                  <GreenButton
                    type="button"
                    disabled={!cardValid || !cardKey || cardMutation.isPending}
                    onClick={() => cardMutation.mutate()}
                  >
                    {cardMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}{" "}
                    {threeDS ? "Aguardando autenticação do banco…" : "Comprar Agora"}
                  </GreenButton>
                  <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                    <Lock className="h-3 w-3" /> Os dados do cartão são criptografados e não ficam
                    salvos na loja.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    );

  if (variantValues === null)
    return (
      <div className="ck flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-foreground">
        <Logo size="sm" />
        <p className="text-[15px]">
          Escolha as opções de {bundle.name} antes de finalizar a compra.
        </p>
        <Link
          to="/produto"
          search={{ plano: bundle.id }}
          className="rounded-md bg-[var(--ck-ok)] px-5 py-3 text-[14px] font-bold text-white transition hover:opacity-90"
        >
          Escolher cor e tamanho
        </Link>
      </div>
    );

  return (
    <div className="ck flex min-h-screen flex-col text-foreground">
      <header className="flex justify-center py-6 md:py-10">
        <Logo size="sm" />
      </header>
      <SummaryMobile
        bundle={bundle}
        frete={freteValue}
        discount={discount}
        bumps={bumps}
        itens={itemLines}
        variant={variant}
      />
      <main className="mx-auto grid w-full max-w-[1160px] gap-4 px-3 pb-24 pt-2 md:px-4 lg:grid-cols-3 lg:gap-4">
        <div className="space-y-5">
          {idCard}
          {addrCard}
        </div>
        <div>{payCard}</div>
        <SummaryDesktop
          bundle={bundle}
          frete={freteValue}
          discount={discount}
          bumps={bumps}
          itens={itemLines}
          variant={variant}
        />
      </main>
      <Reviews compact className="mt-auto" />
      <CheckoutFooter />
    </div>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border",
        on ? "border-[var(--ck-blue)]" : "border-muted-foreground/50",
      )}
    >
      {on && <span className="h-2.5 w-2.5 rounded-full bg-[var(--ck-blue)]" />}
    </span>
  );
}
