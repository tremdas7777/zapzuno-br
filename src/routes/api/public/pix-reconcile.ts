import { createFileRoute } from "@tanstack/react-router";

// Conferência agendada dos Pix não pagos (chamada a cada minuto por um agendamento no banco).
// Pública e sem dados: só consulta o gateway e marca os pagos; a trava em reconcilePendingPix
// limita a 1 rodada a cada 50 s, então chamar mais vezes não pesa no gateway.
async function rodar() {
  const { reconcilePendingPix } = await import("@/lib/pix-orders.server");
  const r = await reconcilePendingPix().catch((e) => {
    console.error("pix-reconcile failed", e);
    return { checked: 0, paid: 0 };
  });
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/public/pix-reconcile")({
  server: { handlers: { GET: rodar, POST: rodar } },
});
