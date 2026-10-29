import { Star } from "lucide-react";
import { REVIEWS, type Review } from "@/lib/reviews";
import { cn } from "@/lib/utils";

function Stars({ rating, compact = false }: { rating: Review["rating"]; compact?: boolean }) {
  return (
    <span
      className="flex items-center gap-0.5 text-[#f5b800]"
      aria-label={`${rating} de 5 estrelas`}
    >
      {Array.from({ length: rating }, (_, i) => (
        <Star
          key={i}
          className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")}
          fill="currentColor"
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="card-soft flex h-full flex-col p-5">
      <Stars rating={review.rating} />
      <p className="mt-3 flex-1 text-[13.5px] leading-relaxed text-[var(--slate)]">
        “{review.text}”
      </p>
      <p className="mt-4 text-[12px] font-bold text-[var(--ink)]">{review.name}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--slate)]">
        Avaliação de cliente
      </p>
    </article>
  );
}

export function Reviews({ compact = false, className }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <section
        className={cn("border-y border-border bg-[#fffaf5] px-5 py-5", className)}
        aria-label="Avaliações de clientes"
      >
        <div className="mx-auto max-w-[1160px]">
          <div className="flex items-center gap-2">
            <Stars rating={5} compact />
            <strong className="text-[13px] text-foreground">5,0</strong>
            <span className="text-[11px] text-muted-foreground">· 4 avaliações de clientes</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REVIEWS.map((review) => (
              <blockquote
                key={review.name}
                className="rounded-lg border border-border bg-white px-4 py-3"
              >
                <Stars rating={review.rating} compact />
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  “{review.text}”
                </p>
                <cite className="mt-2 block text-[11px] font-semibold not-italic text-foreground">
                  — {review.name}
                </cite>
              </blockquote>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn("container-edge py-16 md:py-24", className)}
      aria-labelledby="reviews-title"
    >
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="eyebrow">Quem já jogou, recomenda</p>
          <h2 id="reviews-title" className="display mt-4 text-[52px] md:text-[76px]">
            Diversão que <em>fica na memória</em>
          </h2>
        </div>
        <div className="shrink-0 rounded-xl border border-[var(--line)] bg-[var(--tint-lime)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Stars rating={5} />
            <span className="font-display text-[28px] font-extrabold leading-none text-[var(--ink)]">
              5,0
            </span>
          </div>
          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--slate)]">
            4 avaliações
          </p>
        </div>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {REVIEWS.map((review) => (
          <ReviewCard key={review.name} review={review} />
        ))}
      </div>
    </section>
  );
}
