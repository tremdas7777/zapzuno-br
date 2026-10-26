import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { createCardFollowUpCharge, createUpsellCharge } from "@/lib/pix.functions";
import { loadPixSession, savePixSession, type PixSession } from "@/lib/pix-session";
import {
  BATTERY_PACKS,
  batteryLabel,
  batteryPack,
  batteryContents,
  batteryPackFor,
  type BatteryPackId,
} from "@/lib/upsell";

import { brl } from "@/components/checkout/parts";
import { Shell } from "@/components/checkout/OrderShell";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/pilhas/$id")({
  head: () => ({
    meta: [{ title: `Oferta especial | ${brand.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

/**
 * Pilhas AAA recarregáveis: 1ª oferta do pós-compra, logo depois do pagamento. O cliente escolhe o
 * pacote do tamanho do time (vem marcado o do kit comprado). Comprando ou não, segue para as ofertas
 * (kit/seguro) — ver /upsell. Compra no cartão → mesmo cartão (com o clique do cliente); Pix → Pix separado.
 */
function Page() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<PixSession | null | undefined>(undefined);
  const createFn = useServerFn(createUpsellCharge);
  const cardFn = useServerFn(createCardFollowUpCharge);
  const [usePix, setUsePix] = useState(false);
  const [pack, setPack] = useState<BatteryPackId>(BATTERY_PACKS[0].id);

  useEffect(() => {
    const s = loadPixSession(id);
    // Sem sessão (outro dispositivo) ou já é um upsell: segue para o obrigado.
    if (!s || s.isUpsell) navigate({ to: "/obrigado/$id", params: { id }, replace: true });
    // Pilhas já pagas: segue para as ofertas.
    else if (s.bateriasId) navigate({ to: "/upsell/$id", params: { id }, replace: true });
    else {
      setSession(s);
      setPack(batteryPackFor(s.bundleName));
    }
  }, [id, navigate]);

  const seuKit = batteryPackFor(session?.bundleName);
  const escolhido = batteryPack(pack)!;
  const isCard = session?.method === "card" && !!session.cardHash && !usePix;

  const mutation = useMutation({
    mutationFn: async () => {
      if (isCard) {
        const r = await cardFn({
          data: {
            parentId: id,
            origin: window.location.origin,
            cardHash: session!.cardHash!,
            products: [pack],
          },
        });
        return { ...r, qrcode: "", method: "card" as const };
      }
      const r = await createFn({
        data: { parentId: id, origin: window.location.origin, products: [pack] },
      });
      return { ...r, method: "pix" as const };
    },
    onSuccess: (c) => {
      if (!session) return;
      savePixSession({
        method: c.method,
        id: c.id,
        qrcode: c.qrcode,
        amount: c.amount,
        email: session.email,
        name: session.name,
        bundleId: session.bundleId,
        bundleName: batteryLabel(escolhido),
        units: 0,
        productPrice: escolhido.price,
        frete: 0,
        discount: 0,
        createdAt: Date.now(),
        phone: session.phone,
        cpf: session.cpf,
        utm: session.utm,
        fbp: session.fbp,
        fbc: session.fbc,
        isUpsell: true,
        parentId: id,
        upsellItems: [pack],
      });
      navigate({ to: "/pedido/$id", params: { id: c.id }, replace: true });
    },
  });

  if (!session) {
    return (
      <Shell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--ck-ok)]" />
        </div>
      </Shell>
    );
  }

  const firstName = session.name.trim().split(/\s+/)[0];

  return (
    <Shell>
      <div className="mx-auto max-w-[560px] px-4 pb-20">
        <div className="flex items-center justify-center gap-2 rounded-lg bg-[var(--ck-badge)] px-4 py-3 text-[13px] font-semibold text-[var(--ck-ok)]">
          <CircleCheck className="h-4 w-4 shrink-0" />
          Pagamento aprovado! Seu pedido está confirmado.
        </div>

        <p className="mt-8 text-center text-[13px] font-bold uppercase tracking-wider text-amber-600">
          Atenção, {firstName}: seu kit não vem com pilhas recarregáveis com carregador
        </p>
        <h1 className="mt-2 text-center text-[24px] font-bold leading-tight tracking-tight md:text-[28px]">
          Leve as pilhas recarregáveis com carregador
        </h1>
        <p className="mt-2 text-center text-[14px] leading-relaxed text-muted-foreground">
          Cada pistola usa 3 pilhas AAA e o projetor usa 2 AA. Acabou a carga, é só colocar no
          carregador e jogar de novo, sem comprar pilha nova a cada partida.
        </p>

        <img
          src="/produtos/pilhas-recarregaveis.svg"
          alt="Pilhas AAA e AA recarregáveis com carregador"
          width={400}
          height={400}
          className="mx-auto mt-4 h-44 w-44"
        />

        <p className="mt-2 text-[14px] font-semibold">Escolha para quantos kits</p>
        <div role="radiogroup" aria-label="Pacote de pilhas" className="mt-2 space-y-3">
          {BATTERY_PACKS.map((b) => {
            const on = b.id === pack;
            return (
              <label
                key={b.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-colors ${
                  on ? "border-[var(--ck-ok)] bg-[var(--ck-ok)]/[0.04]" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="pacote"
                  checked={on}
                  onChange={() => setPack(b.id)}
                  className="h-5 w-5 shrink-0 accent-[var(--ck-ok)]"
                />
                <span className="flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[15px] font-semibold">{b.kits} {b.kits === 1 ? "kit" : "kits"} · {b.kits * 2} jogadores</span>
                    {b.id === seuKit && (
                      <span className="rounded bg-[var(--ck-badge)] px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ck-ok)]">
                        Para o seu kit
                      </span>
                    )}
                  </span>
                  <span className="block text-[13px] text-muted-foreground">
                    {batteryContents(b.kits)}
                  </span>
                </span>
                <span className="text-[18px] font-bold text-[var(--ck-ok)]">{brl(b.price)}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[12.5px] text-muted-foreground">
          Vão no mesmo envio do seu pedido, com frete grátis.
        </p>

        {mutation.isError &&
          (isCard ? (
            <p role="alert" className="mt-4 text-center text-sm text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Não foi possível cobrar no mesmo cartão."}{" "}
              <button
                type="button"
                onClick={() => {
                  setUsePix(true);
                  mutation.reset();
                }}
                className="font-semibold underline"
              >
                Pagar com Pix
              </button>
            </p>
          ) : (
            <p role="alert" className="mt-4 text-center text-sm text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Não foi possível gerar o Pix agora. Tente novamente em alguns segundos."}
            </p>
          ))}

        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="mt-5 flex w-full flex-col items-center justify-center rounded-lg bg-[var(--ck-green)] px-6 py-4 text-white shadow-lg transition hover:opacity-90 disabled:opacity-70"
        >
          <span className="flex items-center gap-2 text-[17px] font-bold uppercase">
            {mutation.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
            {isCard ? "Comprar com um clique" : "Gerar Pix"}
          </span>
          <span className="text-[13px] font-medium opacity-90">
            {brl(escolhido.price)} {isCard ? "no mesmo cartão" : "no Pix"}
          </span>
        </button>

        <Link
          to="/upsell/$id"
          params={{ id }}
          replace
          className="mt-4 block text-center text-[13px] text-muted-foreground underline"
        >
          Não, obrigado. Vou jogar sem as recarregáveis.
        </Link>
      </div>
    </Shell>
  );
}
