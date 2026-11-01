export type PaidOrderReport = {
  id: string;
  paid_reported_at: string | null;
  report_result: { utmify?: { ok?: boolean }; skipped?: string; at?: string } | null;
};

const ESPERA_ENTRE_TENTATIVAS_MS = 2 * 60_000;
// Envio em andamento tem a trava recente; trava mais velha que isto é de processo que morreu no meio.
const TRAVA_PRESA_MS = 5 * 60_000;

/** Venda paga que a UTMify ainda não confirmou e já pode ser reenviada. */
export function needsUtmifyRetry(o: PaidOrderReport, now: number): boolean {
  const r = o.report_result ?? {};
  // Cobrança de teste do admin, ou a UTMify já confirmou (inclui a venda antiga marcada como pulada).
  if (r.skipped || r.utmify?.ok) return false;
  if (r.at && now - Date.parse(r.at) < ESPERA_ENTRE_TENTATIVAS_MS) return false;
  return !o.paid_reported_at || now - Date.parse(o.paid_reported_at) > TRAVA_PRESA_MS;
}
