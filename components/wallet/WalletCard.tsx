"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import NumberFlow from "@number-flow/react";
import { isAddress } from "ethers";
import { AnimatePresence, motion } from "framer-motion";
import ButtonMotion from "@/components/ui/ButtonMotion";
import { getDepositInfo, renameWallet, withdrawUsdc } from "@/actions/wallet.actions";
import styles from "./WalletCard.module.scss";

type Props = {
  summary: {
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
  } | null;
};

type ActivePanel = "deposit" | "withdraw" | null;

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function validateWithdrawInput(params: {
  to: string;
  amount: string;
  senderAddress: string;
}): string | null {
  const recipient = params.to.trim();
  if (!recipient) return "Recipient address is required.";
  if (!isAddress(recipient)) return "Recipient address is invalid.";
  if (params.senderAddress && recipient.toLowerCase() === params.senderAddress.toLowerCase()) {
    return "Recipient address must be different from wallet address.";
  }

  const amountRaw = params.amount.trim().replace(",", ".");
  if (!amountRaw) return "Amount is required.";
  const amountValue = Number(amountRaw);
  if (!Number.isFinite(amountValue)) return "Amount format is invalid.";
  if (amountValue <= 0) return "Amount must be greater than 0.";

  return null;
}

function ArrowDownGlyph() {
  return (
    <Image
      src="/assets/dashboard/Import.svg"
      alt=""
      width={20}
      height={20}
      className={styles.arrowGlyph}
      aria-hidden
    />
  );
}

function ArrowUpGlyph() {
  return (
    <Image
      src="/assets/dashboard/Import.svg"
      alt=""
      width={20}
      height={20}
      className={`${styles.arrowGlyph} ${styles.arrowGlyphWithdraw}`}
      aria-hidden
    />
  );
}

export default function WalletCard({ summary }: Props) {
  const router = useRouter();

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isWithdrawPending, startWithdrawTransition] = useTransition();
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [depositInfo, setDepositInfo] = useState<Awaited<ReturnType<typeof getDepositInfo>> | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositMessage, setDepositMessage] = useState<string | null>(null);
  const [isDepositPending, startDepositTransition] = useTransition();
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameInput, setRenameInput] = useState(summary?.displayName ?? "My Wallet");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSuccess, setRenameSuccess] = useState<string | null>(null);
  const [isRenamePending, startRenameTransition] = useTransition();

  const usdcBalance = Number(summary?.usdcBalance ?? 0);
  const safeUsdcBalance = Number.isFinite(usdcBalance) ? usdcBalance : 0;
  const portfolioNotUsdcUsd = summary?.portfolioNotUsdcUsd ?? 0;
  const totalUsd = safeUsdcBalance + portfolioNotUsdcUsd;
  const syntheticDailyDelta = totalUsd > 0 ? Math.max(Math.round(totalUsd * 0.007 * 100) / 100, 0.01) : 0;
  const syntheticDailyPercent = totalUsd > 0 ? (syntheticDailyDelta / totalUsd) * 100 : 0;

  const depositAddress = depositInfo?.address ?? summary?.walletAddress ?? "";
  const isDepositListScrollable = (depositInfo?.deposits?.length ?? 0) >= 4;
  const managedByServer = summary?.managedByServer ?? false;
  const walletDisplayName = summary?.displayName ?? "My Wallet";
  const explorerAddressUrl = useMemo(() => {
    if (depositInfo?.addressUrl) return depositInfo.addressUrl;
    if (!summary?.walletAddress) return null;
    return `${summary.explorerBaseUrl}/address/${summary.walletAddress}`;
  }, [depositInfo?.addressUrl, summary?.explorerBaseUrl, summary?.walletAddress]);

  useEffect(() => {
    setRenameInput(walletDisplayName);
  }, [walletDisplayName]);

  const closePanel = () => {
    setActivePanel(null);
    setCopyStatus(null);
  };

  const onCopyAddress = async () => {
    if (!depositAddress) return;
    try {
      await navigator.clipboard.writeText(depositAddress);
      setCopyStatus("Address copied");
    } catch {
      setCopyStatus("Cannot copy in current browser context");
    }
  };

  const openDeposit = () => {
    setCopyStatus(null);
    setDepositError(null);
    setDepositMessage(null);
    setActivePanel("deposit");

    startDepositTransition(async () => {
      try {
        const info = await getDepositInfo(summary?.walletAddress);
        setDepositInfo(info);
        if (info.status === "error") {
          setDepositError(info.message ?? "Failed to load deposit data");
          setDepositMessage(null);
          return;
        }
        setDepositError(null);
        setDepositMessage(info.message ?? null);
      } catch (e) {
        setDepositError(e instanceof Error ? e.message : "Failed to load deposit data");
      }
    });
  };

  const openWithdraw = () => {
    if (!managedByServer) return;
    setErr(null);
    setTxHash(null);
    setTxUrl(null);
    setActivePanel("withdraw");
  };

  const onWithdraw = () => {
    setErr(null);
    setTxHash(null);
    setTxUrl(null);

    const validationError = validateWithdrawInput({
      to,
      amount,
      senderAddress: summary?.walletAddress ?? "",
    });
    if (validationError) {
      setErr(validationError);
      return;
    }

    startWithdrawTransition(async () => {
      try {
        const res = await withdrawUsdc(to.trim(), amount.trim());
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        setTxHash(res.txHash);
        setTxUrl(res.txUrl);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Withdraw failed");
      }
    });
  };

  const onToggleRename = () => {
    if (!summary?.walletAddress) return;
    setRenameError(null);
    setRenameSuccess(null);
    setRenameInput(walletDisplayName);
    setIsRenameOpen((prev) => !prev);
  };

  const onRenameSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!summary?.walletAddress) return;

    setRenameError(null);
    setRenameSuccess(null);

    startRenameTransition(async () => {
      try {
        const result = await renameWallet(renameInput, summary.walletAddress);
        if (!result.ok) {
          setRenameError(result.error);
          return;
        }

        setRenameSuccess("Wallet name updated.");
        setIsRenameOpen(false);
        setRenameInput(result.displayName);
        router.refresh();
      } catch (e) {
        setRenameError(e instanceof Error ? e.message : "Failed to update wallet name");
      }
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div className={styles.walletMeta}>
          <Image
            src="/assets/dashboard/logo.svg"
            alt="Wallet logo"
            width={52}
            height={52}
            className={styles.logo}
            priority
          />
          <div>
            <div className={styles.titleRow}>
              <div className={styles.title}>{walletDisplayName}</div>
              <button
                type="button"
                className={styles.titleEditButton}
                onClick={onToggleRename}
                title="Rename wallet"
                aria-label="Rename wallet"
                disabled={!summary?.walletAddress}
              >
                <Image
                  src="/assets/dashboard/edit-2.svg"
                  alt=""
                  width={14}
                  height={14}
                  className={styles.titleEditIcon}
                  aria-hidden
                />
              </button>
            </div>
            <div className={styles.joined}>Joined {summary?.joinedAt ?? "—"}</div>
            {isRenameOpen ? (
              <form className={styles.renameForm} onSubmit={onRenameSubmit}>
                <input
                  className={styles.renameInput}
                  value={renameInput}
                  onChange={(event) => setRenameInput(event.target.value)}
                  placeholder="Wallet name"
                  maxLength={32}
                />
                <ButtonMotion
                  className={styles.renameActionButton}
                  disabled={isRenamePending || !renameInput.trim()}
                >
                  {isRenamePending ? "Saving..." : "Save"}
                </ButtonMotion>
                <ButtonMotion
                  type="button"
                  variant="secondary"
                  className={styles.renameActionButton}
                  onClick={() => {
                    setIsRenameOpen(false);
                    setRenameError(null);
                    setRenameInput(walletDisplayName);
                  }}
                  disabled={isRenamePending}
                >
                  Cancel
                </ButtonMotion>
              </form>
            ) : null}
            {renameError ? <div className={styles.renameError}>{renameError}</div> : null}
            {renameSuccess ? <div className={styles.renameSuccess}>{renameSuccess}</div> : null}
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statsLeft}>
            <div className={styles.statLabel}>
              Portfolio (Not USDC) {summary?.trackedTokenSymbol ? `• ${summary.trackedTokenSymbol}` : ""}
            </div>
            <div className={styles.statValue}>{formatUsd(portfolioNotUsdcUsd)}</div>
          </div>
          <div className={styles.statsRight}>
            <div className={styles.statLabel}>USDC + Portfolio</div>
            <div className={styles.totalValue}>
              <Image
                src="/assets/dashboard/money.svg"
                alt="Money icon"
                width={20}
                height={16}
                className={styles.moneyIcon}
              />
              <span>{formatUsd(totalUsd)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.balanceSection}>
        {summary ? (
          <div className={styles.balanceRow}>
            <NumberFlow
              value={safeUsdcBalance}
              locales="de-DE"
              format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
              className={styles.usdcNumber}
            />
            <span className={styles.usdcUnit}>USDC</span>
          </div>
        ) : (
          <div className={styles.balanceFallback}>— USDC</div>
        )}
        <div className={styles.deltaRow}>
          <span>{`+$${syntheticDailyDelta.toFixed(2)}`}</span>
          <span className={styles.deltaPercent}>{`▲ ${syntheticDailyPercent.toFixed(1)}%`}</span>
          <span className={styles.deltaToday}>Today</span>
        </div>
      </div>

      <div className={styles.actionsWrap}>
        <div className={styles.actionsGrid}>
          <ButtonMotion onClick={openDeposit} className={styles.actionButton}>
            <ArrowDownGlyph />
            Deposit
          </ButtonMotion>
          <ButtonMotion
            variant="secondary"
            onClick={openWithdraw}
            disabled={!managedByServer}
            className={styles.actionButton}
            title={
              managedByServer
                ? "Withdraw USDC"
                : "Withdraw is enabled only for WALLET_ADDRESS from .env.local"
            }
          >
            <ArrowUpGlyph />
            Withdraw
          </ButtonMotion>
        </div>
      </div>

      <AnimatePresence>
        {activePanel ? (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePanel}
          >
            <motion.div
              className={styles.modal}
              initial={{ y: 12, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 10, scale: 0.98, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 24, mass: 0.7 }}
              onClick={(event) => event.stopPropagation()}
            >
              {activePanel === "deposit" ? (
                <div>
                  <div className={styles.modalTitle}>Deposit Address</div>
                  <p className={styles.modalDescription}>Send USDC to this address.</p>

                  <div className={styles.addressBox}>{depositAddress || "Wallet unavailable"}</div>

                  <div className={styles.modalActions}>
                    <ButtonMotion variant="secondary" className={styles.modalButton} onClick={onCopyAddress}>
                      Copy
                    </ButtonMotion>
                    {explorerAddressUrl ? (
                      <a className={styles.etherscanLink} href={explorerAddressUrl} target="_blank" rel="noreferrer">
                        View on Etherscan
                      </a>
                    ) : null}
                    <ButtonMotion variant="secondary" className={styles.modalCloseButton} onClick={closePanel}>
                      Close
                    </ButtonMotion>
                  </div>

                  {isDepositPending ? <div className={styles.depositLoading}>Loading deposits...</div> : null}
                  {copyStatus ? <div className={styles.copyStatus}>{copyStatus}</div> : null}
                  {depositError ? <div className={styles.errorAlert}>{depositError}</div> : null}
                  {!depositError && depositMessage ? (
                    <div className={styles.depositMessage}>{depositMessage}</div>
                  ) : null}

                  {depositInfo?.deposits?.length ? (
                    <div className={styles.depositHistory}>
                      <div className={styles.depositHistoryTitle}>Recent deposits</div>
                      <div
                        className={[
                          styles.depositList,
                          isDepositListScrollable ? styles.depositListScrollable : "",
                        ].join(" ")}
                      >
                        {depositInfo.deposits.map((item) => (
                          <a
                            key={item.txHash}
                            className={styles.depositItem}
                            href={item.txUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className={styles.depositItemPrimary}>
                              +{item.amount} {item.symbol}
                            </span>
                            <span className={styles.depositItemMeta}>
                              {formatDateTime(item.timestamp)} from {item.fromShort}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  <div className={styles.modalTitle}>Withdraw USDC</div>
                  {!managedByServer ? (
                    <div className={styles.depositMessage}>
                      Withdraw is available only for the wallet from <code>.env.local</code>.
                    </div>
                  ) : null}
                  <div className={styles.withdrawPanel}>
                    <input
                      className={styles.input}
                      placeholder="Recipient address (0x...)"
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                    />
                    <input
                      className={styles.input}
                      placeholder="Amount (e.g. 10.5)"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                    <div className={styles.withdrawActions}>
                      <ButtonMotion
                        onClick={onWithdraw}
                        disabled={!managedByServer || isWithdrawPending || !to.trim() || !amount.trim()}
                        className={styles.modalButton}
                      >
                        {isWithdrawPending ? "Sending..." : "Confirm Withdraw"}
                      </ButtonMotion>
                      <ButtonMotion
                        variant="secondary"
                        className={styles.modalButton}
                        onClick={() => {
                          setTo("");
                          setAmount("");
                          setErr(null);
                          setTxHash(null);
                          setTxUrl(null);
                        }}
                      >
                        Clear
                      </ButtonMotion>
                      <ButtonMotion variant="secondary" className={styles.modalCloseButton} onClick={closePanel}>
                        Close
                      </ButtonMotion>
                    </div>

                    {err ? <div className={styles.errorAlert}>{err}</div> : null}
                    {txHash ? (
                      <div className={styles.successAlert}>
                        Sent:{" "}
                        <a
                          className={styles.txLink}
                          href={txUrl ?? `${summary?.explorerBaseUrl ?? "https://etherscan.io"}/tx/${txHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {txHash.slice(0, 10)}…{txHash.slice(-8)}
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
