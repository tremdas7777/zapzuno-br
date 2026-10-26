import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Logo da loja: o selo redondo (public/marca/logo.webp, 320×320) + o nome escrito ao lado, que no
 * tamanho do cabeçalho fica legível (o nome dentro do selo some de tão pequeno).
 */
export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={cn("flex select-none items-center gap-2", className)}>
      <img
        src="/marca/logo.webp"
        alt=""
        width={320}
        height={320}
        className={cn(
          "block shrink-0",
          size === "sm" && "h-9 w-9",
          size === "md" && "h-10 w-10 md:h-12 md:w-12",
          size === "lg" && "h-14 w-14 md:h-16 md:w-16",
        )}
      />
      <span
        className={cn(
          "font-display font-extrabold uppercase italic leading-none tracking-[0.02em] text-[var(--ink)]",
          size === "sm" && "text-[22px]",
          size === "md" && "text-[24px] md:text-[28px]",
          size === "lg" && "text-[32px] md:text-[38px]",
        )}
      >
        {brand.name}
      </span>
    </span>
  );
}
