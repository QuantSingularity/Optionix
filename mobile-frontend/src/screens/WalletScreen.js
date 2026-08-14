import { useCallback, useEffect, useState } from "react";
import {
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ActivityIndicator, Button, TextInput } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import QRCode from "react-native-qrcode-svg";
import {
  AlertBanner,
  Badge,
  CardHeaderRow,
  CardMeta,
  CardTitle,
  Divider,
  EmptyState,
  Grid2,
  Screen,
  SectionCard,
  StatLabel,
  StatValue,
} from "../components/UI";
import blockchainService from "../services/blockchainService";
import { extractErrorMessage } from "../services/api";
import { useWallet } from "../context/WalletContext";
import colors from "../theme";
import { formatNumber, shortenAddress } from "../utils/format";

const RISK_TONE = {
  very_low: "success",
  low: "success",
  medium: "warning",
  high: "danger",
  none: "neutral",
};

const WalletScreen = () => {
  const {
    address,
    isConnected,
    isConfigured,
    isInitializing,
    isConnecting,
    pairingUri,
    error: walletError,
    connect,
    disconnect,
    sendTransaction,
  } = useWallet();

  const [status, setStatus] = useState(null);
  const [balance, setBalance] = useState(null);
  const [positions, setPositions] = useState(null);
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [marginMode, setMarginMode] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txMessage, setTxMessage] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await blockchainService.getStatus());
    } catch {
      // Informational only.
    }
  }, []);

  const loadWalletData = useCallback(async () => {
    if (!address) return;
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
    }
  }, [address]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadWalletData();
      setIsLoading(false);
    })();
  }, [loadWalletData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWalletData();
    setRefreshing(false);
  };

  const pollTransaction = useCallback(async (hash) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const result = await blockchainService.getTransactionStatus(hash);
        if (result.status === "success") {
          setTxMessage({ tone: "success", text: "Transaction confirmed." });
          return true;
        }
        if (result.status === "failed" || result.status === "error") {
          setTxMessage({
            tone: "danger",
            text: result.error || "Transaction failed on-chain.",
          });
          return false;
        }
      } catch {
        // Keep polling.
      }
    }
    setTxMessage({ tone: "warning", text: "Timed out waiting to confirm." });
    return false;
  }, []);

  const handleMarginSubmit = async () => {
    if (!isConnected) {
      await connect();
      return;
    }
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;

    setIsSubmitting(true);
    setTxMessage(null);
    try {
      const unsignedTx =
        marginMode === "deposit"
          ? await blockchainService.prepareDepositMargin({
              userAddress: address,
              amount: numericAmount,
            })
          : await blockchainService.prepareWithdrawMargin({
              userAddress: address,
              amount: numericAmount,
            });

      const hash = await sendTransaction(unsignedTx);
      setAmount("");
      setTxMessage({ tone: "info", text: "Waiting for confirmation…" });
      const confirmed = await pollTransaction(hash);
      if (confirmed) await loadWalletData();
    } catch (err) {
      setTxMessage({
        tone: "danger",
        text: extractErrorMessage(err, "Transaction couldn't be prepared."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExercise = async (optionId) => {
    setIsSubmitting(true);
    setTxMessage(null);
    try {
      const unsignedTx = await blockchainService.prepareExerciseOption({
        walletAddress: address,
        optionId,
      });
      const hash = await sendTransaction(unsignedTx);
      setTxMessage({ tone: "info", text: "Waiting for confirmation…" });
      const confirmed = await pollTransaction(hash);
      if (confirmed) await loadWalletData();
    } catch (err) {
      setTxMessage({
        tone: "danger",
        text: extractErrorMessage(err, "Exercise transaction failed."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const contractsConfigured =
    status?.futures_contract_configured || status?.options_contract_configured;

  if (isInitializing) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {!isConfigured && (
        <AlertBanner tone="warning">
          Wallet connection isn&apos;t configured for this build - set
          WALLETCONNECT_PROJECT_ID in .env (get a free one at cloud.reown.com).
        </AlertBanner>
      )}
      {isConfigured && status && !contractsConfigured && (
        <AlertBanner tone="warning">
          The backend isn&apos;t pointed at a deployed contract yet, so on-chain
          data won&apos;t load in this environment.
        </AlertBanner>
      )}
      {walletError ? (
        <AlertBanner tone="danger">{walletError}</AlertBanner>
      ) : null}
      {loadError ? <AlertBanner tone="danger">{loadError}</AlertBanner> : null}
      {txMessage ? (
        <AlertBanner tone={txMessage.tone}>{txMessage.text}</AlertBanner>
      ) : null}

      {!isConnected ? (
        <SectionCard>
          <EmptyState
            icon={
              <MaterialCommunityIcons
                name="link-variant"
                size={26}
                color={colors.borderAccent}
              />
            }
            title="No wallet connected"
            description="Connect a wallet to view your on-chain balance, positions, and options."
          />
          <Button
            mode="contained"
            onPress={connect}
            loading={isConnecting}
            disabled={isConnecting || !isConfigured}
            style={{ marginTop: 8, borderRadius: 10 }}
          >
            Connect Wallet
          </Button>

          {pairingUri && (
            <View style={styles.qrWrap}>
              <Text style={styles.qrHelp}>
                Scan with a wallet app on another device, or tap below if you
                have one installed on this device.
              </Text>
              <View style={styles.qrBox}>
                <QRCode value={pairingUri} size={200} />
              </View>
              <Button
                mode="outlined"
                onPress={() => Linking.openURL(pairingUri)}
                style={{ marginTop: 12 }}
              >
                Open in wallet app
              </Button>
            </View>
          )}
        </SectionCard>
      ) : isLoading && !balance ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <>
          <SectionCard>
            <CardHeaderRow>
              <CardTitle>{shortenAddress(address)}</CardTitle>
              <Badge tone="success">Connected</Badge>
            </CardHeaderRow>
            <Grid2>
              <View style={{ width: "50%", padding: 6 }}>
                <StatLabel>Wallet Balance</StatLabel>
                <StatValue style={{ fontSize: 16 }}>
                  {balance
                    ? `${formatNumber(balance.balance_eth, { decimals: 4 })} ETH`
                    : "-"}
                </StatValue>
              </View>
              <View style={{ width: "50%", padding: 6 }}>
                <StatLabel>Liquidation Risk</StatLabel>
                {positions ? (
                  <Badge
                    tone={RISK_TONE[positions.liquidation_risk] || "neutral"}
                  >
                    {positions.liquidation_risk.replace("_", " ")}
                  </Badge>
                ) : (
                  <StatValue style={{ fontSize: 16 }}>-</StatValue>
                )}
              </View>
            </Grid2>
            <Button mode="text" onPress={disconnect} style={{ marginTop: 4 }}>
              Disconnect
            </Button>
          </SectionCard>

          <SectionCard>
            <CardHeaderRow>
              <CardTitle>Manage Margin</CardTitle>
            </CardHeaderRow>
            <View style={styles.segmented}>
              <Button
                mode={marginMode === "deposit" ? "contained" : "outlined"}
                onPress={() => setMarginMode("deposit")}
                style={styles.segmentBtn}
                compact
              >
                Deposit
              </Button>
              <Button
                mode={marginMode === "withdraw" ? "contained" : "outlined"}
                onPress={() => setMarginMode("withdraw")}
                style={styles.segmentBtn}
                compact
              >
                Withdraw
              </Button>
            </View>
            <TextInput
              mode="outlined"
              label="Amount (ETH)"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              style={{ backgroundColor: colors.surfaceElevated, marginTop: 12 }}
            />
            <Button
              mode="contained"
              onPress={handleMarginSubmit}
              loading={isSubmitting}
              disabled={isSubmitting || !amount}
              style={{ marginTop: 12, borderRadius: 10 }}
            >
              {marginMode === "deposit" ? "Deposit Margin" : "Withdraw Margin"}
            </Button>
          </SectionCard>

          <SectionCard>
            <CardHeaderRow>
              <CardTitle>On-Chain Positions</CardTitle>
              <CardMeta>{positions?.positions?.length || 0} open</CardMeta>
            </CardHeaderRow>
            {positions?.positions?.length > 0 ? (
              positions.positions.map((p, i) => (
                <View key={p.position_id}>
                  {i > 0 && <Divider />}
                  <View style={styles.posRow}>
                    <View>
                      <Text style={styles.posTitle}>
                        #{p.position_id} · {p.leverage}x
                      </Text>
                      <Text style={styles.posSub}>
                        Entry {formatNumber(p.entry_price, { decimals: 2 })} ·
                        Margin {formatNumber(p.margin, { decimals: 4 })} ETH
                      </Text>
                    </View>
                    <Badge
                      tone={p.position_type === "long" ? "success" : "danger"}
                    >
                      {p.position_type}
                    </Badge>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                icon={
                  <MaterialCommunityIcons
                    name="chart-line-variant"
                    size={26}
                    color={colors.borderAccent}
                  />
                }
                title="No open positions"
              />
            )}
          </SectionCard>

          <SectionCard>
            <CardHeaderRow>
              <CardTitle>On-Chain Options</CardTitle>
              <CardMeta>{options.length} total</CardMeta>
            </CardHeaderRow>
            {options.length > 0 ? (
              options.map((o, i) => {
                const isHolder =
                  o.holder?.toLowerCase() === address?.toLowerCase();
                const canExercise = isHolder && o.status === "active";
                return (
                  <View key={o.option_id}>
                    {i > 0 && <Divider />}
                    <View style={styles.posRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.posTitle}>
                          #{o.option_id} · {o.option_type} ({o.option_style})
                        </Text>
                        <Text style={styles.posSub}>
                          Strike {formatNumber(o.strike_price, { decimals: 2 })}{" "}
                          · Premium {formatNumber(o.premium, { decimals: 4 })}{" "}
                          ETH · {isHolder ? "Holder" : "Writer"}
                        </Text>
                      </View>
                      {canExercise ? (
                        <Button
                          mode="contained"
                          compact
                          disabled={isSubmitting}
                          onPress={() => handleExercise(o.option_id)}
                        >
                          Exercise
                        </Button>
                      ) : (
                        <Badge
                          tone={
                            o.status === "exercised" ? "success" : "neutral"
                          }
                        >
                          {o.status}
                        </Badge>
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <EmptyState
                icon={
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={26}
                    color={colors.borderAccent}
                  />
                }
                title="No on-chain options yet"
              />
            )}
          </SectionCard>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  segmented: { flexDirection: "row", gap: 8 },
  segmentBtn: { flex: 1, borderRadius: 10 },
  qrWrap: { alignItems: "center", marginTop: 16 },
  qrHelp: {
    color: colors.textSecondary,
    fontSize: 12.5,
    textAlign: "center",
    marginBottom: 14,
  },
  qrBox: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
  },
  posRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  posTitle: { color: colors.textPrimary, fontSize: 13.5, fontWeight: "700" },
  posSub: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
});

export default WalletScreen;
