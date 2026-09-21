"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Wallet, ExternalLink, Activity, PlusCircle, Compass } from "lucide-react";
import { requestWalletConnection, switchToStudioNet, STUDIONET_CHAIN_ID } from "../lib/genlayer";

export default function Navbar() {
  const pathname = usePathname();
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "ethereum" in window) {
      const eth = (window as any).ethereum;

      const updateWalletState = async () => {
        try {
          const accounts = await eth.request({ method: "eth_accounts" });
          if (accounts && accounts.length > 0) {
            setAccount(accounts[0]);
          } else {
            setAccount(null);
          }

          const currentChainHex = await eth.request({ method: "eth_chainId" });
          if (currentChainHex) {
            setChainId(parseInt(currentChainHex, 16));
          }
        } catch {}
      };

      updateWalletState();

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount(null);
        }
      };

      const handleChainChanged = (newChainHex: string) => {
        setChainId(parseInt(newChainHex, 16));
      };

      eth.on?.("accountsChanged", handleAccountsChanged);
      eth.on?.("chainChanged", handleChainChanged);

      return () => {
        eth.removeListener?.("accountsChanged", handleAccountsChanged);
        eth.removeListener?.("chainChanged", handleChainChanged);
      };
    }
  }, []);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const { address, chainId: cId } = await requestWalletConnection();
      setAccount(address);
      setChainId(cId);
    } catch (err: any) {
      alert(err.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSwitchNetwork = async () => {
    try {
      setIsSwitchingNetwork(true);
      await switchToStudioNet();
      setChainId(STUDIONET_CHAIN_ID);
    } catch (err: any) {
      alert(err.message || "Failed to switch to StudioNet");
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  const navLinks = [
    { href: "/", label: "Protocol Pipeline", icon: Activity },
    { href: "/explorer", label: "Campaign Explorer", icon: Compass },
    { href: "/create", label: "Create Campaign", icon: PlusCircle },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              Aid<span className="text-emerald-400">Flow</span>
            </span>
            <span className="text-[10px] font-semibold text-emerald-400/80 tracking-widest uppercase block -mt-1">
              GenLayer Escrow Protocol
            </span>
          </div>
        </Link>

        {/* Navigation items */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  isActive
                    ? "bg-slate-800 text-emerald-400 border border-slate-700/60 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Network status and Wallet Connect */}
        <div className="flex items-center gap-3">
          {account && chainId && chainId !== STUDIONET_CHAIN_ID ? (
            <button
              onClick={handleSwitchNetwork}
              disabled={isSwitchingNetwork}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span>{isSwitchingNetwork ? "Switching..." : "Switch to StudioNet"}</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>StudioNet (61999)</span>
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 transition-all shadow-md shadow-emerald-500/10 active:scale-95 disabled:opacity-50"
          >
            <Wallet className="w-4 h-4 stroke-[2.5]" />
            {account
              ? `${account.slice(0, 6)}...${account.slice(-4)}`
              : isConnecting
              ? "Connecting..."
              : "Connect Wallet"}
          </button>
        </div>
      </div>
    </header>
  );
}
