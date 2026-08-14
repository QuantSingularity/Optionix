import { useState } from "react";
import { FiArrowRight, FiBriefcase, FiLink, FiRefreshCw } from "react-icons/fi";
import tradingService from "../../services/tradingService";
import { extractErrorMessage } from "../../services/apiClient";
import { generateEthereumAddress } from "../../utils/format";
import { useWallet } from "../../utils/WalletContext";
import {
  Alert,
  Button,
  Card,
  ErrorText,
  Field,
  HelpText,
  Input,
  Label,
  Select,
} from "./UI";

const CreateAccountPrompt = ({ onCreated }) => {
  const {
    address: connectedAddress,
    isConnected,
    isConnecting,
    connect,
  } = useWallet();
  const [address, setAddress] = useState(generateEthereumAddress());
  const [accountType, setAccountType] = useState("demo");
  const [initialDeposit, setInitialDeposit] = useState("100000");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUseWallet = async () => {
    const connected = isConnected ? connectedAddress : await connect();
    if (connected) setAddress(connected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const account = await tradingService.createAccount({
        ethereumAddress: address,
        accountType,
        initialDeposit: initialDeposit ? Number(initialDeposit) : undefined,
      });
      onCreated?.(account);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't create the account."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card style={{ maxWidth: 560, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "rgba(198, 161, 91,.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary)",
            fontSize: 19,
            flexShrink: 0,
          }}
        >
          <FiBriefcase />
        </div>
        <div>
          <h3
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: 17,
              fontWeight: 700,
            }}
          >
            Open your trading account
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginTop: 2,
            }}
          >
            One quick step before you can trade, size positions, or run risk
            reports.
          </p>
        </div>
      </div>

      {error && (
        <Alert $tone="danger" style={{ marginTop: 16 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
        <Field>
          <Label htmlFor="accountType">Account type</Label>
          <Select
            id="accountType"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
          >
            <option value="demo">Demo (paper trading)</option>
            <option value="standard">Standard</option>
            <option value="margin">Margin</option>
          </Select>
        </Field>

        <Field>
          <Label htmlFor="initialDeposit">Initial deposit (USD)</Label>
          <Input
            id="initialDeposit"
            type="number"
            min="0"
            step="100"
            value={initialDeposit}
            onChange={(e) => setInitialDeposit(e.target.value)}
          />
        </Field>

        <Field>
          <Label htmlFor="ethAddress">Wallet address</Label>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              id="ethAddress"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ fontFamily: "'DM Mono', monospace", fontSize: 12.5 }}
            />
            <Button
              type="button"
              $variant="ghost"
              $sm
              onClick={handleUseWallet}
              disabled={isConnecting}
              title="Use your connected wallet address"
            >
              <FiLink /> {isConnecting ? "…" : "Use Wallet"}
            </Button>
            <Button
              type="button"
              $variant="ghost"
              $sm
              onClick={() => setAddress(generateEthereumAddress())}
              title="Generate a new address"
            >
              <FiRefreshCw />
            </Button>
          </div>
          <HelpText>
            Auto-generated for demo accounts. Connect a real wallet or type your
            own address if you have one.
          </HelpText>
        </Field>

        <Button
          type="submit"
          disabled={isSubmitting}
          style={{ width: "100%", marginTop: 6 }}
        >
          {isSubmitting ? "Opening account…" : "Open Account"}
          {!isSubmitting && <FiArrowRight />}
        </Button>
      </form>
    </Card>
  );
};

export default CreateAccountPrompt;
