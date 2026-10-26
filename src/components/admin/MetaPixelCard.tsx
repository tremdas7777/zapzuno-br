import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMetaAdmin, saveMetaAdmin, testMetaAdmin } from "@/lib/meta.functions";
import { Pill, SettingCard, SettingHeader } from "./kit";

export interface MetaPixelCardProps {
  password: string;
}

/** Configuração do Pixel do Meta + API de Conversões (token). */
export function MetaPixelCard({ password }: MetaPixelCardProps) {
  const loadFn = useServerFn(getMetaAdmin);
  const saveFn = useServerFn(saveMetaAdmin);
  const testFn = useServerFn(testMetaAdmin);
  const [pixelId, setPixelId] = useState("");
  const [token, setToken] = useState("");
  const [testCode, setTestCode] = useState("");
  const [tokenHint, setTokenHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!password) return;
    loadFn({ data: { password } })
      .then((r) => {
        setPixelId(r.pixelId);
        setTestCode(r.testCode);
        setTokenHint(r.tokenHint);
      })
      .catch(() => setMsg("Não foi possível carregar."));
  }, [password, loadFn]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await saveFn({ data: { password, pixelId, accessToken: token || undefined, testCode } });
      if (token) setTokenHint(`••••${token.slice(-4)}`);
      setToken("");
      setMsg("Salvo. O pixel já vale para todas as páginas.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await testFn({ data: { password } });
      setMsg(
        r.ok
          ? "Evento de teste enviado. Veja em Gerenciador de Eventos > Testar eventos."
          : `Falhou: ${r.error ?? "erro"}`,
      );
    } catch {
      setMsg("Falhou ao enviar o teste.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingCard>
      <SettingHeader
        icon={<Target />}
        title="Pixel do Meta (opcional)"
        description="As vendas já chegam ao Meta pela UTMify. Preencha só se quiser o pixel direto, pelo navegador e pela API de Conversões, sem contar em dobro."
        status={
          tokenHint ? <Pill tone="green">Configurado</Pill> : <Pill tone="gray">Não usado</Pill>
        }
      />
      <form onSubmit={save} className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1.5 text-xs font-medium text-[#344054]">
          <span>ID do pixel</span>
          <Input
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            required
          />
        </label>
        <label className="space-y-1.5 text-xs font-medium text-[#344054]">
          <span>Token de acesso {tokenHint && `(atual ${tokenHint})`}</span>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={tokenHint ? "Deixe vazio para manter" : "EAA..."}
            autoComplete="off"
          />
        </label>
        <label className="space-y-1.5 text-xs font-medium text-[#344054]">
          <span>Código de teste (opcional)</span>
          <Input
            value={testCode}
            onChange={(e) => setTestCode(e.target.value)}
            placeholder="TEST12345"
          />
        </label>
        <div className="md:col-span-3 flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={busy || !pixelId}>
            Salvar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !tokenHint}
            onClick={test}
          >
            Enviar teste
          </Button>
          {msg && <span className="text-xs text-[#344054]">{msg}</span>}
        </div>
      </form>
    </SettingCard>
  );
}
