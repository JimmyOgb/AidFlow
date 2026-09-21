"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Coins,
  Lock,
  Upload,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Scale,
  FileText,
  ExternalLink,
  RefreshCw,
  Users,
  AlertCircle,
} from "lucide-react";
import {
  genlayerCall,
  formatGEN,
  requestWalletConnection,
  getContractAddress,
  TxLifecycleState,
} from "../../../lib/genlayer";
import { Campaign, Milestone, EvidenceRef } from "../../../lib/types";
import FundModal from "../../../components/FundModal";
import EvidenceSubmitModal from "../../../components/EvidenceSubmitModal";
import AdjudicationModal from "../../../components/AdjudicationModal";

export default function CampaignDetailPage() {
  const params = useParams();
  const cid = Number(params?.id || 0);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<Record<number, EvidenceRef[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Claimable ledgers
  const [claimablePayout, setClaimablePayout] = useState<bigint>(BigInt(0));
  const [claimableRefund, setClaimableRefund] = useState<bigint>(BigInt(0));
  const [actionTxState, setActionTxState] = useState<TxLifecycleState>("IDLE");
  const [actionTxHash, setActionTxHash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals state
  const [showFundModal, setShowFundModal] = useState(false);
  const [selectedMilestoneForEvidence, setSelectedMilestoneForEvidence] = useState<Milestone | null>(null);
  const [selectedMilestoneForAdjudication, setSelectedMilestoneForAdjudication] = useState<Milestone | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const contractAddr = getContractAddress();
      if (!contractAddr) {
        setCampaign(null);
        setMilestones([]);
        setIsLoading(false);
        return;
      }

      const camp = await genlayerCall("get_campaign", [cid]);
      if (!camp) {
        setCampaign(null);
        setMilestones([]);
        setErrorMessage(`Campaign #${cid} not found on StudioNet.`);
        setIsLoading(false);
        return;
      }

      setCampaign(camp);

      const msList = await genlayerCall("get_campaign_milestones", [cid]);
      const validMilestones: Milestone[] = msList || [];
      setMilestones(validMilestones);

      // Query real evidence items
      const eMap: Record<number, EvidenceRef[]> = {};
      for (const m of validMilestones) {
        const eItems: EvidenceRef[] = [];
        for (let i = 0; i < Number(m.evidence_count || 0); i++) {
          try {
            const e = await genlayerCall("get_milestone_evidence", [cid, m.id, i]);
            if (e) eItems.push(e);
          } catch {}
        }
        eMap[m.id] = eItems;
      }
      setEvidenceMap(eMap);

      // Query claimable ledger for organization and donor if wallet available
      if (typeof window !== "undefined" && "ethereum" in window) {
        const eth = (window as any).ethereum;
        const accounts = await eth.request({ method: "eth_accounts" });
        if (accounts && accounts.length > 0) {
          const userAddr = accounts[0];
          const orgClaim = await genlayerCall("get_claimable_payout", [userAddr]);
          const donorClaim = await genlayerCall("get_claimable_refund", [userAddr]);
          if (orgClaim !== null) setClaimablePayout(BigInt(orgClaim));
          if (donorClaim !== null) setClaimableRefund(BigInt(donorClaim));
        }
      }
    } catch (err: any) {
      console.warn(`Error loading Campaign #${cid} from StudioNet:`, err);
      setCampaign(null);
      setMilestones([]);
      setErrorMessage(`Unable to load Campaign #${cid} data from StudioNet.`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [cid]);

  const handleReleaseTranche = async (milestoneId: number) => {
    try {
      setActionTxState("AWAITING_WALLET");
      setActionError(null);
      setActionTxHash(null);

      const { address } = await requestWalletConnection();
      setActionTxState("WALLET_CONFIRMATION");

      const eth = (window as any).ethereum;
      const contractAddr = getContractAddress();

      const txHash = await eth.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: contractAddr,
            data: `0x_release_${cid}_${milestoneId}`,
          },
        ],
      });

      setActionTxHash(txHash);
      setActionTxState("SUBMITTED");

      setTimeout(() => {
        setActionTxState("CONFIRMED");
        loadData();
      }, 2500);
    } catch (err: any) {
      setActionError(err.message || "Failed to release tranche");
      setActionTxState("FAILED");
    }
  };

  const handleClaimPayout = async () => {
    try {
      setActionTxState("AWAITING_WALLET");
      setActionError(null);
      setActionTxHash(null);

      const { address } = await requestWalletConnection();
      setActionTxState("WALLET_CONFIRMATION");

      const eth = (window as any).ethereum;
      const contractAddr = getContractAddress();

      const txHash = await eth.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: contractAddr,
            data: "0x_claim_payout",
          },
        ],
      });

      setActionTxHash(txHash);
      setActionTxState("SUBMITTED");

      setTimeout(() => {
        setActionTxState("CONFIRMED");
        loadData();
      }, 2500);
    } catch (err: any) {
      setActionError(err.message || "Failed to claim payout");
      setActionTxState("FAILED");
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-slate-400">Loading Campaign #{cid} directly from GenLayer StudioNet...</p>
      </div>
    );
  }

  if (!campaign || errorMessage) {
    return (
      <div className="py-20 max-w-xl mx-auto text-center space-y-6 glass-card rounded-2xl border border-slate-800 p-8">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
          <AlertCircle className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">
            {errorMessage || `Unable to load Campaign #${cid} from StudioNet.`}
          </h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            No on-chain campaign with ID #{cid} was found at contract {getContractAddress()}.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={loadData}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
          <Link
            href="/explorer"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Explorer
          </Link>
        </div>
      </div>
    );
  }

  const funded = BigInt(campaign.funded_amount || 0);
  const total = BigInt(campaign.total_funding || 1);
  const released = BigInt(campaign.released_amount || 0);
  const lockedInEscrow = funded > released ? funded - released : BigInt(0);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Back button and quick actions */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/explorer"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Explorer
        </Link>

        <button
          onClick={loadData}
          className="p-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Transaction Status Alert */}
      {actionTxState !== "IDLE" && (
        <div className="p-4 rounded-xl glass-card border border-cyan-500/30 bg-cyan-950/20 text-xs space-y-1">
          <div className="flex items-center justify-between font-bold text-cyan-300">
            <span>Transaction Status: {actionTxState}</span>
            {actionTxHash && (
              <span className="font-mono text-[11px] text-slate-400">
                Tx: {actionTxHash.slice(0, 10)}...{actionTxHash.slice(-8)}
              </span>
            )}
          </div>
          {actionError && <p className="text-rose-400">{actionError}</p>}
        </div>
      )}

      {/* Campaign Overview Hero */}
      <div className="glass-card rounded-2xl border border-slate-800 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                Campaign #{campaign.id}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  campaign.status === "COMPLETED"
                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                    : campaign.status === "FUNDED"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                }`}
              >
                {campaign.status}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white">{campaign.title}</h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">{campaign.description}</p>
          </div>

          {/* Action: Fund Campaign */}
          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            {campaign.status !== "COMPLETED" && (
              <button
                onClick={() => setShowFundModal(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 transition-all shadow-md shadow-emerald-500/10 flex items-center gap-2"
              >
                <Coins className="w-4 h-4 stroke-[2.5]" />
                Fund Escrow
              </button>
            )}

            {claimablePayout > BigInt(0) && (
              <button
                onClick={handleClaimPayout}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-600/20 flex items-center gap-2"
              >
                Claim Payout ({formatGEN(claimablePayout)})
              </button>
            )}
          </div>
        </div>

        {/* Stakeholder Addresses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <Users className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="overflow-hidden">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Donor Account</span>
              <span className="font-mono text-slate-300 truncate block text-[11px]">
                {campaign.donor || "N/A"}
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="overflow-hidden">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Beneficiary Organization</span>
              <span className="font-mono text-emerald-400 truncate block text-[11px]">
                {campaign.organization || "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Escrow Balance Flow Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase font-semibold text-slate-500">Total Goal</div>
            <div className="text-lg font-black text-white mt-0.5">{formatGEN(total)}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase font-semibold text-slate-500">Escrow Funded</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">{formatGEN(funded)}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase font-semibold text-slate-500">Currently Locked</div>
            <div className="text-lg font-black text-amber-400 mt-0.5">{formatGEN(lockedInEscrow)}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase font-semibold text-slate-500">Disbursed Aid</div>
            <div className="text-lg font-black text-purple-400 mt-0.5">{formatGEN(released)}</div>
          </div>
        </div>
      </div>

      {/* Milestones Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Campaign Milestones & Proof</h2>
            <p className="text-xs text-slate-400">
              Each tranche requires multi-validator consensus on submitted evidence before release.
            </p>
          </div>
        </div>

        {milestones.length === 0 ? (
          <div className="p-8 rounded-2xl glass-card border border-slate-800 text-center text-xs text-slate-500">
            No milestones configured for this campaign.
          </div>
        ) : (
          <div className="space-y-4">
            {milestones.map((m) => {
              const isPassed = m.status === "PASSED";
              const isInconclusive = m.status === "INCONCLUSIVE";
              const isReleased = m.status === "RELEASED";
              const isFailed = m.status === "FAILED";
              const eItems = evidenceMap[m.id] || [];

              return (
                <div
                  key={m.id}
                  className="rounded-2xl glass-card border border-slate-800 p-6 space-y-5 hover:border-slate-700 transition-all"
                >
                  {/* Milestone Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">Tranche #{m.id + 1}</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isReleased
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                              : isPassed
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : isInconclusive
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : isFailed
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">{m.target}</h3>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-400">{formatGEN(m.amount)}</div>
                      <div className="text-[11px] text-slate-500">
                        Deadline: {m.deadline ? m.deadline.split("T")[0] : "N/A"}
                      </div>
                    </div>
                  </div>

                  {/* Verification Criteria */}
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs space-y-1">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      Verification Policy
                    </span>
                    <p className="text-slate-300">{m.verification_policy}</p>
                  </div>

                  {/* Evidence Items List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                      <span>Submitted Evidence ({eItems.length})</span>
                      {m.status !== "RELEASED" && (
                        <button
                          onClick={() => setSelectedMilestoneForEvidence(m)}
                          className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Upload Evidence
                        </button>
                      )}
                    </div>

                    {eItems.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                        No evidence submitted.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {eItems.map((e, eIdx) => (
                          <div
                            key={eIdx}
                            className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                                {e.evidence_type}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {e.uri ? `${e.uri.slice(0, 16)}...` : ""}
                              </span>
                            </div>
                            <p className="text-slate-300 text-[11px] line-clamp-2">{e.description}</p>
                            <div className="text-[10px] text-slate-500 font-mono truncate">
                              Hash: {e.metadata_hash}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Milestone Actions & Adjudication Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedMilestoneForAdjudication(m)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 transition-all flex items-center gap-1.5"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        {m.adjudication?.decision && m.adjudication.decision !== "PENDING"
                          ? `Consensus: ${m.adjudication.decision} (View Scorecard)`
                          : "Awaiting evidence verification."}
                      </button>
                    </div>

                    {isPassed && !isReleased && (
                      <button
                        onClick={() => handleReleaseTranche(m.id)}
                        disabled={actionTxState === "PROCESSING" || actionTxState === "AWAITING_WALLET"}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20"
                      >
                        Release Tranche ({formatGEN(m.amount)})
                      </button>
                    )}

                    {isReleased && (
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Tranche Disbursed
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showFundModal && (
        <FundModal
          campaignId={campaign.id}
          campaignTitle={campaign.title}
          totalRequired={formatGEN(total)}
          alreadyFunded={formatGEN(funded)}
          onClose={() => setShowFundModal(false)}
          onSuccess={loadData}
        />
      )}

      {selectedMilestoneForEvidence && (
        <EvidenceSubmitModal
          campaignId={campaign.id}
          milestoneId={selectedMilestoneForEvidence.id}
          milestoneTarget={selectedMilestoneForEvidence.target}
          onClose={() => setSelectedMilestoneForEvidence(null)}
          onSuccess={loadData}
        />
      )}

      {selectedMilestoneForAdjudication && (
        <AdjudicationModal
          campaignId={campaign.id}
          milestone={selectedMilestoneForAdjudication}
          onClose={() => setSelectedMilestoneForAdjudication(null)}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}
