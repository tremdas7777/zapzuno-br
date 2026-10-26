import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getPixStatus } from "@/lib/pix.functions";
import { loadPixSession, pendingPixIds } from "@/lib/pix-session";

/**
 * Cliente que gerou o Pix, saiu da tela do pedido (voltou para o produto, recarregou o site) e pagou
 * no app do banco: quando o pagamento cai, leva para /pedido, que dispara a compra uma vez e segue
 * para o pós-compra. Fora do checkout (não interrompe uma compra em andamento) e das telas do pedido.
 */
const FORA = /^\/(pedido|pilhas|upsell|expresso|obrigado|checkout|admin)(\/|$)/;
/** O Pix expira em 30 min; a folga cobre a confirmação atrasada do banco. */
const JANELA_MS = 45 * 60 * 1000;
const INTERVALO_MS = 8000;

export function PixPaidWatcher() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const statusFn = useServerFn(getPixStatus);

  useEffect(() => {
    if (FORA.test(pathname)) return;
    let parado = false;
    let rodando = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checar = async () => {
      if (parado || rodando) return;
      // Nada pendente: não consulta mais até a próxima troca de página.
      const ids = pendingPixIds(JANELA_MS).slice(0, 3);
      if (!ids.length) return;
      rodando = true;
      try {
        if (document.visibilityState === "visible") {
          for (const id of ids) {
            const s = loadPixSession(id);
            const r = await statusFn({
              data: {
                id,
                report: { fbp: s?.fbp ?? null, fbc: s?.fbc ?? null, url: window.location.href },
              },
            }).catch(() => null);
            if (parado) return;
            if (r?.paid) {
              parado = true;
              navigate({ to: "/pedido/$id", params: { id } });
              return;
            }
          }
        }
      } finally {
        rodando = false;
      }
      if (!parado) timer = setTimeout(checar, INTERVALO_MS);
    };

    // Voltando do app do banco: confere na hora, sem esperar o próximo ciclo.
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void checar();
    };
    timer = setTimeout(checar, 1500);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      parado = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [pathname, navigate, statusFn]);

  return null;
}
