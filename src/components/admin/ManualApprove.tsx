import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveOrderFn, type AdminOrder } from "@/lib/admin.functions";
import { fmtDateTime, isPaid, statusLabel } from "@/lib/admin-format";

/**
 * Pedido sem pagamento confirmado: confere no gateway e aprova se já foi pago. Se o gateway ainda
 * não mostrar o pagamento, deixa aprovar na mão (comprovante do cliente, Pix na conta).
 */
export function ManualApprove({
  order: o,
  password,
  onApproved,
}: {
  order: AdminOrder;
  password: string;
  onApproved: () => void;
}) {
  const approve = useServerFn(approveOrderFn);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Status do gateway quando ele ainda não mostra o pagamento (libera o "Aprovar mesmo assim").
  const [naoPago, setNaoPago] = useState<string | null>(null);
  const manual = o.customer?.manualApproval;

  if (isPaid(o)) {
    if (!manual) return null;
    return (
      <p className="flex items-center gap-2 rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-xs text-[#b54708]">
        <BadgeCheck className="h-4 w-4 shrink-0" />
        Aprovado manualmente em {fmtDateTime(manual.at)}
        {manual.gatewayStatus ? ` (gateway dizia: ${statusLabel(manual.gatewayStatus)})` : ""}
      </p>
    );
  }

  const run = async (forcar: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await approve({ data: { password, id: o.id, forcar } });
      if (r.approved) {
        setNaoPago(null);
        setMsg(
          r.manual
            ? "Pedido aprovado manualmente. Foi para a UTMify e para o envio como pago."
            : "Pagamento confirmado no gateway. Pedido aprovado.",
        );
        onApproved();
      } else {
        setNaoPago(r.gatewayStatus ?? "sem resposta");
      }
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Não deu para aprovar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#eef0f3] p-3">
      <p className="text-sm font-medium text-[#101828]">Pagamento não confirmado</p>
      <p className="mt-0.5 text-xs text-[#667085]">
        O cliente pagou e o pedido não mudou? Confira no gateway e aprove.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className="h-9" disabled={busy} onClick={() => run(false)}>
          {busy && !naoPago ? "Conferindo…" : "Conferir e aprovar"}
        </Button>
      </div>
      {naoPago && (
        <div className="mt-3 rounded-lg border border-[#fedf89] bg-[#fffaeb] p-3 text-xs text-[#b54708]">
          <p>
            O gateway ainda diz: <strong>{statusLabel(naoPago)}</strong>. Só aprove se você conferiu
            o Pix na conta ou o comprovante do cliente. O pedido conta como venda na UTMify e vai
            para o envio.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-8 border-[#b54708] text-[#b54708] hover:bg-[#fef0c7] hover:text-[#b54708]"
            disabled={busy}
            onClick={() => run(true)}
          >
            {busy ? "Aprovando…" : "Aprovar mesmo assim"}
          </Button>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-[#344054]">{msg}</p>}
    </div>
  );
}
