import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteProducts,
  getAdminProduct,
  importProducts,
  uploadProductImage,
  type ImportProductInput,
} from "@/lib/products-admin.functions";
import { normalize, parseMoney, sameCollection, slugify } from "@/lib/shopify-csv";
import { cn } from "@/lib/utils";

type Option = { name: string; values: string[] };
type VariantRow = { sku: string; price: string; compareAt: string; stock: string; image: string };

const EMPTY_ROW: VariantRow = { sku: "", price: "", compareAt: "", stock: "", image: "" };

const SIZE_PRESETS: { label: string; values: string[] }[] = [
  { label: "Jeans 38–48", values: ["38", "40", "42", "44", "46", "48"] },
  { label: "PP–GG", values: ["PP", "P", "M", "G", "GG"] },
  { label: "P–G3", values: ["P", "M", "G", "GG", "G1", "G2", "G3"] },
  { label: "Tamanho único", values: ["Único"] },
];

const key = (values: readonly string[]) => values.join(" / ");

/** Todas as combinações das opções (como a Shopify gera as variações). */
function combinations(options: Option[]): string[][] {
  const used = options.filter((o) => o.name.trim() && o.values.length);
  if (!used.length) return [[]];
  return used.reduce<string[][]>(
    (acc, o) => acc.flatMap((prev) => o.values.map((v) => [...prev, v])),
    [[]],
  );
}

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : n.toFixed(2).replace(".", ",");

/** Reduz a foto no navegador (máx. 1600 px, WebP) antes de enviar. */
async function shrink(file: File): Promise<{ base64: string; type: "image/webp" | "image/jpeg" }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(
      `Não consegui abrir "${file.name}". Use JPG, PNG ou WebP (foto de iPhone em HEIC: exporte como JPG).`,
    );
  });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const toBlob = (type: string) =>
    new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.86));
  let blob = await toBlob("image/webp");
  let type: "image/webp" | "image/jpeg" = "image/webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob("image/jpeg");
    type = "image/jpeg";
  }
  if (!blob) throw new Error(`Não consegui processar "${file.name}".`);
  const base64 = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1] ?? "");
    fr.onerror = () => rej(new Error("Falha ao ler a foto."));
    fr.readAsDataURL(blob!);
  });
  return { base64, type };
}

function ValuesInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    onChange([...values, ...parts.filter((p) => !values.includes(p))]);
    setDraft("");
  };
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-sm">
          {v}
          <button
            type="button"
            aria-label={`Remover ${v}`}
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => {
          if (e.target.value.endsWith(",")) add(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && values.length)
            onChange(values.slice(0, -1));
        }}
        onBlur={() => add(draft)}
        placeholder={values.length ? "" : placeholder}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

/**
 * Cadastro manual de produto, no estilo da Shopify: dados, fotos (upload ou link), coleções e
 * variações geradas pelas opções (preço, preço "de", SKU, estoque e foto de cada uma).
 * Salva pelo mesmo caminho do importador CSV (não duplica: atualiza pelo Handle).
 */
export function ProductEditor({
  password,
  handle,
  collections,
  onClose,
}: {
  password: string;
  /** null = produto novo. */
  handle: string | null;
  collections: { slug: string; name: string }[];
  onClose: (changed: boolean) => void;
}) {
  const loadFn = useServerFn(getAdminProduct);
  const saveFn = useServerFn(importProducts);
  const uploadFn = useServerFn(uploadProductImage);
  const deleteFn = useServerFn(deleteProducts);

  const isNew = handle === null;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState(handle ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState("");
  const [vendor, setVendor] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"active" | "draft">("active");
  const [images, setImages] = useState<string[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [newCol, setNewCol] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [rows, setRows] = useState<Record<string, VariantRow>>({ "": { ...EMPTY_ROW } });
  const [bulk, setBulk] = useState({ price: "", compareAt: "", stock: "" });
  const [uploading, setUploading] = useState(0);
  const [urlDraft, setUrlDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    loadFn({ data: { password, handle: handle! } })
      .then((p) => {
        if (!alive) return;
        if (!p) {
          setError("Produto não encontrado.");
          return;
        }
        setTitle(p.title);
        setDescription(p.description);
        setProductType(p.productType ?? "");
        setVendor(p.vendor);
        setTags(p.tags.join(", "));
        setStatus(p.status);
        setImages(p.images);
        setCols(p.collections);
        setOptions(p.options.map((o) => ({ name: o.name, values: [...o.values] })));
        const r: Record<string, VariantRow> = {};
        for (const v of p.variants)
          r[key(v.values)] = {
            sku: v.sku ?? "",
            price: fmt(v.price),
            compareAt: fmt(v.compareAtPrice),
            stock: v.stock === null ? "" : String(v.stock),
            image: v.image ?? "",
          };
        setRows(r);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Erro ao abrir o produto"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [handle, isNew, loadFn, password]);

  const combos = useMemo(() => combinations(options), [options]);
  const rowOf = (values: string[]) => rows[key(values)] ?? EMPTY_ROW;
  const setRow = (values: string[], patch: Partial<VariantRow>) =>
    setRows((r) => ({ ...r, [key(values)]: { ...(r[key(values)] ?? EMPTY_ROW), ...patch } }));

  const setOption = (i: number, patch: Partial<Option>) =>
    setOptions((os) => os.map((o, k) => (k === i ? { ...o, ...patch } : o)));

  const applyBulk = () =>
    setRows((r) => {
      const next = { ...r };
      for (const c of combos) {
        const cur = next[key(c)] ?? EMPTY_ROW;
        next[key(c)] = {
          ...cur,
          ...(bulk.price ? { price: bulk.price } : {}),
          ...(bulk.compareAt ? { compareAt: bulk.compareAt } : {}),
          ...(bulk.stock ? { stock: bulk.stock } : {}),
        };
      }
      return next;
    });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = [...files].slice(0, 12);
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const { base64, type } = await shrink(f);
        const { url } = await uploadFn({ data: { password, name: f.name, contentType: type, base64 } });
        setImages((imgs) => [...imgs, url]);
      } catch (e) {
        setError(e instanceof Error ? e.message : `Falha ao enviar ${f.name}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const move = (i: number, dir: -1 | 1) =>
    setImages((imgs) => {
      const j = i + dir;
      if (j < 0 || j >= imgs.length) return imgs;
      const next = [...imgs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const toggleCol = (name: string) =>
    setCols((c) => (c.includes(name) ? c.filter((x) => x !== name) : [...c, name]));

  const save = async () => {
    setError(null);
    const h = slugify(slug || title);
    if (!title.trim()) return setError("Dê um título para o produto.");
    if (!h) return setError("Preencha o endereço (handle) do produto.");
    const usedOptions = options
      .map((o) => ({ name: o.name.trim(), values: o.values }))
      .filter((o) => o.name && o.values.length);
    if (options.some((o) => o.name.trim() && !o.values.length))
      return setError("Toda opção precisa de pelo menos um valor (ex.: Tamanho → 38, 40...).");
    const variants: ImportProductInput["variants"] = [];
    for (const c of combos) {
      const r = rowOf(c);
      const price = parseMoney(r.price);
      if (price === null || price === "invalid")
        return setError(`Preço inválido${c.length ? ` na variação ${key(c)}` : ""}.`);
      const compare = parseMoney(r.compareAt);
      if (compare === "invalid")
        return setError(`Preço "de" inválido${c.length ? ` na variação ${key(c)}` : ""}.`);
      let stock: number | null = null;
      if (r.stock.trim()) {
        const n = Number(r.stock.replace(",", "."));
        if (!Number.isInteger(n) || n < 0)
          return setError(`Estoque inválido${c.length ? ` na variação ${key(c)}` : ""} (use número inteiro).`);
        stock = n;
      }
      variants.push({
        values: c,
        sku: r.sku.trim() || null,
        price,
        compareAtPrice: typeof compare === "number" && compare > price ? compare : null,
        stock,
        image: r.image || null,
      });
    }
    const skus = variants.map((v) => v.sku?.toLowerCase()).filter(Boolean);
    if (new Set(skus).size !== skus.length) return setError("Tem SKU repetido entre as variações.");
    if (!cols.length && !window.confirm('Sem coleção, o produto vai para "Outros". Salvar assim mesmo?'))
      return;

    const product: ImportProductInput = {
      handle: h,
      title: title.trim(),
      description: description.trim(),
      productType: productType.trim() || null,
      vendor,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 30),
      status,
      options: usedOptions,
      variants,
      images,
      collections: cols,
    };
    setSaving(true);
    try {
      const r = await saveFn({ data: { password, products: [product] } });
      const res = r.results[0];
      if (!res || res.status === "error") throw new Error(res?.message ?? "Não foi possível salvar.");
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!handle || !window.confirm(`Excluir "${title}" e todas as variações?`)) return;
    setSaving(true);
    try {
      await deleteFn({ data: { password, handles: [handle] } });
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir");
      setSaving(false);
    }
  };

  if (loading)
    return (
      <Card className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Abrindo produto…
      </Card>
    );

  const label = "mb-1.5 block text-sm font-medium";
  const section = "space-y-4 p-5";
  const allCols = [
    ...collections.map((c) => c.name),
    ...cols.filter((c) => !sameCollection(c, collections)),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onClose(false)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Produtos
        </button>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="outline" onClick={() => void remove()} disabled={saving}>
              <Trash2 className="mr-1.5 h-4 w-4 text-red-600" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => onClose(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || uploading > 0}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {isNew ? "Salvar produto" : "Salvar alterações"}
          </Button>
        </div>
      </div>
      <h2 className="text-xl font-semibold">{isNew ? "Adicionar produto" : title || "Editar produto"}</h2>

      {error && (
        <Card className="border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card className={section}>
            <div>
              <label className={label} htmlFor="pe-title">
                Título
              </label>
              <Input
                id="pe-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                placeholder="Calça Jogador Jeans Azul Médio"
              />
            </div>
            <div>
              <label className={label} htmlFor="pe-desc">
                Descrição
              </label>
              <Textarea
                id="pe-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Modelagem, tecido, como veste... Deixe uma linha em branco entre os parágrafos."
              />
            </div>
          </Card>

          <Card className={section}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Fotos</span>
              <span className="text-xs text-muted-foreground">A primeira é a capa</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {images.map((src, i) => (
                <div key={src} className="group relative aspect-[3/4] overflow-hidden rounded-md border bg-muted">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      Capa
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 p-1 opacity-0 transition group-hover:opacity-100">
                    <button type="button" aria-label="Mover para a esquerda" onClick={() => move(i, -1)} className="text-white">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Remover foto"
                      onClick={() => setImages((imgs) => imgs.filter((x) => x !== src))}
                      className="text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label="Mover para a direita" onClick={() => move(i, 1)} className="text-white">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {Array.from({ length: uploading }, (_, i) => (
                <div key={`up-${i}`} className="grid aspect-[3/4] place-items-center rounded-md border bg-muted">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void onFiles(e.dataTransfer.files);
                }}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
              >
                <ImagePlus className="h-5 w-5" />
                Enviar fotos
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void onFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <Input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="Ou cole o link de uma foto (https://...)"
              />
              <Button
                variant="outline"
                onClick={() => {
                  const u = urlDraft.trim();
                  if (!/^https?:\/\/\S+$/i.test(u)) return setError("Link de foto inválido.");
                  setImages((imgs) => (imgs.includes(u) ? imgs : [...imgs, u]));
                  setUrlDraft("");
                }}
              >
                <Link2 className="mr-1.5 h-4 w-4" /> Adicionar
              </Button>
            </div>
          </Card>

          <Card className={section}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Opções</span>
              {options.length < 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setOptions((os) => [
                      ...os,
                      { name: os.some((o) => normalize(o.name) === "tamanho") ? "Cor" : "Tamanho", values: [] },
                    ])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Adicionar opção
                </Button>
              )}
            </div>
            {options.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem opções, o produto tem um preço só. Adicione Tamanho, Cor... para gerar as variações.
              </p>
            )}
            {options.map((o, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex gap-2">
                  <Input
                    value={o.name}
                    onChange={(e) => setOption(i, { name: e.target.value })}
                    placeholder="Nome da opção (Tamanho, Cor...)"
                    className="max-w-[220px]"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remover opção"
                    onClick={() => setOptions((os) => os.filter((_, k) => k !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <ValuesInput
                  values={o.values}
                  onChange={(values) => setOption(i, { values })}
                  placeholder="Digite um valor e aperte Enter (ex.: 40)"
                />
                {/tamanho|size/i.test(o.name) && (
                  <div className="flex flex-wrap gap-1.5">
                    {SIZE_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setOption(i, { values: p.values })}
                        className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Card>

          <Card className={section}>
            <span className="text-sm font-medium">
              {combos.length > 1 || combos[0]?.length ? `Variações (${combos.length})` : "Preço e estoque"}
            </span>
            {combos.length > 1 && (
              <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted p-3">
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">Preço</span>
                  <Input value={bulk.price} onChange={(e) => setBulk({ ...bulk, price: e.target.value })} placeholder="189,90" className="h-9 w-28" />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">Preço "de"</span>
                  <Input value={bulk.compareAt} onChange={(e) => setBulk({ ...bulk, compareAt: e.target.value })} placeholder="249,90" className="h-9 w-28" />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">Estoque</span>
                  <Input value={bulk.stock} onChange={(e) => setBulk({ ...bulk, stock: e.target.value })} placeholder="10" className="h-9 w-20" />
                </div>
                <Button size="sm" variant="outline" onClick={applyBulk}>
                  Aplicar a todas
                </Button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    {combos[0]!.length > 0 && <th className="py-2 pr-2">Variação</th>}
                    <th className="py-2 pr-2">Preço</th>
                    <th className="py-2 pr-2">Preço "de"</th>
                    <th className="py-2 pr-2">SKU</th>
                    <th className="py-2 pr-2">Estoque</th>
                    {images.length > 0 && <th className="py-2">Foto</th>}
                  </tr>
                </thead>
                <tbody>
                  {combos.map((c) => {
                    const r = rowOf(c);
                    return (
                      <tr key={key(c)} className="border-t">
                        {c.length > 0 && <td className="py-2 pr-2 font-medium">{key(c)}</td>}
                        <td className="py-2 pr-2">
                          <Input value={r.price} onChange={(e) => setRow(c, { price: e.target.value })} placeholder="0,00" className="h-9 w-24" />
                        </td>
                        <td className="py-2 pr-2">
                          <Input value={r.compareAt} onChange={(e) => setRow(c, { compareAt: e.target.value })} placeholder="opcional" className="h-9 w-24" />
                        </td>
                        <td className="py-2 pr-2">
                          <Input value={r.sku} onChange={(e) => setRow(c, { sku: e.target.value })} placeholder="opcional" className="h-9 w-32" />
                        </td>
                        <td className="py-2 pr-2">
                          <Input value={r.stock} onChange={(e) => setRow(c, { stock: e.target.value })} placeholder="sem controle" className="h-9 w-28" />
                        </td>
                        {images.length > 0 && (
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              {r.image && <img src={r.image} alt="" className="h-9 w-7 rounded object-cover" />}
                              <select
                                value={r.image}
                                onChange={(e) => setRow(c, { image: e.target.value })}
                                className="h-9 rounded-md border bg-transparent px-2 text-xs"
                              >
                                <option value="">Sem foto</option>
                                {images.map((src, k) => (
                                  <option key={src} value={src}>
                                    Foto {k + 1}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Estoque em branco = sem controle (sempre disponível). Estoque 0 = esgotado.
            </p>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className={section}>
            <span className="text-sm font-medium">Situação</span>
            <div className="grid grid-cols-2 gap-2">
              {(["active", "draft"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    status === s ? "border-foreground bg-foreground text-background" : "hover:border-foreground",
                  )}
                >
                  {s === "active" ? "Visível" : "Oculto"}
                </button>
              ))}
            </div>
          </Card>

          <Card className={section}>
            <span className="text-sm font-medium">Coleções</span>
            <div className="flex flex-wrap gap-1.5">
              {allCols.map((name) => {
                const on = cols.some((c) => normalize(c) === normalize(name));
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleCol(name)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs",
                      on ? "border-foreground bg-foreground text-background" : "hover:border-foreground",
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input value={newCol} onChange={(e) => setNewCol(e.target.value)} placeholder="Nova coleção" className="h-9" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const n = newCol.trim();
                  if (n && !cols.some((c) => normalize(c) === normalize(n))) setCols([...cols, n]);
                  setNewCol("");
                }}
              >
                Criar
              </Button>
            </div>
          </Card>

          <Card className={section}>
            <div>
              <label className={label} htmlFor="pe-type">
                Tipo de produto
              </label>
              <Input id="pe-type" value={productType} onChange={(e) => setProductType(e.target.value)} placeholder="Calça" />
            </div>
            <div>
              <label className={label} htmlFor="pe-tags">
                Tags
              </label>
              <Input id="pe-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="jeans, destroyed (separe por vírgula)" />
            </div>
            <div>
              <label className={label} htmlFor="pe-handle">
                Endereço do produto
              </label>
              <Input
                id="pe-handle"
                value={slug}
                disabled={!isNew}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="calca-jogador-azul-medio"
              />
              <p className="mt-1 break-all text-xs text-muted-foreground">
                /produto?plano={slugify(slug || title) || "..."}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
