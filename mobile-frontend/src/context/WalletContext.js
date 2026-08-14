import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Linking } from "react-native";
import { SignClient } from "@walletconnect/sign-client";

let projectId = "";
try {
  // eslint-disable-next-line global-require
  const env = require("@env");
  if (env?.WALLETCONNECT_PROJECT_ID) projectId = env.WALLETCONNECT_PROJECT_ID;
} catch {
  // @env not configured - connect() will surface a clear error below.
}

// eip155:1 = Ethereum mainnet. Extend this list if you support more chains;
// it only controls which namespaces are proposed during pairing.
const CHAIN_ID = 1;
const NAMESPACE = `eip155:${CHAIN_ID}`;

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const clientRef = useRef(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [session, setSession] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [pairingUri, setPairingUri] = useState(null);
  const [error, setError] = useState("");

  const address =
    session?.namespaces?.eip155?.accounts?.[0]?.split(":")[2] || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!projectId) {
        setIsInitializing(false);
        return;
      }
      try {
        const client = await SignClient.init({
          projectId,
          metadata: {
            name: "Optionix",
            description: "Optionix derivatives trading platform",
            url: "https://optionix.example",
            icons: [],
          },
        });
        if (cancelled) return;
        clientRef.current = client;

        const existing = client.session
          .getAll()
          .find((s) => s.namespaces?.eip155);
        if (existing) setSession(existing);

        client.on("session_delete", () => setSession(null));
        client.on("session_expire", () => setSession(null));
      } catch (err) {
        setError(err?.message || "Couldn't initialize wallet connection.");
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setError("");
    if (!projectId) {
      setError(
        "Wallet connection isn't configured - set WALLETCONNECT_PROJECT_ID in .env.",
      );
      return null;
    }
    const client = clientRef.current;
    if (!client) {
      setError("Wallet client isn't ready yet - try again in a moment.");
      return null;
    }

    setIsConnecting(true);
    try {
      const { uri, approval } = await client.connect({
        requiredNamespaces: {
          eip155: {
            methods: [
              "eth_sendTransaction",
              "eth_signTransaction",
              "personal_sign",
            ],
            chains: [NAMESPACE],
            events: ["accountsChanged", "chainChanged"],
          },
        },
      });

      if (uri) {
        setPairingUri(uri);
        // Hand off directly to a wallet app on this device if one is
        // installed and registered for the wc: scheme. If none is, the
        // caller can still show `pairingUri` as a QR code for a wallet on
        // another device to scan.
        Linking.openURL(uri).catch(() => {
          // No wallet app registered the wc: scheme - QR fallback still works.
        });
      }

      const newSession = await approval();
      setSession(newSession);
      setPairingUri(null);
      return (
        newSession.namespaces?.eip155?.accounts?.[0]?.split(":")[2] || null
      );
    } catch (err) {
      setError(err?.message || "Couldn't connect to your wallet.");
      setPairingUri(null);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const client = clientRef.current;
    if (client && session) {
      try {
        await client.disconnect({
          topic: session.topic,
          reason: { code: 6000, message: "User disconnected" },
        });
      } catch {
        // Session may already be gone server-side - clear local state anyway.
      }
    }
    setSession(null);
  }, [session]);

  /**
   * Sign and send a transaction prepared by the backend
   * (see services/blockchainService.js `prepare*Tx` calls). Returns the
   * transaction hash once the wallet submits it.
   */
  const sendTransaction = useCallback(
    async (unsignedTx) => {
      const client = clientRef.current;
      if (!client || !session) throw new Error("No wallet connected.");

      const { from, ...rest } = unsignedTx;
      // WalletConnect's eth_sendTransaction expects numeric fields as hex
      // strings; the backend returns them as decimal numbers via web3.py.
      const toHex = (v) =>
        v === undefined || v === null
          ? undefined
          : "0x" + BigInt(v).toString(16);

      const txParam = {
        from,
        to: rest.to,
        data: rest.data,
        value: toHex(rest.value) || "0x0",
        gas: toHex(rest.gas),
        gasPrice: toHex(rest.gasPrice),
        nonce: toHex(rest.nonce),
      };
      Object.keys(txParam).forEach(
        (k) => txParam[k] === undefined && delete txParam[k],
      );

      const result = await client.request({
        topic: session.topic,
        chainId: NAMESPACE,
        request: {
          method: "eth_sendTransaction",
          params: [txParam],
        },
      });
      return result; // tx hash
    },
    [session],
  );

  const value = useMemo(
    () => ({
      address,
      isConnected: !!session,
      isConfigured: !!projectId,
      isInitializing,
      isConnecting,
      pairingUri,
      error,
      setError,
      connect,
      disconnect,
      sendTransaction,
    }),
    [
      address,
      session,
      isInitializing,
      isConnecting,
      pairingUri,
      error,
      connect,
      disconnect,
      sendTransaction,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}

export default WalletContext;
