import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/admin-format";
import { Pill, SettingCard, SettingHeader } from "./kit";
import {
  deleteKokuKeyFn,
  deletePixBlackKeyFn,
  deletePaySharkKeyFn,
  deletePixgateKeyFn,
  deleteSagacePayKeyFn,
  deleteUmbrellaKeyFn,
  getPixGatewayStatus,
  saveKokuKeyFn,
  savePixBlackKeyFn,
  savePaySharkKeyFn,
  savePixgateKeyFn,
  saveSagacePayKeyFn,
  saveUmbrellaKeyFn,
  setPixGatewayFn,
  testKokuFn,
  testPixBlackFn,
  testPaySharkFn,
  testPixgateFn,
  testSagacePayFn,
  testUmbrellaFn,
} from "@/lib/pix-gateway.functions";

type Gateway = "pixgate" | "umbrella" | "sagacepay" | "payshark" | "koku" | "pixblack";
const GATEWAYS = ["pixgate", "umbrella", "sagacepay", "payshark", "koku", "pixblack"] as const;
type KeyInfo = { key: string | null; source: "admin" | "secret" | null };
type Status = {
  selected: Gateway;
  active: Gateway;
  configured: Record<Gateway, boolean>;
  keys: Record<Gateway, KeyInfo>;
  lastFallback: { from: Gateway; to: Gateway; reason: string; at: string } | null;
};

const LABEL: Record<Gateway, string> = {
  pixgate: "PixGate",
  umbrella: "Umbrella",
  sagacepay: "SagacePay",
  payshark: "PayShark",
  koku: "Koku",
  pixblack: "Pix Black",
};
const SECRET: Record<Gateway, string> = {
  pixgate: "PIXGATE_API_KEY",
  umbrella: "UMBRELLA_API_KEY",
  sagacepay: "SAGACEPAY_API_KEY",
  payshark: "PAYSHARK_API_KEY",
  koku: "KOKU_API_KEY",
  pixblack: "PIXBLACK_API_KEY",
};

/** Escolha do gateway do Pix (PixGate, Umbrella, SagacePay, PayShark, Koku ou Pix Black) + chave de cada um. */
export function PixGatewayCard({ password }: { password: string }) {
  const statusFn = useServerFn(getPixGatewayStatus);
  const setFn = useServerFn(setPixGatewayFn);
  const savePixgateFn = useServerFn(savePixgateKeyFn);
  const deletePixgateFn = useServerFn(deletePixgateKeyFn);
  const saveUmbrellaFn = useServerFn(saveUmbrellaKeyFn);
  const deleteUmbrellaFn = useServerFn(deleteUmbrellaKeyFn);
  const testPixgate = useServerFn(testPixgateFn);
  const testUmbrella = useServerFn(testUmbrellaFn);
  const saveSagaceFn = useServerFn(saveSagacePayKeyFn);
  const deleteSagaceFn = useServerFn(deleteSagacePayKeyFn);
  const testSagace = useServerFn(testSagacePayFn);
  const savePaySharkFn = useServerFn(savePaySharkKeyFn);
  const deletePaySharkFn = useServerFn(deletePaySharkKeyFn);
  const testPayShark = useServerFn(testPaySharkFn);
  const saveKokuFn = useServerFn(saveKokuKeyFn);
  const deleteKokuFn = useServerFn(deleteKokuKeyFn);
  const testKoku = useServerFn(testKokuFn);
  const savePixBlackFn = useServerFn(savePixBlackKeyFn);
  const deletePixBlackFn = useServerFn(deletePixBlackKeyFn);
  const testPixBlack = useServerFn(testPixBlackFn);
  const keyFns = {
    pixgate: { save: savePixgateFn, remove: deletePixgateFn, test: testPixgate },
    umbrella: { save: saveUmbrellaFn, remove: deleteUmbrellaFn, test: testUmbrella },
    sagacepay: { save: saveSagaceFn, remove: deleteSagaceFn, test: testSagace },
    payshark: { save: savePaySharkFn, remove: deletePaySharkFn, test: testPayShark },
    koku: { save: saveKokuFn, remove: deleteKokuFn, test: testKoku },
    pixblack: { save: savePixBlackFn, remove: deletePixBlackFn, test: testPixBlack },
  };

  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => {
    statusFn({ data: { password } })
      .then(setStatus)
      .catch(() => setStatus(null));
  };

  useEffect(() => {
    if (password) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  /** Executa a ação e mostra o resultado; devolve se deu certo. */
  const run = async (label: string, fn: () => Promise<string>): Promise<boolean> => {
    setBusy(label);
    setMsg(null);
    try {
      setMsg(await fn());
      return true;
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Algo deu errado. Tente de novo.");
      return false;
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const choose = (gateway: Gateway) =>
    run(`set-${gateway}`, async () => {
      await setFn({ data: { password, gateway } });
      return `Pronto: os próximos Pix saem pela ${LABEL[gateway]}. Pedidos já gerados continuam no gateway de origem.`;
    });

  const saveKey = (gateway: Gateway, key: string) =>
    run(`save-${gateway}`, async () => {
      await keyFns[gateway].save({ data: { password, key } });
      return `Chave da ${LABEL[gateway]} salva. Os próximos Pix da ${LABEL[gateway]} já usam esta chave.`;
    });

  const deleteKey = (gateway: Gateway) =>
    run(`delete-${gateway}`, async () => {
      await keyFns[gateway].remove({ data: { password } });
      return `Chave da ${LABEL[gateway]} apagada do painel.`;
    });

  /** Consulta o gateway com a chave em uso, sem gerar Pix nem pedido. */
  const testKey = (gateway: Gateway) =>
    run(`test-${gateway}`, async () => {
      const r: { ok: boolean; status?: number; error?: string; note?: string } = await keyFns[
        gateway
      ].test({ data: { password } });
      return r.ok
        ? `Chave da ${LABEL[gateway]} aceita (teste sem gerar pedido).${r.note ? ` ${r.note}` : ""}`
        : `Chave da ${LABEL[gateway]} com problema: ${r.error ?? `erro ${r.status ?? ""}`}`;
    });

  return (
    <SettingCard>
      <SettingHeader
        icon={<ArrowLeftRight />}
        title="Gateway do Pix"
        description="Quem gera os próximos Pix. A troca vale na hora; pedidos já gerados continuam sendo confirmados pelo gateway em que foram criados. Se o gateway em uso falhar, o Pix sai sozinho pelo próximo que tiver chave."
        status={status ? <Pill tone="green">Em uso: {LABEL[status.active]}</Pill> : null}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {GATEWAYS.map((g) => {
          const on = status?.selected === g;
          const temChave = !!status?.configured[g];
          return (
            <button
              key={g}
              type="button"
              disabled={!status || !!busy || on}
              onClick={() => choose(g)}
              className={cn(
                "relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors disabled:cursor-default",
                on
                  ? "border-[var(--adm-brand)] bg-[var(--adm-brand-soft)] ring-1 ring-[var(--adm-brand)]"
                  : "border-[#e4e7ec] bg-white hover:border-[#d0d5dd] hover:bg-[#f9fafb]",
              )}
            >
              <span className="text-sm font-semibold text-[#101828]">
                {busy === `set-${g}` ? "Salvando…" : LABEL[g]}
              </span>
              <span className={cn("text-xs", temChave ? "text-[#067647]" : "text-[#98a2b3]")}>
                {status ? (temChave ? "Chave cadastrada" : "Sem chave") : "…"}
              </span>
              {on && (
                <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-[var(--adm-brand)]" />
              )}
            </button>
          );
        })}
      </div>

      {status && status.active !== status.selected && (
        <p className="rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-xs text-[#b54708]">
          A {LABEL[status.selected]} está escolhida mas sem chave, então o checkout está usando a{" "}
          {LABEL[status.active]}. Cadastre a chave para ela entrar em uso.
        </p>
      )}

      {status?.lastFallback && <LastFallback f={status.lastFallback} />}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#98a2b3]">
          Chaves de API
        </p>
        <ul className="divide-y divide-[#eef0f3] rounded-lg border border-[#e4e7ec]">
          {GATEWAYS.map((g) => (
            <KeySection
              key={g}
              gateway={g}
              info={status?.keys[g] ?? null}
              loading={status === null}
              busy={busy}
              onSave={(key) => saveKey(g, key)}
              onDelete={() => deleteKey(g)}
              onTest={() => testKey(g)}
            />
          ))}
        </ul>
      </div>
      {msg && <p className="rounded-lg bg-[#f2f4f7] px-3 py-2 text-xs text-[#344054]">{msg}</p>}
    </SettingCard>
  );
}

/** Última vez que o Pix saiu pelo gateway reserva. Destaque nas primeiras 24 h. */
function LastFallback({ f }: { f: NonNullable<Status["lastFallback"]> }) {
  const recente = Date.now() - new Date(f.at).getTime() < 86_400_000;
  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-2 text-xs",
        recente
          ? "border-[#fedf89] bg-[#fffaeb] text-[#b54708]"
          : "border-[#e4e7ec] bg-[#f9fafb] text-[#475467]",
      )}
    >
      Última troca automática: {LABEL[f.from]} → {LABEL[f.to]} em {fmtDateTime(f.at)}.
      {f.reason && ` Motivo: ${f.reason}`}
      {recente && ` Teste a chave da ${LABEL[f.from]} ou troque o gateway acima.`}
    </p>
  );
}

function KeySection({
  gateway,
  info,
  loading,
  busy,
  onSave,
  onDelete,
  onTest,
}: {
  gateway: Gateway;
  info: KeyInfo | null;
  loading: boolean;
  busy: string | null;
  onSave: (key: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onTest: () => Promise<boolean>;
}) {
  const [key, setKey] = useState("");
  const [editando, setEditando] = useState(false);
  const fonte = loading ? null : info?.source;

  return (
    <li className="px-3 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[#101828]">{LABEL[gateway]}</span>
            {loading ? (
              <span className="text-xs text-[#98a2b3]">…</span>
            ) : fonte === "admin" ? (
              <Pill tone="green">Chave do painel</Pill>
            ) : fonte === "secret" ? (
              <Pill tone="blue">Secret do Lovable</Pill>
            ) : (
              <Pill tone="gray">Sem chave</Pill>
            )}
          </div>
          {info?.key && <p className="mt-0.5 font-mono text-xs text-[#98a2b3]">{info.key}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!info?.source || !!busy}
            onClick={onTest}
          >
            {busy === `test-${gateway}` ? "Testando…" : "Testar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!!busy}
            onClick={() => setEditando((v) => !v)}
          >
            {editando ? "Cancelar" : info?.source ? "Trocar" : "Cadastrar"}
          </Button>
          {info?.source === "admin" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[#b42318] hover:bg-[#fef3f2] hover:text-[#b42318]"
              disabled={!!busy}
              onClick={onDelete}
            >
              {busy === `delete-${gateway}` ? "Apagando…" : "Apagar"}
            </Button>
          )}
        </div>
      </div>
      {editando && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            type="password"
            autoComplete="off"
            aria-label={`Chave da API ${LABEL[gateway]}`}
            placeholder={`Cole a chave da API ${LABEL[gateway]}`}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <Button
            disabled={key.trim().length < 10 || !!busy}
            onClick={() =>
              onSave(key.trim()).then((ok) => {
                if (ok) {
                  setKey("");
                  setEditando(false);
                }
              })
            }
          >
            {busy === `save-${gateway}` ? "Salvando…" : "Salvar chave"}
          </Button>
        </div>
      )}
      {editando && (
        <p className="mt-1.5 text-xs text-[#98a2b3]">
          A chave salva aqui tem prioridade. Sem ela, vale o secret {SECRET[gateway]} do Lovable.
        </p>
      )}
    </li>
  );
}
