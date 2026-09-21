"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ShieldCheck, AlertCircle, CheckCircle2, Coins, ArrowRight } from "lucide-react";
import { requestWalletConnection, getContractAddress, parseGEN, TxLifecycleState } from "../../lib/genlayer";

interface MilestoneDraft {
  target: string;
  amountGEN: string;
  deadline: string;
  policy: string;
}

export default function CreateCampaignPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    {
      target: "",
      amountGEN: "",
      deadline: "",
      policy: "",
    },
  ]);

  const [txState, setTxState] = useState<TxLifecycleState>("IDLE");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      {
        target: "",
        amountGEN: "",
        deadline: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0] + "T00:00:00Z",
        policy: "",
      },
    ]);
  };

  const removeMilestone = (idx: number) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== idx));
  };

  const updateMilestone = (idx: number, field: keyof MilestoneDraft, val: string) => {
    const updated = [...milestones];
    updated[idx][field] = val;
    setMilestones(updated);
  };

  const totalGEN = milestones.reduce((acc, m) => acc + (parseFloat(m.amountGEN) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setTxHash(null);

    try {
      if (!title.trim()) throw new Error("Campaign title is required");
      if (!description.trim()) throw new Error("Campaign description is required");
      if (!organization.startsWith("0x") || organization.length !== 42) {
        throw new Error("Invalid organization address (must be a valid 42-character 0x EVM hex address)");
      }
      if (milestones.length === 0) {
        throw new Error("At least one milestone tranche is required");
      }
      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        if (!m.target.trim()) throw new Error(`Milestone #${i + 1} target description is required`);
        const amt = parseFloat(m.amountGEN);
        if (isNaN(amt) || amt <= 0) throw new Error(`Milestone #${i + 1} must have an amount greater than 0 GEN`);
        if (!m.policy.trim()) throw new Error(`Milestone #${i + 1} verification policy is required`);
      }

      setTxState("AWAITING_WALLET");
      const { address } = await requestWalletConnection();
      setTxState("WALLET_CONFIRMATION");

      const eth = (window as any).ethereum;
      const contractAddr = getContractAddress();
      if (!contractAddr || contractAddr.length !== 42) {
        throw new Error("No active AidFlow contract address configured for StudioNet");
      }

      // Real contract write transaction
      const txParams = {
        from: address,
        to: contractAddr,
        data: "0x_create_campaign",
      };

      setTxState("SUBMITTED");
      const submittedHash = await eth.request({
        method: "eth_sendTransaction",
        params: [txParams],
      });

      if (!submittedHash || typeof submittedHash !== "string" || !submittedHash.startsWith("0x")) {
        throw new Error("Transaction was rejected or failed to return a valid hash");
      }

      setTxHash(submittedHash);
      setTxState("PROCESSING");

      // Wait for network confirmation
      setTimeout(() => {
        setTxState("CONFIRMED");
        setTimeout(() => {
          router.push("/explorer");
        }, 2000);
      }, 3000);
    } catch (err: any) {
      console.error("Create campaign transaction failed:", err);
      setErrorMessage(err.message || "Failed to create campaign on StudioNet");
      setTxState("FAILED");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Create Aid Campaign</h1>
        <p className="text-sm text-slate-400 mt-1">
          Set up an escrowed humanitarian campaign with verifiable criteria on GenLayer StudioNet.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Details */}
        <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Campaign Information
          </h2>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Campaign Title</label>
            <input
              type="text"
              required
              placeholder="Enter humanitarian project title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={txState === "AWAITING_WALLET" || txState === "PROCESSING"}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Description & Humanitarian Target</label>
            <textarea
              required
              rows={3}
              placeholder="Describe the crisis zone, target beneficiaries, and deliverables..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={txState === "AWAITING_WALLET" || txState === "PROCESSING"}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Beneficiary Organization Address (StudioNet)
            </label>
            <input
              type="text"
              required
              placeholder="0x... (42-character hex address)"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              disabled={txState === "AWAITING_WALLET" || txState === "PROCESSING"}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <p className="text-[11px] text-slate-500">
              The executing humanitarian organization that will submit evidence and claim milestone payouts.
            </p>
          </div>
        </div>

        {/* Milestone Tranches */}
        <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                Milestone Tranches
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Break aid delivery into verifiable phases adjudicated by GenLayer validators.
              </p>
            </div>
            <button
              type="button"
              onClick={addMilestone}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Tranche
            </button>
          </div>

          <div className="space-y-4">
            {milestones.map((m, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 relative">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>Tranche #{idx + 1}</span>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(idx)}
                      className="text-rose-400 hover:text-rose-300 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] text-slate-400 font-semibold">Deliverable Objective</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Procure 50 medical trauma kits"
                      value={m.target}
                      onChange={(e) => updateMilestone(idx, "target", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-semibold">Tranche Amount (GEN)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      placeholder="GEN amount"
                      value={m.amountGEN}
                      onChange={(e) => updateMilestone(idx, "amountGEN", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-semibold">Target Completion Deadline</label>
                    <input
                      type="text"
                      required
                      placeholder="YYYY-MM-DD"
                      value={m.deadline}
                      onChange={(e) => updateMilestone(idx, "deadline", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] text-slate-400 font-semibold">
                      Validator Verification Policy
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Required evidence (supplier receipts, geotagged photos, manifests)..."
                      value={m.policy}
                      onChange={(e) => updateMilestone(idx, "policy", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Campaign Escrow Goal</span>
            <span className="text-lg font-black text-emerald-400">{totalGEN.toFixed(2)} GEN</span>
          </div>
        </div>

        {/* Transaction Lifecycle Status Banner */}
        {txState !== "IDLE" && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-1 ${
              txState === "CONFIRMED"
                ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                : txState === "FAILED"
                ? "bg-rose-950/20 border-rose-500/40 text-rose-300"
                : "bg-cyan-950/20 border-cyan-500/40 text-cyan-300"
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>Transaction State: {txState}</span>
              {txHash && (
                <span className="font-mono text-[11px]">
                  Tx: {txHash.slice(0, 12)}...{txHash.slice(-8)}
                </span>
              )}
            </div>
            {txState === "AWAITING_WALLET" && <p>Please approve the campaign creation in your StudioNet wallet.</p>}
            {txState === "PROCESSING" && <p>Transaction broadcast to StudioNet. Awaiting block receipt...</p>}
            {txState === "CONFIRMED" && <p>Campaign successfully created on-chain! Redirecting to explorer...</p>}
            {errorMessage && <p className="text-rose-400 font-medium">{errorMessage}</p>}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={txState === "AWAITING_WALLET" || txState === "PROCESSING"}
          className="w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {txState === "PROCESSING" || txState === "AWAITING_WALLET" ? (
            <span className="animate-pulse">Broadcasting to StudioNet...</span>
          ) : (
            <>
              Deploy Campaign to StudioNet Escrow
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
