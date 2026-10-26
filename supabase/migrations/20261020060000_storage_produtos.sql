-- Fotos dos produtos enviadas pelo /admin (cadastro manual).
-- Bucket público para leitura (a vitrine mostra as fotos pelo link); só o servidor grava
-- (service_role ignora RLS), então não há policy de escrita para anon/authenticated.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'produtos',
  'produtos',
  true,
  5242880,
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/avif', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;
