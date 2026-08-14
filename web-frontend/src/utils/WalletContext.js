import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BrowserProvider } from "ethers";

const WalletContext = createContext(null);

function getInjectedProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const isWalletAvailable = !!getInjectedProvider();

  const refreshFromInjected = useCallback(async () => {
    const injected = getInjectedProvider();
    if (!injected) return;
    try {
      const provider = new BrowserProvider(injected);
      const accounts = await provider.send("eth_accounts", []);
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        const network = await provider.getNetwork();
        setChainId(Number(network.chainId));
      } else {
        setAddress(null);
        setChainId(null);
      }
    } catch (err) {
      // Silent - this runs on mount to detect an already-connected wallet;
      // no need to surface an error for a background check.
    }
  }, []);

  useEffect(() => {
    refreshFromInjected();
    const injected = getInjectedProvider();
    if (!injected?.on) return undefined;

    const handleAccountsChanged = (accounts) => {
      setAddress(accounts.length > 0 ? accounts[0] : null);
    };
    const handleChainChanged = (newChainIdHex) => {
      setChainId(parseInt(newChainIdHex, 16));
    };

    injected.on("accountsChanged", handleAccountsChanged);
    injected.on("chainChanged", handleChainChanged);
    return () => {
      injected.removeListener?.("accountsChanged", handleAccountsChanged);
      injected.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [refreshFromInjected]);

  const connect = useCallback(async () => {
    const injected = getInjectedProvider();
    if (!injected) {
      setError(
        "No wallet extension detected. Install MetaMask or another browser wallet to continue.",
      );
      return null;
    }
    setError("");
    setIsConnecting(true);
    try {
      const provider = new BrowserProvider(injected);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      setAddress(accounts[0]);
      setChainId(Number(network.chainId));
      return accounts[0];
    } catch (err) {
      const message =
        err?.code === 4001
          ? "Connection request was rejected."
          : err?.message || "Couldn't connect to your wallet.";
      setError(message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // Injected wallets don't expose a programmatic disconnect - this just
    // clears local state; the extension itself stays connected until the
    // user disconnects it there.
    setAddress(null);
    setChainId(null);
  }, []);

  /**
   * Sign and send a transaction prepared by the backend
   * (see services/blockchainService.js `build*Tx` calls). Returns the
   * transaction hash once submitted.
   */
  const sendTransaction = useCallback(async (unsignedTx) => {
    const injected = getInjectedProvider();
    if (!injected) throw new Error("No wallet connected.");
    const provider = new BrowserProvider(injected);
    const signer = await provider.getSigner();

    // The backend returns snake_free camelCase-ish web3.py transaction
    // dicts; strip fields ethers doesn't expect and let the wallet fill
    // in anything it manages itself (e.g. nonce, if it prefers to).
    const { from, ...rest } = unsignedTx;
    const tx = await signer.sendTransaction(rest);
    return tx.hash;
  }, []);

  const value = useMemo(
    () => ({
      address,
      chainId,
      isConnected: !!address,
      isWalletAvailable,
      isConnecting,
      error,
      setError,
      connect,
      disconnect,
      sendTransaction,
    }),
    [
      address,
      chainId,
      isWalletAvailable,
      isConnecting,
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
