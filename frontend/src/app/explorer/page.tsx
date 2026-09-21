"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Coins, ShieldCheck, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { genlayerCall, formatGEN, getContractAddress } from "../../lib/genlayer";
import { Campaign } from "../../lib/types";

export default function ExplorerPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  async function loadCampaigns() {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const contractAddr = getContractAddress();
      if (!contractAddr) {
        setCampaigns([]);
        setIsLoading(false);
        return;
      }

      // Read actual count from deployed AidFlow contract on StudioNet
      const countRes = await genlayerCall("get_campaign_count");
      if (countRes === null || countRes === undefined) {
        setCampaigns([]);
        setIsLoading(false);
        return;
      }

      const count = Number(countRes);
      if (count === 0) {
        setCampaigns([]);
        setIsLoading(false);
        return;
      }

      const list: Campaign[] = [];
      for (let i = 0; i < count; i++) {
        const c = await genlayerCall("get_campaign", [i]);
        if (c) {
          list.push(c);
        }
      }
      setCampaigns(list);
    } catch (err: any) {
      console.warn("Error fetching campaigns from StudioNet:", err);
      setErrorMessage("Unable to load AidFlow data from StudioNet.");
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  const filtered = campaigns.filter((c) => {
    const matchesFilter = filter === "ALL" || c.status === filter;
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.organization.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Campaign Explorer</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real humanitarian escrow campaigns on GenLayer StudioNet (Chain ID: 61999).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadCampaigns}
            disabled={isLoading}
            className="p-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1.5"
            title="Refresh from StudioNet"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            href="/create"
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/10 flex items-center gap-2 self-start md:self-auto"
          >
            Create New Campaign
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search campaigns or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          {["ALL", "ACTIVE", "FUNDED", "COMPLETED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all whitespace-nowrap ${
                filter === st
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign Grid & Real States */}
      {isLoading ? (
        <div className="text-center py-20 glass-card rounded-2xl border border-slate-800 space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400">Querying deployed AidFlow contract on StudioNet (Chain ID: 61999)...</p>
        </div>
      ) : errorMessage ? (
        <div className="text-center py-16 glass-card rounded-2xl border border-rose-900/40 bg-rose-950/10 space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-sm font-semibold text-rose-300">{errorMessage}</p>
          <p className="text-xs text-slate-400">Verify RPC connection to https://studio.genlayer.com/api</p>
          <button
            onClick={loadCampaigns}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
          >
            Retry StudioNet Query
          </button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl border border-slate-800 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No campaigns found on StudioNet.</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No humanitarian escrow contracts have been registered yet on StudioNet. Be the first to create one.
            </p>
          </div>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/10"
          >
            Create First Campaign
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-2xl border border-slate-800 space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm text-slate-400">No campaigns matching selected filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((camp) => {
            const funded = BigInt(camp.funded_amount || 0);
            const total = BigInt(camp.total_funding || 1);
            const progressPercent = total > BigInt(0) ? Math.min(100, Number((funded * BigInt(100)) / total)) : 0;

            return (
              <div
                key={camp.id}
                className="rounded-2xl glass-card border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between overflow-hidden group hover:shadow-xl hover:shadow-slate-950/50"
              >
                <div className="p-6 space-y-4">
                  {/* Status badge & ID */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">Campaign #{camp.id}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        camp.status === "COMPLETED"
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                          : camp.status === "FUNDED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {camp.status}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                      {camp.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {camp.description}
                    </p>
                  </div>

                  {/* Escrow Progress Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Escrow Funding</span>
                      <span className="text-emerald-400 font-bold">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>{formatGEN(camp.funded_amount)} funded</span>
                      <span>Target {formatGEN(camp.total_funding)}</span>
                    </div>
                  </div>

                  {/* Milestone & Org stats */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                    <div>
                      <div className="text-slate-500">Milestones</div>
                      <div className="text-slate-200 font-bold">{camp.milestone_count} Tranches</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Released</div>
                      <div className="text-emerald-400 font-bold">{formatGEN(camp.released_amount)}</div>
                    </div>
                  </div>
                </div>

                {/* Footer Link */}
                <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">
                    Org: {camp.organization ? `${camp.organization.slice(0, 6)}...${camp.organization.slice(-4)}` : "N/A"}
                  </span>
                  <Link
                    href={`/campaign/${camp.id}`}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                  >
                    View Details
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
