"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Printer, Star, Vault } from "lucide-react";
import { demoCategories, demoProducts } from "@/lib/mock-data";
import { useMergedCatalog } from "@/lib/hooks/useMergedCatalog";
import { es } from "@/lib/locale";
import { loadOverrides, saveOverrides } from "@/lib/product-overrides";
import type { DiningTable, PaymentMethod, SaleChannel, SaleItem } from "@/lib/types";
import { DiscountModal, type DiscountApplyPayload } from "@/lib/components/DiscountModal";
import { PaymentChangeModal } from "@/lib/components/PaymentChangeModal";
import { printKitchenTicket, openCashDrawerStub } from "@/lib/print-ticket";

function lineId() {
  return `ln_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export type CartLine = {
  id: string;
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  kitchenSent: boolean;
};

type DiscountMeta = {
  amount: number;
  percent: number;
  type: "employee" | "owner" | "custom";
  description: string;
};
type ChargeLinePart = { lineId: string; qty: number };
type PendingCharge = { total: number; parts: ChargeLinePart[]; label: string };

type Props = {
  mode: "table" | "counter";
  table: DiningTable | null;
  /** Mostrador: pedido activo */
  counterOrderId: string | null;
  tableLabelForKitchen: string;
  clientName?: string | null;
  customerId?: string | null;
  serverName?: string | null;
  billingServerId: string;
  billingServerName: string;
  onCloseTable?: () => void | Promise<void>;
};

function setFavorite(productId: string, value: boolean) {
  const m = loadOverrides();
  m[productId] = { ...m[productId], isFavorite: value };
  saveOverrides(m);
}

function categoryName(id: string): string {
  return demoCategories.find((c) => c.id === id)?.name ?? id;
}

export function RestaurantOrderSidebar({
  mode,
  table,
  counterOrderId,
  tableLabelForKitchen,
  clientName = null,
  customerId = null,
  serverName = null,
  billingServerId,
  billingServerName,
  onCloseTable,
}: Props) {
  const catalog = useMergedCatalog(demoProducts);
  const [search, setSearch] = useState("");
  const [discountMeta, setDiscountMeta] = useState<DiscountMeta | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cart, setCart] = useState<CartLine[]>([]);
  /** Sección «Por categoría» colapsada por defecto. */
  const [categoriesSectionOpen, setCategoriesSectionOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [registerOpen, setRegisterOpen] = useState<boolean | null>(null);
  const [discountModal, setDiscountModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [customerPoints, setCustomerPoints] = useState<number | null>(null);
  const [rewardCfg, setRewardCfg] = useState<{ 50: string; 100: string; 150: string }>({
    50: "Premio 50 pts",
    100: "Premio 100 pts",
    150: "Premio 150 pts",
  });
  const [redeemingTier, setRedeemingTier] = useState<number | null>(null);
  const [splitModal, setSplitModal] = useState(false);
  const [pendingCharge, setPendingCharge] = useState<PendingCharge | null>(null);
  const draftKey = useMemo(() => {
    if (mode === "counter") return `pos_order_draft:counter:${counterOrderId ?? "none"}`;
    return `pos_order_draft:table:${table?.id ?? "none"}`;
  }, [mode, counterOrderId, table?.id]);

  const lastPrintPayload = useRef<{ title: string; subtitle: string; lines: { name: string; qty: number }[] } | null>(null);

  const refreshRegister = useCallback(() => {
    fetch("/api/register/status")
      .then((r) => r.json())
      .then((d) => setRegisterOpen(!!d.data?.isOpen))
      .catch(() => setRegisterOpen(false));
  }, []);

  useEffect(() => {
    refreshRegister();
    window.addEventListener("pos-register-updated", refreshRegister);
    return () => window.removeEventListener("pos-register-updated", refreshRegister);
  }, [refreshRegister]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) {
        setCart([]);
        setDiscountMeta(null);
        setPaymentMethod("cash");
        setSearch("");
        return;
      }
      const parsed = JSON.parse(raw) as {
        cart?: CartLine[];
        discountMeta?: DiscountMeta | null;
        paymentMethod?: PaymentMethod;
      };
      setCart(Array.isArray(parsed.cart) ? parsed.cart : []);
      setDiscountMeta(parsed.discountMeta ?? null);
      setPaymentMethod(parsed.paymentMethod === "card" ? "card" : "cash");
      setSearch("");
    } catch {
      setCart([]);
      setDiscountMeta(null);
      setPaymentMethod("cash");
      setSearch("");
    }
  }, [draftKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          cart,
          discountMeta,
          paymentMethod,
        }),
      );
    } catch {
      // ignore localStorage failures
    }
  }, [draftKey, cart, discountMeta, paymentMethod]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pos_rewards_cfg_v1");
      if (!raw) return;
      const cfg = JSON.parse(raw) as { r50?: string; r100?: string; r150?: string };
      setRewardCfg({
        50: cfg.r50?.trim() || "Premio 50 pts",
        100: cfg.r100?.trim() || "Premio 100 pts",
        150: cfg.r150?.trim() || "Premio 150 pts",
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (mode !== "table" || !customerId) {
      setCustomerPoints(null);
      return;
    }
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.data) ? d.data : [];
        const c = list.find((x: { id: string; pointsBalance?: number }) => x.id === customerId);
        setCustomerPoints(c ? Number(c.pointsBalance ?? 0) : 0);
      })
      .catch(() => setCustomerPoints(0));
  }, [mode, customerId]);

  const q = search.trim().toLowerCase();
  const searchHits = useMemo(() => {
    if (!q) return [];
    return catalog.filter((p) => {
      if (p.isArchived || !p.isActive) return false;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    }).slice(0, 20);
  }, [catalog, q]);

  const favorites = useMemo(
    () => catalog.filter((p) => p.isFavorite && !p.isArchived && p.isActive),
    [catalog],
  );

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof catalog>();
    for (const p of catalog) {
      if (p.isArchived || !p.isActive) continue;
      const list = map.get(p.categoryId) ?? [];
      list.push(p);
      map.set(p.categoryId, list);
    }
    return map;
  }, [catalog]);

  const categoryIdsSorted = useMemo(() => {
    return [...productsByCategory.keys()].sort((a, b) =>
      categoryName(a).localeCompare(categoryName(b), "es"),
    );
  }, [productsByCategory]);

  const subtotal = useMemo(
    () => cart.reduce((acc, l) => acc + l.qty * l.unitPrice, 0),
    [cart],
  );
  const discountAmount = discountMeta?.amount ?? 0;
  const total = Math.max(0, subtotal - discountAmount);

  const channel: SaleChannel = mode === "counter" ? "counter" : "table";
  const tableId = mode === "table" ? table?.id ?? null : null;

  const unsentLines = useMemo(() => cart.filter((l) => !l.kitchenSent), [cart]);
  const allSent = cart.length > 0 && unsentLines.length === 0;

  function addProduct(productId: string) {
    if (mode === "counter" && !counterOrderId) return;
    const product = catalog.find((p) => p.id === productId);
    if (!product || !product.isActive) return;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === productId && !l.kitchenSent);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          id: lineId(),
          productId: product.id,
          name: product.name,
          qty: 1,
          unitPrice: product.price,
          kitchenSent: false,
        },
      ];
    });
  }

  function setQty(lineId_: string, qty: number) {
    const line = cart.find((l) => l.id === lineId_);
    if (!line || line.kitchenSent) return;
    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.id !== lineId_));
      return;
    }
    setCart((prev) => prev.map((l) => (l.id === lineId_ ? { ...l, qty } : l)));
  }

  function removeLine(lineId_: string) {
    const line = cart.find((l) => l.id === lineId_);
    if (!line || line.kitchenSent) return;
    setCart((prev) => prev.filter((l) => l.id !== lineId_));
  }

  async function sendKitchen() {
    if (registerOpen === false) {
      window.alert(es.orderFlow.registerClosed);
      return;
    }
    if (unsentLines.length === 0) return;
    const items: SaleItem[] = unsentLines.map((l) => ({
      productId: l.productId,
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.qty * l.unitPrice,
    }));
    const res = await fetch("/api/kitchen/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel,
        tableId,
        tableLabel: tableLabelForKitchen,
        counterOrderId,
        items,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(
        err?.error === "items_required"
          ? "La comanda no tiene productos válidos."
          : err?.error === "Forbidden"
            ? "No tienes permiso para enviar a cocina."
            : "No se pudo registrar en cocina.",
      );
      return;
    }
    const payload = {
      title: es.orderFlow.sendKitchen,
      subtitle: `${tableLabelForKitchen} · ${mode === "counter" ? "Mostrador" : "Mesa"}`,
      lines: unsentLines.map((l) => ({ name: l.name, qty: l.qty })),
    };
    lastPrintPayload.current = payload;
    printKitchenTicket(payload);
    setCart((prev) =>
      prev.map((l) => (unsentLines.some((u) => u.id === l.id) ? { ...l, kitchenSent: true } : l)),
    );
    window.dispatchEvent(new CustomEvent("pos-kitchen-updated"));
  }

  function reprintLast() {
    const p = lastPrintPayload.current;
    if (!p) {
      window.alert("No hay comanda reciente.");
      return;
    }
    printKitchenTicket(p);
  }

  function applyDiscount(p: DiscountApplyPayload) {
    setDiscountMeta({
      amount: Math.min(subtotal, p.discountAmount),
      percent: p.discountPercent,
      type: p.discountType,
      description: p.discountDescription,
    });
  }

  function parseRewardDiscount(label: string): number {
    const m = label.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
    if (!m) return 0;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  async function redeemReward(tier: 50 | 100 | 150) {
    if (!customerId) return;
    setRedeemingTier(tier);
    const res = await fetch("/api/customers/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, tier }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(
        data?.error === "insufficient_points"
          ? "Este cliente no tiene puntos suficientes."
          : "No se pudo canjear la recompensa.",
      );
      setRedeemingTier(null);
      return;
    }
    setCustomerPoints((prev) => Math.max(0, Number(prev ?? 0) - tier));
    const label = rewardCfg[tier];
    const amount = Math.min(subtotal, parseRewardDiscount(label));
    if (amount > 0) {
      setDiscountMeta({
        amount,
        percent: subtotal > 0 ? (amount / subtotal) * 100 : 0,
        type: "custom",
        description: `Recompensa ${tier} pts: ${label}`,
      });
    }
    setRedeemingTier(null);
  }

  async function submitSale(tenderedCash: number | null, forced?: PendingCharge | null) {
    const chargeParts = forced?.parts ?? cart.map((l) => ({ lineId: l.id, qty: l.qty }));
    const byId = new Map(cart.map((l) => [l.id, l] as const));
    const chargeItems = chargeParts
      .map((p) => {
        const line = byId.get(p.lineId);
        if (!line || p.qty <= 0) return null;
        return {
          productId: line.productId,
          name: line.name,
          qty: p.qty,
          unitPrice: line.unitPrice,
          lineTotal: p.qty * line.unitPrice,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (chargeItems.length === 0) return;
    const chargeSubtotal = chargeItems.reduce((n, i) => n + i.lineTotal, 0);
    const chargeTotal = forced?.total ?? chargeSubtotal;
    const chargeDiscount = Math.max(0, chargeSubtotal - chargeTotal);
    const customer =
      mode === "table"
        ? (clientName?.trim() || es.restaurant.defaultCustomer)
        : es.restaurant.defaultCustomer;
    const payload: Record<string, unknown> = {
      channel,
      tableId,
      items: chargeItems,
      subtotal: chargeSubtotal,
      discount: chargeDiscount,
      total: chargeTotal,
      payments: [{ method: paymentMethod, amount: chargeTotal }],
      customerName: customer,
      customerId: mode === "table" ? customerId : null,
      serverId: billingServerId,
      serverName: billingServerName,
      discountPercent: discountMeta?.percent ?? null,
      discountType: discountMeta?.type ?? null,
      discountDescription: discountMeta?.description ?? null,
      tenderedCash: null as number | null,
      changeGiven: null as number | null,
    };
    if (paymentMethod === "cash" && tenderedCash != null) {
      payload.tenderedCash = tenderedCash;
      payload.changeGiven = Math.max(0, tenderedCash - chargeTotal);
    }
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === "register_closed") {
        window.alert(data.message ?? es.orderFlow.registerClosed);
        refreshRegister();
      } else {
        window.alert("No se pudo registrar la venta.");
      }
      return;
    }
    const allCharged = cart.every((line) => {
      const picked = chargeParts.find((p) => p.lineId === line.id);
      return !!picked && picked.qty >= line.qty;
    });
    setPaymentModal(false);
    setPendingCharge(null);
    setCart((prev) =>
      prev
        .map((line) => {
          const picked = chargeParts.find((p) => p.lineId === line.id);
          if (!picked) return line;
          const nextQty = line.qty - picked.qty;
          if (nextQty <= 0) return null;
          return { ...line, qty: nextQty };
        })
        .filter((x): x is CartLine => !!x),
    );
    setDiscountMeta(null);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore localStorage failures
    }
    window.dispatchEvent(new CustomEvent("pos-sales-updated"));
    if (mode === "table" && table && onCloseTable && allCharged) {
      if (window.confirm(es.orderFlow.askCloseTable)) {
        await onCloseTable();
      }
    }
  }

  function startCheckout() {
    if (registerOpen === false) {
      window.alert(es.orderFlow.registerClosed);
      return;
    }
    if (!allSent || cart.length === 0) return;
    setPendingCharge({
      total,
      parts: cart.map((l) => ({ lineId: l.id, qty: l.qty })),
      label: "Cuenta completa",
    });
    setPaymentModal(true);
  }

  const headerTitle =
    mode === "counter"
      ? es.restaurant.counterHeader
      : table
        ? `${es.restaurant.tablePrefix} ${table.label}`
        : es.restaurant.noTableHeader;

  const canSendKitchen =
    unsentLines.length > 0 && (mode === "table" ? !!table : !!counterOrderId);
  const canCharge =
    registerOpen !== false && allSent && cart.length > 0 && (mode === "table" ? !!table : !!counterOrderId);

  const chipBtn =
    "rounded border border-slate-200/90 bg-white px-0.5 py-1 text-left text-[0.58rem] font-semibold leading-[1.08] text-slate-800 shadow-sm transition hover:bg-amber-50/80";

  const counterBlocked = mode === "counter" && !counterOrderId;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-white">
      {discountModal && (
        <DiscountModal
          subtotal={subtotal}
          onApply={applyDiscount}
          onClose={() => setDiscountModal(false)}
        />
      )}
      {paymentModal && (
        <PaymentChangeModal
          total={pendingCharge?.total ?? total}
          paymentMethod={paymentMethod}
          onConfirm={(tendered) => {
            void (async () => {
              await submitSale(tendered, pendingCharge);
            })();
          }}
          onSplit={
            cart.length > 0
              ? () => {
                  setPaymentModal(false);
                  setSplitModal(true);
                }
              : undefined
          }
          onClose={() => setPaymentModal(false)}
        />
      )}
      {splitModal && (
        <SplitBillModal
          cart={cart}
          onClose={() => setSplitModal(false)}
          onCharge={(parts, label) => {
            const byId = new Map(cart.map((l) => [l.id, l] as const));
            const splitTotal = parts.reduce((n, p) => {
              const line = byId.get(p.lineId);
              return n + (line ? p.qty * line.unitPrice : 0);
            }, 0);
            if (splitTotal <= 0) return;
            setPendingCharge({ total: splitTotal, parts, label });
            setSplitModal(false);
            setPaymentModal(true);
          }}
        />
      )}

      <header
        className="shrink-0 px-2 py-1.5 text-white"
        style={{ backgroundColor: "#c41e1e" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <h2 className="text-xs font-black uppercase tracking-wide">{headerTitle}</h2>
            {mode === "table" && table && (
              <div className="mt-0.5 space-y-0.5 text-[0.6rem] font-semibold text-white/95">
                <p>
                  {es.restaurant.customerLabel}: {clientName ?? es.restaurant.defaultCustomer}
                </p>
                {serverName && <p>Mesero: {serverName}</p>}
              </div>
            )}
            {mode === "counter" && (
              <p className="mt-0.5 text-[0.6rem] text-white/90">
                {es.restaurant.customerLabel}: {es.restaurant.defaultCustomer}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-0.5">
            <button
              type="button"
              title={es.orderFlow.reprint}
              className="rounded bg-white/15 p-1 text-white hover:bg-white/25"
              onClick={reprintLast}
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title={es.orderFlow.openDrawer}
              className="rounded bg-white/15 p-1 text-white hover:bg-white/25"
              onClick={() => openCashDrawerStub()}
            >
              <Vault className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {registerOpen === false && (
        <div
          className="shrink-0 border-b border-amber-200 bg-amber-50 px-2 py-1.5 text-[0.6rem] text-amber-950"
          role="alert"
        >
          <p className="font-bold">{es.orderFlow.registerClosed}</p>
          <Link href="/ventas?tab=arqueos" className="mt-0.5 inline-block font-semibold underline">
            {es.orderFlow.openRegisterLink}
          </Link>
        </div>
      )}

      {mode === "table" && customerId && clientName !== es.restaurant.defaultCustomer && (
        <div className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[0.62rem] text-emerald-900">
          <p className="font-bold">
            Recompensas: {customerPoints ?? 0} pts
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {([50, 100, 150] as const).map((tier) => {
              const ok = Number(customerPoints ?? 0) >= tier;
              return (
                <button
                  key={tier}
                  type="button"
                  disabled={!ok || redeemingTier === tier}
                  onClick={() => {
                    void redeemReward(tier);
                  }}
                  className={`rounded-full border px-2 py-0.5 text-[0.58rem] font-extrabold uppercase tracking-wide ${
                    ok
                      ? "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                  title={rewardCfg[tier]}
                >
                  {redeemingTier === tier ? "Aplicando..." : ok ? `Aplicar ${tier}` : `${tier}`}
                </button>
              );
            })}
          </div>
          <p className="mt-0.5 text-[0.58rem] text-emerald-800/80">
            Para descuento automático, escribe el valor en la recompensa (ej: "$5 Postre").
          </p>
        </div>
      )}

      <div className="shrink-0 border-b border-slate-100 px-2 py-1.5">
        <input
          type="search"
          placeholder={es.restaurant.searchProduct}
          className="input-base w-full rounded border px-1.5 py-1 text-xs"
          style={{ borderColor: "var(--pos-border)" }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={counterBlocked}
        />
      </div>

      {q && searchHits.length > 0 && (
        <div className="max-h-20 shrink-0 overflow-y-auto border-b border-slate-100 px-1 py-1">
          <ul className="space-y-0.5">
            {searchHits.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-0.5 rounded bg-slate-50 px-1 py-0.5"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-[0.65rem] font-medium text-slate-800"
                  onClick={() => addProduct(p.id)}
                  disabled={counterBlocked}
                >
                  <span className="block truncate">{p.name}</span>
                  <span className="text-[0.55rem] text-slate-500">${p.price.toFixed(2)}</span>
                </button>
                <button
                  type="button"
                  title={p.isFavorite ? es.restaurant.removeFavorite : es.restaurant.addFavorite}
                  className={`shrink-0 rounded p-0.5 ${
                    p.isFavorite ? "text-amber-500" : "text-slate-300 hover:text-amber-500"
                  }`}
                  onClick={() => setFavorite(p.id, !p.isFavorite)}
                >
                  <Star className="h-3 w-3" fill={p.isFavorite ? "currentColor" : "none"} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {q && searchHits.length === 0 && (
        <p className="shrink-0 border-b border-slate-100 px-2 py-1 text-[0.6rem] text-slate-500">
          {es.restaurant.noSearchHits}
        </p>
      )}

      {mode === "table" && !table ? (
        <div className="flex min-h-[100px] flex-1 flex-col items-center justify-center p-4 text-center text-xs text-slate-500">
          <p>{es.restaurant.selectTableHint}</p>
        </div>
      ) : counterBlocked ? (
        <div className="flex min-h-[100px] flex-1 flex-col items-center justify-center p-4 text-center text-xs text-slate-500">
          <p>{es.orderFlow.selectCounter}</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="max-h-[min(34vh,240px)] shrink-0 overflow-y-auto border-b border-slate-100">
            {favorites.length > 0 && (
              <div className="border-b border-slate-50">
                <p className="flex w-full items-center gap-1 px-2 py-1 text-left text-[0.6rem] font-extrabold uppercase text-slate-600">
                  <Star className="h-3 w-3 shrink-0 text-amber-500" fill="currentColor" aria-hidden />
                  {es.pos.favorites}
                </p>
                <div className="grid grid-cols-5 gap-0.5 px-1 pb-1.5">
                  {favorites.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`${chipBtn} border-amber-200/70 bg-amber-50/80 min-h-[2.6rem]`}
                      onClick={() => addProduct(p.id)}
                      title={p.name}
                      disabled={counterBlocked}
                    >
                      <span className="line-clamp-3">{p.name}</span>
                      <span className="block text-[0.5rem] text-slate-600">${p.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-b border-slate-50">
              <button
                type="button"
                className="flex w-full items-center gap-1 px-2 py-1 text-left text-[0.6rem] font-extrabold uppercase text-slate-500"
                onClick={() => setCategoriesSectionOpen((v) => !v)}
              >
                {categoriesSectionOpen ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">{es.restaurant.categoriesSection}</span>
                <span className="ml-auto text-[0.55rem] font-normal text-slate-400 tabular-nums">
                  {categoryIdsSorted.reduce((n, id) => n + (productsByCategory.get(id)?.length ?? 0), 0)}
                </span>
              </button>
              {categoriesSectionOpen &&
                categoryIdsSorted.map((catId) => {
                  const prods = productsByCategory.get(catId);
                  if (!prods?.length) return null;
                  const open = expandedCats[catId] ?? false;
                  return (
                    <div key={catId} className="border-t border-slate-50">
                      <button
                        type="button"
                        className="flex w-full items-center gap-1 px-2 py-0.5 text-left text-[0.6rem] font-bold text-slate-700"
                        onClick={() => setExpandedCats((prev) => ({ ...prev, [catId]: !open }))}
                      >
                        {open ? (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0" />
                        )}
                        <span className="truncate">{categoryName(catId)}</span>
                        <span className="ml-auto text-[0.55rem] font-normal text-slate-400">
                          {prods.length}
                        </span>
                      </button>
                      {open && (
                        <div className="grid grid-cols-5 gap-0.5 px-1 pb-1">
                          {prods.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className={`${chipBtn} min-h-[2.5rem] ${
                                p.isFavorite ? "border-amber-200/70 bg-amber-50/80" : ""
                              }`}
                              title={p.name}
                              onClick={() => addProduct(p.id)}
                              disabled={counterBlocked}
                            >
                              <span className="line-clamp-3">{p.name}</span>
                              <span className="block text-[0.5rem] text-slate-600">${p.price.toFixed(2)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
            <p className="text-[0.6rem] font-extrabold uppercase text-slate-500">{es.pos.cart}</p>
            <ul className="mt-1 space-y-1">
              {cart.map((line) => (
                <li
                  key={line.id}
                  className={`flex items-center gap-1 rounded border px-1 py-0.5 ${
                    line.kitchenSent
                      ? "border-emerald-100 bg-emerald-50/60"
                      : "border-slate-100 bg-slate-50/90"
                  }`}
                >
                  <div className="flex items-center rounded bg-white shadow-sm">
                    <button
                      type="button"
                      className="px-1 py-0 text-[0.65rem] font-bold text-slate-600 disabled:opacity-30"
                      disabled={line.kitchenSent}
                      onClick={() => setQty(line.id, line.qty - 1)}
                    >
                      −
                    </button>
                    <span className="min-w-[1rem] text-center text-[0.6rem] font-bold tabular-nums">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      className="px-1 py-0 text-[0.65rem] font-bold text-slate-600 disabled:opacity-30"
                      disabled={line.kitchenSent}
                      onClick={() => setQty(line.id, line.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.65rem] font-medium leading-tight">
                      {line.name}{" "}
                      <span className="text-[0.5rem] font-normal text-slate-400">
                        {line.kitchenSent ? `· ${es.orderFlow.sentKitchen}` : `· ${es.orderFlow.linePending}`}
                      </span>
                    </p>
                    <p className="text-[0.55rem] text-slate-500">
                      ${(line.qty * line.unitPrice).toFixed(2)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 px-0.5 text-[0.65rem] font-bold text-red-600 disabled:opacity-20"
                    disabled={line.kitchenSent}
                    onClick={() => removeLine(line.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {cart.length === 0 && (
              <p className="mt-2 text-[0.65rem] text-slate-400">{es.pos.emptyCart}</p>
            )}
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-slate-200 bg-slate-50/90 px-2 py-2">
        {mode === "table" && !table ? null : counterBlocked ? null : (
          <>
            {mode === "table" && table && (
              <p className="text-[0.6rem] font-semibold text-slate-600">
                {es.restaurant.pendingTotal}: ${subtotal.toFixed(2)}
              </p>
            )}
            {discountMeta && discountMeta.amount > 0 && (
              <p className="text-[0.55rem] text-rose-700">
                {es.pos.discount}: −${discountMeta.amount.toFixed(2)} ({discountMeta.type}) —{" "}
                {discountMeta.description}
              </p>
            )}
            <div className="mt-1 flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[0.6rem] font-bold"
                onClick={() => setDiscountModal(true)}
                disabled={subtotal <= 0 || registerOpen === false}
              >
                {es.orderFlow.discountBtn}
              </button>
              {discountMeta && (
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[0.55rem] font-semibold text-slate-600"
                  onClick={() => setDiscountMeta(null)}
                >
                  {es.orderFlow.clearDiscount}
                </button>
              )}
              <select
                className="ml-auto rounded border border-slate-200 bg-white px-1 py-1 text-[0.6rem]"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                <option value="cash">{es.pos.cash}</option>
                <option value="card">{es.pos.card}</option>
              </select>
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-slate-200 pt-1">
              <span className="text-[0.65rem] font-semibold text-slate-600">{es.pos.total}</span>
              <span className="text-sm font-black tabular-nums text-slate-900">${total.toFixed(2)}</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => {
                  if (cart.length === 0 && mode === "table" && table && onCloseTable) {
                    void onCloseTable();
                    return;
                  }
                  startCheckout();
                }}
                disabled={cart.length > 0 ? !canCharge : !(mode === "table" && table && onCloseTable)}
                className="btn-pos-primary py-2 text-[0.65rem] font-extrabold uppercase tracking-wide disabled:opacity-40"
              >
                {cart.length > 0 ? es.pos.checkout : `${es.restaurant.closeTable}`}
              </button>
              <button
                type="button"
                disabled={!canSendKitchen}
                className="rounded-lg py-2 text-[0.65rem] font-extrabold uppercase text-white shadow disabled:opacity-40"
                style={{ backgroundColor: "var(--pos-primary)" }}
                onClick={() => void sendKitchen()}
              >
                {es.orderFlow.sendKitchen}
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function SplitBillModal({
  cart,
  onClose,
  onCharge,
}: {
  cart: CartLine[];
  onClose: () => void;
  onCharge: (parts: ChargeLinePart[], label: string) => void;
}) {
  const [mode, setMode] = useState<"percent" | "people" | "items">("percent");
  const [percent, setPercent] = useState(50);
  const [people, setPeople] = useState(2);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const subtotal = useMemo(() => cart.reduce((n, l) => n + l.qty * l.unitPrice, 0), [cart]);

  function byPercent(targetPercent: number) {
    let target = (subtotal * targetPercent) / 100;
    const parts: ChargeLinePart[] = [];
    for (const line of cart) {
      if (target <= 0) break;
      const maxLine = line.qty * line.unitPrice;
      const takeQty = Math.min(line.qty, Math.max(0, Math.ceil(target / line.unitPrice)));
      const realTake = Math.min(takeQty, line.qty);
      if (realTake > 0) {
        parts.push({ lineId: line.id, qty: realTake });
        target -= Math.min(maxLine, realTake * line.unitPrice);
      }
    }
    return parts;
  }

  const chargeParts =
    mode === "items"
      ? cart.filter((l) => selected[l.id]).map((l) => ({ lineId: l.id, qty: l.qty }))
      : mode === "people"
        ? byPercent(100 / Math.max(1, people))
        : byPercent(Math.max(1, Math.min(100, percent)));

  return (
    <div className="fixed inset-0 z-[131] flex items-center justify-center bg-black/45 p-3">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
        <h2 className="text-base font-black text-slate-900">Dividir cuenta</h2>
        <div className="mt-2 flex gap-1">
          {(["percent", "people", "items"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded px-2 py-1 text-xs font-bold uppercase ${mode === m ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {m === "percent" ? "%" : m === "people" ? "Personas" : "Productos"}
            </button>
          ))}
        </div>
        {mode === "percent" && (
          <div className="mt-3">
            <label className="text-xs font-bold text-slate-600">Porcentaje</label>
            <input type="number" min={1} max={100} className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm" value={percent} onChange={(e) => setPercent(Number(e.target.value) || 1)} />
          </div>
        )}
        {mode === "people" && (
          <div className="mt-3">
            <label className="text-xs font-bold text-slate-600">Entre cuantas personas</label>
            <input type="number" min={2} className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm" value={people} onChange={(e) => setPeople(Math.max(2, Number(e.target.value) || 2))} />
          </div>
        )}
        {mode === "items" && (
          <div className="mt-3 max-h-44 space-y-1 overflow-y-auto">
            {cart.map((l) => (
              <label key={l.id} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-sm">
                <input type="checkbox" checked={!!selected[l.id]} onChange={() => setSelected((p) => ({ ...p, [l.id]: !p[l.id] }))} />
                <span className="flex-1 truncate">{l.qty}x {l.name}</span>
              </label>
            ))}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-bold" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn-pos-primary flex-1 py-2 text-sm font-extrabold uppercase disabled:opacity-40"
            disabled={chargeParts.length === 0}
            onClick={() => onCharge(chargeParts, "Division de cuenta")}
          >
            Cobrar esta parte
          </button>
        </div>
      </div>
    </div>
  );
}
