"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Coins,
  FileCheck,
  Cpu,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  Search,
  Scale,
  ExternalLink,
} from "lucide-react";
import { getContractAddress } from "../lib/genlayer";

export default function HomePage() {
  const contractAddress = getContractAddress();

  const pipelineSteps = [
    {
      label: "DONOR",
      desc: "Escrows native GEN via payable methods",
      icon: Coins,
      color: "text-amber-400",
      border: "border-amber-500/30",
    },
    {
      label: "ESCROW",
      desc: "Locked on-chain until milestone verification",
      icon: Lock,
      color: "text-emerald-400",
      border: "border-emerald-500/30",
    },
    {
      label: "ORGANIZATION",
      desc: "Executes humanitarian relief deliverables",
      icon: ShieldCheck,
      color: "text-teal-400",
      border: "border-teal-500/30",
    },
    {
      label: "EVIDENCE",
      desc: "Invoices, GPS manifests, photos, web proof",
      icon: FileCheck,
      color: "text-purple-400",
      border: "border-purple-500/30",
    },
    {
      label: "GENLAYER",
      desc: "Decentralized non-deterministic LLM consensus",
      icon: Cpu,
      color: "text-cyan-400",
      border: "border-cyan-500/30",
    },
    {
      label: "RELEASE / HOLD",
      desc: "Autonomous tranche release or inconclusive lock",
      icon: CheckCircle2,
      color: "text-emerald-400",
      border: "border-emerald-500/30",
    },
  ];

  const adjudicationPhases = [
    {
      step: "01",
      title: "OBSERVE",
      subtitle: "Multi-modal Evidence Intake",
      desc: "Local organizations submit invoices, delivery manifests, geographic coordinates, field photographs, and web evidence.",
      badge: "Intake",
    },
    {
      step: "02",
      title: "VERIFY",
      subtitle: "Independent LLM Evaluation",
      desc: "GenLayer validators independently inspect submitted documentation and query web sources against predefined milestone criteria.",
      badge: "Non-Deterministic",
    },
    {
      step: "03",
      title: "CONSENSUS",
      subtitle: "Substantive Equivalence",
      desc: "Validators reach consensus on decision (PASS / FAIL / INCONCLUSIVE) and scoring tolerances without fragile string matching.",
      badge: "Equivalence",
    },
    {
      step: "04",
      title: "RELEASE",
      subtitle: "Autonomous Escrow Disbursal",
      desc: "Upon finalized PASS, the contract automatically releases the tranche to claimable balance. INCONCLUSIVE keeps funds safely locked.",
      badge: "Settlement",
    },
  ];

  return (
    <div className="space-y-16 py-4">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-4xl mx-auto pt-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Autonomous Humanitarian Aid Escrow
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Verifiable Aid. Autonomous Escrow. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
            Powered by GenLayer.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Donors fund humanitarian relief via on-chain smart escrow. Decentralized GenLayer validators evaluate receipts, delivery manifests, and field documentation. Capital is released strictly upon verified human impact.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/explorer"
            className="px-6 py-3 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            Explore Campaigns
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/create"
            className="px-6 py-3 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all flex items-center gap-2"
          >
            Create Aid Campaign
          </Link>
        </div>

        {/* Live Contract Status Pill */}
        <div className="pt-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Target: StudioNet (Chain ID 61999)</span>
            <span className="text-slate-600">•</span>
            <span className="font-mono text-[11px] text-slate-300">
              Contract: {contractAddress ? `${contractAddress.slice(0, 10)}...${contractAddress.slice(-8)}` : "Pending Deployment"}
            </span>
          </div>
        </div>
      </section>

      {/* Protocol Visual Pipeline */}
      <section className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800">
        <div className="mb-6 text-center">
          <h2 className="text-xs uppercase tracking-widest text-emerald-400 font-bold">The AidFlow Pipeline</h2>
          <p className="text-lg font-bold text-white mt-1">Autonomous Flow of Capital & Proof</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 relative">
          {pipelineSteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.label}
                className={`p-4 rounded-xl bg-slate-900/90 border ${step.border} flex flex-col items-center text-center space-y-2 relative group hover:border-slate-600 transition-all`}
              >
                <div className={`p-2.5 rounded-lg bg-slate-800 ${step.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="font-extrabold text-xs tracking-wider text-slate-200">{step.label}</div>
                <p className="text-[11px] text-slate-400 leading-tight">{step.desc}</p>
                {idx < pipelineSteps.length - 1 && (
                  <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600 font-bold">
                    →
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Adjudication Cycle: OBSERVE -> VERIFY -> CONSENSUS -> RELEASE */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs uppercase tracking-widest text-cyan-400 font-bold">Consensus Architecture</div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">How GenLayer Adjudicates Aid Milestones</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Subjective humanitarian outcomes verified through objective validator consensus and custom equivalence principles.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {adjudicationPhases.map((phase) => (
            <div
              key={phase.step}
              className="p-6 rounded-2xl glass-card border border-slate-800 hover:border-slate-700 transition-all space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-slate-700">{phase.step}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-emerald-400 border border-slate-700">
                  {phase.badge}
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">{phase.title}</h3>
                <h4 className="text-xs text-emerald-400 font-medium">{phase.subtitle}</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{phase.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Protocol Security & Invariants */}
      <section className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold">Protocol Security</div>
          <h3 className="text-xl font-bold text-white mt-1">On-Chain Escrow Safety Invariants</h3>
          <p className="text-xs text-slate-400 mt-1">
            Mathematically verified rules governing the custody, adjudication, and settlement of humanitarian funds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Zero Admin Backdoors</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              No administrator or deployer can unilaterally seize funds. Capital moves solely through passed validator consensus or donor refund conditions.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Inconclusive Protection</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ambiguous or incomplete evidence returns INCONCLUSIVE, keeping escrow funds locked while allowing the organization to submit supplementary proof.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Substantive Equivalence</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Validators independently re-verify evidence without fragile string matching, comparing categorical verdicts (PASS/FAIL/INCONCLUSIVE) and metrics within tolerances.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
