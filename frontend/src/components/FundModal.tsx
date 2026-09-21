"use client";

import React, { useState } from "react";
import { Coins, X, CheckCircle2, AlertCircle } from "lucide-react";
import { formatGEN, parseGEN, TxLifecycleState, sendContractTransaction, getContractAddress } from "../lib/genlayer";
import TransactionConfirmPanel from "./TransactionConfirmPanel";

interface FundModalProps {
  campaignId: number;
  campaignTitle: string;
  totalRequired: string;
  alreadyFunded: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FundModal({
  campaignId,
  campaignTitle,
  totalRequired,
  alreadyFunded,
  onClose,
  onSuccess,
}: FundModalProps) {
  const [amountGEN, setAmountGEN] = useState("10");
  const [txState, setTxState] = useState<TxLifecycleState>("IDLE");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleFund = async () => {
    setErrorMessage(null);
    setTxHash(null);

    try {
      const valWei = parseGEN(amountGEN);
      if (valWei <= BigInt(0)) {
        throw new Error("Funding amount must be greater than 0 GEN");
      }

      setTxState("AWAITING_WALLET");

      const submittedHash = await sendContractTransaction({
        functionName: "fund_campaign",
        args: [BigInt(campaignId)],
        value: valWei,
      });

      if (!submittedHash || typeof submittedHash !== "string" || !submittedHash.startsWith("0x")) {
        throw new Error("Transaction was rejected or returned an invalid hash");
      }

      setTxHash(submittedHash);
      setTxState("PROCESSING");

      setTimeout(() => {
        setTxState("CONFIRMED");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }, 3000);
    } catch (err: any) {
      console.error("Fund transaction failed:", err);
      setErrorMessage(err.message || "Failed to submit funding transaction to StudioNet");
      setTxState("FAILED");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card rounded-2xl border border-slate-800 w-full max-w-md p-6 space-y-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Fund Campaign Escrow</h3>
            <p className="text-xs text-slate-400">Payable GEN directly enters smart escrow on StudioNet</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
          <div className="text-slate-400 font-medium">Campaign:</div>
          <div className="text-white font-bold">{campaignTitle}</div>
          <div className="flex justify-between text-slate-500 pt-1">
            <span>Target: {totalRequired}</span>
            <span className="text-emerald-400">Funded: {alreadyFunded}</span>
          </div>
        </div>

        {!showConfirm ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Deposit Amount (GEN)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  placeholder="Enter GEN amount"
                  value={amountGEN}
                  onChange={(e) => setAmountGEN(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-bold text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-amber-400">
                  GEN
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Funds lock into smart escrow. Release occurs only after GenLayer validator milestone consensus.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (parseFloat(amountGEN) > 0) {
                    setShowConfirm(true);
                  }
                }}
                disabled={!amountGEN || parseFloat(amountGEN) <= 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md shadow-amber-500/10 disabled:opacity-50"
              >
                Review Deposit Details
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <TransactionConfirmPanel
              action="Fund Campaign Escrow"
              amountGEN={amountGEN}
              recipientLabel="AidFlow Smart Contract (Payable Escrow)"
              recipientAddress={getContractAddress()}
              explanation={`Transfers ${amountGEN} GEN to the AidFlow smart contract via fund_campaign(${campaignId}). Capital is locked in on-chain escrow and released in tranches only when GenLayer validators verify milestone deliverables.`}
              isSubmitting={txState === "AWAITING_WALLET" || txState === "PROCESSING"}
              onConfirm={handleFund}
              onCancel={() => setShowConfirm(false)}
            />

            {txState !== "IDLE" && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                  txState === "CONFIRMED"
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                    : txState === "FAILED"
                    ? "bg-rose-950/20 border-rose-500/40 text-rose-300"
                    : "bg-cyan-950/20 border-cyan-500/40 text-cyan-300"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>Transaction Status: {txState}</span>
                  {txHash && (
                    <span className="font-mono text-[10px]">
                      Tx: {txHash.slice(0, 8)}...{txHash.slice(-6)}
                    </span>
                  )}
                </div>
                {txState === "AWAITING_WALLET" && <p>Please approve the fund_campaign transaction in your wallet...</p>}
                {txState === "PROCESSING" && <p>Broadcasting to StudioNet. Waiting for consensus receipt...</p>}
                {txState === "CONFIRMED" && <p>Deposit confirmed! Escrow updated.</p>}
                {errorMessage && <p className="text-rose-400">{errorMessage}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

