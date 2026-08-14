import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiCheckCircle,
  FiCreditCard,
  FiExternalLink,
  FiLink,
  FiLoader,
  FiXCircle,
} from "react-icons/fi";
import blockchainService from "../services/blockchainService";
import { extractErrorMessage } from "../services/apiClient";
import { useWallet } from "../utils/WalletContext";
import { formatNumber, shortenAddress } from "../utils/format";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CardMeta,
  CardTitle,
  CenteredSpinner,
  EmptyState,
  Field,
  Grid,
  HelpText,
  Input,
  Label,
  PageHeader,
  PageSubtitle,
  PageTitle,
  PageWrap,
  Segmented,
  SegmentedBtn,
  StatCard,
  StatLabel,
  StatValue,
  Table,
  TableScroll,
} from "../components/common/UI";

const POSITION_RISK_TONE = {
  very_low: "success",
  low: "success",
  medium: "warning",
  high: "danger",
  none: "neutral",
};

function TxStatusBanner({ tx }) {
  if (!tx) return null;
  if (tx.state === "pending") {
    return (
      <Alert $tone="info">
        <FiLoader /> Waiting for confirmation… ({shortenAddress(tx.hash, 6)})
      </Alert>
    );
  }
  if (tx.state === "success") {
    return (
      <Alert $tone="success">
        <FiCheckCircle /> Transaction confirmed ({shortenAddress(tx.hash, 6)})
      </Alert>
    );
  }
  if (tx.state === "error") {
    return (
      <Alert $tone="danger">
        <FiXCircle /> {tx.message || "Transaction failed."}
      </Alert>
    );
  }
  return null;
}

const Wallet = () => {
  const {
    address,
    chainId,
    isConnected,
    isWalletAvailable,
    isConnecting,
    error: walletError,
    connect,
    sendTransaction,
  } = useWallet();

  const [status, setStatus] = useState(null);
  const [balance, setBalance] = useState(null);
  const [positions, setPositions] = useState(null);
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [marginTab, setMarginTab] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tx, setTx] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await blockchainService.getStatus());
    } catch (err) {
      // Status is informational only - don't block the rest of the page.
    }
  }, []);

  const loadWalletData = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setLoadError("");
    try {
      const [bal, pos, opts] = await Promise.all([
        blockchainService.getWalletBalance(address),
        blockchainService.getWalletPositions(address),
        blockchainService.getWalletOptions(address),
      ]);
      setBalance(bal);
      setPositions(pos);
      setOptions(opts);
    } catch (err) {
      setLoadError(
        extractErrorMessage(err, "Couldn't load on-chain wallet data."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  const pollTransaction = useCallback(async (hash) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const result = await blockchainService.getTransactionStatus(hash);
        if (result.status === "success") {
          setTx({ hash, state: "success" });
          return true;
        }
        if (result.status === "failed" || result.status === "error") {
          setTx({
            hash,
            state: "error",
            message: result.error || "Transaction failed on-chain.",
          });
          return false;
        }
      } catch (err) {
        // Keep polling - a transient lookup failure isn't a final state.
      }
    }
    setTx({ hash, state: "error", message: "Timed out waiting to confirm." });
    return false;
  }, []);

  const handleMarginSubmit = async (e) => {
    e.preventDefault();
    if (!isConnected) {
      await connect();
      return;
    }
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;

    setIsSubmitting(true);
    setTx(null);
    try {
      const unsignedTx =
        marginTab === "deposit"
          ? await blockchainService.prepareDepositMargin({
              userAddress: address,
              amount: numericAmount,
            })
          : await blockchainService.prepareWithdrawMargin({
              userAddress: address,
              amount: numericAmount,
            });

      const hash = await sendTransaction(unsignedTx);
      setTx({ hash, state: "pending" });
      setAmount("");
      const confirmed = await pollTransaction(hash);
      if (confirmed) await loadWalletData();
    } catch (err) {
      setTx({
        hash: null,
        state: "error",
        message: extractErrorMessage(err, "Transaction couldn't be prepared."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExercise = async (optionId) => {
    setIsSubmitting(true);
    setTx(null);
    try {
      const unsignedTx = await blockchainService.prepareExerciseOption({
        walletAddress: address,
        optionId,
      });
      const hash = await sendTransaction(unsignedTx);
      setTx({ hash, state: "pending" });
      const confirmed = await pollTransaction(hash);
      if (confirmed) await loadWalletData();
    } catch (err) {
      setTx({
        hash: null,
        state: "error",
        message: extractErrorMessage(err, "Exercise transaction failed."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const contractsConfigured =
    status?.futures_contract_configured || status?.options_contract_configured;

  return (
    <PageWrap>
      <PageHeader>
        <div>
          <PageTitle>Wallet</PageTitle>
          <PageSubtitle>
            Connect a wallet to deposit or withdraw on-chain margin, and to
            manage futures positions and options written directly on the
            Optionix smart contracts.
          </PageSubtitle>
        </div>
        {isConnected ? (
          <Badge $tone="success">
            <FiLink /> {shortenAddress(address)}
            {chainId ? ` · chain ${chainId}` : ""}
          </Badge>
        ) : (
          <Button onClick={connect} disabled={isConnecting}>
            <FiLink /> {isConnecting ? "Connecting…" : "Connect Wallet"}
          </Button>
        )}
      </PageHeader>

      {!isWalletAvailable && (
        <Alert $tone="warning">
          No browser wallet detected. Install{" "}
          <a
            href="https://metamask.io/"
            target="_blank"
            rel="noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            MetaMask
          </a>{" "}
          or another injected wallet to connect.
        </Alert>
      )}

      {isWalletAvailable && status && !contractsConfigured && (
        <Alert $tone="warning">
          The backend isn't pointed at a deployed futures or options contract
          yet, so on-chain reads and transactions won't work in this
          environment. This page will work once contract addresses are
          configured.
        </Alert>
      )}

      {walletError && <Alert $tone="danger">{walletError}</Alert>}
      {loadError && <Alert $tone="danger">{loadError}</Alert>}
      <TxStatusBanner tx={tx} />

      {!isConnected ? (
        <Card>
          <EmptyState>
            <FiLink />
            <h4>No wallet connected</h4>
            <p>
              Connect your wallet to view your on-chain balance, futures
              positions, and options.
            </p>
          </EmptyState>
        </Card>
      ) : isLoading && !balance ? (
        <CenteredSpinner $minHeight="40vh" />
      ) : (
        <>
          <Grid $cols={3} style={{ marginBottom: 20 }}>
            <StatCard>
              <StatLabel>
                <FiCreditCard /> Wallet Balance
              </StatLabel>
              <StatValue>
                {balance
                  ? `${formatNumber(balance.balance_eth, { decimals: 4 })} ETH`
                  : "-"}
              </StatValue>
            </StatCard>
            <StatCard>
              <StatLabel>Margin In Use (on-chain)</StatLabel>
              <StatValue>
                {positions
                  ? `${formatNumber(positions.total_margin_used, { decimals: 4 })} ETH`
                  : "-"}
              </StatValue>
            </StatCard>
            <StatCard>
              <StatLabel>Liquidation Risk</StatLabel>
              <StatValue style={{ fontSize: 18 }}>
                {positions ? (
                  <Badge
                    $tone={
                      POSITION_RISK_TONE[positions.liquidation_risk] ||
                      "neutral"
                    }
                  >
                    {positions.liquidation_risk.replace("_", " ")}
                  </Badge>
                ) : (
                  "-"
                )}
              </StatValue>
            </StatCard>
          </Grid>

          <Grid $cols={3} style={{ marginBottom: 20, alignItems: "start" }}>
            <Card style={{ gridColumn: "span 2" }}>
              <CardHeader>
                <CardTitle>
                  <FiActivity /> On-Chain Futures Positions
                </CardTitle>
                <CardMeta>{positions?.positions?.length || 0} open</CardMeta>
              </CardHeader>
              {positions?.positions?.length > 0 ? (
                <TableScroll>
                  <Table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Side</th>
                        <th>Size</th>
                        <th>Entry</th>
                        <th>Margin</th>
                        <th>Leverage</th>
                        <th>Est. Liq. Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.positions.map((p) => (
                        <tr key={p.position_id}>
                          <td>#{p.position_id}</td>
                          <td>
                            <Badge
                              $tone={
                                p.position_type === "long"
                                  ? "success"
                                  : "danger"
                              }
                            >
                              {p.position_type}
                            </Badge>
                          </td>
                          <td>{formatNumber(p.size, { decimals: 4 })}</td>
                          <td>
                            {formatNumber(p.entry_price, { decimals: 2 })}
                          </td>
                          <td>{formatNumber(p.margin, { decimals: 4 })}</td>
                          <td>{p.leverage}x</td>
                          <td>
                            {formatNumber(p.liquidation_price, {
                              decimals: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableScroll>
              ) : (
                <EmptyState>
                  <FiActivity />
                  <h4>No open on-chain positions</h4>
                  <p>Positions opened on the futures contract appear here.</p>
                </EmptyState>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {marginTab === "deposit" ? (
                    <FiArrowDownCircle />
                  ) : (
                    <FiArrowUpCircle />
                  )}{" "}
                  Manage Margin
                </CardTitle>
              </CardHeader>
              <Segmented style={{ marginBottom: 16 }}>
                <SegmentedBtn
                  type="button"
                  $active={marginTab === "deposit"}
                  onClick={() => setMarginTab("deposit")}
                >
                  Deposit
                </SegmentedBtn>
                <SegmentedBtn
                  type="button"
                  $active={marginTab === "withdraw"}
                  onClick={() => setMarginTab("withdraw")}
                >
                  Withdraw
                </SegmentedBtn>
              </Segmented>
              <form onSubmit={handleMarginSubmit}>
                <Field>
                  <Label htmlFor="margin-amount">Amount (ETH)</Label>
                  <Input
                    id="margin-amount"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <HelpText>
                    {marginTab === "deposit"
                      ? "Sent from your wallet directly into the futures contract."
                      : "Withdrawn from your available on-chain margin back to your wallet."}
                  </HelpText>
                </Field>
                <Button
                  type="submit"
                  disabled={isSubmitting || !amount}
                  style={{ width: "100%" }}
                >
                  {isSubmitting
                    ? "Confirm in wallet…"
                    : marginTab === "deposit"
                      ? "Deposit Margin"
                      : "Withdraw Margin"}
                </Button>
              </form>
            </Card>
          </Grid>

          <Card>
            <CardHeader>
              <CardTitle>On-Chain Options</CardTitle>
              <CardMeta>{options.length} total</CardMeta>
            </CardHeader>
            {options.length > 0 ? (
              <TableScroll>
                <Table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Style</th>
                      <th>Strike</th>
                      <th>Premium</th>
                      <th>Expires</th>
                      <th>Status</th>
                      <th>Role</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {options.map((o) => {
                      const isHolder =
                        o.holder?.toLowerCase() === address?.toLowerCase();
                      const canExercise = isHolder && o.status === "active";
                      return (
                        <tr key={o.option_id}>
                          <td>#{o.option_id}</td>
                          <td>{o.option_type}</td>
                          <td>{o.option_style}</td>
                          <td>
                            {formatNumber(o.strike_price, { decimals: 2 })}
                          </td>
                          <td>{formatNumber(o.premium, { decimals: 4 })}</td>
                          <td>
                            {new Date(
                              o.expiration_time * 1000,
                            ).toLocaleDateString()}
                          </td>
                          <td>
                            <Badge
                              $tone={
                                o.status === "active"
                                  ? "info"
                                  : o.status === "exercised"
                                    ? "success"
                                    : "neutral"
                              }
                            >
                              {o.status}
                            </Badge>
                          </td>
                          <td>{isHolder ? "Holder" : "Writer"}</td>
                          <td>
                            {canExercise && (
                              <Button
                                $sm
                                $variant="gold"
                                disabled={isSubmitting}
                                onClick={() => handleExercise(o.option_id)}
                              >
                                Exercise
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableScroll>
            ) : (
              <EmptyState>
                <FiExternalLink />
                <h4>No on-chain options yet</h4>
                <p>Options this wallet has written or purchased appear here.</p>
              </EmptyState>
            )}
          </Card>
        </>
      )}
    </PageWrap>
  );
};

export default Wallet;
