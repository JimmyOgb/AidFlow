import { createClient, chains, isSuccessful } from "genlayer-js";
import deployedConfig from "../contracts/deployed_contract.json";

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
  | "WALLET_SUBMITTED"
  | "SUBMITTED"
  | "PROCESSING"
  | "CONSENSUS"
  | "FINALIZED"
  | "SUCCESS"
  | "UNDETERMINED"
  | "FAILED";

export interface GenLayerTxTracking {
  txId: string;
  evmHash?: string;
  functionName: string;
  status: string;
  statusName?: string;
  resultName?: string;
  executionResultName?: string;
  isSuccessful?: boolean;
  error?: string;
  updatedAt: number;
}

export interface PersistedTxRecord {
  txId: string;
  evmHash?: string;
  functionName: string;
  actionTitle: string;
  campaignId?: number;
  status: TxLifecycleState;
  preBalances?: {
    escrowBalance?: string;
    callerBalance?: string;
    orgClaimable?: string;
    donorClaimable?: string;
  };
  postBalances?: {
    escrowBalance?: string;
    callerBalance?: string;
    orgClaimable?: string;
    donorClaimable?: string;
  };
  intendedAmountGEN?: string;
  updatedAt: number;
  resultSummary?: string;
}

const STORAGE_KEY_PENDING_TX = "aidflow_active_genlayer_tx";

export function savePendingTx(record: PersistedTxRecord): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PENDING_TX, JSON.stringify(record));
  } catch (err) {
    console.warn("Failed saving pending transaction to localStorage:", err);
  }
}

export function getPendingTx(): PersistedTxRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENDING_TX);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingTx(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_PENDING_TX);
  } catch (err) {
    console.warn("Failed clearing pending transaction from localStorage:", err);
  }
}

export function getContractAddress(): string {
  return deployedConfig.contract_address || "0xB7ddB3322403F15ba9648c96E2B60Cb391d53Ae3";
}

export function formatGEN(atto: bigint | number | string | null | undefined): string {
  if (atto === null || atto === undefined) return "0.00 GEN";
  try {
    const b = BigInt(atto);
    const whole = b / BigInt(10 ** 18);
    const remainder = b % BigInt(10 ** 18);
    const decimals = remainder.toString().padStart(18, "0").slice(0, 4);
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

export function getGenLayerClient(accountAddress?: string) {
  const provider = typeof window !== "undefined" ? (window as any).ethereum : undefined;
  return createClient({
    chain: chains.studionet,
    endpoint: deployedConfig.rpcUrl || "https://studio.genlayer.com/api",
    provider,
    account: accountAddress as `0x${string}` | undefined,
  });
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
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexChainId,
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

export async function readEscrowBalance(): Promise<bigint> {
  const client = getGenLayerClient();
  const contract = getContractAddress();
  try {
    const balance = await client.getBalance({ address: contract as `0x${string}` });
    return BigInt(balance);
  } catch (err) {
    console.warn("Could not read contract escrow native balance:", err);
    return BigInt(0);
  }
}

export async function readNativeBalance(addr: string): Promise<bigint> {
  if (!addr || !addr.startsWith("0x")) return BigInt(0);
  const client = getGenLayerClient();
  try {
    const balance = await client.getBalance({ address: addr as `0x${string}` });
    return BigInt(balance);
  } catch (err) {
    console.warn(`Could not read native balance for ${addr}:`, err);
    return BigInt(0);
  }
}

export async function submitGenLayerWrite({
  functionName,
  args = [],
  value = BigInt(0),
  leaderOnly = false,
  onStatusChange,
  onTrackingUpdate,
}: {
  functionName: string;
  args?: any[];
  value?: bigint;
  leaderOnly?: boolean;
  onStatusChange?: (state: TxLifecycleState, message?: string) => void;
  onTrackingUpdate?: (tracking: GenLayerTxTracking) => void;
}): Promise<{
  txId: string;
  evmHash?: string;
  receipt: any;
  isSuccess: boolean;
  statusName: string;
  resultName: string;
  executionResultName: string;
}> {
  const { address, chainId } = await requestWalletConnection();

  if (chainId !== GENLAYER_STUDIONET.id) {
    await switchToStudioNet();
  }

  const contract = getContractAddress();
  if (!contract || contract.length !== 42) {
    throw new Error("Invalid AidFlow contract address on StudioNet");
  }

  onStatusChange?.("AWAITING_WALLET", "Please approve the transaction in your wallet...");

  const client = getGenLayerClient(address);

  let txId: string;
  try {
    txId = await client.writeContract({
      address: contract as `0x${string}`,
      functionName,
      args,
      value,
      leaderOnly,
    });
  } catch (err: any) {
    onStatusChange?.("FAILED", err.message || "Wallet rejected transaction");
    throw err;
  }

  if (!txId || typeof txId !== "string" || !txId.startsWith("0x")) {
    throw new Error("Write call did not return a valid GenLayer transaction ID");
  }

  onStatusChange?.("WALLET_SUBMITTED", "Wallet transaction submitted to StudioNet");
  onStatusChange?.("PROCESSING", "Intelligent Contract execution in progress on GenLayer...");

  // On StudioNet, client.writeContract returns the GenLayer Intelligent Contract transaction ID directly.
  // EVM submission hashes only exist when using an outer EVM bridge envelope (e.g. Testnet Bradbury/Asimov).
  // We do NOT conflate or duplicate the GenLayer transaction ID as the EVM hash.
  const tracking: GenLayerTxTracking = {
    txId,
    evmHash: undefined,
    functionName,
    status: "PENDING",
    statusName: "PENDING",
    updatedAt: Date.now(),
  };
  onTrackingUpdate?.(tracking);

  savePendingTx({
    txId,
    evmHash: undefined,
    functionName,
    actionTitle: functionName,
    status: "PROCESSING",
    updatedAt: Date.now(),
  });

  // Track transaction lifecycle with GenLayer client
  let receipt: any = null;

  try {
    // 1. Wait for decision (responsive consensus state)
    try {
      const decisionReceipt = await client.waitForDecision({
        hash: txId as any,
        interval: 2000,
        retries: 30,
      });
      if (decisionReceipt) {
        tracking.status = String(decisionReceipt.status);
        tracking.statusName = decisionReceipt.statusName;
        tracking.resultName = (decisionReceipt as any).result_name || decisionReceipt.resultName;
        onStatusChange?.("CONSENSUS", `Decision reached: ${tracking.resultName || tracking.statusName}`);
        onTrackingUpdate?.({ ...tracking, updatedAt: Date.now() });
      }
    } catch (decisionErr: any) {
      // Continue to finalization even if early decision polling timed out
      console.warn("waitForDecision note:", decisionErr.message);
    }

    // 2. Wait for finalization (durable on-chain settlement)
    receipt = await client.waitForFinalization({
      hash: txId as any,
      interval: 2000,
      retries: 45,
    });
  } catch (finErr: any) {
    // Fetch raw transaction state to see where it landed
    try {
      receipt = await client.getTransaction({ hash: txId as any });
    } catch {}
    if (!receipt) {
      onStatusChange?.("FAILED", `Transaction finalization timed out: ${finErr.message}`);
      throw finErr;
    }
  }

  const statusName = receipt.statusName || String(receipt.status);
  const resultName = (receipt as any).result_name || receipt.resultName || "UNKNOWN";
  const executionResultName = receipt.txExecutionResultName || "UNKNOWN";
  const success = Boolean(isSuccessful(receipt));

  tracking.status = String(receipt.status);
  tracking.statusName = statusName;
  tracking.resultName = resultName;
  tracking.executionResultName = executionResultName;
  tracking.isSuccessful = success;
  tracking.updatedAt = Date.now();
  onTrackingUpdate?.(tracking);

  if (resultName === "NO_MAJORITY" || statusName === "UNDETERMINED" || receipt?.lifecycle?.outcome === "undetermined") {
    onStatusChange?.(
      "UNDETERMINED",
      `GenLayer consensus did not produce a majority (result: ${resultName}). Execution undetermined. Financial state was not modified.`
    );
    savePendingTx({
      txId,
      functionName,
      actionTitle: functionName,
      status: "UNDETERMINED",
      resultSummary: `Consensus Undetermined (${resultName})`,
      updatedAt: Date.now(),
    });
    return {
      txId,
      receipt,
      isSuccess: false,
      statusName,
      resultName,
      executionResultName,
    };
  }

  if (!success && executionResultName !== "FINISHED_WITH_RETURN") {
    onStatusChange?.("FAILED", `Transaction finalized with execution failure: ${executionResultName} (${resultName})`);
    savePendingTx({
      txId,
      functionName,
      actionTitle: functionName,
      status: "FAILED",
      resultSummary: `Failed (${executionResultName})`,
      updatedAt: Date.now(),
    });
    return {
      txId,
      receipt,
      isSuccess: false,
      statusName,
      resultName,
      executionResultName,
    };
  }

  onStatusChange?.("SUCCESS", "Transaction finalized and execution verified on GenLayer!");
  clearPendingTx();

  return {
    txId,
    receipt,
    isSuccess: true,
    statusName,
    resultName,
    executionResultName,
  };
}

export async function pollExistingGenLayerTx(
  txId: string,
  onUpdate: (tracking: GenLayerTxTracking) => void
): Promise<{ receipt: any; isSuccess: boolean }> {
  const client = getGenLayerClient();
  const tx = await client.getTransaction({ hash: txId as any });
  if (!tx) {
    throw new Error(`Transaction ${txId} not found on StudioNet`);
  }

  const statusName = tx.statusName || String(tx.status);
  const resultName = (tx as any).result_name || tx.resultName || "UNKNOWN";
  const executionResultName = tx.txExecutionResultName || "UNKNOWN";
  const success = Boolean(isSuccessful(tx));

  const tracking: GenLayerTxTracking = {
    txId,
    functionName: "tracked_transaction",
    status: String(tx.status),
    statusName,
    resultName,
    executionResultName,
    isSuccessful: success,
    updatedAt: Date.now(),
  };
  onUpdate(tracking);

  return { receipt: tx, isSuccess: success };
}

// Low-level GenLayer StudioNet contract reader using client.readContract
export async function genlayerCall(method: string, args: any[] = []): Promise<any> {
  const client = getGenLayerClient();
  const contract = getContractAddress();

  if (!contract || contract === "0x5FbDB2315678afecb367f032d93F642f64180aa3" || contract.length !== 42) {
    return null;
  }

  try {
    const result = await client.readContract({
      address: contract as `0x${string}`,
      functionName: method,
      args,
      kwargs: {},
    });
    // Convert Map returns into plain objects for seamless React consumption
    if (result instanceof Map) {
      const obj: Record<string, any> = {};
      for (const [k, v] of Array.from(result.entries())) {
        obj[k] = v;
      }
      return obj;
    }
    return result;
  } catch (err: any) {
    console.warn(`Error calling ${method} on StudioNet:`, err?.message || err);
    return null;
  }
}
