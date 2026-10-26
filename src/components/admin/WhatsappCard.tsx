import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getSiteSettings,
  setWhatsappEnabled,
  setWhatsappMessage,
  setWhatsappNumber,
} from "@/lib/site-settings.functions";
import { formatWhatsapp, normalizeWhatsapp, whatsappLink } from "@/lib/whatsapp";
import { Pill, SettingCard, SettingHeader } from "./kit";

export interface WhatsappCardProps {
  password: string;
}

/** WhatsApp do site (rodapé e contato): liga/desliga, número e mensagem pronta. */
export function WhatsappCard({ password }: WhatsappCardProps) {
  const fetchSettings = useServerFn(getSiteSettings);
  const saveEnabledFn = useServerFn(setWhatsappEnabled);
  const saveNumberFn = useServerFn(setWhatsappNumber);
  const saveMessageFn = useServerFn(setWhatsappMessage);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [draft, setDraft] = useState("");
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState<"phone" | "message" | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!password) return;
    fetchSettings()
      .then((s) => {
        setEnabled(s.whatsappEnabled);
        setPhone(s.whatsappPhone);
        setMessage(s.whatsappMessage);
        setDraft(s.whatsappMessage);
      })
      .catch(() => {});
  }, [password, fetchSettings]);

  const toggle = async () => {
    if (enabled === null) return;
    setToggling(true);
    try {
      const r = await saveEnabledFn({ data: { password, enabled: !enabled } });
      setEnabled(r.enabled);
    } finally {
      setToggling(false);
    }
  };

  const savePhone = async () => {
    const normalized = normalizeWhatsapp(newPhone);
    if (!normalized) {
      setMsg("Número inválido. Digite o DDD e o número, ex.: (11) 98765-4321.");
      return;
    }
    setSaving("phone");
    setMsg(null);
    try {
      const r = await saveNumberFn({ data: { password, phone: normalized } });
      setPhone(r.phone);
      setNewPhone("");
      setMsg(`Número salvo: ${formatWhatsapp(r.phone)}.`);
    } catch {
      setMsg("Falhou ao salvar o número.");
    } finally {
      setSaving(null);
    }
  };

  const saveMessage = async () => {
    setSaving("message");
    setMsg(null);
    try {
      const r = await saveMessageFn({ data: { password, message: draft } });
      setMessage(r.message);
      setDraft(r.message);
      setMsg("Mensagem salva.");
    } catch {
      setMsg("Falhou ao salvar a mensagem.");
    } finally {
      setSaving(null);
    }
  };

  const link = phone ? whatsappLink(phone, message) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Não deu para copiar. Selecione o link e copie.");
    }
  };

  return (
    <SettingCard>
      <SettingHeader
        icon={<MessageCircle />}
        title="Botão de WhatsApp"
        description="Aparece no rodapé e na página de contato. Desligado, o botão e o número somem do site."
        status={
          enabled === null ? null : enabled ? (
            <Pill tone="green">Ativo</Pill>
          ) : (
            <Pill tone="gray">Desligado</Pill>
          )
        }
      />
      <label className="flex items-center justify-between gap-4 rounded-lg border border-[#e4e7ec] bg-[#f9fafb] px-4 py-3">
        <span className="text-sm font-medium text-[#101828]">
          {toggling ? "Salvando…" : "Mostrar o WhatsApp no site"}
        </span>
        <Switch
          checked={!!enabled}
          disabled={toggling || enabled === null}
          onCheckedChange={() => toggle()}
          aria-label="Mostrar o WhatsApp no site"
        />
      </label>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-[#101828]">Número</div>
        <div className="text-[13px]">
          {phone ? (
            <span className="text-[#475467]">
              Em uso: <span className="font-semibold text-[#101828]">{formatWhatsapp(phone)}</span>
            </span>
          ) : (
            <span className="text-[#b54708]">
              Nenhum número cadastrado: o botão não aparece no site.
            </span>
          )}
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            savePhone();
          }}
        >
          <Input
            type="tel"
            inputMode="tel"
            placeholder={phone ? "Novo número com DDD" : "Número com DDD, ex.: (11) 98765-4321"}
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="sm:max-w-sm"
          />
          <Button type="submit" size="sm" disabled={!newPhone.trim() || saving === "phone"}>
            {saving === "phone" ? "Salvando…" : phone ? "Trocar número" : "Salvar número"}
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="wa-mensagem" className="text-sm font-medium text-[#101828]">
          Mensagem pronta
        </label>
        <p className="text-xs text-muted-foreground">
          Já vem escrita quando o cliente abre o WhatsApp pelo site.
        </p>
        <Textarea
          id="wa-mensagem"
          rows={2}
          maxLength={500}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="sm:max-w-xl"
        />
        <div>
          <Button
            size="sm"
            disabled={saving === "message" || draft.trim() === message}
            onClick={saveMessage}
          >
            {saving === "message" ? "Salvando…" : "Salvar mensagem"}
          </Button>
        </div>
      </div>

      {link && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-[#101828]">Link do WhatsApp</div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="sm:max-w-xl font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? "Copiado!" : "Copiar link"}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={link} target="_blank" rel="noreferrer">
                  Testar
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {msg && <p className="rounded-lg bg-[#f2f4f7] px-3 py-2 text-xs text-[#344054]">{msg}</p>}
    </SettingCard>
  );
}
