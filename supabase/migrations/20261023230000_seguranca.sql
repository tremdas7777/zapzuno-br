-- Segurança (2026-10-23): a chave pública do site (anon) não lê nem grava nada sensível.

-- rastreios guarda o CPF do cliente (codigo_rastreio): só o servidor (service role) acessa.
DROP POLICY IF EXISTS "Anyone can read rastreios" ON public.rastreios;
DROP POLICY IF EXISTS "Authenticated can manage rastreios" ON public.rastreios;
REVOKE ALL ON public.rastreios FROM anon, authenticated;

-- Funil: gravado pelo servidor (trackFunnelEvent e trackCheckoutStep), com tipo e tamanhos conferidos.
DROP POLICY IF EXISTS "Anyone can insert events" ON public.funnel_events;
REVOKE ALL ON public.funnel_events FROM anon, authenticated;

-- Tabelas só do servidor: além do RLS sem regras, tira qualquer permissão padrão.
REVOKE ALL ON public.private_settings FROM anon, authenticated;
REVOKE ALL ON public.pix_orders FROM anon, authenticated;
REVOKE ALL ON public.products, public.product_variants, public.collections, public.product_collections FROM anon, authenticated;

