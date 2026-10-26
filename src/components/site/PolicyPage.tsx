import type { ReactNode } from "react";
import { SiteLayout } from "./Layout";

export function PolicyPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <SiteLayout>
      <section className="pb-24 pt-14 md:pt-20">
        <div className="container-edge max-w-3xl">
          <span className="eyebrow">Políticas</span>
          <h1 className="display mt-5 mb-6 text-[48px] md:text-[72px]">
            {title}
          </h1>
          <p className="text-lg text-[var(--ink)] leading-relaxed">{intro}</p>
          <div className="mt-16 space-y-8 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:uppercase [&_h2]:mt-12 [&_h2]:mb-4 [&_p]:text-[var(--ink)] [&_p]:leading-relaxed [&_ul]:list-none [&_ul]:p-0 [&_ul]:text-[var(--ink)] [&_ul]:space-y-3 [&_li]:border-b [&_li]:border-[var(--line)] [&_li]:pb-3">
            {children}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
