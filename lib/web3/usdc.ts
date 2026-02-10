import "server-only";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatUnits,
  parseUnits,
  isAddress,
} from "ethers";

const USDC_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

const TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

const CHAIN_EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io",
  11155111: "https://sepolia.etherscan.io",
  5: "https://goerli.etherscan.io",
};

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function normalizedAddressFromEnv(name: string): string {
  const raw = requiredEnv(name);
  if (isAddress(raw)) return raw;

  const lower = String(raw).toLowerCase();
  if (isAddress(lower)) return lower;

  throw new Error(`Invalid ${name}`);
}

export function getChainId(): number {
  const raw = process.env.CHAIN_ID ?? "1";
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid CHAIN_ID: ${raw}`);
  return n;
}

export function getRpcUrl(): string {
  return requiredEnv("RPC_URL");
}

export function getWalletAddress(): string {
  return normalizedAddressFromEnv("WALLET_ADDRESS");
}

export function getUsdcAddress(): string {
  return normalizedAddressFromEnv("USDC_ADDRESS");
}

export function getUsdcDecimals(): number {
  const raw = (process.env.USDC_DECIMALS ?? "6").trim();
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 36) {
    throw new Error(`Invalid USDC_DECIMALS: ${raw}`);
  }
  return n;
}

export function getTrackedTokenDecimals(): number | null {
  const raw = process.env.TRACKED_TOKEN_DECIMALS?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 36) {
    throw new Error(`Invalid TRACKED_TOKEN_DECIMALS: ${raw}`);
  }
  return n;
}

export function getTrackedTokenAddress(): string {
  return normalizedAddressFromEnv("TRACKED_TOKEN_ADDRESS");
}

export function getTrackedTokenPriceUsd(): number {
  const raw = (process.env.TRACKED_TOKEN_PRICE_USD ?? "1").trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid TRACKED_TOKEN_PRICE_USD: ${raw}`);
  }
  return n;
}

export function getExplorerBaseUrl(): string {
  const fromEnv = process.env.ETHERSCAN_BASE_URL?.trim();
  if (fromEnv) return fromEnv;
  return CHAIN_EXPLORERS[getChainId()] ?? CHAIN_EXPLORERS[1];
}

export function getEtherscanApiUrl(): string {
  return process.env.ETHERSCAN_API_URL?.trim() ?? "https://api.etherscan.io/v2/api";
}

export function getEtherscanApiKey(): string {
  return requiredEnv("ETHERSCAN_API_KEY");
}

export function getProvider(): JsonRpcProvider {
  return new JsonRpcProvider(getRpcUrl(), getChainId());
}

export function getServerWallet(): Wallet {
  const rawPk = requiredEnv("WALLET_PRIVATE_KEY").trim();
  const pk = rawPk.startsWith("0x") ? rawPk : `0x${rawPk}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error("Invalid WALLET_PRIVATE_KEY format");
  }
  return new Wallet(pk, getProvider());
}

export function getUsdcContract(providerOrSigner?: JsonRpcProvider | Wallet): Contract {
  const ps = providerOrSigner ?? getProvider();
  return new Contract(getUsdcAddress(), USDC_ABI, ps);
}

export function parseUsdc(amount: string): bigint {
  const normalized = amount.trim().replace(",", ".");
  return parseUnits(normalized, getUsdcDecimals());
}

export function formatUsdc(value: bigint): string {
  return formatUnits(value, getUsdcDecimals());
}

export function getTokenContract(address: string, providerOrSigner?: JsonRpcProvider | Wallet): Contract {
  if (!isAddress(address)) throw new Error("Invalid token address");
  const ps = providerOrSigner ?? getProvider();
  return new Contract(address, TOKEN_ABI, ps);
}

export function assertAddress(addr: string, field = "address"): void {
  if (!isAddress(addr)) throw new Error(`Invalid ${field}`);
}

export function shortAddr(addr: string): string {
  if (!isAddress(addr)) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
