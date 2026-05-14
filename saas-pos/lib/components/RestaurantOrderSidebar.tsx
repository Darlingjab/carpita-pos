"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Printer, Star, Vault } from "lucide-react";
import { demoCategories, demoProducts } from "@/lib/mock-data";
import { useMergedCatalog } from "@/lib/hooks/useMergedCatalog";
import { postSaleWithOfflineQueue } from "@/lib/client/post-sale";
import { es } from "@/lib/locale";
import { rememberRegisterOpen, canAssumeRegisterOpenOffline } from "@/lib/register-open-snapshot";
import { loadOverrides, saveOverrides } from "@/lib/product-overrides";
import type { DiningTable, PaymentMethod, Product, SaleChannel, SaleItem, SalePayment } from "@/lib/types";
import { DiscountModal, type DiscountApplyPayload } from "@/lib/components/DiscountModal";
import { PaymentChangeModal, type PaymentModalResult } from "@/lib/components/PaymentChangeModal";
import { printKitchenTicket, printSaleReceipt, printPreCuenta, openCashDrawerStub } from "@/lib/print-ticket";
import { loadPrinterSettings } from "@/lib/printer-settings";
import { RestaurantFavoritesAdminModal } from "@/lib/components/RestaurantFavoritesAdminModal";
import {
  appearanceForSlot,
  FAVORITE_GRID_COLS_DEFAULT,
  loadFavoriteGridColumns,
  loadFavoriteSlotIds,
} from "@/lib/restaurant-favorites-config";

function lineId() {
  return `ln_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Si la etiqueta ya trae el prefijo (p. ej. "MESA 2"), no repetir "Mesa MESA 2". */
function diningTableHeaderLabel(prefix: string, label: string): string {
  const p = prefix.trim();
  const lab = label.trim();
  if (!lab) return p;
  const pu = p.toUpperCase();
  const lu = lab.toUpperCase();
  if (lu.startsWith(`${pu} `) || lu === pu) return lab;
  return `${p} ${lab}`.trim();
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
  /** Permiso `favorites.manage` (admin). */
  canConfigureFavorites?: boolean;
};

function setFavorite(productId: string, value: boolean) {
  const m = loadOverrides();
  m[productId] = { ...m[productId], isFavorite: value };
  saveOverrides(m);
  window.dispatchEvent(new CustomEvent("pos-catalog-updated"));
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
  canConfigureFavorites = false,
}: Props) {
  const catalog = useMergedCatalog(demoProducts);
  /** Catálogo para venta en mesa/mostrador: sin temporada (solo facilita venta actual; reportes siguen con histórico). */
  const saleCatalog = useMemo(
    () => catalog.filter((p) => !p.isSeasonal),
    [catalog],
  );
  const [search, setSearch] = useState("");
  const [discountMeta, setDiscountMeta] = useState<DiscountMeta | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cart, setCart] = useState<CartLine[]>([]);
  /** Abierto por defecto para ver productos por categoría sin paso extra (especialmente en escritorio). */
  const [categoriesSectionOpen, setCategoriesSectionOpen] = useState(true);
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
  const [favoriteSlotIds, setFavoriteSlotIds] = useState<string[] | null>(null);
  const [favoriteGridCols, setFavoriteGridCols] = useState(FAVORITE_GRID_COLS_DEFAULT);
  const [favAdminOpen, setFavAdminOpen] = useState(false);
  /** Por defecto expandido; el cajero puede minimizar para ganar espacio. */
  const [favoritesSectionOpen, setFavoritesSectionOpen] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [closeTableConfirm, setCloseTableConfirm] = useState(false);
  const closeTableCallback = useRef<(() => void | Promise<void>) | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
  }

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const draftKey = useMemo(() => {
    if (mode === "counter") return `pos_order_draft:counter:${counterOrderId ?? "none"}`;
    return `pos_order_draft:table:${table?.id ?? "none"}`;
  }, [mode, counterOrderId, table?.id]);

  const lastPrintPayload = useRef<{ title: string; subtitle: string; lines: { name: string; qty: number }[] } | null>(null);

  const refreshRegister = useCallback(() => {
    fetch("/api/register/status")
      .then((r) => r.json())
      .then((d) => {
        const open = !!d.data?.isOpen;
        rememberRegisterOpen(open);
        setRegisterOpen(open);
      })
      .catch(() => {
        if (canAssumeRegisterOpenOffline()) setRegisterOpen(true);
        else setRegisterOpen(false);
      });
  }, []);

  useEffect(() => {
    refreshRegister();
    window.addEventListener("pos-register-updated", refreshRegister);
    return () => window.removeEventListener("pos-register-updated", refreshRegister);
  }, [refreshRegister]);

  useEffect(() => {
    function syncFavLayout() {
      setFavoriteSlotIds(loadFavoriteSlotIds());
      setFavoriteGridCols(loadFavoriteGridColumns());
    }
    syncFavLayout();
    window.addEventListener("pos-restaurant-favorites-updated", syncFavLayout);
    window.addEventListener("pos-catalog-updated", syncFavLayout);
    return () => {
      window.removeEventListener("pos-restaurant-favorites-updated", syncFavLayout);
      window.removeEventListener("pos-catalog-updated", syncFavLayout);
    };
  }, []);

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
      const pm = parsed.paymentMethod;
      setPaymentMethod(pm === "card" || pm === "transfer" ? pm : "cash");
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
    return saleCatalog.filter((p) => {
      if (p.isArchived || !p.isActive) return false;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    }).slice(0, 20);
  }, [saleCatalog, q]);

  const usingCustomFavoriteSlots = favoriteSlotIds !== null;

  const favoritesWithColors = useMemo(() => {
    if (favoriteSlotIds !== null) {
      const out: { product: Product; colorIndex: number }[] = [];
      for (const id of favoriteSlotIds) {
        const p = saleCatalog.find((x) => x.id === id);
        if (p && !p.isArchived && p.isActive) {
          out.push({ product: p, colorIndex: p.favoriteColorIndex ?? 0 });
        }
      }
      return out;
    }
    return saleCatalog
      .filter((p) => p.isFavorite && !p.isArchived && p.isActive)
      .map((product) => ({ product, colorIndex: product.favoriteColorIndex ?? 0 }));
  }, [favoriteSlotIds, saleCatalog]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of saleCatalog) {
      if (p.isArchived || !p.isActive) continue;
      const list = map.get(p.categoryId) ?? [];
      list.push(p);
      map.set(p.categoryId, list);
    }
    return map;
  }, [saleCatalog]);

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
    const product = saleCatalog.find((p) => p.id === productId);
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
      showToast(es.orderFlow.registerClosed);
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
      showToast(
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
    // Respetar preferencia: imprimir comanda automáticamente o no
    if (loadPrinterSettings().printKitchenAuto) {
      printKitchenTicket(payload);
    }
    setCart((prev) =>
      prev.map((l) => (unsentLines.some((u) => u.id === l.id) ? { ...l, kitchenSent: true } : l)),
    );
    window.dispatchEvent(new CustomEvent("pos-kitchen-updated"));
  }

  function reprintLast() {
    const p = lastPrintPayload.current;
    if (!p) {
      showToast("No hay comanda reciente.");
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
      showToast(
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

  async function submitSale(pay: PaymentModalResult, forced?: PendingCharge | null) {
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
    const payments: SalePayment[] =
      pay.payments.length > 0
        ? pay.payments
        : [{ method: paymentMethod, amount: chargeTotal }];

    const payload: Record<string, unknown> = {
      channel,
      tableId,
      items: chargeItems,
      subtotal: chargeSubtotal,
      discount: chargeDiscount,
      total: chargeTotal,
      payments,
      customerName: customer,
      customerId: mode === "table" ? customerId : null,
      serverId: billingServerId,
      serverName: billingServerName,
      discountPercent: discountMeta?.percent ?? null,
      discountType: discountMeta?.type ?? null,
      discountDescription: discountMeta?.description ?? null,
      tenderedCash: pay.tenderedCash,
      changeGiven: pay.changeGiven,
    };
    const result = await postSaleWithOfflineQueue(payload);
    if (result.kind === "error") {
      if (result.error === "register_closed") {
        showToast(result.message ?? es.orderFlow.registerClosed);
        refreshRegister();
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

    // Imprimir recibo del cliente tras cobro exitoso (o en cola offline)
    if (loadPrinterSettings().printReceiptAuto) printSaleReceipt({
      tableLabel: table?.label ?? undefined,
      serverName: billingServerName ?? undefined,
      customerName: customer,
      items: chargeItems,
      subtotal: chargeSubtotal,
      discount: chargeDiscount,
      total: chargeTotal,
      payments,
      tenderedCash: pay.tenderedCash ?? null,
      changeGiven: pay.changeGiven ?? null,
      discountType: discountMeta?.type ?? null,
      discountDescription: discountMeta?.description ?? null,
      discountPercent: discountMeta?.percent ?? null,
    });

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
    if (mode === "table" && table && onCloseTable && allCharged) {
      closeTableCallback.current = onCloseTable;
      setCloseTableConfirm(true);
    }
  }

  function startCheckout() {
    if (registerOpen === false) {
      showToast(es.orderFlow.registerClosed);
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
        ? diningTableHeaderLabel(es.restaurant.tablePrefix, table.label)
        : es.restaurant.noTableHeader;

  const canSendKitchen =
    unsentLines.length > 0 && (mode === "table" ? !!table : !!counterOrderId);
  const canCharge =
    registerOpen !== false && allSent && cart.length > 0 && (mode === "table" ? !!table : !!counterOrderId);

  const chipBtn =
    "rounded border border-slate-200/90 bg-white px-0.5 py-1 text-left text-[0.58rem] font-semibold leading-[1.08] text-slate-800 shadow-sm transition hover:bg-amber-50/80";

  const counterBlocked = mode === "counter" && !counterOrderId;

  return (
    <aside className="flex h-full min-h-0 max-h-full w-full min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {toastMsg && (
        <div
          className="fixed bottom-4 left-1/2 z-[300] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            <span className="flex-1 leading-snug">{toastMsg}</span>
            <button type="button" className="shrink-0 text-slate-400 hover:text-white" onClick={() => setToastMsg(null)} aria-label="Cerrar">✕</button>
          </div>
        </div>
      )}
      {closeTableConfirm && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/45 p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <p className="text-sm text-slate-700">{es.orderFlow.askCloseTable}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => setCloseTableConfirm(false)}
              >
                No
              </button>
              <button
                type="button"
                className="btn-pos-primary flex-1 py-2.5 text-sm font-extrabold"
                onClick={async () => {
                  setCloseTableConfirm(false);
                  if (closeTableCallback.current) await closeTableCallback.current();
                }}
              >
                Sí, cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {discountModal && (
        <DiscountModal
          subtotal={subtotal}
          onApply={applyDiscount}
          onClose={() => setDiscountModal(false)}
        />
      )}
      {paymentModal && (
        <PaymentChangeModal
          key={`${pendingCharge?.total ?? total}-${pendingCharge?.label ?? "full"}`}
          total={pendingCharge?.total ?? total}
          defaultMethod={paymentMethod}
          onConfirm={(result) => {
            void (async () => {
              await submitSale(result, pendingCharge);
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

      <RestaurantFavoritesAdminModal
        open={favAdminOpen}
        onClose={() => setFavAdminOpen(false)}
        saleCatalog={saleCatalog}
      />

      <header
        className="shrink-0 px-2 py-1.5 text-white max-lg:py-1 lg:py-1.5"
        style={{ backgroundColor: "var(--pos-primary)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Mesa, cliente y mesero"
          >
            <h2
              className="m-0 inline-flex max-w-full shrink-0 items-center rounded-md border border-white/35 bg-white/12 px-2 py-1 text-[0.58rem] font-black uppercase leading-none tracking-wide text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]"
              title={headerTitle}
            >
              <span className="truncate">{headerTitle}</span>
            </h2>
            {mode === "table" && table && (
              <>
                <span
                  className="inline-flex max-w-[min(100%,14rem)] min-w-0 items-center rounded-md border border-white/35 bg-white/12 px-2 py-1 text-[0.58rem] font-bold leading-tight text-white/95 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]"
                  title={`${es.restaurant.customerLabel}: ${clientName ?? es.restaurant.defaultCustomer}`}
                >
                  <span className="truncate">
                    <span className="font-extrabold text-white/70">{es.restaurant.customerLabel}</span>
                    <span className="mx-0.5 text-white/40">·</span>
                    <span className="font-semibold">{clientName ?? es.restaurant.defaultCustomer}</span>
                  </span>
                </span>
                {serverName ? (
                  <span
                    className="inline-flex max-w-[min(100%,12rem)] min-w-0 items-center rounded-md border border-white/35 bg-white/12 px-2 py-1 text-[0.58rem] font-bold leading-tight text-white/95 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]"
                    title={`Mesero: ${serverName}`}
                  >
                    <span className="truncate">
                      <span className="font-extrabold text-white/70">Mesero</span>
                      <span className="mx-0.5 text-white/40">·</span>
                      <span className="font-semibold">{serverName}</span>
                    </span>
                  </span>
                ) : null}
              </>
            )}
            {mode === "counter" && (
              <span
                className="inline-flex max-w-full min-w-0 items-center rounded-md border border-white/35 bg-white/12 px-2 py-1 text-[0.58rem] font-bold leading-tight text-white/90 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]"
                title={`${es.restaurant.customerLabel}: ${es.restaurant.defaultCustomer}`}
              >
                <span className="truncate">
                  <span className="font-extrabold text-white/70">{es.restaurant.customerLabel}</span>
                  <span className="mx-0.5 text-white/40">·</span>
                  <span>{es.restaurant.defaultCustomer}</span>
                </span>
              </span>
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

      <div className="shrink-0 border-b border-slate-100 px-2 py-1 max-lg:py-1">
        <input
          type="search"
          placeholder={es.restaurant.searchProduct}
          className="input-base w-full rounded border px-1.5 py-1 text-xs max-lg:py-0.5"
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
                {!usingCustomFavoriteSlots && (
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
                )}
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:min-h-0">
            <div className="flex min-h-[9rem] flex-[5] basis-0 flex-col gap-1.5 overflow-hidden border-b border-slate-100 px-1 pb-1 [-webkit-overflow-scrolling:touch] max-lg:max-h-[52dvh] lg:min-h-[14rem]">
              <section
                className="flex min-h-0 flex-[2] basis-0 flex-col overflow-hidden rounded-lg border border-slate-200/90 bg-slate-50/80 shadow-sm"
                aria-labelledby="restaurant-favorites-heading"
              >
                <div className="flex shrink-0 items-center gap-1.5 border-b border-slate-200/80 bg-white/50 px-2 py-1">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1 rounded-md py-0.5 text-left text-[0.6rem] font-extrabold uppercase text-slate-600 hover:bg-white/80"
                    onClick={() => setFavoritesSectionOpen((v) => !v)}
                    aria-expanded={favoritesSectionOpen}
                    aria-controls="restaurant-favorites-panel"
                    id="restaurant-favorites-heading"
                    title={favoritesSectionOpen ? es.restaurant.favoritesHide : es.restaurant.favoritesShow}
                  >
                    {favoritesSectionOpen ? (
                      <ChevronDown className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                    )}
                    <Star className="h-3 w-3 shrink-0 text-amber-500" fill="currentColor" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{es.pos.favorites}</span>
                    {favoritesWithColors.length > 0 && (
                      <span className="shrink-0 rounded border border-slate-200/80 bg-white px-1 py-px text-[0.55rem] font-semibold normal-case tabular-nums text-slate-500">
                        {favoritesWithColors.length}
                      </span>
                    )}
                  </button>
                  {canConfigureFavorites && (
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.6rem] font-extrabold uppercase text-slate-700 shadow-sm hover:bg-slate-50"
                      onClick={() => setFavAdminOpen(true)}
                    >
                      {es.restaurant.favoritesEdit}
                    </button>
                  )}
                </div>
                {favoritesSectionOpen ? (
                  <div
                    id="restaurant-favorites-panel"
                    role="region"
                    className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable] px-1 py-1"
                  >
                    {favoritesWithColors.length === 0 ? (
                      <p className="px-1 py-2 text-[0.6rem] text-slate-500">{es.restaurant.favoritesNoItems}</p>
                    ) : (
                      <div
                        className="grid gap-1 overflow-x-hidden lg:gap-0.5"
                        style={{
                          gridTemplateColumns: `repeat(${favoriteGridCols}, minmax(0, 1fr))`,
                        }}
                      >
                        {favoritesWithColors.map(({ product: p, colorIndex }) => {
                          const col = appearanceForSlot(colorIndex);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={`${chipBtn} min-h-[2.6rem] min-w-0 border-2 px-0.5 py-0.5 text-[0.52rem] leading-tight sm:text-[0.55rem] max-lg:min-h-[2.25rem] lg:min-h-[2.6rem] lg:px-0.5 lg:text-[0.58rem] lg:leading-[1.08] w-full`}
                              style={{
                                backgroundColor: col.background,
                                borderColor: col.border,
                                color: col.text,
                              }}
                              onClick={() => addProduct(p.id)}
                              title={p.name}
                              disabled={counterBlocked}
                            >
                              <span className="line-clamp-2 lg:line-clamp-3">{p.name}</span>
                              <span className="block text-[0.48rem] opacity-80 max-lg:mt-px lg:text-[0.5rem]">
                                ${p.price.toFixed(2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </section>

              <section
                className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm"
                aria-labelledby="restaurant-categories-heading"
              >
                <button
                  type="button"
                  id="restaurant-categories-heading"
                  className="flex w-full shrink-0 items-center gap-1 border-b border-slate-100 bg-slate-50/40 px-2 py-1 text-left text-[0.6rem] font-extrabold uppercase text-slate-600 hover:bg-slate-50/90"
                  onClick={() => setCategoriesSectionOpen((v) => !v)}
                  aria-expanded={categoriesSectionOpen}
                  aria-controls="restaurant-categories-panel"
                >
                  {categoriesSectionOpen ? (
                    <ChevronDown className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate">{es.restaurant.categoriesSection}</span>
                  <span className="shrink-0 rounded border border-slate-200/80 bg-white px-1 py-px text-[0.55rem] font-normal tabular-nums text-slate-500">
                    {categoryIdsSorted.reduce((n, id) => n + (productsByCategory.get(id)?.length ?? 0), 0)}
                  </span>
                </button>
                {categoriesSectionOpen ? (
                  <div
                    id="restaurant-categories-panel"
                    role="region"
                    className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]"
                  >
                    {categoryIdsSorted.map((catId) => {
                      const prods = productsByCategory.get(catId);
                      if (!prods?.length) return null;
                      const open = expandedCats[catId] ?? false;
                      return (
                        <div key={catId} className="border-t border-slate-100">
                          <button
                            type="button"
                            className="flex w-full items-center gap-1 px-2 py-0.5 text-left text-[0.6rem] font-bold text-slate-700 hover:bg-slate-50/80"
                            onClick={() => setExpandedCats((prev) => ({ ...prev, [catId]: !open }))}
                          >
                            {open ? (
                              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
                            ) : (
                              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                            )}
                            <span className="truncate">{categoryName(catId)}</span>
                            <span className="ml-auto text-[0.55rem] font-normal text-slate-400">{prods.length}</span>
                          </button>
                          {open && (
                            <div className="flex gap-0.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] max-lg:px-1 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-1">
                              {prods.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className={`${chipBtn} min-h-[2.5rem] max-lg:min-w-[4.75rem] max-lg:shrink-0 ${
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
                ) : null}
              </section>
            </div>

            <div className="flex min-h-[8rem] flex-[2] basis-0 flex-col overflow-hidden border-t border-slate-100 px-2 py-1.5 lg:min-h-[10rem] lg:border-t-0">
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]">
                <ul className="space-y-1.5 pb-2" aria-label={es.pos.cart}>
                  {cart.map((line) => (
                    <li
                      key={line.id}
                      className={`flex items-center gap-1 rounded border px-1 py-0.5 ${
                        line.kitchenSent
                          ? "border-emerald-100 bg-emerald-50/60"
                          : "border-slate-100 bg-slate-50/90"
                      }`}
                    >
                      <div className="flex items-center rounded border border-slate-200 bg-white shadow-sm">
                        <button
                          type="button"
                          className="flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center text-[0.7rem] font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30"
                          disabled={line.kitchenSent}
                          onClick={() => setQty(line.id, line.qty - 1)}
                        >
                          −
                        </button>
                        <span className="min-w-[1.25rem] border-x border-slate-200 text-center text-[0.6rem] font-bold tabular-nums leading-none py-1">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          className="flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center text-[0.7rem] font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30"
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
                        className="min-h-8 min-w-8 shrink-0 rounded-md border border-red-200 bg-red-50 px-1.5 text-base font-black leading-none text-red-700 disabled:opacity-25 sm:min-h-10 sm:min-w-10 sm:px-2 sm:text-lg"
                        disabled={line.kitchenSent}
                        onClick={() => removeLine(line.id)}
                        aria-label="Quitar línea"
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
        </div>
      )}

      <div
        className="sticky bottom-0 z-20 shrink-0 border-t bg-white px-2.5 pt-2 shadow-[0_-8px_20px_-4px_rgb(15_23_42/0.10)] supports-[backdrop-filter]:bg-white/96 supports-[backdrop-filter]:backdrop-blur-md"
        style={{
          borderColor: "var(--pos-border)",
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        {mode === "table" && !table ? null : counterBlocked ? null : (
          <>
            {/* Controles auxiliares: descuento + forma de pago */}
            <div className="flex flex-wrap items-center gap-1 pb-1.5">
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[0.6rem] font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40"
                onClick={() => setDiscountModal(true)}
                disabled={subtotal <= 0 || registerOpen === false}
              >
                {es.orderFlow.discountBtn}
              </button>
              {discountMeta && (
                <button
                  type="button"
                  className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[0.55rem] font-semibold text-rose-600 transition-colors hover:bg-rose-100"
                  onClick={() => setDiscountMeta(null)}
                >
                  ✕ {es.orderFlow.clearDiscount}
                </button>
              )}
              <select
                className="ml-auto rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[0.6rem] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[var(--pos-primary)]/40"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                <option value="cash">{es.pos.cash}</option>
                <option value="card">{es.pos.card}</option>
                <option value="transfer">{es.pos.transfer}</option>
              </select>
            </div>

            {/* Descuento aplicado */}
            {discountMeta && discountMeta.amount > 0 && (
              <p className="mb-1 text-[0.55rem] font-semibold text-rose-600">
                Dto. −${discountMeta.amount.toFixed(2)} ({discountMeta.type}){discountMeta.description ? ` · ${discountMeta.description}` : ""}
              </p>
            )}

            {/* Total prominente */}
            <div className="flex items-baseline justify-between rounded-lg bg-slate-50 px-3 py-2" style={{ border: "1px solid var(--pos-border)" }}>
              <span className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">{es.pos.total}</span>
              <span className="text-lg font-black tabular-nums text-slate-900">${total.toFixed(2)}</span>
            </div>

            {/* Botones de acción principales */}
            <div className="mt-2 grid grid-cols-2 gap-1.5">
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
                className="rounded-lg py-2.5 text-[0.68rem] font-extrabold uppercase tracking-wide text-white shadow-sm transition-all disabled:opacity-40 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97]"
              >
                {cart.length > 0 ? es.pos.checkout : `${es.restaurant.closeTable}`}
              </button>
              <button
                type="button"
                disabled={!canSendKitchen}
                className="rounded-lg py-2.5 text-[0.68rem] font-extrabold uppercase tracking-wide text-white shadow-sm transition-all disabled:opacity-40 active:scale-[0.97]"
                style={{ backgroundColor: "var(--pos-primary)" }}
                onClick={() => void sendKitchen()}
              >
                {es.orderFlow.sendKitchen}
              </button>
            </div>

            {/* Acciones secundarias */}
            {cart.length > 0 && (
              <button
                type="button"
                disabled={!canCharge}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white py-1.5 text-[0.6rem] font-extrabold uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
                onClick={() => setSplitModal(true)}
              >
                {es.orderFlow.partialCheckout}
              </button>
            )}
            {mode === "table" && cart.length > 0 && (
              <button
                type="button"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-1.5 text-[0.6rem] font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                onClick={() =>
                  printPreCuenta({
                    tableLabel: table?.label,
                    serverName: serverName ?? undefined,
                    items: cart.map((l) => ({
                      name: l.name,
                      qty: l.qty,
                      unitPrice: l.unitPrice,
                      lineTotal: l.qty * l.unitPrice,
                    })),
                    subtotal,
                    discount: discountMeta?.amount ?? 0,
                    total,
                  })
                }
              >
                🧾 Ver pre-cuenta
              </button>
            )}
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
