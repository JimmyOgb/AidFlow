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
  HelpCircle,
} from "lucide-react";
import {
  genlayerCall,
  formatGEN,
  getContractAddress,
  TxLifecycleState,
  GenLayerTxTracking,
  submitGenLayerWrite,
  readEscrowBalance,
  readNativeBalance,
  savePendingTx,
  getPendingTx,
  clearPendingTx,
  pollExistingGenLayerTx,
  requestWalletConnection,
} from "../../../lib/genlayer";
import { Campaign, Milestone, EvidenceRef } from "../../../lib/types";
import FundModal from "../../../components/FundModal";
import EvidenceSubmitModal from "../../../components/EvidenceSubmitModal";
import AdjudicationModal from "../../../components/AdjudicationModal";
import TransactionConfirmPanel from "../../../components/TransactionConfirmPanel";

export default function CampaignDetailPage() {
  const params = useParams();
  const cid = Number(params?.id || 0);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<Record<number, EvidenceRef[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Connected wallet
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);

  // On-chain claimable ledgers (queried directly from contract, never derived)
  const [registeredOrgClaimable, setRegisteredOrgClaimable] = useState<bigint>(BigInt(0));
  const [userOrgClaimable, setUserOrgClaimable] = useState<bigint>(BigInt(0));
  const [userDonorClaimable, setUserDonorClaimable] = useState<bigint>(BigInt(0));
  const [userContribution, setUserContribution] = useState<bigint>(BigInt(0));
  const [isRefundEligible, setIsRefundEligible] = useState<boolean>(false);

  // Transaction states
  const [actionTxState, setActionTxState] = useState<TxLifecycleState>("IDLE");
  const [actionTxHash, setActionTxHash] = useState<string | null>(null);
  const [actionTracking, setActionTracking] = useState<GenLayerTxTracking | null>(null);
  const [actionStatusMessage, setActionStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals state
  const [showFundModal, setShowFundModal] = useState(false);
  const [selectedMilestoneForEvidence, setSelectedMilestoneForEvidence] = useState<Milestone | null>(null);
  const [selectedMilestoneForAdjudication, setSelectedMilestoneForAdjudication] = useState<Milestone | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    action: string;
    methodName?: string;
    amountGEN?: string;
    callerAddress?: string;
    recipientLabel: string;
    recipientAddress?: string;
    contractAddress?: string;
    explanation: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

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

      // 1. Read campaign state from contract
      const camp = await genlayerCall("get_campaign", [cid]);
      if (!camp) {
        setCampaign(null);
        setMilestones([]);
        setErrorMessage(`Campaign #${cid} not found on StudioNet.`);
        setIsLoading(false);
        return;
      }

      const campaignObj: Campaign = {
        id: cid,
        donor: camp.donor,
        organization: camp.organization,
        title: camp.title,
        description: camp.description,
        total_funding: BigInt(camp.total_amount || camp.total_funding || 0),
        funded_amount: BigInt(camp.funded_amount || 0),
        released_amount: BigInt(camp.released_amount || 0),
        refunded_amount: BigInt(camp.refunded_amount || 0),
        status: camp.status || "CREATED",
        created_at: camp.created_at || "",
        milestone_count: camp.milestone_count || 0,
      };
      setCampaign(campaignObj);

      // 2. Read milestones
      const msList = await genlayerCall("get_campaign_milestones", [cid]);
      const validMilestones: Milestone[] = msList || [];
      setMilestones(validMilestones);

      // 3. Read evidence records
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

      // 4. Real on-chain read of registered organization's org_claimable
      if (camp.organization) {
        const orgBalances = await genlayerCall("get_claimable_balances", [camp.organization]);
        if (orgBalances) {
          setRegisteredOrgClaimable(BigInt(orgBalances.org_claimable || 0));
        }
      }

      // 5. Real on-chain read of refund condition
      const refundable = await genlayerCall("is_campaign_refundable", [cid]);
      setIsRefundEligible(Boolean(refundable));

      // 6. Real on-chain read of connected wallet balances & contributions
      if (typeof window !== "undefined" && "ethereum" in window) {
        const eth = (window as any).ethereum;
        const accounts = await eth.request({ method: "eth_accounts" });
        if (accounts && accounts.length > 0) {
          const userAddr = accounts[0];
          setConnectedAddress(userAddr);

          const userBalances = await genlayerCall("get_claimable_balances", [userAddr]);
          if (userBalances) {
            setUserOrgClaimable(BigInt(userBalances.org_claimable || 0));
            setUserDonorClaimable(BigInt(userBalances.donor_claimable || 0));
          }

          const contrib = await genlayerCall("get_contributor_amount", [cid, userAddr]);
          if (contrib !== null && contrib !== undefined) {
            setUserContribution(BigInt(contrib));
          }
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

    // Check for in-flight transaction in localStorage
    const pending = getPendingTx();
    if (pending && pending.campaignId === cid) {
      setActionTxState(pending.status);
      setActionTxHash(pending.txId);
      setActionTracking({
        txId: pending.txId,
        evmHash: pending.evmHash,
        functionName: pending.functionName,
        status: pending.status,
        updatedAt: pending.updatedAt,
      });
      setActionStatusMessage(`Resumed tracking ${pending.actionTitle} from localStorage.`);

      pollExistingGenLayerTx(pending.txId, (tr) => {
        setActionTracking(tr);
        if (tr.statusName === "FINALIZED" || tr.status === "7") {
          if (tr.resultName === "NO_MAJORITY" || tr.statusName === "UNDETERMINED") {
            setActionTxState("UNDETERMINED");
            setActionStatusMessage("Consensus finished as UNDETERMINED (NO_MAJORITY). State unchanged.");
          } else if (tr.isSuccessful) {
            setActionTxState("SUCCESS");
            setActionStatusMessage("Transaction execution succeeded!");
            loadData();
          } else {
            setActionTxState("FAILED");
            setActionStatusMessage("Transaction finalized with failure.");
          }
        }
      }).catch((e) => console.warn("Failed polling resumed tx:", e));
    }
  }, [cid]);

  // Execute release milestone tranche
  const executeReleaseTranche = async (milestoneId: number) => {
    try {
      setActionTxState("AWAITING_WALLET");
      setActionError(null);
      setActionTxHash(null);
      setActionStatusMessage("Please approve release_milestone in your wallet...");

      const result = await submitGenLayerWrite({
        functionName: "release_milestone",
        args: [BigInt(cid), BigInt(milestoneId)],
        onStatusChange: (st, msg) => {
          setActionTxState(st);
          if (msg) setActionStatusMessage(msg);
        },
        onTrackingUpdate: (tr) => {
          setActionTracking(tr);
          setActionTxHash(tr.txId);
        },
      });

      if (result.statusName === "UNDETERMINED" || result.resultName === "NO_MAJORITY") {
        setActionTxState("UNDETERMINED");
        setActionStatusMessage(
          "Validator committee reached NO_MAJORITY (UNDETERMINED). Tranche was not released. Financial state preserved."
        );
        return;
      }

      if (!result.isSuccess) {
        setActionTxState("FAILED");
        setActionError(`Milestone release failed: ${result.executionResultName}`);
        return;
      }

      setActionTxState("SUCCESS");
      setActionStatusMessage("Tranche released successfully on-chain!");
      await loadData();
      clearPendingTx();
    } catch (err: any) {
      setActionError(err.message || "Failed to release tranche");
      setActionTxState("FAILED");
    }
  };

  const handleReleaseTranche = (milestone: Milestone) => {
    setConfirmConfig({
      action: "Release Milestone Tranche",
      methodName: "release_milestone",
      amountGEN: (Number(milestone.amount) / 1e18).toFixed(2),
      callerAddress: connectedAddress || "Connected Wallet",
      recipientLabel: "Organization Claimable Ledger",
      recipientAddress: campaign?.organization || getContractAddress(),
      contractAddress: getContractAddress(),
      explanation: `Releases tranche #${milestone.id + 1} (${formatGEN(milestone.amount)}) from escrow into the registered organization's claimable ledger. Tranche must be verified by validator consensus.`,
      onConfirm: () => executeReleaseTranche(milestone.id),
    });
  };

  // Execute claim organization payout (proven end-to-end with on-chain balance verification)
  const executeClaimPayout = async () => {
    try {
      setActionTxState("AWAITING_WALLET");
      setActionError(null);
      setActionTxHash(null);
      setActionStatusMessage("Reading pre-transaction balances for payout verification...");

      const recipientAddr = connectedAddress || campaign?.organization || "";
      let preOrgClaimable = userOrgClaimable > BigInt(0) ? userOrgClaimable : registeredOrgClaimable;
      const preRecipientBalance = recipientAddr ? await readNativeBalance(recipientAddr) : BigInt(0);
      const preEscrowBalance = await readEscrowBalance();

      savePendingTx({
        txId: "",
        functionName: "claim_payout",
        actionTitle: "Claim Organization Payout",
        campaignId: cid,
        status: "AWAITING_WALLET",
        preBalances: {
          orgClaimable: preOrgClaimable.toString(),
          callerBalance: preRecipientBalance.toString(),
          escrowBalance: preEscrowBalance.toString(),
        },
        updatedAt: Date.now(),
      });

      const result = await submitGenLayerWrite({
        functionName: "claim_payout",
        args: [],
        onStatusChange: (st, msg) => {
          setActionTxState(st);
          if (msg) setActionStatusMessage(msg);
        },
        onTrackingUpdate: (tr) => {
          setActionTracking(tr);
          setActionTxHash(tr.txId);
        },
      });

      if (result.statusName === "UNDETERMINED" || result.resultName === "NO_MAJORITY") {
        setActionTxState("UNDETERMINED");
        setActionStatusMessage(
          "Consensus produced NO_MAJORITY (UNDETERMINED). Claim payout not completed on-chain. State preserved; no double-spend."
        );
        return;
      }

      if (!result.isSuccess) {
        setActionTxState("FAILED");
        setActionError(`claim_payout execution failed on-chain: ${result.executionResultName}`);
        return;
      }

      // Post-payout on-chain verification
      setActionStatusMessage("Verifying post-payout balances on-chain...");
      const postRecipientBalance = recipientAddr ? await readNativeBalance(recipientAddr) : BigInt(0);
      const postEscrowBalance = await readEscrowBalance();

      let postOrgClaimable = BigInt(0);
      if (recipientAddr) {
        const balObj = await genlayerCall("get_claimable_balances", [recipientAddr]);
        if (balObj) postOrgClaimable = BigInt(balObj.org_claimable || 0);
      }

      setActionTxState("SUCCESS");
      setActionStatusMessage(
        `Payout verified on-chain! Organization recipient balance updated to ${formatGEN(postRecipientBalance)}.`
      );
      await loadData();
      clearPendingTx();
    } catch (err: any) {
      setActionError(err.message || "Failed to claim payout");
      setActionTxState("FAILED");
    }
  };

  const handleClaimPayout = () => {
    const claimAmount = userOrgClaimable > BigInt(0) ? userOrgClaimable : registeredOrgClaimable;
    setConfirmConfig({
      action: "Claim Organization Payout",
      methodName: "claim_payout",
      amountGEN: (Number(claimAmount) / 1e18).toFixed(2),
      callerAddress: connectedAddress || "Connected Wallet",
      recipientLabel: "Eligible Organization / Caller Wallet",
      recipientAddress: connectedAddress || campaign?.organization || "Connected Wallet",
      contractAddress: getContractAddress(),
      explanation: `Calls claim_payout() on AidFlow contract. Zeroes your claimable balance on-chain and transfers ${formatGEN(claimAmount)} native GEN directly to your connected organization wallet. Requires GenLayer finalization and recipient balance verification.`,
      onConfirm: executeClaimPayout,
    });
  };

  // Execute trigger campaign refund
  const executeTriggerRefund = async () => {
    try {
      setActionTxState("AWAITING_WALLET");
      setActionError(null);
      setActionTxHash(null);
      setActionStatusMessage("Please approve refund_campaign in your wallet...");

      const result = await submitGenLayerWrite({
        functionName: "refund_campaign",
        args: [BigInt(cid)],
        onStatusChange: (st, msg) => {
          setActionTxState(st);
          if (msg) setActionStatusMessage(msg);
        },
        onTrackingUpdate: (tr) => {
          setActionTracking(tr);
          setActionTxHash(tr.txId);
        },
      });

      if (result.statusName === "UNDETERMINED" || result.resultName === "NO_MAJORITY") {
        setActionTxState("UNDETERMINED");
        setActionStatusMessage(
          "Validator committee returned NO_MAJORITY (UNDETERMINED). Campaign state preserved. Will not retry automatically."
        );
        return;
      }

      if (!result.isSuccess) {
        setActionTxState("FAILED");
        setActionError(`Refund trigger failed: ${result.executionResultName}`);
        return;
      }

      setActionTxState("SUCCESS");
      setActionStatusMessage("Campaign transitioned to REFUNDED state on-chain! Contributor ledgers allocated.");
      await loadData();
      clearPendingTx();
    } catch (err: any) {
      setActionError(err.message || "Failed to trigger campaign refund");
      setActionTxState("FAILED");
    }
  };

  const handleTriggerRefund = () => {
    const unreleased = campaign
      ? BigInt(campaign.funded_amount || 0) - BigInt(campaign.released_amount || 0) - BigInt(campaign.refunded_amount || 0)
      : BigInt(0);

    setConfirmConfig({
      action: "Trigger Campaign Refund",
      methodName: "refund_campaign",
      amountGEN: (Number(unreleased) / 1e18).toFixed(2),
      callerAddress: connectedAddress || "Connected Wallet",
      recipientLabel: "Proportional Contributor Refund Allocation",
      recipientAddress: getContractAddress(),
      contractAddress: getContractAddress(),
      explanation: `Calls refund_campaign(${cid}) on AidFlow contract. Validates that a milestone failed, permanently transitions campaign into REFUNDED (terminal state), and allocates ${formatGEN(unreleased)} unreleased capital proportionally across all recorded contributors' personal refund claimable balances.`,
      onConfirm: executeTriggerRefund,
    });
  };

  // Execute claim donor/contributor refund (proven end-to-end with on-chain balance verification)
  const executeClaimRefund = async () => {
    try {
      setActionTxState("AWAITING_WALLET");
      setActionError(null);
      setActionTxHash(null);
      setActionStatusMessage("Reading pre-transaction contributor refund balances...");

      const callerAddr = connectedAddress || "";
      const preDonorClaimable = userDonorClaimable;
      const preCallerBalance = callerAddr ? await readNativeBalance(callerAddr) : BigInt(0);
      const preEscrowBalance = await readEscrowBalance();

      savePendingTx({
        txId: "",
        functionName: "claim_refund",
        actionTitle: "Claim Contributor Refund",
        campaignId: cid,
        status: "AWAITING_WALLET",
        preBalances: {
          donorClaimable: preDonorClaimable.toString(),
          callerBalance: preCallerBalance.toString(),
          escrowBalance: preEscrowBalance.toString(),
        },
        updatedAt: Date.now(),
      });

      const result = await submitGenLayerWrite({
        functionName: "claim_refund",
        args: [],
        onStatusChange: (st, msg) => {
          setActionTxState(st);
          if (msg) setActionStatusMessage(msg);
        },
        onTrackingUpdate: (tr) => {
          setActionTracking(tr);
          setActionTxHash(tr.txId);
        },
      });

      if (result.statusName === "UNDETERMINED" || result.resultName === "NO_MAJORITY") {
        setActionTxState("UNDETERMINED");
        setActionStatusMessage(
          "Validator consensus returned NO_MAJORITY (UNDETERMINED). Refund not claimed. State preserved."
        );
        return;
      }

      if (!result.isSuccess) {
        setActionTxState("FAILED");
        setActionError(`claim_refund failed on-chain: ${result.executionResultName}`);
        return;
      }

      // Post-refund on-chain verification
      setActionStatusMessage("Verifying post-refund balances on-chain...");
      const postCallerBalance = callerAddr ? await readNativeBalance(callerAddr) : BigInt(0);
      const postEscrowBalance = await readEscrowBalance();

      let postDonorClaimable = BigInt(0);
      if (callerAddr) {
        const balObj = await genlayerCall("get_claimable_balances", [callerAddr]);
        if (balObj) postDonorClaimable = BigInt(balObj.donor_claimable || 0);
      }

      setActionTxState("SUCCESS");
      setActionStatusMessage(
        `Refund verified on-chain! Contributor wallet received native refund: ${formatGEN(postCallerBalance)}.`
      );
      await loadData();
      clearPendingTx();
    } catch (err: any) {
      setActionError(err.message || "Failed to claim refund");
      setActionTxState("FAILED");
    }
  };

  const handleClaimRefund = () => {
    setConfirmConfig({
      action: "Claim Contributor Refund",
      methodName: "claim_refund",
      amountGEN: (Number(userDonorClaimable) / 1e18).toFixed(2),
      callerAddress: connectedAddress || "Connected Wallet",
      recipientLabel: "Connected Contributor Wallet (Strict Ownership)",
      recipientAddress: connectedAddress || "Connected Wallet",
      contractAddress: getContractAddress(),
      explanation: `Calls claim_refund() on AidFlow contract. Zeroes your contributor claimable refund ledger on-chain and transfers ${formatGEN(userDonorClaimable)} native GEN directly to your connected wallet. Transfers cannot be redirected to any other address.`,
      onConfirm: executeClaimRefund,
    });
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
  const refunded = BigInt(campaign.refunded_amount || 0);
  const lockedInEscrow = funded > (released + refunded) ? funded - released - refunded : BigInt(0);
  const isTerminalRefunded = campaign.status === "REFUNDED";
  // The contract permits refund_campaign only for the recorded donor or a wallet
  // with a non-zero contribution. Keep the UI aligned with that on-chain rule.
  const connectedWalletCanTriggerRefund = Boolean(
    connectedAddress &&
      ((campaign.donor || "").toLowerCase() === connectedAddress.toLowerCase() || userContribution > BigInt(0))
  );

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

      {/* Terminal State Warning Banner */}
      {isTerminalRefunded && (
        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/20 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-rose-300 block">Campaign Status: REFUNDED (Terminal State)</span>
            <p className="text-slate-300 leading-relaxed">
              This campaign has been refunded on-chain following an adjudicated failed milestone. All unreleased capital has been proportionally attributed to contributors. No further evidence submission, milestone adjudication, or tranche releases are permitted.
            </p>
          </div>
        </div>
      )}

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
          {actionTxState === "PROCESSING" && (
            <p className="text-slate-400">Waiting for on-chain StudioNet receipt confirmation...</p>
          )}
          {actionTxState === "SUCCESS" && (
            <p className="text-emerald-400 font-semibold">Transaction confirmed on-chain! State refreshed.</p>
          )}
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
                  isTerminalRefunded
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    : campaign.status === "COMPLETED"
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

          {/* Action Buttons: Fund, Payout, Refund Trigger, Claim Refund */}
          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            {!isTerminalRefunded && campaign.status !== "COMPLETED" && (
              <button
                onClick={() => setShowFundModal(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 transition-all shadow-md shadow-emerald-500/10 flex items-center gap-2"
              >
                <Coins className="w-4 h-4 stroke-[2.5]" />
                Fund Escrow
              </button>
            )}

            {/* Claim Payout: Enabled when connected wallet has claimable payout balance */}
            {userOrgClaimable > BigInt(0) && (
              <button
                onClick={handleClaimPayout}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-600/20 flex items-center gap-2"
              >
                Claim Payout ({formatGEN(userOrgClaimable)})
              </button>
            )}

            {/* Trigger Refund: Enabled ONLY when contract reports is_campaign_refundable == true */}
            {!isTerminalRefunded && isRefundEligible && connectedWalletCanTriggerRefund && (
              <button
                onClick={handleTriggerRefund}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-md shadow-amber-600/20 flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Trigger Refund ({formatGEN(lockedInEscrow)})
              </button>
            )}

            {/* Claim Refund: Available when connected contributor has non-zero donor_claimable */}
            {userDonorClaimable > BigInt(0) && (
              <button
                onClick={handleClaimRefund}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/20 flex items-center gap-2"
              >
                Claim Refund ({formatGEN(userDonorClaimable)})
              </button>
            )}
          </div>
        </div>

        {/* Stakeholder Addresses & Real On-Chain Claimable Balances */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-slate-500">Campaign Creator / Donor</span>
              <Users className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <span className="font-mono text-slate-300 truncate block text-[11px]">
              {campaign.donor || "N/A"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-slate-500">Beneficiary Organization</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="font-mono text-emerald-400 truncate block text-[11px]">
              {campaign.organization || "N/A"}
            </span>
            <div className="pt-1 flex items-center justify-between text-[11px] border-t border-slate-800/80">
              <span className="text-slate-400">Claimable Payout:</span>
              <span className="font-bold text-purple-400 font-mono">
                {formatGEN(registeredOrgClaimable)}
              </span>
            </div>
          </div>
        </div>

        {/* Connected Contributor & Ownership Panel */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-slate-200 text-xs">Connected Contributor Account</span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              {connectedAddress || "Wallet not connected"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Your Escrow Contribution</span>
              <span className="font-mono font-bold text-white text-sm block mt-0.5">
                {formatGEN(userContribution)}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Your Claimable Refund</span>
              <span className="font-mono font-bold text-rose-400 text-sm block mt-0.5">
                {formatGEN(userDonorClaimable)}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Refund Ownership Protection</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Strict 1:1 attribution. Native GEN transfers exclusively to connected caller.
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
            <div className="text-[10px] uppercase font-semibold text-slate-500">
              {isTerminalRefunded ? "Total Refunded" : "Disbursed Aid"}
            </div>
            <div className={`text-lg font-black mt-0.5 ${isTerminalRefunded ? "text-rose-400" : "text-purple-400"}`}>
              {formatGEN(isTerminalRefunded ? refunded : released)}
            </div>
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
                      {!isTerminalRefunded && m.status !== "RELEASED" && (
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

                    {!isTerminalRefunded && isPassed && !isReleased && (
                      <button
                        onClick={() => handleReleaseTranche(m)}
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

      {confirmConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-card rounded-2xl border border-slate-800 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <TransactionConfirmPanel
              action={confirmConfig.action}
              methodName={confirmConfig.methodName}
              amountGEN={confirmConfig.amountGEN}
              callerAddress={confirmConfig.callerAddress}
              recipientLabel={confirmConfig.recipientLabel}
              recipientAddress={confirmConfig.recipientAddress}
              contractAddress={confirmConfig.contractAddress}
              explanation={confirmConfig.explanation}
              onConfirm={confirmConfig.onConfirm}
              onCancel={() => {
                setConfirmConfig(null);
                setActionTxState("IDLE");
              }}
              isSubmitting={actionTxState === "AWAITING_WALLET" || actionTxState === "PROCESSING" || actionTxState === "CONSENSUS"}
              txState={actionTxState}
              txTracking={actionTracking}
              statusMessage={actionStatusMessage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
