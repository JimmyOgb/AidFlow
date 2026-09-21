import deployedConfig from "../contracts/deployed_contract.json";
import { AIDFLOW_ABI } from "../contracts/abi";

export const GENLAYER_STUDIONET = {
  id: 61999,
  name: "GenLayer Studio Network",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://studio.genlayer.com/api"] },
  },
  blockExplorers: {
    default: { name: "Studio Explorer", url: "https://genlayer-explorer.vercel.app" },
  },
};

export type TxLifecycleState =
  | "IDLE"
  | "AWAITING_WALLET"
  | "WALLET_CONFIRMATION"
  | "SUBMITTED"
  | "PROCESSING"
  | "ADJUDICATING"
  | "CONFIRMED"
  | "FINALIZED"
  | "FAILED";

export function getContractAddress(): string {
  return deployedConfig.contract_address || "";
}

export function formatGEN(atto: bigint | number | string | null | undefined): string {
  if (atto === null || atto === undefined) return "0.00 GEN";
  try {
    const b = BigInt(atto);
    const whole = b / BigInt(10 ** 18);
    const remainder = b % BigInt(10 ** 18);
    const decimals = remainder.toString().padStart(18, "0").slice(0, 2);
    return `${whole}.${decimals} GEN`;
  } catch {
    return "0.00 GEN";
  }
}

export function parseGEN(gen: string): bigint {
  const num = parseFloat(gen);
  if (isNaN(num) || num <= 0) return BigInt(0);
  return BigInt(Math.floor(num * 10 ** 18));
}

export async function requestWalletConnection(): Promise<{ address: string; chainId: number }> {
  if (typeof window === "undefined" || !("ethereum" in window)) {
    throw new Error("No Web3 wallet found. Please install MetaMask or another EVM wallet.");
  }
  const eth = (window as any).ethereum;
  const accounts = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("No account authorized by wallet");
  }
  const chainIdHex = await eth.request({ method: "eth_chainId" });
  const chainId = parseInt(chainIdHex, 16);

  // Prompt network switch to StudioNet (61999) exclusively
  if (chainId !== GENLAYER_STUDIONET.id) {
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${GENLAYER_STUDIONET.id.toString(16)}` }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${GENLAYER_STUDIONET.id.toString(16)}`,
              chainName: GENLAYER_STUDIONET.name,
              rpcUrls: GENLAYER_STUDIONET.rpcUrls.default.http,
              nativeCurrency: GENLAYER_STUDIONET.nativeCurrency,
              blockExplorerUrls: [GENLAYER_STUDIONET.blockExplorers.default.url],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  }

  return { address: accounts[0], chainId };
}

// Low-level GenLayer StudioNet RPC caller targeting https://studio.genlayer.com/api
export async function genlayerCall(method: string, args: any[] = []): Promise<any> {
  const rpcUrl = deployedConfig.rpcUrl || "https://studio.genlayer.com/api";
  const contract = getContractAddress();

  if (!contract || contract === "0x5FbDB2315678afecb367f032d93F642f64180aa3" || contract.length !== 42) {
    // Contract address not set or invalid
    return null;
  }

  try {
    const payload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "gen_call",
      params: [
        {
          type: "read",
          to: contract,
          from: "0x0000000000000000000000000000000000000000",
          functionName: method,
          args: args,
          kwargs: {},
          leaderOnly: false,
          transaction_hash_variant: "latest-nonfinal",
        },
      ],
    };

    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.error) {
      // Contract not found or RPC error: return null so caller displays real empty state
      return null;
    }
    return data.result;
  } catch (err) {
    console.warn(`Network error calling ${method} on StudioNet:`, err);
    return null;
  }
}
