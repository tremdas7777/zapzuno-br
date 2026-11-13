-- Comprovante do Pix enviado pelo cliente na página do pedido (2026-11-13).
-- Os arquivos ficam num bucket privado; só o servidor (service role) lê e grava.
alter table public.pix_orders add column if not exists comprovantes jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;
