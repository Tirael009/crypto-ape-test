import WalletCard from "@/components/wallet/WalletCard";
import ProfitLossCard from "@/components/wallet/ProfitLossCard";
import { getPnLSeries, getWalletSummary } from "@/actions/wallet.actions";
import styles from "./page.module.scss";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

function getPublicKeyParam(searchParams: SearchParams): string | undefined {
  const raw = searchParams.publicKey;
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export default async function Home({ searchParams }: PageProps) {
  const resolvedSearchParams = (searchParams ? await searchParams : {}) as SearchParams;
  const publicKey = getPublicKeyParam(resolvedSearchParams);

  let summary: Awaited<ReturnType<typeof getWalletSummary>> | null = null;
  let pnl: Awaited<ReturnType<typeof getPnLSeries>> | null = null;
  let error: string | null = null;

  try {
    summary = await getWalletSummary(publicKey);
    pnl = await getPnLSeries("6H", publicKey);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {error ? (
          <div className={styles.errorBox}>
            <div className={styles.errorTitle}>Config / runtime error</div>
            <div className={styles.errorMessage}>{error}</div>
            <div className={styles.errorHint}>
              Проверь <span className={styles.errorCode}>.env.local</span> (RPC_URL, WALLET_ADDRESS,
              WALLET_PRIVATE_KEY, USDC_ADDRESS, TRACKED_TOKEN_ADDRESS, TRACKED_TOKEN_DECIMALS,
              TRACKED_TOKEN_PRICE_USD, ETHERSCAN_API_KEY, ETHERSCAN_API_URL,
              ETHERSCAN_BASE_URL, CHAIN_ID) и валидность query-параметра{" "}
              <span className={styles.errorCode}>?publicKey=0x...</span>.
            </div>
          </div>
        ) : null}

        <div className={styles.cardsGrid}>
          <WalletCard summary={summary} />
          <ProfitLossCard initial={pnl} walletAddress={summary?.walletAddress ?? publicKey} />
        </div>
      </div>
    </main>
  );
}
