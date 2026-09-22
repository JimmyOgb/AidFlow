"use client";

import React, { useState } from "react";
import { Cpu, X, CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck, Scale, ArrowRight, ExternalLink } from "lucide-react";
import { Milestone, AdjudicationResult } from "../lib/types";
import { formatGEN, TxLifecycleState, sendContractTransaction, waitForTransactionReceipt, getContractAddress } from "../lib/genlayer";

interface AdjudicationModalProps {
  campaignId: number;
  milestone: Milestone;
  onClose: () => void;
  onRefresh: () => void;
}

export default function AdjudicationModal({
  campaignId,
  milestone,
  onClose,
  onRefresh,
}: AdjudicationModalProps) {
  const [adjState, setAdjState] = useState<TxLifecycleState>("IDLE");
  const [adjTxHash, setAdjTxHash] = useState<string | null>(null);
  const [releaseState, setReleaseState] = useState<TxLifecycleState>("IDLE");
  const [releaseTxHash, setReleaseTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const adj = milestone.adjudication;
  const isPassed = milestone.status === "PASSED" || adj.decision === "PASS";
  const isInconclusive = milestone.status === "INCONCLUSIVE" || adj.decision === "INCONCLUSIVE";
  const isFailed = milestone.status === "FAILED" || adj.decision === "FAIL";
  const isReleased = milestone.status === "RELEASED";

  const handleRunAdjudication = async () => {
    try {
      setErrorMessage(null);
      setAdjTxHash(null);
      setAdjState("AWAITING_WALLET");
      
      const submittedHash = await sendContractTransaction({
        functionName: "adjudicate_milestone",
        args: [BigInt(campaignId), BigInt(milestone.id)],
      });

      setAdjTxHash(submittedHash);
      setAdjState("ADJUDICATING");

      // Wait for real on-chain consensus receipt (up to 90s for LLM validator execution)
      await waitForTransactionReceipt(submittedHash, 90000);

      setAdjState("FINALIZED");
      onRefresh();
    } catch (err: any) {
      console.error("Adjudication failed:", err);
      setErrorMessage(err.message || "Failed to trigger adjudication on StudioNet");
      setAdjState("FAILED");
    }
  };

  const handleReleaseTranche = async () => {
    try {
      setErrorMessage(null);
      setReleaseTxHash(null);
      setReleaseState("AWAITING_WALLET");

      const submittedHash = await sendContractTransaction({
        functionName: "release_milestone",
        args: [BigInt(campaignId), BigInt(milestone.id)],
      });

      setReleaseTxHash(submittedHash);
      setReleaseState("PROCESSING");

      // Wait for real on-chain transaction receipt
      await waitForTransactionReceipt(submittedHash);

      setReleaseState("CONFIRMED");
      onRefresh();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Release milestone failed:", err);
      setErrorMessage(err.message || "Failed to release milestone on StudioNet");
      setReleaseState("FAILED");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-card rounded-2xl border border-slate-800 w-full max-w-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">GenLayer Validator Consensus</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Milestone #{milestone.id}
              </span>
            </div>
            <p className="text-xs text-slate-400">Non-deterministic multi-validator outcome verification</p>
          </div>
        </div>

        {/* Adjudication 4-Stage Pipeline Visualizer */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Verification Pipeline</span>
            <span className="text-emerald-400 font-mono text-[10px]">
              OBSERVE → VERIFY → CONSENSUS → RELEASE
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/60">
              <div className="font-extrabold text-white text-[11px]">1. OBSERVE</div>
              <div className="text-[10px] text-emerald-400 mt-0.5">
                {milestone.evidence_count} items submitted
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/60">
              <div className="font-extrabold text-white text-[11px]">2. VERIFY</div>
              <div className="text-[10px] text-cyan-400 mt-0.5">LLM inspection</div>
            </div>

            <div
              className={`p-2.5 rounded-lg border ${
                isPassed
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                  : isInconclusive
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                  : isFailed
                  ? "bg-rose-500/10 border-rose-500/40 text-rose-400"
                  : "bg-slate-800 border-slate-700/60 text-slate-400"
              }`}
            >
              <div className="font-extrabold text-[11px]">3. CONSENSUS</div>
              <div className="text-[10px] font-bold mt-0.5">{adj.decision || "PENDING"}</div>
            </div>

            <div
              className={`p-2.5 rounded-lg border ${
                isReleased
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                  : isPassed
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse"
                  : "bg-slate-800 border-slate-700/60 text-slate-500"
              }`}
            >
              <div className="font-extrabold text-[11px]">4. RELEASE</div>
              <div className="text-[10px] mt-0.5 font-bold">
                {isReleased ? "DISBURSED" : isPassed ? "ELIGIBLE" : "LOCKED"}
              </div>
            </div>
          </div>
        </div>

        {/* Milestone Policy & Target */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
          <div>
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Target Goal</span>
            <div className="text-slate-200 font-bold text-sm mt-0.5">{milestone.target}</div>
          </div>
          <div>
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Predefined Verification Criteria</span>
            <p className="text-slate-300 mt-0.5 leading-relaxed">{milestone.verification_policy}</p>
          </div>
        </div>

        {/* Scorecard Results */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Decision</div>
            <div
              className={`text-base font-black mt-1 ${
                isPassed ? "text-emerald-400" : isInconclusive ? "text-amber-400" : isFailed ? "text-rose-400" : "text-slate-400"
              }`}
            >
              {adj.decision || "PENDING"}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Completion</div>
            <div className="text-base font-black text-white mt-1">
              {adj.completion_percentage || 0}%
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Evidence Quality</div>
            <div className="text-base font-black text-cyan-400 mt-1">
              {adj.evidence_quality || "NONE"}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Criteria Met</div>
            <div className="text-base font-black text-purple-400 mt-1">
              {adj.criteria_met || 0} / {adj.criteria_total || 0}
            </div>
          </div>
        </div>

        {/* Validator Reasoning */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Validator Consensus Reasoning</span>
            <span className="text-[11px] text-slate-500 font-mono">
              Equivalence Strategy: Substantive Score Tolerance
            </span>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono italic">
            "{adj.concise_reasoning || "Evidence submitted. Ready for GenLayer validator adjudication."}"
          </div>
        </div>

        {/* Inconclusive Warning note */}
        {isInconclusive && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-bold block">Consensus Inconclusive: Funds Held in Escrow</span>
              The submitted evidence was evaluated as incomplete or ambiguous. The contract has locked the milestone tranche. The organization may submit supplementary documentation (photos, rosters, delivery receipts) to trigger re-evaluation.
            </div>
          </div>
        )}

        {/* Real Adjudication Lifecycle Status */}
        {adjState !== "IDLE" && (
          <div
            className={`p-3.5 rounded-xl border text-xs space-y-1 ${
              adjState === "FINALIZED"
                ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                : adjState === "FAILED"
                ? "bg-rose-950/20 border-rose-500/40 text-rose-300"
                : "bg-cyan-950/20 border-cyan-500/40 text-cyan-300"
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>Adjudication Consensus: {adjState}</span>
              {adjTxHash && (
                <span className="font-mono text-[10px]">
                  Tx: {adjTxHash.slice(0, 8)}...{adjTxHash.slice(-6)}
                </span>
              )}
            </div>
            {adjState === "AWAITING_WALLET" && <p>Confirm the transaction in your StudioNet wallet...</p>}
            {adjState === "ADJUDICATING" && (
              <p>GenLayer validator committee evaluating submitted evidence non-deterministically...</p>
            )}
            {adjState === "FINALIZED" && <p>Consensus reached and state finalized on StudioNet!</p>}
            {errorMessage && <p className="text-rose-400">{errorMessage}</p>}
          </div>
        )}

        {/* Real Release Lifecycle Status */}
        {releaseState !== "IDLE" && (
          <div
            className={`p-3.5 rounded-xl border text-xs space-y-1 ${
              releaseState === "CONFIRMED"
                ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                : releaseState === "FAILED"
                ? "bg-rose-950/20 border-rose-500/40 text-rose-300"
                : "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>Release Status: {releaseState}</span>
              {releaseTxHash && (
                <span className="font-mono text-[10px]">
                  Tx: {releaseTxHash.slice(0, 8)}...{releaseTxHash.slice(-6)}
                </span>
              )}
            </div>
            {releaseState === "AWAITING_WALLET" && <p>Confirm tranche release in your wallet...</p>}
            {releaseState === "PROCESSING" && <p>Processing milestone payout on StudioNet...</p>}
            {releaseState === "CONFIRMED" && <p>Milestone tranche released to organization balance!</p>}
            {errorMessage && <p className="text-rose-400">{errorMessage}</p>}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleRunAdjudication}
            disabled={
              adjState === "AWAITING_WALLET" ||
              adjState === "ADJUDICATING" ||
              milestone.evidence_count === 0
            }
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md shadow-cyan-600/20 disabled:opacity-50 active:scale-95"
          >
            {adjState === "ADJUDICATING" || adjState === "AWAITING_WALLET" ? (
              <span className="animate-pulse">Evaluating on StudioNet...</span>
            ) : (
              "Trigger Validator Consensus"
            )}
          </button>

          {isPassed && !isReleased && (
            <button
              type="button"
              onClick={handleReleaseTranche}
              disabled={releaseState === "AWAITING_WALLET" || releaseState === "PROCESSING"}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
            >
              {releaseState === "PROCESSING" || releaseState === "AWAITING_WALLET" ? (
                <span className="animate-pulse">Releasing...</span>
              ) : (
                `Release Tranche (${formatGEN(milestone.amount)})`
              )}
            </button>
          )}

          {isReleased && (
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Tranche Released & Disbursed
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
