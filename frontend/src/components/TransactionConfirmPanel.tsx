"use client";

import React from "react";
import {
  ShieldCheck,
  ArrowUpRight,
  Lock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Cpu,
  Layers,
  Copy,
  Check,
} from "lucide-react";
import { getContractAddress, TxLifecycleState, GenLayerTxTracking } from "../lib/genlayer";

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
  txState?: TxLifecycleState;
  txTracking?: GenLayerTxTracking | null;
  statusMessage?: string | null;
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
  txState = "IDLE",
  txTracking,
  statusMessage,
  onConfirm,
  onCancel,
}: TransactionConfirmPanelProps) {
  const activeContract = contractAddress || getContractAddress();
  const targetAddress = recipientAddress || activeContract;
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isWalletSubmitted =
    txState !== "IDLE" && txState !== "AWAITING_WALLET";
  const isProcessing =
    txState === "PROCESSING" ||
    txState === "CONSENSUS" ||
    txState === "FINALIZED" ||
    txState === "SUCCESS" ||
    txState === "UNDETERMINED" ||
    txState === "FAILED";
  const isConsensusReached =
    txState === "CONSENSUS" ||
    txState === "FINALIZED" ||
    txState === "SUCCESS" ||
    txState === "UNDETERMINED";
  const isFinalized =
    txState === "FINALIZED" ||
    txState === "SUCCESS" ||
    txState === "UNDETERMINED";
  const isExecutionSuccess = txState === "SUCCESS";
  const isUndetermined = txState === "UNDETERMINED";
  const isFailed = txState === "FAILED";

  const explorerUrl = "https://studio.genlayer.com/";

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-left">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            GenLayer Transaction Verification Panel
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
            Network & Consensus
          </span>
          <span className="font-medium text-slate-300 mt-0.5 block">GenLayer StudioNet</span>
          <span className="font-mono text-[10px] text-slate-500 block mt-0.5">
            Chain ID: 61999 · Gasless IC Writes
          </span>
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
            Recipient / Ledger
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

      {/* 5-Stage GenLayer Lifecycle Visualizer */}
      {txState !== "IDLE" && (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              GenLayer Intelligent Contract Lifecycle
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isExecutionSuccess
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : isUndetermined
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : isFailed
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse"
              }`}
            >
              {txState}
            </span>
          </div>

          {/* Stepper Grid */}
          <div className="grid grid-cols-5 gap-1.5 text-[10px] text-center">
            {/* Step 1: Wallet Submission */}
            <div
              className={`p-2 rounded-lg border flex flex-col justify-between ${
                isWalletSubmitted
                  ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                  : txState === "AWAITING_WALLET"
                  ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-300 animate-pulse"
                  : "bg-slate-900 border-slate-800 text-slate-600"
              }`}
            >
              <div className="font-bold">1. Wallet</div>
              <div className="text-[9px] mt-1">
                {isWalletSubmitted ? "Submitted" : txState === "AWAITING_WALLET" ? "Signing..." : "Pending"}
              </div>
            </div>

            {/* Step 2: GenLayer IC Execution */}
            <div
              className={`p-2 rounded-lg border flex flex-col justify-between ${
                isProcessing
                  ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-300"
                  : "bg-slate-900 border-slate-800 text-slate-600"
              }`}
            >
              <div className="font-bold">2. IC Execution</div>
              <div className="text-[9px] mt-1">
                {isProcessing ? "Processing" : "Queued"}
              </div>
            </div>

            {/* Step 3: Consensus */}
            <div
              className={`p-2 rounded-lg border flex flex-col justify-between ${
                isConsensusReached
                  ? isUndetermined
                    ? "bg-amber-950/30 border-amber-500/50 text-amber-300"
                    : "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                  : txState === "PROCESSING"
                  ? "bg-cyan-950/30 border-cyan-500/40 text-cyan-300 animate-pulse"
                  : "bg-slate-900 border-slate-800 text-slate-600"
              }`}
            >
              <div className="font-bold">3. Consensus</div>
              <div className="text-[9px] mt-1">
                {isConsensusReached ? (isUndetermined ? "Undetermined" : "Decided") : "Awaiting"}
              </div>
            </div>

            {/* Step 4: Finalization */}
            <div
              className={`p-2 rounded-lg border flex flex-col justify-between ${
                isFinalized
                  ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                  : "bg-slate-900 border-slate-800 text-slate-600"
              }`}
            >
              <div className="font-bold">4. Finalization</div>
              <div className="text-[9px] mt-1">
                {isFinalized ? "Finalized" : "Pending"}
              </div>
            </div>

            {/* Step 5: Execution Result */}
            <div
              className={`p-2 rounded-lg border flex flex-col justify-between ${
                isExecutionSuccess
                  ? "bg-emerald-950/40 border-emerald-500 text-emerald-300"
                  : isUndetermined
                  ? "bg-amber-950/40 border-amber-500 text-amber-300"
                  : isFailed
                  ? "bg-rose-950/40 border-rose-500 text-rose-300"
                  : "bg-slate-900 border-slate-800 text-slate-600"
              }`}
            >
              <div className="font-bold">5. Result</div>
              <div className="text-[9px] mt-1 font-bold">
                {isExecutionSuccess
                  ? "Successful"
                  : isUndetermined
                  ? "No Majority"
                  : isFailed
                  ? "Failed"
                  : "Pending"}
              </div>
            </div>
          </div>

          {/* Explicit Hash Differentiation */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] space-y-1.5">
            {txTracking?.evmHash && txTracking.evmHash !== txTracking.txId && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">EVM Submission Hash:</span>
                <div className="flex items-center gap-1.5 font-mono text-slate-300">
                  <span>
                    {txTracking.evmHash.slice(0, 10)}...{txTracking.evmHash.slice(-8)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(txTracking.evmHash!, "evm")}
                    className="text-slate-500 hover:text-white"
                  >
                    {copiedId === "evm" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            )}

            {txTracking?.txId && (
              <div className="flex items-center justify-between">
                <span className="text-cyan-400 font-bold">GenLayer Transaction ID:</span>
                <div className="flex items-center gap-1.5 font-mono text-cyan-300">
                  <span title={txTracking.txId}>
                    {txTracking.txId.slice(0, 10)}...{txTracking.txId.slice(-8)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(txTracking.txId, "txId")}
                    className="text-cyan-500 hover:text-white"
                  >
                    {copiedId === "txId" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <a
                    href={`${explorerUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-500 hover:text-cyan-400 ml-1"
                    title="View on GenLayer Studio"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {txTracking?.resultName && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                <span className="text-slate-400">Consensus Result:</span>
                <span
                  className={`font-mono font-bold ${
                    txTracking.resultName === "MAJORITY_AGREE"
                      ? "text-emerald-400"
                      : txTracking.resultName === "NO_MAJORITY"
                      ? "text-amber-400"
                      : "text-slate-300"
                  }`}
                >
                  {txTracking.resultName}
                </span>
              </div>
            )}

            {txTracking?.executionResultName && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Execution Result:</span>
                <span
                  className={`font-mono font-bold ${
                    txTracking.executionResultName === "FINISHED_WITH_RETURN"
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {txTracking.executionResultName}
                </span>
              </div>
            )}
          </div>

          {/* Undetermined Warning Box */}
          {isUndetermined && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Consensus Undetermined (NO_MAJORITY)</span>
              </div>
              <p className="text-slate-300 text-[10px] leading-relaxed">
                GenLayer validators finalized this transaction without reaching majority agreement.
                The contract state and balances were <strong>not modified</strong>. The financial operation has not been automatically retried to prevent unintended double-actions. Your transaction ID is preserved above for inspection.
              </p>
            </div>
          )}

          {statusMessage && (
            <div className="text-[11px] text-slate-300 italic pt-0.5">
              {statusMessage}
            </div>
          )}
        </div>
      )}

      {/* Button Actions */}
      <div className="flex items-center gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-1/3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all disabled:opacity-50"
          >
            {isUndetermined || isExecutionSuccess ? "Close" : "Cancel"}
          </button>
        )}
        {(!isSubmitting && !isExecutionSuccess && !isUndetermined) && (
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/10 active:scale-[0.98]"
          >
            <span>Authorize Intelligent Contract Call</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
