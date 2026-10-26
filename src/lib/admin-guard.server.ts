// Senha do /admin: comparação em tempo constante e trava contra tentativa e erro por IP.
import { getRequest } from "@tanstack/react-start/server";

/** Senhas erradas diferentes aceitas por IP na janela; passou disso, recusa até a janela vencer. */
const LIMITE = 10;
const JANELA_MS = 15 * 60_000;
/** IP → impressão de cada senha errada → quando. Só a impressão (nunca a senha) fica na memória. */
const falhas = new Map<string, Map<number, number>>();

function ipDaRequisicao(): string {
  try {
    const h = getRequest()?.headers;
    return (
      h?.get("cf-connecting-ip") ??
      h?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h?.get("x-real-ip") ??
      "?"
    );
  } catch {
    return "?";
  }
}

/** Compara sem revelar, pelo tempo de resposta, quantos caracteres batem. */
function iguais(a: string, b: string): boolean {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

/** Impressão curta (FNV-1a) para contar senhas erradas diferentes sem guardá-las. */
function impressao(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Confere a senha do admin. Sem ADMIN_PASSWORD configurada, nada passa. Depois de 10 senhas
 * erradas diferentes do mesmo IP em 15 minutos, recusa tudo desse IP até a janela vencer. A
 * mesma senha errada repetida (ex.: uma antiga salva no navegador) conta uma vez só.
 */
export function senhaAdminOk(pwd: string | undefined | null): boolean {
  const esperada = process.env["ADMIN_PASSWORD"];
  if (!esperada || !pwd) return false;
  const ip = ipDaRequisicao();
  const agora = Date.now();
  const doIp = falhas.get(ip) ?? new Map<number, number>();
  for (const [k, t] of doIp) if (agora - t >= JANELA_MS) doIp.delete(k);
  if (doIp.size >= LIMITE) return false;
  if (iguais(pwd, esperada)) return true;
  doIp.set(impressao(pwd), agora);
  if (falhas.size > 5000) falhas.clear();
  falhas.set(ip, doIp);
  return false;
}
