import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAddress, isAddress } from "ethers";

type WalletDisplayNameStore = Record<string, string>;

const STORAGE_DIR = path.join(process.cwd(), ".data");
const STORAGE_PATH = path.join(STORAGE_DIR, "wallet-display-names.json");

function normalizeAddress(address: string): string {
  const candidate = address.trim();
  if (!isAddress(candidate)) throw new Error("Invalid wallet address.");
  return getAddress(candidate).toLowerCase();
}

async function readStore(): Promise<WalletDisplayNameStore> {
  try {
    const raw = await readFile(STORAGE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const source = parsed as Record<string, unknown>;
    const result: WalletDisplayNameStore = {};
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === "string" && value.trim()) {
        result[key] = value;
      }
    }
    return result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeStore(store: WalletDisplayNameStore): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
  await writeFile(STORAGE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getWalletDisplayName(address: string): Promise<string | null> {
  const key = normalizeAddress(address);
  const store = await readStore();
  const value = store[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export async function setWalletDisplayName(address: string, displayName: string): Promise<void> {
  const key = normalizeAddress(address);
  const normalizedName = displayName.trim();
  const store = await readStore();
  store[key] = normalizedName;
  await writeStore(store);
}

export async function clearWalletDisplayName(address: string): Promise<void> {
  const key = normalizeAddress(address);
  const store = await readStore();
  if (!(key in store)) return;
  delete store[key];
  await writeStore(store);
}
