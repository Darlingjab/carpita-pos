"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Landmark } from "lucide-react";
import { es } from "@/lib/locale";
import type { PaymentMethod, SalePayment } from "@/lib/types";

export type PaymentModalResult = {
  payments: SalePayment[];
  tenderedCash: number | null;
  changeGiven: number | null;
};

type Props = {
  total: number;
  /** Preferencia inicial desde el panel (efectivo / tarjeta). */
  defaultMethod?: PaymentMethod;
  onConfirm: (result: PaymentModalResult) => void;
  onSplit?: () => void;
  onClose: () => void;
};

function parseMoney(s: string): number {
  const raw = s.trim().replace(",", ".");
  if (raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

const EPS = 0.02;

export function PaymentChangeModal({ total, defaultMethod = "cash", onConfirm, onSplit, onClose }: Props) {
  const [cashStr, setCashStr] = useState("");
  const [cardStr, setCardStr] = useState("");
  const [transferStr, setTransferStr] = useState("");
  const [receivedStr, setReceivedStr] = useState("");

  useEffect(() => {
    if (defaultMethod === "cash") {
      setCashStr(total > 0 ? total.toFixed(2) : "");
      setCardStr("");
      setTransferStr("");
    } else if (defaultMethod === "card") {
      setCashStr("");
      setCardStr(total > 0 ? total.toFixed(2) : "");
      setTransferStr("");
    } else {
      setCashStr("");
      setCardStr("");
      setTransferStr(total > 0 ? total.toFixed(2) : "");
    }
    setReceivedStr("");
  }, [total, defaultMethod]);

  const cashAmt = parseMoney(cashStr);
  const cardAmt = parseMoney(cardStr);
  const transferAmt = parseMoney(transferStr);
  const allocated = cashAmt + cardAmt + transferAmt;
  const remainder = Math.round((total - allocated) * 100) / 100;
  const overpay = Math.round((allocated - total) * 100) / 100;

  const received = useMemo(() => {
    const r = parseMoney(receivedStr);
    if (receivedStr.trim() === "") return cashAmt;
    return r;
  }, [receivedStr, cashAmt]);

  /** Cambio por billetes (solo cuando lo cubierto ≈ total). */
  const changeFromBills = useMemo(() => {
    if (cashAmt <= EPS) return 0;
    if (overpay > EPS) return 0;
    return Math.max(0, Math.round((received - cashAmt) * 100) / 100);
  }, [cashAmt, received, overpay]);

  const coversTotal = allocated + EPS >= total && allocated > EPS;
  const exactOrOver = remainder <= EPS;

  function setAll(method: PaymentMethod) {
    const t = total.toFixed(2);
    setCashStr(method === "cash" ? t : "");
    setCardStr(method === "card" ? t : "");
    setTransferStr(method === "transfer" ? t : "");
    setReceivedStr("");
  }

  function submit() {
    if (!coversTotal) return;
    const payments: SalePayment[] = [];
    if (cashAmt > EPS) payments.push({ method: "cash", amount: cashAmt });
    if (cardAmt > EPS) payments.push({ method: "card", amount: cardAmt });
    if (transferAmt > EPS) payments.push({ method: "transfer", amount: transferAmt });

    let tenderedCash: number | null = null;
    let changeGiven: number | null = null;
    if (cashAmt > EPS) {
      tenderedCash = receivedStr.trim() === "" ? cashAmt : received;
    }
    const fromOver = overpay > EPS ? overpay : 0;
    const fromBills = changeFromBills;
    const totalChange = Math.round((fromOver + fromBills) * 100) / 100;
    changeGiven = totalChange > EPS ? totalChange : null;

    onConfirm({ payments, tenderedCash, changeGiven });
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-3">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
        <h2 className="text-center text-lg font-black tracking-tight text-slate-900 sm:text-xl">
          {es.paymentModal.title}
        </h2>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-slate-500">
            {es.paymentModal.toPay}
          </p>
          <p className="mt-1 text-3xl font-black tabular-nums text-slate-900 sm:text-4xl">
            ${total.toFixed(2)}
          </p>
        </div>

        <p className="mt-3 text-center text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
          {es.paymentModal.splitHint}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.65rem] font-bold uppercase text-slate-700 hover:bg-slate-50"
            onClick={() => setAll("cash")}
          >
            {es.paymentModal.allCash}
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.65rem] font-bold uppercase text-slate-700 hover:bg-slate-50"
            onClick={() => setAll("card")}
          >
            {es.paymentModal.allCard}
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.65rem] font-bold uppercase text-slate-700 hover:bg-slate-50"
            onClick={() => setAll("transfer")}
          >
            {es.paymentModal.allTransfer}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Banknote className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
            <span className="w-28 shrink-0 text-xs font-bold text-slate-700">{es.paymentModal.cashAmount}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1.5 text-right text-base font-bold tabular-nums"
              value={cashStr}
              onChange={(e) => setCashStr(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <CreditCard className="h-5 w-5 shrink-0 text-sky-700" aria-hidden />
            <span className="w-28 shrink-0 text-xs font-bold text-slate-700">{es.paymentModal.cardAmount}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1.5 text-right text-base font-bold tabular-nums"
              value={cardStr}
              onChange={(e) => setCardStr(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Landmark className="h-5 w-5 shrink-0 text-violet-700" aria-hidden />
            <span className="w-28 shrink-0 text-xs font-bold text-slate-700">{es.paymentModal.transferAmount}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1.5 text-right text-base font-bold tabular-nums"
              value={transferStr}
              onChange={(e) => setTransferStr(e.target.value)}
            />
          </label>
        </div>

        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-center text-sm font-bold ${
            remainder > EPS
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : exactOrOver
                ? overpay > EPS
                  ? "border-sky-200 bg-sky-50 text-sky-950"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {remainder > EPS
            ? `${es.paymentModal.remaining}: $${remainder.toFixed(2)}`
            : overpay > EPS
              ? `${es.paymentModal.changeFromOverpay}: $${overpay.toFixed(2)}`
              : es.paymentModal.splitOk}
        </div>

        {cashAmt > EPS && overpay <= EPS && (
          <>
            <label className="mt-3 block text-xs font-bold text-slate-600">{es.paymentModal.tendered}</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-lg font-bold tabular-nums"
              placeholder={cashAmt.toFixed(2)}
              value={receivedStr}
              onChange={(e) => setReceivedStr(e.target.value)}
            />
            {changeFromBills > EPS && (
              <div className="mt-2 flex justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
                <span>{es.paymentModal.change}</span>
                <span>${changeFromBills.toFixed(2)}</span>
              </div>
            )}
          </>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-bold"
            onClick={onClose}
          >
            {es.restaurant.cancel}
          </button>
          {onSplit && (
            <button
              type="button"
              className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700"
              onClick={onSplit}
            >
              {es.paymentModal.splitBill}
            </button>
          )}
          <button
            type="button"
            disabled={!coversTotal}
            className="btn-pos-primary min-h-11 flex-[1.2] py-2.5 text-sm font-extrabold uppercase disabled:opacity-40"
            onClick={submit}
          >
            {es.paymentModal.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
