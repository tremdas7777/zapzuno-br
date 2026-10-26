import { brand } from "@/lib/brand";
import { FREE_SHIPPING_LABEL } from "@/lib/bundles";

const garantia = `Garantia de ${brand.garantiaDias} dias ou seu dinheiro de volta`;

/** Faixa do topo: três avisos no computador; no celular eles correm em fila. */
export function AnnouncementBar() {
  const mobile = [FREE_SHIPPING_LABEL, "Qualquer parede vira o alvo", garantia];
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {mobile.map((m) => (
        <li key={m} className="flex items-center px-5">
          <span className="mr-5 text-[var(--blue)]">✦</span>
          {m}
        </li>
      ))}
    </ul>
  );
  return (
    <div
      className="border-b border-[var(--line)] bg-[rgb(var(--fade-rgb)/0.72)] bg-[linear-gradient(90deg,var(--tint-blue),transparent_55%,var(--tint-lime))] text-[10px] backdrop-blur-md font-bold uppercase tracking-[0.14em] text-[var(--ink)]"
      role="region"
      aria-label="Avisos da loja"
    >
      <div className="container-edge hidden h-8 items-center justify-between md:flex">
        <span>{FREE_SHIPPING_LABEL}</span>
        <span>
          Qualquer parede <span className="text-[var(--blue)]">vira o alvo.</span>
        </span>
        <span>{garantia}</span>
      </div>
      <div className="overflow-hidden py-2 md:hidden">
        <div className="marquee">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </div>
  );
}
