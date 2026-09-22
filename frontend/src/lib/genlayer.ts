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

export const STUDIONET_CHAIN_ID = GENLAYER_STUDIONET.id;

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
  return { address: accounts[0], chainId };
}

export async function switchToStudioNet(): Promise<void> {
  if (typeof window === "undefined" || !("ethereum" in window)) {
    throw new Error("No Web3 wallet found. Please install MetaMask or another EVM wallet.");
  }
  const eth = (window as any).ethereum;
  const hexChainId = `0x${GENLAYER_STUDIONET.id.toString(16)}`;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
  } catch (switchError: any) {
    // Error code 4902 indicates that the chain has not been added yet
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexChainId,
            chainName: GENLAYER_STUDIONET.name,
            rpcUrls: GENLAYER_STUDIONET.rpcUrls.default.http,
            nativeCurrency: GENLAYER_STUDIONET.nativeCurrency,
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

export async function sendContractTransaction({
  functionName,
  args = [],
  value = BigInt(0),
}: {
  functionName: string;
  args?: any[];
  value?: bigint;
}): Promise<string> {
  const { address, chainId } = await requestWalletConnection();

  if (chainId !== GENLAYER_STUDIONET.id) {
    await switchToStudioNet();
  }

  const contract = getContractAddress();
  if (!contract || contract.length !== 42) {
    throw new Error("Invalid AidFlow contract address on StudioNet");
  }

  const { encodeFunctionData } = await import("viem");
  const { AIDFLOW_VIEM_ABI } = await import("../contracts/abi");

  const calldata = encodeFunctionData({
    abi: AIDFLOW_VIEM_ABI,
    functionName: functionName as any,
    args: args as any,
  });

  const eth = (window as any).ethereum;
  const txParams: Record<string, string> = {
    from: address,
    to: contract,
    data: calldata,
  };

  if (value > BigInt(0)) {
    txParams.value = `0x${value.toString(16)}`;
  }

  const txHash = await eth.request({
    method: "eth_sendTransaction",
    params: [txParams],
  });

  if (!txHash || typeof txHash !== "string" || !txHash.startsWith("0x")) {
    throw new Error("Transaction was rejected or returned an invalid hash");
  }

  return txHash;
}

export async function waitForTransactionReceipt(
  txHash: string,
  timeoutMs: number = 60000,
  pollIntervalMs: number = 2000
): Promise<{ status: "0x1" | "0x0"; transactionHash: string }> {
  const rpcUrl = deployedConfig.rpcUrl || "https://studio.genlayer.com/api";
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "eth_getTransactionReceipt",
          params: [txHash],
        }),
      });
      const data = await res.json();
      if (data.result) {
        if (data.result.status === "0x1" || data.result.status === 1) {
          return { status: "0x1", transactionHash: txHash };
        } else if (data.result.status === "0x0" || data.result.status === 0) {
          throw new Error(`Transaction ${txHash} reverted on-chain`);
        }
      }
    } catch (e: any) {
      if (e.message && e.message.includes("reverted")) throw e;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`Transaction confirmation timed out after ${timeoutMs / 1000}s`);
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
