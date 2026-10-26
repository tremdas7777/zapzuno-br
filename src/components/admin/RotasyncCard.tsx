import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteRotasyncKeyFn,
  enviarPendentesRotasyncFn,
  getRotasyncStatus,
  listarPendentesRotasyncFn,
  saveRotasyncKeyFn,
  testRotasyncKeyFn,
} from "@/lib/rotasync.functions";
import { Pill, SettingCard, SettingHeader } from "./kit";

type Pendente = {
  id: string;
  criadoEm: string;
  cliente: string;
  itens: string[];
  totalCents: number;
};
type Resultado = { ok: boolean; error?: string; trackingCode?: string };

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataCurta = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export interface RotasyncCardProps {
  password: string;
}

/** Integração RotaSync: chave da loja salva no banco, com troca, exclusão e teste (sem criar pedido). */
export function RotasyncCard({ password }: RotasyncCardProps) {
  const statusFn = useServerFn(getRotasyncStatus);
  const saveFn = useServerFn(saveRotasyncKeyFn);
  const deleteFn = useServerFn(deleteRotasyncKeyFn);
  const testFn = useServerFn(testRotasyncKeyFn);
  const listarFn = useServerFn(listarPendentesRotasyncFn);
  const enviarFn = useServerFn(enviarPendentesRotasyncFn);

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [source, setSource] = useState<"admin" | "env" | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Pedidos antigos (pagos antes da chave)
  const [pendentes, setPendentes] = useState<Pendente[] | null>(null);
  const [semEndereco, setSemEndereco] = useState(0);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msgAntigos, setMsgAntigos] = useState<string | null>(null);

  const refresh = () =>
    statusFn({ data: { password } })
      .then((r) => {
        setConfigured(r.configured);
        setMaskedKey(r.maskedKey);
        setSource(r.source);
      })
      .catch(() => setConfigured(false));

  useEffect(() => {
    if (!password) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await saveFn({ data: { password, key: key.trim() } });
      if (!r.ok) {
        setMsg(`A RotaSync recusou essa chave: ${r.error ?? "chave inválida"}`);
        return;
      }
      setKey("");
      setMsg(
        r.test?.ok
          ? "Chave salva e aceita pela RotaSync. Os próximos pedidos pagos já vão para lá."
          : `Chave salva, mas não deu para confirmar agora (${r.test?.error ?? "sem resposta"}). Use "Testar".`,
      );
      refresh();
    } catch {
      setMsg("Falhou ao salvar a chave.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setMsg(null);
    try {
      await deleteFn({ data: { password } });
      setMsg("Chave apagada. Os pedidos pagos não vão mais para a RotaSync.");
      refresh();
    } catch {
      setMsg("Falhou ao apagar a chave.");
    } finally {
      setDeleting(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const r = await testFn({ data: { password } });
      setMsg(
        r.ok
          ? "Conexão OK: a RotaSync aceitou a chave. (Teste sem criar pedido.)"
          : `A RotaSync recusou${r.status ? ` (HTTP ${r.status})` : ""}: ${r.error ?? "sem detalhes"}`,
      );
    } catch {
      setMsg("Falhou ao testar.");
    } finally {
      setTesting(false);
    }
  };

  const buscarPendentes = async () => {
    setBuscando(true);
    setMsgAntigos(null);
    setResultados({});
    try {
      const r = await listarFn({ data: { password } });
      setPendentes(r.pendentes);
      setSemEndereco(r.semEndereco);
      setMarcados(new Set(r.pendentes.map((p) => p.id)));
    } catch {
      setMsgAntigos("Falhou ao buscar os pedidos.");
    } finally {
      setBuscando(false);
    }
  };

  const alternar = (id: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const enviarMarcados = async () => {
    if (!pendentes) return;
    const ids = pendentes.filter((p) => marcados.has(p.id)).map((p) => p.id);
    if (!ids.length) return;
    setEnviando(true);
    setMsgAntigos(null);
    try {
      const r = await enviarFn({ data: { password, ids } });
      const novos: Record<string, Resultado> = { ...resultados };
      for (const x of r) novos[x.id] = x;
      setResultados(novos);
      const ok = r.filter((x) => x.ok).length;
      setMsgAntigos(
        `${ok} de ${r.length} pedido(s) enviados.${ok < r.length ? " Veja o motivo nos que falharam." : ""}`,
      );
      // Os enviados saem da seleção (não manda de novo por engano).
      setMarcados((m) => new Set([...m].filter((id) => !r.some((x) => x.id === id && x.ok))));
    } catch {
      setMsgAntigos("Falhou ao enviar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SettingCard>
      <SettingHeader
        icon={<Truck />}
        title="RotaSync"
        description="Cada pedido pago vai para a RotaSync com endereço e itens (tamanho e cor), e o código de rastreio volta para a página de rastreio do cliente."
        status={
          configured === null ? null : configured ? (
            <Pill tone="green">{source === "env" ? "Conectada (variável)" : "Conectada"}</Pill>
          ) : (
            <Pill tone="amber">Sem chave</Pill>
          )
        }
      />
      {configured === false && (
        <p className="rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-xs text-[#b54708]">
          Sem chave, os pedidos pagos não vão para a RotaSync.
        </p>
      )}
      {maskedKey && (
        <p className="text-xs text-[#667085]">
          Chave atual: <span className="font-mono text-[#98a2b3]">{maskedKey}</span>
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="password"
          placeholder={
            configured
              ? "Chave salva — cole uma nova para trocar"
              : "Cole a chave da loja na RotaSync"
          }
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <Button disabled={!key.trim() || saving} onClick={save}>
          {saving ? "Conferindo…" : "Salvar chave"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={!configured || testing} onClick={runTest}>
          {testing ? "Testando…" : "Testar conexão"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-[#b42318] hover:bg-[#fef3f2] hover:text-[#b42318]"
          disabled={source !== "admin" || deleting}
          onClick={remove}
        >
          {deleting ? "Apagando…" : "Apagar chave"}
        </Button>
      </div>
      {msg && <p className="rounded-lg bg-[#f2f4f7] px-3 py-2 text-xs text-[#344054]">{msg}</p>}

      {configured && (
        <div className="flex flex-col gap-3 border-t border-[#eef0f3] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[#101828]">Pedidos antigos</div>
              <div className="text-xs text-[#667085]">
                Pedidos pagos que ainda não foram para a RotaSync. Desmarque os que você já
                despachou por outro caminho antes de enviar.
              </div>
            </div>
            <Button size="sm" variant="outline" disabled={buscando} onClick={buscarPendentes}>
              {buscando ? "Buscando…" : pendentes ? "Atualizar lista" : "Ver pedidos"}
            </Button>
          </div>

          {pendentes &&
            (pendentes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum pedido pago faltando na RotaSync.
                {semEndereco > 0 &&
                  ` (${semEndereco} pedido(s) sem endereço completo não podem ir.)`}
              </p>
            ) : (
              <>
                <ul className="max-h-96 divide-y divide-[#eef0f3] overflow-auto rounded-lg border border-[#e4e7ec] text-sm">
                  {pendentes.map((p) => {
                    const r = resultados[p.id];
                    return (
                      <li key={p.id} className="flex gap-3 p-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0"
                          checked={marcados.has(p.id)}
                          disabled={enviando || r?.ok}
                          onChange={() => alternar(p.id)}
                          aria-label={`Enviar o pedido de ${p.cliente}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <span className="font-medium">{p.cliente}</span>
                            <span className="text-xs text-muted-foreground">
                              {dataCurta(p.criadoEm)} · {brl(p.totalCents)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">{p.itens.join(" · ")}</div>
                          {r && (
                            <div
                              className={`mt-1 text-xs ${r.ok ? "text-green-700" : "text-destructive"}`}
                            >
                              {r.ok
                                ? `Enviado${r.trackingCode ? ` · rastreio ${r.trackingCode}` : ""}${r.error ? ` (${r.error})` : ""}`
                                : `Não foi: ${r.error ?? "erro"}`}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    disabled={enviando || marcados.size === 0}
                    onClick={enviarMarcados}
                  >
                    {enviando ? "Enviando…" : `Enviar ${marcados.size} pedido(s)`}
                  </Button>
                  {semEndereco > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {semEndereco} pedido(s) sem endereço completo não podem ir.
                    </span>
                  )}
                </div>
              </>
            ))}
          {msgAntigos && (
            <p className="rounded-lg bg-[#f2f4f7] px-3 py-2 text-xs text-[#344054]">{msgAntigos}</p>
          )}
        </div>
      )}
    </SettingCard>
  );
}
