import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { AnnouncementBar } from "./AnnouncementBar";

export function SiteLayout({ children }: { children: ReactNode }) {
  const chromeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chromeRef.current;
    if (!el) return;

    const update = () => {
      document.documentElement.style.setProperty("--site-chrome-h", `${el.offsetHeight}px`);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div id="top" className="galaxy relative isolate flex min-h-screen flex-col">
      {/* Fundo de galáxia fixo atrás da página (versão em pé para o celular). */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[#070b22]">
        <picture>
          <source media="(max-width: 767px)" srcSet="/fundo/galaxia-m.webp" />
          <img src="/fundo/galaxia.webp" alt="" className="h-full w-full object-cover" />
        </picture>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,34,0.55),rgba(7,11,34,0.35)_40%,rgba(7,11,34,0.6))]" />
      </div>
      <div ref={chromeRef} className="fixed top-0 inset-x-0 z-50 flex flex-col">
        <AnnouncementBar />
        <Header />
      </div>
      <main className="flex-1" style={{ paddingTop: "var(--site-chrome-h, 7rem)" }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
