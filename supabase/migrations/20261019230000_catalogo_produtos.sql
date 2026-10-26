-- Catálogo da loja (produtos importados pelo CSV do /admin).
-- Leitura e escrita só pelo servidor (service_role): a vitrine lê por uma server function.

CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image text,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  product_type text,
  vendor text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft')),
  -- [{"name": "Tamanho", "values": ["38", "40"]}]
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  images text[] NOT NULL DEFAULT '{}',
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_collections (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, collection_id)
);

CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  option_values text[] NOT NULL DEFAULT '{}',
  sku text,
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  compare_at_price numeric(10, 2),
  -- NULL = sem controle de estoque
  stock integer,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, option_values)
);

-- SKU não se repete entre produtos (o importador usa o SKU para achar produtos já cadastrados).
CREATE UNIQUE INDEX product_variants_sku_key ON public.product_variants (lower(sku))
  WHERE sku IS NOT NULL AND sku <> '';
CREATE INDEX product_variants_product_idx ON public.product_variants (product_id);
CREATE INDEX product_collections_collection_idx ON public.product_collections (collection_id);

GRANT ALL ON public.collections, public.products, public.product_collections, public.product_variants
  TO service_role;

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
