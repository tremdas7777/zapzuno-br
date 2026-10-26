# ZAPZUNO Brasil

Versão brasileira da loja ZAPZUNO (zapzuno.store): o Projetor Laser Tag (1 projetor + 2 pistolas +
4 cartões de alvo) em 1, 2 ou 3 kits, com checkout próprio (Pix + cartão), painel admin e
integrações de rastreio e marketing. Feita na mesma base da BEAM RIVALS Brasil.

Hospedada na Vercel (projeto `zapzuno-br`), banco no Supabase (projeto `zapzuno-br`, região São
Paulo, ligado à Vercel pela integração oficial). Publicar de novo: `npx vercel deploy --prod` na pasta.

## O que tem na loja

- **Início** (`src/routes/index.tsx`): carrossel de banners (`public/banners`, versão de computador
  e de celular), vídeos, os 3 kits, presente, comparativo e dúvidas.
- **Produto** (`src/routes/produto.tsx` + `src/components/br/`): galeria, escolha de 1/2/3 kits
  (o que vem no pedido muda com a quantidade), vídeos, alvos, modos de tiro, jeitos de jogar,
  comparativo, como jogar e dúvidas.
- **Textos do produto** (`src/lib/laser.ts`): o que vem na caixa, alvos, modos, perguntas frequentes.
- **Preços** (`src/lib/catalog-data.ts`, lista `KITS`): R$ 67 / R$ 97 / R$ 127 (1/2/3 kits), os
  mesmos da BEAM RIVALS; o preço "de" é provisório. Com o banco ligado, dá para mudar pelo
  `/admin` → Produtos.
- **Pós-compra** (`src/lib/upsell.ts`): pilhas recarregáveis (AAA + AA) → kit extra 50% OFF e
  seguro de entrega → envio expresso. Preços das pilhas são sugestão.
- **Checkout** (`/checkout`): Pix (PixGate, Umbrella, SagacePay, PayShark) e cartão (HyperCash).
  O preço é sempre recalculado no servidor pela variação escolhida. Frete grátis sempre.
- **Painel admin** (`/admin`): visão geral, funil, pedidos, checkouts abandonados, produtos e
  configuração dos gateways, da UTMify, do WhatsApp e da RotaSync.

## Antes de vender — o que configurar

1. **Gateway Pix**: `/admin` → card do gateway (a chave fica no banco).
2. **UTMify**: o pixel da ZAPZUNO em `src/lib/pixels.ts` e o token no `/admin`.
3. **Domínio**: depois de comprar, troque `brand.siteUrl` (`src/lib/brand.ts`) e o `robots.txt`.
4. **Webhook do Pix**: cadastre `https://SEU-DOMINIO/api/public/pix-webhook` no gateway.

Variáveis da Vercel (Production): as da integração Supabase (`SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`…) e `ADMIN_PASSWORD` (secreta). O build copia a
URL e a chave pública para `VITE_SUPABASE_*` (`vite.config.ts`).
