"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { demoProducts, demoTables } from "@/lib/mock-data";
import { useMergedCatalog } from "@/lib/hooks/useMergedCatalog";
import { postSaleWithOfflineQueue } from "@/lib/client/post-sale";
import { es } from "@/lib/locale";
import {
  rememberRegisterOpen,
  canAssumeRegisterOpenOffline,
} from "@/lib/register-open-snapshot";
import { PaymentMethod, SaleChannel } from "@/lib/types";
import { ToastBanner } from "@/lib/components/ToastBanner";
import { ErrorBoundary } from "@/lib/components/ErrorBoundary";

type CartLine = { productId: string; name: string; qty: number; unitPrice: number };

function PosContent() {
  const searchParams = useSearchParams();
  const catalog = useMergedCatalog(demoProducts);
  const saleCatalog = useMemo(() => catalog.filter((p) => !p.isSeasonal), [catalog]);
  const [channel, setChannel] = useState<SaleChannel>("counter");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function showToast(msg: string) { setToastMsg(msg); }

  useEffect(() => {
    const mesa = searchParams.get("mesa");
    if (mesa && demoTables.some((t) => t.id === mesa)) {
      setChannel("table");
      setSelectedTable(mesa);
    }
  }, [searchParams]);

  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return saleCatalog.filter((p) => {
      if (p.isArchived) return false;
      if (!showInactive && !p.isActive) return false;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [saleCatalog, search, showInactive]);

  const favorites = useMemo(
    () =>
      saleCatalog.filter((p) => {
        if (p.isArchived) return false;
        if (!showInactive && !p.isActive) return false;
        return p.isFavorite;
      }),
    [saleCatalog, showInactive],
  );

  const selectedTableLabel = useMemo(
    () => demoTables.find((t) => t.id === selectedTable)?.label ?? "",
    [selectedTable],
  );

  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.qty * item.unitPrice, 0),
    [cart],
  );
  const total = Math.max(0, subtotal - discount);

  function addProduct(productId: string) {
    const product = saleCatalog.find((p) => p.id === productId);
    if (!product || !product.isActive) return;
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === productId);
      if (!existing) {
        return [...prev, { productId: product.id, name: product.name, qty: 1, unitPrice: product.price }];
      }
      return prev.map((line) =>
        line.productId === productId ? { ...line, qty: line.qty + 1 } : line,
      );
    });
  }

  async function checkout() {
    let regOpen = false;
    try {
      const reg = await fetch("/api/register/status").then((r) => r.json());
      regOpen = !!reg?.data?.isOpen;
      rememberRegisterOpen(regOpen);
    } catch {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        regOpen = canAssumeRegisterOpenOffline();
        if (!regOpen) {
          showToast(es.offline.needRegisterOnline);
          return;
        }
      } else if (canAssumeRegisterOpenOffline()) {
        regOpen = true;
      } else {
        showToast(
          "No se pudo comprobar la caja. Revisa la conexión o abre Ventas → Arqueos.",
        );
        return;
      }
    }
    if (!regOpen) {
      showToast(
        "La caja está cerrada. Ve a Ventas → Arqueos para abrir caja con dinero base.",
      );
      return;
    }
    const payload = {
      channel,
      tableId: channel === "table" ? selectedTable || null : null,
      items: cart.map((line) => ({
        productId: line.productId,
        name: line.name,
        qty: line.qty,
        unitPrice: line.unitPrice,
        lineTotal: line.qty * line.unitPrice,
      })),
      subtotal,
      discount,
      total,
      payments: [{ method: paymentMethod, amount: total }],
      customerName: es.restaurant.defaultCustomer,
    };
    const result = await postSaleWithOfflineQueue(payload);
    if (result.kind === "error") {
      if (result.error === "register_closed") {
        showToast(result.message ?? "La caja está cerrada.");
      } else {
        showToast(result.message ?? "No se pudo registrar la venta.");
      }
      return;
    }
    if (result.kind === "queued") {
      showToast(es.offline.saleQueued);
    } else {
      window.dispatchEvent(new CustomEvent("pos-sales-updated"));
    }
    setCart([]);
    setDiscount(0);
  }

  return (
    <>
    <ToastBanner message={toastMsg} onDismiss={() => setToastMsg(null)} />
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{es.pos.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {es.pos.syncHint} <code className="rounded bg-zinc-100 px-1 text-xs">{es.pos.exportsFolder}</code>.
            </p>
            <p className="mt-1 text-xs text-zinc-400">{es.pos.fudoNote}</p>
          </div>
          <Link
            href="/mesas"
            className="shrink-0 rounded-lg border border-blue-500 bg-[var(--pos-accent)] px-3 py-1.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-sm hover:opacity-95"
          >
            {es.pos.mapLink}
          </Link>
        </div>
        {channel === "table" && selectedTableLabel && (
          <p className="mt-2 text-sm font-medium text-amber-800">
            {selectedTableLabel} — {es.pos.table.toLowerCase()}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setChannel("counter")}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
              channel === "counter"
                ? "border-transparent text-white shadow-md"
                : "border-[var(--pos-border)] bg-white text-[var(--pos-text)]"
            }`}
            style={
              channel === "counter" ? { backgroundColor: "var(--pos-primary)" } : undefined
            }
          >
            {es.pos.counter}
          </button>
          <button
            type="button"
            onClick={() => setChannel("table")}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
              channel === "table"
                ? "border-transparent text-white shadow-md"
                : "border-[var(--pos-border)] bg-white text-[var(--pos-text)]"
            }`}
            style={channel === "table" ? { backgroundColor: "var(--pos-primary)" } : undefined}
          >
            {es.pos.table}
          </button>
          {channel === "table" && (
            <select
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
            >
              <option value="">{es.pos.chooseTable}</option>
              {demoTables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder={es.pos.searchPlaceholder}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:max-w-md"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            {es.pos.showInactive}
          </label>
        </div>
        <p className="mt-3 text-xs text-zinc-500">{es.pos.catalogHint}</p>
        {favorites.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-zinc-600">{es.pos.favorites}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              {favorites.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-left"
                  onClick={() => addProduct(p.id)}
                  disabled={!p.isActive}
                >
                  <p className="text-xs text-zinc-500">{p.sku}</p>
                  <p className="font-medium leading-tight">{p.name}</p>
                  <p className="text-sm">${p.price.toFixed(2)}</p>
                </button>
              ))}
            </div>
          </div>
        )}
        {search.trim() && (
          <div className="mt-4">
            <p className="text-sm font-medium text-zinc-600">Resultados de búsqueda</p>
            <div className="mt-2 max-h-[min(50vh,28rem)] overflow-y-auto">
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {searchHits.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`w-full rounded-xl border p-3 text-left ${
                        p.isActive
                          ? "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                          : "border-zinc-100 bg-zinc-100/50 opacity-60"
                      }`}
                      onClick={() => addProduct(p.id)}
                      disabled={!p.isActive}
                    >
                      <p className="text-sm text-zinc-500">{p.sku}</p>
                      <p className="font-medium leading-tight">{p.name}</p>
                      <p className="text-sm">${p.price.toFixed(2)}</p>
                      {!p.isActive && (
                        <p className="mt-1 text-xs text-red-600">{es.pos.inactive}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {searchHits.length === 0 && (
                <p className="py-6 text-center text-sm text-zinc-500">Sin coincidencias.</p>
              )}
            </div>
          </div>
        )}
      </div>
      <aside className="card p-4 lg:sticky lg:top-24 lg:self-start">
        <h3 className="font-semibold">{es.pos.cart}</h3>
        <div className="mt-3 space-y-2">
          {cart.map((line) => (
            <div key={line.productId} className="flex items-center justify-between rounded-lg bg-zinc-50 p-2">
              <p>
                {line.name} × {line.qty}
              </p>
              <p>${(line.qty * line.unitPrice).toFixed(2)}</p>
            </div>
          ))}
          {cart.length === 0 && <p className="text-sm text-zinc-500">{es.pos.emptyCart}</p>}
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <label className="block">{es.pos.discount}</label>
          <input
            type="number"
            min={0}
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
          />
          <label className="block">{es.pos.payment}</label>
          <select
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            <option value="cash">{es.pos.cash}</option>
            <option value="card">{es.pos.card}</option>
            <option value="transfer">{es.pos.transfer}</option>
          </select>
        </div>
        <div className="mt-4 border-t border-zinc-200 pt-3 text-sm">
          <p>
            {es.pos.subtotal}: ${subtotal.toFixed(2)}
          </p>
          <p className="font-medium">
            {es.pos.total}: ${total.toFixed(2)}
          </p>
        </div>
        <button
          type="button"
          onClick={checkout}
          disabled={cart.length === 0 || (channel === "table" && !selectedTable)}
          className="btn-pos-primary mt-4 w-full px-3 py-3 text-base font-extrabold uppercase tracking-wide shadow-[0_4px_12px_rgba(255,129,1,0.25)] disabled:shadow-none"
        >
          {es.pos.checkout}
        </button>
      </aside>
    </section>
    </>
  );
}

export default function PosPage() {
  return (
    <ErrorBoundary section="POS">
      <Suspense
        fallback={
          <section className="card p-12 text-center text-zinc-500">{es.pos.loading}</section>
        }
      >
        <PosContent />
      </Suspense>
    </ErrorBoundary>
  );
}
