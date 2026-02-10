"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { formatEther, formatUnits, getAddress, isAddress } from "ethers";
import { cached, clearCache } from "@/lib/cache/memo";
import {
  clearWalletDisplayName,
  getWalletDisplayName,
  setWalletDisplayName,
} from "@/lib/storage/wallet-display-name";
import {
  EtherscanApiError,
  getNormalTransactions,
  getTokenTransfers,
} from "@/lib/etherscan/client";
import {
  formatUsdc,
  getExplorerBaseUrl,
  getProvider,
  getServerWallet,
  getTokenContract,
  getTrackedTokenAddress,
  getTrackedTokenDecimals,
  getTrackedTokenPriceUsd,
  getUsdcAddress,
  getUsdcContract,
  getUsdcDecimals,
  getWalletAddress,
  parseUsdc,
  shortAddr,
} from "@/lib/web3/usdc";

export type RangeKey = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";
export type DataStatus = "ok" | "no_history" | "error";

export type WalletSummary = {
  displayName: string;
  walletAddress: string;
  managedByServer: boolean;
  usdcBalance: string;
  ethBalance: string;
  trackedTokenBalance: string;
  trackedTokenSymbol: string;
  trackedTokenPriceUsd: number;
  portfolioNotUsdcUsd: number;
  joinedAt: string;
  explorerBaseUrl: string;
};

export type PnLPoint = { ts: number; value: number };

export type PnLSeries = {
  range: RangeKey;
  points: PnLPoint[];
  delta: number;
  status: DataStatus;
  message?: string;
};

export type DepositItem = {
  txHash: string;
  from: string;
  fromShort: string;
  amount: string;
  symbol: string;
  timestamp: number;
  txUrl: string;
};

export type DepositInfo = {
  address: string;
  addressUrl: string;
  explorerBaseUrl: string;
  deposits: DepositItem[];
  status: DataStatus;
  message?: string;
};

export type WithdrawUsdcResult =
  | {
      ok: true;
      txHash: string;
      txUrl: string;
    }
  | {
      ok: false;
      error: string;
    };

export type RenameWalletResult =
  | {
      ok: true;
      displayName: string;
    }
  | {
      ok: false;
      error: string;
    };

type LedgerTransfer = {
  ts: number;
  deltaRaw: bigint;
};

const ETHERSCAN_PAGE_SIZE = 1000;
const MAX_PNL_PAGES = 40;
const DEFAULT_WALLET_DISPLAY_NAME = "My Wallet";
const MAX_WALLET_DISPLAY_NAME_LENGTH = 32;

function resolveWalletAddress(publicKey?: string): string {
  const candidate = publicKey?.trim();
  if (!candidate) return getWalletAddress();
  if (!isAddress(candidate)) {
    throw new Error("Invalid publicKey. Pass a valid EVM address.");
  }
  return getAddress(candidate);
}

function rangeToMs(range: Exclude<RangeKey, "ALL">): number {
  switch (range) {
    case "1H":
      return 60 * 60 * 1000;
    case "6H":
      return 6 * 60 * 60 * 1000;
    case "1D":
      return 24 * 60 * 60 * 1000;
    case "1W":
      return 7 * 24 * 60 * 60 * 1000;
    case "1M":
      return 30 * 24 * 60 * 60 * 1000;
  }
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function roundToMinute(valueMs: number): number {
  return Math.floor(valueMs / 60_000) * 60_000;
}

function safeTimestampMs(value: string): number {
  const secs = Number(value);
  if (!Number.isFinite(secs) || secs <= 0) return 0;
  return secs * 1000;
}

function formatMonthYear(tsMs: number): string {
  if (!tsMs) return "—";
  return new Date(tsMs).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function parseBigint(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function parseDecimal(value: number | bigint | string): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return Number(value);
}

function parseIntSafe(value: string | number | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value !== "string") return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function normalizeWalletDisplayName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function validateWalletDisplayName(value: string): string | null {
  if (!value) return "Wallet name is required.";
  if (value.length > MAX_WALLET_DISPLAY_NAME_LENGTH) {
    return `Wallet name is too long (max ${MAX_WALLET_DISPLAY_NAME_LENGTH} chars).`;
  }
  return null;
}

function parseUnitsToNumber(raw: bigint, decimals: number): number {
  const n = Number(formatUnits(raw, decimals));
  return Number.isFinite(n) ? n : 0;
}

function toUsd(balanceRaw: bigint, decimals: number, priceUsd: number): number {
  const amount = parseUnitsToNumber(balanceRaw, decimals);
  return roundMoney(amount * priceUsd);
}

function transferDeltaRaw(params: {
  transfer: { from: string; to: string; value: string };
  walletAddress: string;
}): bigint {
  const wallet = params.walletAddress.toLowerCase();
  const from = params.transfer.from.toLowerCase();
  const to = params.transfer.to.toLowerCase();
  const rawValue = parseBigint(params.transfer.value);

  if (to === wallet) return rawValue;
  if (from === wallet) return -rawValue;
  return 0n;
}

function messageFromError(error: unknown, fallback: string): string {
  if (error instanceof EtherscanApiError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function friendlyTxError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lower = raw.toLowerCase();

  if (lower.includes("missing env")) return raw;
  if (lower.includes("invalid wallet_private_key")) return "Invalid server wallet private key.";
  if (lower.includes("insufficient funds")) return "Not enough ETH for gas on the server wallet.";
  if (lower.includes("execution reverted") && lower.includes("balance")) {
    return "Insufficient USDC balance for transfer.";
  }
  if (lower.includes("nonce")) return "Nonce conflict. Retry the transaction.";
  if (lower.includes("underpriced")) return "Gas price too low. Retry in a few seconds.";
  if (lower.includes("network")) return "Network error while sending transaction.";

  return raw || "Withdraw failed.";
}

function buildLedger(
  transfers: Array<{
    from: string;
    to: string;
    value: string;
    timeStamp: string;
    blockNumber?: string;
    transactionIndex?: string;
  }>,
  walletAddress: string
): LedgerTransfer[] {
  const ordered = transfers
    .map((item, index) => {
      const ts = safeTimestampMs(item.timeStamp);
      const deltaRaw = transferDeltaRaw({
        transfer: { from: item.from, to: item.to, value: item.value },
        walletAddress,
      });

      return {
        ts,
        deltaRaw,
        blockNumber: parseIntSafe(item.blockNumber),
        txIndex: parseIntSafe(item.transactionIndex),
        index,
      };
    })
    .filter((item) => item.ts > 0 && item.deltaRaw !== 0n)
    .sort((a, b) => {
      if (a.ts !== b.ts) return a.ts - b.ts;
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      if (a.txIndex !== b.txIndex) return a.txIndex - b.txIndex;
      return a.index - b.index;
    });

  const events: LedgerTransfer[] = [];
  let lastTs = 0;
  for (const item of ordered) {
    const nextTs = item.ts <= lastTs ? lastTs + 1 : item.ts;
    events.push({
      ts: nextTs,
      deltaRaw: item.deltaRaw,
    });
    lastTs = nextTs;
  }

  return events;
}

async function getWalletJoinedAt(walletAddress: string): Promise<string> {
  const cacheAddress = walletAddress.toLowerCase();
  return cached(
    `wallet-first-seen:${cacheAddress}`,
    async () => {
      try {
        const txs = await getNormalTransactions({
          address: walletAddress,
          sort: "asc",
          offset: 1,
        });
        const tsMs = safeTimestampMs(txs[0]?.timeStamp ?? "");
        return formatMonthYear(tsMs);
      } catch {
        return "—";
      }
    },
    60_000
  );
}

async function getTrackedTokenSnapshot(walletAddress: string): Promise<{
  balanceRaw: bigint;
  decimals: number;
  symbol: string;
  priceUsd: number;
}> {
  const provider = getProvider();
  const token = getTokenContract(getTrackedTokenAddress(), provider);
  const configuredDecimals = getTrackedTokenDecimals();

  const [balanceRaw, symbolValue] = await Promise.all([
    token.balanceOf(walletAddress) as Promise<bigint>,
    (token.symbol() as Promise<string>).catch(() => "TOKEN"),
  ]);

  let decimals = configuredDecimals;
  if (decimals == null) {
    const decimalsValue = await (token.decimals() as Promise<number | bigint | string>);
    decimals = parseDecimal(decimalsValue);
  }

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("Invalid tracked token decimals");
  }

  const symbol = String(symbolValue ?? "").trim() || "TOKEN";
  const priceUsd = getTrackedTokenPriceUsd();

  return {
    balanceRaw,
    decimals,
    symbol,
    priceUsd,
  };
}

export async function getWalletSummary(publicKey?: string): Promise<WalletSummary> {
  const walletAddress = resolveWalletAddress(publicKey);
  const managedAddress = getWalletAddress();
  const cacheKey = `summary:${walletAddress.toLowerCase()}`;

  return cached(
    cacheKey,
    async () => {
      const provider = getProvider();
      const usdc = getUsdcContract(provider);

      const [usdcBn, ethBn, tracked, joinedAt, displayNameRaw] = await Promise.all([
        usdc.balanceOf(walletAddress) as Promise<bigint>,
        provider.getBalance(walletAddress) as Promise<bigint>,
        getTrackedTokenSnapshot(walletAddress),
        getWalletJoinedAt(walletAddress),
        getWalletDisplayName(walletAddress).catch(() => null),
      ]);

      const eth = Number(formatEther(ethBn));
      const safeEth = Number.isFinite(eth) ? eth : 0;
      const displayName = displayNameRaw ?? DEFAULT_WALLET_DISPLAY_NAME;

      return {
        displayName,
        walletAddress,
        managedByServer: walletAddress.toLowerCase() === managedAddress.toLowerCase(),
        usdcBalance: formatUsdc(usdcBn),
        ethBalance: String(Math.round(safeEth * 1e6) / 1e6),
        trackedTokenBalance: formatUnits(tracked.balanceRaw, tracked.decimals),
        trackedTokenSymbol: tracked.symbol,
        trackedTokenPriceUsd: tracked.priceUsd,
        portfolioNotUsdcUsd: toUsd(tracked.balanceRaw, tracked.decimals, tracked.priceUsd),
        joinedAt,
        explorerBaseUrl: getExplorerBaseUrl(),
      };
    },
    60_000
  );
}

export async function getPnLSeries(range: RangeKey, publicKey?: string): Promise<PnLSeries> {
  const walletAddress = resolveWalletAddress(publicKey);
  const tokenAddress = getTrackedTokenAddress();
  const cacheKey = `pnl:${walletAddress.toLowerCase()}:${tokenAddress.toLowerCase()}:${range}`;

  return cached(
    cacheKey,
    async () => {
      const end = roundToMinute(Date.now());
      const requestedStart = range === "ALL" ? null : end - rangeToMs(range);

      const tracked = await getTrackedTokenSnapshot(walletAddress);
      const transfers: Awaited<ReturnType<typeof getTokenTransfers>> = [];
      let reachedRequestedStart = range === "ALL";
      let exhaustedHistory = false;
      let hitPageLimit = false;

      try {
        let page = 1;

        while (page <= MAX_PNL_PAGES) {
          const batch = await getTokenTransfers({
            address: walletAddress,
            contractAddress: tokenAddress,
            sort: "desc",
            page,
            offset: ETHERSCAN_PAGE_SIZE,
          });

          if (batch.length === 0) {
            exhaustedHistory = true;
            break;
          }
          transfers.push(...batch);

          const oldestBatchTs = safeTimestampMs(batch[batch.length - 1]?.timeStamp ?? "");
          const batchReachedRequestedStart =
            requestedStart != null && oldestBatchTs > 0 && oldestBatchTs <= requestedStart;
          const batchExhaustedHistory = batch.length < ETHERSCAN_PAGE_SIZE;

          if (range === "ALL") {
            if (batchExhaustedHistory) {
              exhaustedHistory = true;
              break;
            }
          } else if (batchReachedRequestedStart || batchExhaustedHistory) {
            if (batchReachedRequestedStart) {
              reachedRequestedStart = true;
            } else {
              exhaustedHistory = true;
            }
            break;
          }

          page += 1;
        }

        if (page > MAX_PNL_PAGES) {
          hitPageLimit = true;
        }
      } catch (error) {
        return {
          range,
          points: [],
          delta: 0,
          status: "error",
          message: messageFromError(error, "Failed to load token history from Etherscan."),
        };
      }

      if (range !== "ALL" && requestedStart != null && hitPageLimit && !reachedRequestedStart) {
        return {
          range,
          points: [],
          delta: 0,
          status: "error",
          message: "PnL history is too large for the selected range. Try a shorter range.",
        };
      }

      if (range === "ALL" && hitPageLimit && !exhaustedHistory) {
        return {
          range,
          points: [],
          delta: 0,
          status: "error",
          message: "All-time history is too large. Try a shorter range.",
        };
      }

      const ledger = buildLedger(transfers, walletAddress);
      if (ledger.length === 0) {
        return {
          range,
          points: [],
          delta: 0,
          status: "no_history",
          message: "No token history for tracked token.",
        };
      }

      const oldestSeenTs = ledger[0].ts;
      const start =
        range === "ALL"
          ? Math.max(0, oldestSeenTs - 1)
          : requestedStart ?? Math.max(0, oldestSeenTs - 1);

      let balanceAtEndRaw = tracked.balanceRaw;
      for (let i = ledger.length - 1; i >= 0; i -= 1) {
        const item = ledger[i];
        if (item.ts <= end) break;
        balanceAtEndRaw -= item.deltaRaw;
      }

      let balanceAtStartRaw = balanceAtEndRaw;
      const eventsInRange: LedgerTransfer[] = [];
      for (const item of ledger) {
        if (item.ts <= start || item.ts > end) continue;
        eventsInRange.push(item);
        balanceAtStartRaw -= item.deltaRaw;
      }

      const points: PnLPoint[] = [
        {
          ts: start,
          value: toUsd(balanceAtStartRaw, tracked.decimals, tracked.priceUsd),
        },
      ];

      let runningRaw = balanceAtStartRaw;
      for (const event of eventsInRange) {
        runningRaw += event.deltaRaw;
        const nextValue = toUsd(runningRaw, tracked.decimals, tracked.priceUsd);
        const lastPoint = points[points.length - 1];
        if (lastPoint && lastPoint.ts === event.ts) {
          points[points.length - 1] = {
            ts: event.ts,
            value: nextValue,
          };
        } else {
          points.push({
            ts: event.ts,
            value: nextValue,
          });
        }
      }

      const endValue = toUsd(balanceAtEndRaw, tracked.decimals, tracked.priceUsd);
      const finalPoint = points[points.length - 1];
      if (!finalPoint || finalPoint.ts !== end || finalPoint.value !== endValue) {
        points.push({
          ts: end,
          value: endValue,
        });
      }

      const first = points[0]?.value ?? endValue;
      const last = points[points.length - 1]?.value ?? endValue;

      return {
        range,
        points,
        delta: roundMoney(last - first),
        status: "ok",
      };
    },
    60_000
  );
}

export async function getDepositInfo(publicKey?: string): Promise<DepositInfo> {
  const address = resolveWalletAddress(publicKey);
  const usdcAddress = getUsdcAddress();
  const explorerBaseUrl = getExplorerBaseUrl();
  const cacheKey = `deposits:${address.toLowerCase()}:${usdcAddress.toLowerCase()}`;
  const usdcDecimals = getUsdcDecimals();

  return cached(
    cacheKey,
    async () => {
      let transfers: Awaited<ReturnType<typeof getTokenTransfers>> = [];
      try {
        transfers = await getTokenTransfers({
          address,
          contractAddress: usdcAddress,
          sort: "desc",
          offset: 40,
        });
      } catch (error) {
        return {
          address,
          addressUrl: `${explorerBaseUrl}/address/${address}`,
          explorerBaseUrl,
          deposits: [],
          status: "error" as const,
          message: messageFromError(error, "Failed to load deposits from Etherscan."),
        };
      }

      const deposits = transfers
        .filter((item) => item.to.toLowerCase() === address.toLowerCase())
        .slice(0, 8)
        .map((item) => {
          const parsedDecimals = Number(item.tokenDecimal);
          const decimals =
            Number.isFinite(parsedDecimals) && parsedDecimals >= 0
              ? parsedDecimals
              : usdcDecimals;
          const amount = parseUnitsToNumber(parseBigint(item.value), decimals);
          return {
            txHash: item.hash,
            from: item.from,
            fromShort: shortAddr(item.from),
            amount: amount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            }),
            symbol: item.tokenSymbol || "USDC",
            timestamp: safeTimestampMs(item.timeStamp),
            txUrl: `${explorerBaseUrl}/tx/${item.hash}`,
          };
        });

      if (deposits.length === 0) {
        return {
          address,
          addressUrl: `${explorerBaseUrl}/address/${address}`,
          explorerBaseUrl,
          deposits: [],
          status: "no_history",
          message: "No USDC deposit history yet.",
        };
      }

      return {
        address,
        addressUrl: `${explorerBaseUrl}/address/${address}`,
        explorerBaseUrl,
        deposits,
        status: "ok",
      };
    },
    60_000
  );
}

function validateWithdrawInput(params: {
  sender: string;
  to: string;
  amount: string;
}): { ok: true; to: string; value: bigint } | { ok: false; error: string } {
  const recipient = params.to.trim();
  if (!recipient) return { ok: false, error: "Recipient address is required." };
  if (!isAddress(recipient)) return { ok: false, error: "Recipient address is invalid." };
  if (recipient.toLowerCase() === params.sender.toLowerCase()) {
    return { ok: false, error: "Recipient address must be different from wallet address." };
  }

  const rawAmount = params.amount.trim();
  if (!rawAmount) return { ok: false, error: "Amount is required." };

  let value: bigint;
  try {
    value = parseUsdc(rawAmount);
  } catch {
    return {
      ok: false,
      error: `Amount format is invalid. Use up to ${getUsdcDecimals()} decimal places.`,
    };
  }

  if (value <= 0n) {
    return { ok: false, error: "Amount must be greater than 0." };
  }

  return { ok: true, to: recipient, value };
}

export async function withdrawUsdc(to: string, amount: string): Promise<WithdrawUsdcResult> {
  try {
    const configuredSender = getWalletAddress();
    const signer = getServerWallet();
    const signerAddress = getAddress(signer.address);

    if (signerAddress.toLowerCase() !== configuredSender.toLowerCase()) {
      return {
        ok: false,
        error: "WALLET_PRIVATE_KEY does not match WALLET_ADDRESS.",
      };
    }

    const validation = validateWithdrawInput({ sender: signerAddress, to, amount });
    if (!validation.ok) return validation;

    const provider = getProvider();
    const usdcRead = getUsdcContract(provider);
    const senderBalance = (await usdcRead.balanceOf(signerAddress)) as bigint;

    if (senderBalance < validation.value) {
      return {
        ok: false,
        error: `Insufficient USDC balance. Available: ${formatUsdc(senderBalance)} USDC.`,
      };
    }

    const usdc = getUsdcContract(signer);
    const tx = await usdc.transfer(validation.to, validation.value);
    const txHash = String(tx?.hash ?? "");

    if (!txHash) {
      return { ok: false, error: "Failed to get transaction hash." };
    }

    await tx.wait(1);

    const senderCachePrefix = signerAddress.toLowerCase();
    clearCache(`summary:${senderCachePrefix}`);
    clearCache(`pnl:${senderCachePrefix}`);
    clearCache(`deposits:${senderCachePrefix}`);
    revalidatePath("/");

    return {
      ok: true,
      txHash,
      txUrl: `${getExplorerBaseUrl()}/tx/${txHash}`,
    };
  } catch (error) {
    return {
      ok: false,
      error: friendlyTxError(error),
    };
  }
}

export async function renameWallet(
  nextDisplayName: string,
  publicKey?: string
): Promise<RenameWalletResult> {
  try {
    const walletAddress = resolveWalletAddress(publicKey);
    const normalizedName = normalizeWalletDisplayName(nextDisplayName);
    const validationError = validateWalletDisplayName(normalizedName);

    if (validationError) {
      return {
        ok: false,
        error: validationError,
      };
    }

    if (normalizedName === DEFAULT_WALLET_DISPLAY_NAME) {
      await clearWalletDisplayName(walletAddress);
    } else {
      await setWalletDisplayName(walletAddress, normalizedName);
    }

    clearCache(`summary:${walletAddress.toLowerCase()}`);
    revalidatePath("/");

    return {
      ok: true,
      displayName: normalizedName,
    };
  } catch (error) {
    return {
      ok: false,
      error: messageFromError(error, "Failed to update wallet name."),
    };
  }
}

export async function getDepositAddress(publicKey?: string): Promise<{ address: string }> {
  const depositInfo = await getDepositInfo(publicKey);
  return { address: depositInfo.address };
}
