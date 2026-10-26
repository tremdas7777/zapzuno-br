import { trackFunnelEvent } from "@/lib/checkout-tracking.functions";

const SESSION_KEY = "bshop_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const UTM_KEYS = [
  "src",
  "sck",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
const UTM_STORE = "bshop_utms";

/** Guarda as UTMs da primeira visita com UTM (localStorage) para enviá-las na venda. */
export function getStoredUtms(): Record<string, string | null> {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const fromUrl: Record<string, string | null> = {};
  for (const k of UTM_KEYS) {
    const v = p.get(k);
    if (v) fromUrl[k] = v.slice(0, 300);
  }
  try {
    if (Object.keys(fromUrl).length) {
      localStorage.setItem(UTM_STORE, JSON.stringify(fromUrl));
      return fromUrl;
    }
    const raw = localStorage.getItem(UTM_STORE);
    return raw ? (JSON.parse(raw) as Record<string, string | null>) : {};
  } catch {
    return fromUrl;
  }
}

function getUtmParams() {
  const u = getStoredUtms();
  return {
    utm_source: u["utm_source"] ?? null,
    utm_medium: u["utm_medium"] ?? null,
    utm_campaign: u["utm_campaign"] ?? null,
  };
}

export type FunnelEventInput = {
  event_type: "page_view" | "product_view" | "checkout_click";
  path?: string;
  bundle_id?: string;
  bundle_name?: string;
  value?: number;
  metadata?: Record<string, unknown>;
};

export async function trackEvent(input: FunnelEventInput) {
  if (typeof window === "undefined") return;
  try {
    const utm = getUtmParams();
    const source = input.metadata?.["source"];
    await trackFunnelEvent({
      data: {
        sessionId: getSessionId(),
        event_type: input.event_type,
        path: (input.path ?? window.location.pathname).slice(0, 300),
        bundle_id: input.bundle_id?.slice(0, 80) ?? null,
        bundle_name: input.bundle_name?.slice(0, 160) ?? null,
        value: input.value ?? null,
        referrer: document.referrer ? document.referrer.slice(0, 500) : null,
        user_agent: navigator.userAgent.slice(0, 400),
        utm_source: utm.utm_source?.slice(0, 300) ?? null,
        utm_medium: utm.utm_medium?.slice(0, 300) ?? null,
        utm_campaign: utm.utm_campaign?.slice(0, 300) ?? null,
        source: typeof source === "string" ? source.slice(0, 60) : null,
      },
    });
  } catch (e) {
    console.warn("trackEvent failed", e);
  }
}
