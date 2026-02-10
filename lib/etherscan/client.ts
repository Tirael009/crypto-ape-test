import "server-only";
import { isAddress } from "ethers";
import {
  getChainId,
  getEtherscanApiKey,
  getEtherscanApiUrl,
} from "@/lib/web3/usdc";

type EtherscanResponse<T> = {
  status: string;
  message: string;
  result: T;
};

export type EtherscanErrorCode =
  | "INVALID_API_KEY"
  | "RATE_LIMIT"
  | "HTTP_ERROR"
  | "UNKNOWN";

export class EtherscanApiError extends Error {
  code: EtherscanErrorCode;
  details?: string;

  constructor(message: string, code: EtherscanErrorCode, details?: string) {
    super(message);
    this.name = "EtherscanApiError";
    this.code = code;
    this.details = details;
  }
}

export type EtherscanTokenTransfer = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
};

export type EtherscanNormalTx = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  isError: string;
};

type SortOrder = "asc" | "desc";

function noDataResponse(value: unknown): boolean {
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value !== "string") return false;
  const normalized = value.toLowerCase();
  return normalized.includes("no transactions found");
}

function normalizeEtherscanError(message: string): EtherscanApiError {
  const lower = message.toLowerCase();

  if (lower.includes("missing/invalid api key") || lower.includes("invalid api key")) {
    return new EtherscanApiError(
      "Invalid Etherscan API key.",
      "INVALID_API_KEY",
      message
    );
  }

  if (lower.includes("rate limit")) {
    return new EtherscanApiError(
      "Etherscan rate limit reached. Retry in a few seconds.",
      "RATE_LIMIT",
      message
    );
  }

  return new EtherscanApiError(
    `Etherscan error: ${message || "Unknown error"}`,
    "UNKNOWN",
    message
  );
}

async function etherscanRequest<T>(params: Record<string, string | number>): Promise<T> {
  const url = new URL(getEtherscanApiUrl());
  url.searchParams.set("chainid", String(getChainId()));
  url.searchParams.set("apikey", getEtherscanApiKey());

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new EtherscanApiError(`Etherscan HTTP ${res.status}`, "HTTP_ERROR");
  }

  const data = (await res.json()) as EtherscanResponse<T>;
  if (data.status === "0") {
    if (noDataResponse(data.result)) {
      return [] as unknown as T;
    }

    const resultText =
      typeof data.result === "string"
        ? data.result
        : typeof data.message === "string"
          ? data.message
          : "Unknown Etherscan error";

    throw normalizeEtherscanError(resultText);
  }

  return data.result;
}

export async function getTokenTransfers(params: {
  address: string;
  contractAddress: string;
  sort?: SortOrder;
  page?: number;
  offset?: number;
  startblock?: number;
  endblock?: number;
}): Promise<EtherscanTokenTransfer[]> {
  if (!isAddress(params.address)) throw new Error("Invalid wallet address for Etherscan");
  if (!isAddress(params.contractAddress)) {
    throw new Error("Invalid token address for Etherscan");
  }

  return etherscanRequest<EtherscanTokenTransfer[]>({
    module: "account",
    action: "tokentx",
    address: params.address,
    contractaddress: params.contractAddress,
    page: params.page ?? 1,
    offset: params.offset ?? 250,
    startblock: params.startblock ?? 0,
    endblock: params.endblock ?? 99999999,
    sort: params.sort ?? "desc",
  });
}

export async function getNormalTransactions(params: {
  address: string;
  sort?: SortOrder;
  page?: number;
  offset?: number;
  startblock?: number;
  endblock?: number;
}): Promise<EtherscanNormalTx[]> {
  if (!isAddress(params.address)) throw new Error("Invalid wallet address for Etherscan");

  return etherscanRequest<EtherscanNormalTx[]>({
    module: "account",
    action: "txlist",
    address: params.address,
    page: params.page ?? 1,
    offset: params.offset ?? 50,
    startblock: params.startblock ?? 0,
    endblock: params.endblock ?? 99999999,
    sort: params.sort ?? "desc",
  });
}
