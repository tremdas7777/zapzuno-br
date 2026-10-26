import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteUtmifyTokenFn,
  getUtmifyStatus,
  saveUtmifyTokenFn,
  sendUtmifyTest,
} from "@/lib/utmify.functions";
import { Pill, SettingCard, SettingHeader } from "./kit";

export interface UtmifyCardProps {
  password: string;
}

/** Integração UTMify: token salvo no banco, com troca, exclusão e venda de teste. */
export function UtmifyCard({ password }: UtmifyCardProps) {
  const statusFn = useServerFn(getUtmifyStatus);
  const testFn = useServerFn(sendUtmifyTest);
  const saveFn = useServerFn(saveUtmifyTokenFn);
  const deleteFn = useServerFn(deleteUtmifyTokenFn);

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [maskedToken, setMaskedToken] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () =>
    statusFn({ data: { password } })
      .then((r) => {
        setConfigured(r.configured);
        setMaskedToken(r.maskedToken);
      })
      .catch(() => setConfigured(false));

  useEffect(() => {
    if (!password) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  const save = async () => {
    if (!token.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      await saveFn({ data: { password, token: token.trim() } });
      setToken("");
      setMsg("Token salvo.");
      refresh();
    } catch {
      setMsg("Falhou ao salvar o token.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setMsg(null);
    try {
      await deleteFn({ data: { password } });
      setMsg("Token apagado. As vendas não serão mais enviadas à UTMify.");
      refresh();
    } catch {
      setMsg("Falhou ao apagar o token.");
    } finally {
      setDeleting(false);
    }
  };

  const runTest = async (status: "paid" | "waiting_payment") => {
    setTesting(true);
    setMsg(null);
    try {
      const r = await testFn({ data: { password, status } });
      setMsg(
        r.ok
          ? `Conexão OK: a UTMify aceitou o formato de pedido ${status === "paid" ? "pago" : "pendente"}. (Enviado como teste — não entra nas vendas.)`
          : `A UTMify recusou (HTTP ${r.status ?? "?"}): ${r.error ?? "sem detalhes"}`,
      );
    } catch {
      setMsg("Falhou ao enviar o teste.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <SettingCard>
      <SettingHeader
        icon={<BarChart3 />}
        title="UTMify"
        description="Cada Pix gerado (pendente) e cada pagamento aprovado vai para a UTMify com as UTMs do cliente."
        status={
          configured === null ? null : configured ? (
            <Pill tone="green">Conectada</Pill>
          ) : (
            <Pill tone="gray">Sem token</Pill>
          )
        }
      />
      {maskedToken && (
        <p className="text-xs text-[#667085]">
          Token atual: <span className="font-mono text-[#98a2b3]">{maskedToken}</span>
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="password"
          placeholder={
            configured ? "Token salvo — cole um novo para trocar" : "Cole o token da UTMify"
          }
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Button disabled={!token.trim() || saving} onClick={save}>
          {saving ? "Salvando…" : "Salvar token"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!configured || testing}
          onClick={() => runTest("paid")}
        >
          {testing ? "Testando…" : "Enviar venda de teste (paga)"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!configured || testing}
          onClick={() => runTest("waiting_payment")}
        >
          {testing ? "Testando…" : "Enviar teste (pendente)"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-[#b42318] hover:bg-[#fef3f2] hover:text-[#b42318]"
          disabled={!configured || deleting}
          onClick={remove}
        >
          {deleting ? "Apagando…" : "Apagar token"}
        </Button>
      </div>
      {msg && <p className="rounded-lg bg-[#f2f4f7] px-3 py-2 text-xs text-[#344054]">{msg}</p>}
    </SettingCard>
  );
}
