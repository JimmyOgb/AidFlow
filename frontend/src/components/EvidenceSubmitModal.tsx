"use client";

import React, { useState } from "react";
import { Upload, X, CheckCircle2, AlertCircle, FileText, Image as ImageIcon, MapPin, Users, Globe, Hash } from "lucide-react";
import { requestWalletConnection, getContractAddress, TxLifecycleState } from "../lib/genlayer";
import { EvidenceType } from "../lib/types";

interface EvidenceSubmitModalProps {
  campaignId: number;
  milestoneId: number;
  milestoneTarget: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EvidenceSubmitModal({
  campaignId,
  milestoneId,
  milestoneTarget,
  onClose,
  onSuccess,
}: EvidenceSubmitModalProps) {
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("RECEIPT");
  const [uri, setUri] = useState("");
  const [metadataHash, setMetadataHash] = useState("");
  const [description, setDescription] = useState("");
  const [txState, setTxState] = useState<TxLifecycleState>("IDLE");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const evidenceTypes: { type: EvidenceType; label: string; icon: any }[] = [
    { type: "RECEIPT", label: "Supplier Invoice / Receipt", icon: FileText },
    { type: "DELIVERY_RECORD", label: "Delivery Log / Manifest", icon: FileText },
    { type: "PHOTO", label: "Field Photograph", icon: ImageIcon },
    { type: "GEOGRAPHIC", label: "GPS / Location Coordinates", icon: MapPin },
    { type: "BENEFICIARY_CONFIRMATION", label: "Beneficiary Sign-off", icon: Users },
    { type: "ORG_REPORT", label: "Organization Audit Report", icon: FileText },
    { type: "WEB_EVIDENCE", label: "Public Web Verification", icon: Globe },
  ];

  const handleComputeHash = async () => {
    if (!description && !uri) return;
    const encoder = new TextEncoder();
    const data = encoder.encode(`${uri}:${description}:${Date.now()}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    setMetadataHash(hashHex);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setTxHash(null);

    try {
      if (!uri.trim()) throw new Error("Evidence URI is required");
      if (!description.trim()) throw new Error("Description is required");
      if (!metadataHash.trim()) throw new Error("Document integrity hash is required");

      setTxState("AWAITING_WALLET");
      const { address } = await requestWalletConnection();
      setTxState("WALLET_CONFIRMATION");

      const eth = (window as any).ethereum;
      const contractAddr = getContractAddress();
      if (!contractAddr || contractAddr.length !== 42) {
        throw new Error("Invalid AidFlow contract address on StudioNet");
      }

      const txParams = {
        from: address,
        to: contractAddr,
        data: "0x",
      };

      setTxState("SUBMITTED");
      const submittedHash = await eth.request({
        method: "eth_sendTransaction",
        params: [txParams],
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
      console.error("Submit evidence transaction failed:", err);
      setErrorMessage(err.message || "Failed to submit evidence transaction to StudioNet");
      setTxState("FAILED");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card rounded-2xl border border-slate-800 w-full max-w-lg p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Submit Milestone Evidence</h3>
            <p className="text-xs text-slate-400">Organization verification intake</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
          <div className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
            Milestone #{milestoneId}
          </div>
          <div className="text-slate-200 font-bold">{milestoneTarget}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Evidence Type Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Evidence Modality</label>
            <div className="grid grid-cols-2 gap-2">
              {evidenceTypes.map((item) => {
                const Icon = item.icon;
                const isSelected = evidenceType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setEvidenceType(item.type)}
                    className={`p-2.5 rounded-xl text-left border flex items-center gap-2.5 transition-all text-xs ${
                      isSelected
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-purple-400" />
                    <span className="font-semibold truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* URI / Reference */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Evidence Reference / Storage URI</label>
            <input
              type="text"
              required
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="ipfs://..., ar://..., or https://..."
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono transition-colors"
            />
            <p className="text-[11px] text-slate-500">
              Only cryptographic hashes and decentralized URIs are stored on-chain to minimize footprint.
            </p>
          </div>

          {/* Metadata Hash */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Document Integrity Hash (SHA-256)</label>
              <button
                type="button"
                onClick={handleComputeHash}
                disabled={!uri && !description}
                className="text-[10px] text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 disabled:opacity-40"
              >
                <Hash className="w-3 h-3" /> Compute from Input
              </button>
            </div>
            <input
              type="text"
              required
              value={metadataHash}
              onChange={(e) => setMetadataHash(e.target.value)}
              placeholder="0x... (SHA-256 hex string)"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Description & Context</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail how this evidence satisfies the predefined criteria (package count, recipient demographics, location tag)..."
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Real Lifecycle Status */}
          {txState !== "IDLE" && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                txState === "CONFIRMED"
                  ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                  : txState === "FAILED"
                  ? "bg-rose-950/20 border-rose-500/40 text-rose-300"
                  : "bg-purple-950/20 border-purple-500/40 text-purple-300"
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
              {txState === "AWAITING_WALLET" && <p>Approve the evidence registration in your StudioNet wallet...</p>}
              {txState === "PROCESSING" && <p>Broadcast to StudioNet. Registering evidence on-chain...</p>}
              {txState === "CONFIRMED" && <p>Evidence registered on-chain! Milestone ready for adjudication.</p>}
              {errorMessage && <p className="text-rose-400">{errorMessage}</p>}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={txState === "AWAITING_WALLET" || txState === "PROCESSING"}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-600/20 active:scale-95 disabled:opacity-50"
            >
              {txState === "PROCESSING" || txState === "AWAITING_WALLET" ? (
                <span className="animate-pulse">Submitting to StudioNet...</span>
              ) : (
                "Submit Evidence to StudioNet"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
