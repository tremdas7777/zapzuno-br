import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  deleteHypercashKeysFn,
  getHypercashStatus,
  saveHypercashKeysFn,
  testHypercashFn,
} from "@/lib/hypercash.functions";
import { Pill, SettingCard, SettingHeader } from "./kit";
import { getSiteSettings, setCardEnabled } from "@/lib/site-settings.functions";

/** Cartão de crédito (HyperCash): chaves salvas no banco + liga/desliga no checkout. */
export function HypercashCard({ password }: { password: string }) {
  const statusFn = useServerFn(getHypercashStatus);
  const saveFn = useServerFn(saveHypercashKeysFn);
  const deleteFn = useServerFn(deleteHypercashKeysFn);
  const testFn = useServerFn(testHypercashFn);
  const settingsFn = useServerFn(getSiteSettings);
  const toggleFn = useServerFn(setCardEnabled);

  const [masked, setMasked] = useState<{ secret: string | null; public: string | null } | null>(
    null,
  );
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [secret, setSecret] = useState("");
  const [pub, setPub] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => {
    statusFn({ data: { password } })
      .then(setMasked)
      .catch(() => setMasked({ secret: null, public: null }));
    settingsFn()
      .then((s) => setEnabled(s.cardEnabled))
      .catch(() => undefined);
  };

  useEffect(() => {
    if (password) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setMsg(null);
    try {
      setMsg(await fn());
    } catch {
      setMsg("Algo deu errado. Tente de novo.");
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const save = () =>
    run("save", async () => {
      await saveFn({
        data: {
          password,
          ...(secret.trim() ? { secret: secret.trim() } : {}),
          ...(pub.trim() ? { public: pub.trim() } : {}),
        },
      });
      setSecret("");
      setPub("");
      return "Chaves salvas.";
    });

  const remove = () =>
    run("delete", async () => {
      await deleteFn({ data: { password } });
      return "Chaves apagadas. O cartão some do checkout.";
    });

  const test = () =>
    run("test", async () => {
      const r = await testFn({ data: { password } });
      return r.ok
        ? "Conexão OK: a HyperCash aceitou a chave secreta. (Nenhuma cobrança foi criada.)"
        : `Falhou${r.status ? ` (HTTP ${r.status})` : ""}: ${r.error ?? "sem detalhes"}`;
    });

  const toggle = () =>
    run("toggle", async () => {
      const r = await toggleFn({ data: { password, enabled: !enabled } });
      return r.enabled ? "Cartão ativado no checkout." : "Cartão desativado: checkout só com Pix.";
    });

  const hasKeys = !!masked?.secret && !!masked?.public;
  const live = enabled && hasKeys;

  return (
    <SettingCard>
      <SettingHeader
        icon={<CreditCard />}
        title="Cartão de crédito (HyperCash)"
        description="Ligado: cartão em até 12x pelo preço cheio e o Pix ganha 10% de desconto. Desligado, os clientes veem só o Pix, mas você, logado neste painel, ainda vê o cartão para testar (abra o checkout nesta mesma aba)."
        status={
          enabled === null ? null : live ? (
            <Pill tone="green">Ativo</Pill>
          ) : !enabled ? (
            <Pill tone="gray">Desligado</Pill>
          ) : (
            <Pill tone="amber">Sem chaves</Pill>
          )
        }
      />
      <label className="flex items-center justify-between gap-4 rounded-lg border border-[#e4e7ec] bg-[#f9fafb] px-4 py-3">
        <span className="text-sm font-medium text-[#101828]">
          {busy === "toggle" ? "Salvando…" : "Mostrar cartão no checkout"}
        </span>
        <Switch
          checked={!!enabled}
          disabled={!!busy || enabled === null}
          onCheckedChange={() => toggle()}
          aria-label="Mostrar cartão no checkout"
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="password"
          autoComplete="off"
          placeholder={
            masked?.public ? `Chave pública salva (${masked.public})` : "Chave pública (pk_…)"
          }
          value={pub}
          onChange={(e) => setPub(e.target.value)}
        />
        <Input
          type="password"
          autoComplete="off"
          placeholder={masked?.secret ? `Chave secreta salva (${masked.secret})` : "Chave secreta"}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={(!secret.trim() && !pub.trim()) || !!busy} onClick={save}>
          {busy === "save" ? "Salvando…" : "Salvar chaves"}
        </Button>
        <Button size="sm" variant="outline" disabled={!masked?.secret || !!busy} onClick={test}>
          {busy === "test" ? "Testando…" : "Testar conexão"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-[#b42318] hover:bg-[#fef3f2] hover:text-[#b42318]"
          disabled={(!masked?.secret && !masked?.public) || !!busy}
          onClick={remove}
        >
          {busy === "delete" ? "Apagando…" : "Apagar chaves"}
        </Button>
      </div>
      {msg && <p className="rounded-lg bg-[#f2f4f7] px-3 py-2 text-xs text-[#344054]">{msg}</p>}
    </SettingCard>
  );
}
