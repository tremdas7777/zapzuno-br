import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  deleteProducts,
  getAdminCatalog,
  importProducts,
  seedImportProducts,
  setProductsStatus,
  type AdminProductRow,
  type CollectionResult,
  type ImportProductInput,
  type ImportResult,
} from "@/lib/products-admin.functions";
import {
  normalize,
  parseShopifyCsv,
  sameCollection,
  TEMPLATE_HEADER,
  toCsvRow,
  type ImportProduct,
  type ParseResult,
} from "@/lib/shopify-csv";
import { SEED_COLLECTIONS, SEED_PRODUCTS } from "@/lib/catalog-data";
import { ProductEditor } from "@/components/admin/ProductEditor";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const CHUNK = 25;

type Catalog = Awaited<ReturnType<typeof getAdminCatalog>>;

const SOURCE_LABEL: Record<ImportProduct["categorySource"], string> = {
  coluna: "coluna Coleção",
  tipo: "pelo Tipo",
  título: "pelo título",
  categoria: "pela categoria Shopify",
  padrão: "sem pista: Outros",
};

/** CSV modelo no formato da Shopify, com as peças do catálogo inicial. */
function templateCsv() {
  const lines = [toCsvRow(TEMPLATE_HEADER)];
  for (const p of SEED_PRODUCTS) {
    const col = SEED_COLLECTIONS.find((c) => c.slug === p.collections[0])?.name ?? "";
    const rows = Math.max(p.variants.length, p.images.length);
    for (let i = 0; i < rows; i++) {
      const v = p.variants[i];
      const first = i === 0;
      lines.push(
        toCsvRow([
          p.handle,
          first ? p.title : "",
          first ? p.description.split("\n\n").map((t) => `<p>${t}</p>`).join("") : "",
          first ? (p.productType ?? "") : "",
          first ? p.tags.join(", ") : "",
          first ? col : "",
          first ? "active" : "",
          first && v ? (p.options[0]?.name ?? "") : "",
          v?.values[0] ?? "",
          "",
          "",
          v?.sku ?? "",
          v ? v.price.toFixed(2) : "",
          v?.compareAtPrice ? v.compareAtPrice.toFixed(2) : "",
          v?.stock ?? "",
          v?.image ?? "",
          p.images[i] ?? "",
          p.images[i] ? i + 1 : "",
        ]),
      );
    }
  }
  return lines.join("\n");
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const toInput = (p: ImportProduct): ImportProductInput => ({
  handle: p.handle,
  title: p.title,
  description: p.description,
  productType: p.productType,
  vendor: p.vendor,
  tags: p.tags,
  status: p.status,
  options: p.options,
  variants: p.variants,
  images: p.images,
  collections: p.collections,
});

/** Aba "Produtos": importador CSV (formato Shopify) e lista do catálogo. */
export function ProductsTab({ password }: { password: string }) {
  const fetchCatalog = useServerFn(getAdminCatalog);
  const runImport = useServerFn(importProducts);
  const runStatus = useServerFn(setProductsStatus);
  const runDelete = useServerFn(deleteProducts);

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<{ items: ImportResult[]; cols: CollectionResult[] } | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  /** Editor aberto: "new" = produto novo; texto = handle do produto. */
  const [editing, setEditing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCatalog(await fetchCatalog({ data: { password } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }, [fetchCatalog, password]);

  useEffect(() => {
    void load();
  }, [load]);

  // Banco vazio ou desligado: compara com as coleções do catálogo inicial (as que a loja mostra).
  const existingCollections = useMemo(
    () =>
      catalog?.collections.length
        ? catalog.collections.map((c) => ({ slug: c.slug, name: c.name }))
        : SEED_COLLECTIONS,
    [catalog],
  );

  const readFile = async (file: File) => {
    setResults(null);
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError("Envie um arquivo .csv (no Excel: Salvar como → CSV UTF-8).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("Arquivo muito grande (máximo 15 MB).");
      return;
    }
    setError(null);
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    // CSV do Excel antigo vem em Latin-1: se o UTF-8 quebrar acentos, relê.
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf);
    setParsed(parseShopifyCsv(text, existingCollections));
  };

  const preview = useMemo(() => {
    if (!parsed) return null;
    const handles = new Set(catalog?.products.map((p) => p.handle));
    const titles = new Set(catalog?.products.map((p) => normalize(p.title)));
    const known = (p: ImportProduct) => handles.has(p.handle) || titles.has(normalize(p.title));
    const cols = new Map<string, { count: number; isNew: boolean }>();
    for (const p of parsed.products)
      for (const c of p.collections) {
        const cur = cols.get(c) ?? { count: 0, isNew: !sameCollection(c, existingCollections) };
        cur.count++;
        cols.set(c, cur);
      }
    return {
      updates: parsed.products.filter(known).length,
      creates: parsed.products.filter((p) => !known(p)).length,
      variants: parsed.products.reduce((s, p) => s + p.variants.length, 0),
      errors: parsed.issues.filter((i) => i.level === "error"),
      warnings: parsed.issues.filter((i) => i.level === "warning"),
      cols: [...cols.entries()].sort((a, b) => b[1].count - a[1].count),
      known,
    };
  }, [parsed, catalog, existingCollections]);

  const send = async (items: ImportProductInput[]) => {
    setError(null);
    setResults(null);
    setProgress({ done: 0, total: items.length });
    const all: ImportResult[] = [];
    const cols: CollectionResult[] = [];
    try {
      for (let i = 0; i < items.length; i += CHUNK) {
        const r = await runImport({ data: { password, products: items.slice(i, i + CHUNK) } });
        all.push(...r.results);
        cols.push(...r.newCollections);
        setProgress({ done: Math.min(i + CHUNK, items.length), total: items.length });
      }
    } catch (e) {
      setError(
        `A importação parou no meio: ${e instanceof Error ? e.message : String(e)}. Os produtos já enviados ficaram salvos; pode enviar o arquivo de novo que eles não duplicam.`,
      );
    }
    setResults({ items: all, cols });
    setProgress(null);
    setParsed(null);
    setFileName(null);
    void load();
  };

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };

  const list = (catalog?.products ?? []).filter(
    (p) =>
      !query.trim() ||
      normalize(`${p.title} ${p.handle} ${p.collections.join(" ")}`).includes(normalize(query)),
  );

  const counts = results && {
    created: results.items.filter((r) => r.status === "created").length,
    updated: results.items.filter((r) => r.status === "updated").length,
    failed: results.items.filter((r) => r.status === "error"),
  };

  if (editing)
    return (
      <ProductEditor
        password={password}
        handle={editing === "new" ? null : editing}
        collections={catalog?.collections ?? []}
        onClose={(changed) => {
          setEditing(null);
          if (changed) void load();
        }}
      />
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight text-[#101828] sm:text-2xl">
            Produtos
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#667085]">
            Cadastre à mão ou importe o CSV de produtos da Shopify (ou uma planilha com as mesmas
            colunas). Produtos já cadastrados são atualizados, nunca duplicados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => setEditing("new")}
            disabled={catalog?.configured === false}
            title={catalog?.configured === false ? "Conecte o banco de dados para cadastrar" : undefined}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar produto
          </Button>
          <Button variant="outline" size="sm" onClick={() => download("modelo-produtos.csv", templateCsv())}>
            <Download className="mr-1.5 h-4 w-4" /> Baixar CSV modelo
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {catalog && !catalog.configured && (
        <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Banco de dados não conectado.</b> A loja está mostrando o catálogo inicial do código.
          Você já pode conferir a prévia de um CSV aqui; para gravar os produtos, conecte o Supabase
          (Lovable Cloud), rode as migrações e configure o <code>SUPABASE_SERVICE_ROLE_KEY</code>.
        </Card>
      )}

      {error && (
        <Card className="flex items-start gap-2 border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </Card>
      )}

      {/* Envio do arquivo */}
      {!parsed && !progress && (
        <Card
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) void readFile(f);
          }}
          className={`flex flex-col items-center gap-3 border-2 border-dashed p-8 text-center transition ${
            dragging ? "border-foreground bg-muted" : "border-border"
          }`}
        >
          <FileUp className="h-8 w-8 text-muted-foreground" />
          <div>
            <div className="font-medium">Arraste o CSV aqui ou escolha o arquivo</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Colunas lidas: Handle, Title, Body (HTML), Type, Tags, Collection, Status, Option1–3
              Name/Value, Variant SKU, Variant Price, Variant Compare At Price, Variant Inventory
              Qty, Variant Image, Image Src.
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" /> Escolher arquivo CSV
            </Button>
            {catalog?.configured && !catalog.products.some((p) => p.status === "active") && (
              <Button
                variant="outline"
                onClick={() => void send(seedImportProducts())}
                title="Grava no banco as peças que a loja mostra hoje"
              >
                <PackagePlus className="mr-1.5 h-4 w-4" /> Carregar catálogo inicial ({SEED_PRODUCTS.length}{" "}
                peças)
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Prévia */}
      {parsed && preview && !progress && (
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">{fileName}</div>
              <div className="text-lg font-semibold">
                {parsed.products.length} produtos · {preview.variants} variações
              </div>
              <div className="text-sm text-muted-foreground">
                {preview.creates} novos · {preview.updates} já cadastrados (serão atualizados) ·{" "}
                {parsed.rowCount} linhas lidas
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setParsed(null);
                  setFileName(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={!parsed.products.length || catalog?.configured === false}
                title={catalog?.configured === false ? "Conecte o banco de dados para importar" : undefined}
                onClick={() => void send(parsed.products.map(toInput))}
              >
                Importar {parsed.products.length} produtos
              </Button>
            </div>
          </div>

          {preview.cols.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium">Coleções</div>
              <div className="flex flex-wrap gap-2">
                {preview.cols.map(([name, c]) => (
                  <span
                    key={name}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      c.isNew ? "border-blue-300 bg-blue-50 text-blue-800" : "bg-muted"
                    }`}
                  >
                    {name} · {c.count} {c.isNew && <b>· nova</b>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(preview.errors.length > 0 || preview.warnings.length > 0) && (
            <div className="space-y-2">
              {preview.errors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <div className="mb-1 flex items-center gap-1.5 font-medium">
                    <XCircle className="h-4 w-4" /> {preview.errors.length} erros (essas linhas não
                    entram)
                  </div>
                  <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs">
                    {preview.errors.map((i, k) => (
                      <li key={k}>
                        Linha {i.row}
                        {i.handle ? ` (${i.handle})` : ""}: {i.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.warnings.length > 0 && (
                <details className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-4 w-4" /> {preview.warnings.length} avisos (o produto
                    entra assim mesmo)
                  </summary>
                  <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs">
                    {preview.warnings.map((i, k) => (
                      <li key={k}>
                        Linha {i.row}
                        {i.handle ? ` (${i.handle})` : ""}: {i.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="max-h-[420px] overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">Produto</th>
                  <th className="p-2">Coleção</th>
                  <th className="p-2">Variações</th>
                  <th className="p-2">Preço</th>
                  <th className="p-2">Estoque</th>
                  <th className="p-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {parsed.products.map((p) => {
                  const prices = p.variants.map((v) => v.price);
                  const min = Math.min(...prices);
                  const max = Math.max(...prices);
                  const tracked = p.variants.filter((v) => v.stock !== null);
                  return (
                    <tr key={p.handle} className="border-t">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {p.images[0] ? (
                            <img src={p.images[0]} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium">{p.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.handle}
                              {p.status === "draft" && " · rascunho (fica oculto)"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-xs">
                        {p.collections.join(", ")}
                        <div className="text-muted-foreground">{SOURCE_LABEL[p.categorySource]}</div>
                      </td>
                      <td className="p-2 text-xs">
                        {p.variants.length}
                        {p.options.length > 0 && (
                          <div className="text-muted-foreground">
                            {p.options.map((o) => `${o.name}: ${o.values.join(", ")}`).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap p-2 text-xs">
                        {min === max ? brl(min) : `${brl(min)} – ${brl(max)}`}
                      </td>
                      <td className="p-2 text-xs">
                        {tracked.length ? tracked.reduce((s, v) => s + (v.stock ?? 0), 0) : "—"}
                      </td>
                      <td className="p-2 text-xs">
                        {preview.known(p) ? (
                          <span className="text-amber-700">atualiza</span>
                        ) : (
                          <span className="text-emerald-700">novo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {progress && (
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2 font-medium">
            <Loader2 className="h-4 w-4 animate-spin" /> Importando… {progress.done} de {progress.total}
          </div>
          <Progress value={(progress.done / Math.max(1, progress.total)) * 100} />
        </Card>
      )}

      {results && counts && (
        <Card className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> {counts.created} criados
            </span>
            <span className="flex items-center gap-1.5 font-medium text-amber-700">
              <RefreshCw className="h-4 w-4" /> {counts.updated} atualizados
            </span>
            {counts.failed.length > 0 && (
              <span className="flex items-center gap-1.5 font-medium text-red-700">
                <XCircle className="h-4 w-4" /> {counts.failed.length} com erro
              </span>
            )}
            {results.cols.length > 0 && (
              <span className="text-muted-foreground">
                Coleções novas: {results.cols.map((c) => c.name).join(", ")}
              </span>
            )}
          </div>
          {counts.failed.length > 0 && (
            <ul className="space-y-1 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {counts.failed.map((r) => (
                <li key={r.handle}>
                  <b>{r.title}</b> ({r.handle}): {r.message}
                </li>
              ))}
            </ul>
          )}
          {results.items.some((r) => r.message && r.status !== "error") && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Produtos achados pelo SKU ou título</summary>
              <ul className="mt-1 space-y-0.5">
                {results.items
                  .filter((r) => r.message && r.status !== "error")
                  .map((r) => (
                    <li key={r.handle}>
                      {r.title}: {r.message}
                    </li>
                  ))}
              </ul>
            </details>
          )}
          <p className="text-xs text-muted-foreground">
            A loja mostra as mudanças em até 30 segundos.
          </p>
        </Card>
      )}

      {/* Catálogo */}
      {catalog?.configured && (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <b>{catalog.products.length}</b> produtos ·{" "}
              {catalog.products.filter((p) => p.status === "active").length} visíveis ·{" "}
              {catalog.collections.length} coleções
            </div>
            <label className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produto"
                className="w-64 pl-8"
              />
            </label>
          </div>
          {catalog.collections.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {catalog.collections.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setQuery(c.name)}
                  className="rounded-full bg-muted px-3 py-1 text-xs hover:bg-muted/70"
                >
                  {c.name} · {c.count}
                </button>
              ))}
            </div>
          )}
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {catalog.products.length ? "Nada encontrado." : "Nenhum produto no banco ainda."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2">Produto</th>
                    <th className="p-2">Coleções</th>
                    <th className="p-2">A partir de</th>
                    <th className="p-2">Variações</th>
                    <th className="p-2">Estoque</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((p: AdminProductRow) => (
                    <tr key={p.handle} className={`border-t ${p.status !== "active" ? "opacity-55" : ""}`}>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {p.img ? (
                            <img src={p.img} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted" />
                          )}
                          <div className="min-w-0">
                            <a
                              href={`/produto?plano=${encodeURIComponent(p.handle)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate font-medium hover:underline"
                            >
                              {p.title}
                            </a>
                            <div className="text-xs text-muted-foreground">
                              {p.handle}
                              {p.status !== "active" && " · oculto"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-xs">{p.collections.join(", ") || "—"}</td>
                      <td className="whitespace-nowrap p-2 text-xs">{brl(p.minPrice)}</td>
                      <td className="p-2 text-xs">{p.variants}</td>
                      <td className="p-2 text-xs">
                        {p.stock === null ? "—" : p.stock === 0 ? <span className="text-red-700">esgotado</span> : p.stock}
                      </td>
                      <td className="whitespace-nowrap p-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          title="Editar"
                          onClick={() => setEditing(p.handle)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          title={p.status === "active" ? "Ocultar da loja" : "Mostrar na loja"}
                          onClick={() =>
                            void act(`s-${p.handle}`, () =>
                              runStatus({
                                data: {
                                  password,
                                  handles: [p.handle],
                                  status: p.status === "active" ? "draft" : "active",
                                },
                              }),
                            )
                          }
                        >
                          {busy === `s-${p.handle}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : p.status === "active" ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          title="Excluir"
                          onClick={() => {
                            if (!window.confirm(`Excluir "${p.title}" e todas as variações?`)) return;
                            void act(`d-${p.handle}`, () =>
                              runDelete({ data: { password, handles: [p.handle] } }),
                            );
                          }}
                        >
                          {busy === `d-${p.handle}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-600" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
