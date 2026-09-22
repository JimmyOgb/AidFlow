"use client";

import React from "react";
import { ShieldCheck, ArrowUpRight, Lock } from "lucide-react";
import { getContractAddress } from "../lib/genlayer";

interface TransactionConfirmPanelProps {
  action: string;
  methodName?: string;
  amountGEN?: string;
  callerAddress?: string;
  recipientLabel: string;
  recipientAddress?: string;
  contractAddress?: string;
  explanation: string;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function TransactionConfirmPanel({
  action,
  methodName,
  amountGEN,
  callerAddress,
  recipientLabel,
  recipientAddress,
  contractAddress,
  explanation,
  isSubmitting,
  onConfirm,
  onCancel,
}: TransactionConfirmPanelProps) {
  const activeContract = contractAddress || getContractAddress();
  const targetAddress = recipientAddress || activeContract;

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-left">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Transaction Verification Panel
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
          StudioNet (61999)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
            Action / Method
          </span>
          <span className="font-bold text-white mt-0.5 block">{action}</span>
          {methodName && (
            <span className="font-mono text-[10px] text-cyan-400 block mt-0.5">
              {methodName}()
            </span>
          )}
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
            Network
          </span>
          <span className="font-medium text-slate-300 mt-0.5 block">GenLayer StudioNet</span>
          <span className="font-mono text-[10px] text-slate-500 block mt-0.5">Chain ID: 61999</span>
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
            AidFlow Contract Address
          </span>
          <span className="font-mono text-[10px] text-slate-300 truncate block mt-0.5" title={activeContract}>
            {activeContract}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
            Native Value (GEN)
          </span>
          <span className="font-mono font-bold text-emerald-400 text-sm mt-0.5 block">
            {amountGEN ? `${amountGEN} GEN` : "0.00 GEN (State Call)"}
          </span>
        </div>

        {callerAddress && (
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
              Caller / Signer
            </span>
            <span className="font-mono text-[10px] text-slate-300 truncate block mt-0.5" title={callerAddress}>
              {callerAddress}
            </span>
          </div>
        )}

        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
            Recipient / Destination
          </span>
          <span className="font-medium text-slate-300 mt-0.5 block">{recipientLabel}</span>
          <span className="font-mono text-[10px] text-slate-400 truncate block mt-0.5" title={targetAddress}>
            {targetAddress}
          </span>
        </div>
      </div>

      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
        <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200 block mb-0.5">Execution Details:</strong>
          {explanation}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-1/3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
            isSubmitting
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/10 active:scale-[0.98]"
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Awaiting Wallet...</span>
            </>
          ) : (
            <>
              <span>Authorize Transaction</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
