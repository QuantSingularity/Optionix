import { act, renderHook, waitFor } from "@testing-library/react";
import { WalletProvider, useWallet } from "../../utils/WalletContext";

const mockSend = jest.fn();
const mockGetNetwork = jest.fn();
const mockGetSigner = jest.fn();

jest.mock("ethers", () => ({
  BrowserProvider: jest.fn().mockImplementation(() => ({
    send: (...a) => mockSend(...a),
    getNetwork: (...a) => mockGetNetwork(...a),
    getSigner: (...a) => mockGetSigner(...a),
  })),
}));

const ADDRESS = "0x1111111111111111111111111111111111111111";
let listeners;
let injected;

beforeEach(() => {
  jest.clearAllMocks();
  listeners = {};
  injected = {
    on: jest.fn((evt, cb) => {
      listeners[evt] = cb;
    }),
    removeListener: jest.fn(),
  };
  window.ethereum = injected;
  mockSend.mockResolvedValue([]);
  mockGetNetwork.mockResolvedValue({ chainId: 1n });
});

afterEach(() => {
  delete window.ethereum;
});

const wrapper = ({ children }) => <WalletProvider>{children}</WalletProvider>;

describe("useWallet", () => {
  it("throws outside a provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useWallet())).toThrow(
      "useWallet must be used within a WalletProvider",
    );
    spy.mockRestore();
  });
});

describe("detection", () => {
  it("reports availability and starts disconnected", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });
    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith("eth_accounts", []),
    );
    expect(result.current.isWalletAvailable).toBe(true);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
  });

  it("reports when no extension is installed", () => {
    delete window.ethereum;
    const { result } = renderHook(() => useWallet(), { wrapper });
    expect(result.current.isWalletAvailable).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("picks up an already-connected account on mount", async () => {
    mockSend.mockResolvedValue([ADDRESS]);
    mockGetNetwork.mockResolvedValue({ chainId: 137n });
    const { result } = renderHook(() => useWallet(), { wrapper });
    await waitFor(() => expect(result.current.address).toBe(ADDRESS));
    expect(result.current.chainId).toBe(137);
    expect(result.current.isConnected).toBe(true);
  });

  it("silently ignores a failing background check", async () => {
    mockSend.mockRejectedValue(new Error("locked"));
    const { result } = renderHook(() => useWallet(), { wrapper });
    await waitFor(() => expect(mockSend).toHaveBeenCalled());
    expect(result.current.error).toBe("");
  });
});

describe("wallet events", () => {
  it("tracks account and chain changes", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });
    await waitFor(() => expect(injected.on).toHaveBeenCalledTimes(2));
    act(() => listeners.accountsChanged([ADDRESS]));
    expect(result.current.address).toBe(ADDRESS);
    act(() => listeners.chainChanged("0x89"));
    expect(result.current.chainId).toBe(137);
    act(() => listeners.accountsChanged([]));
    expect(result.current.address).toBeNull();
  });

  it("removes its listeners on unmount", async () => {
    const { unmount } = renderHook(() => useWallet(), { wrapper });
    await waitFor(() => expect(injected.on).toHaveBeenCalled());
    unmount();
    expect(injected.removeListener).toHaveBeenCalledWith(
      "accountsChanged",
      listeners.accountsChanged,
    );
    expect(injected.removeListener).toHaveBeenCalledWith(
      "chainChanged",
      listeners.chainChanged,
    );
  });

  it("works with a provider that has no event API", async () => {
    window.ethereum = {};
    const { result } = renderHook(() => useWallet(), { wrapper });
    expect(result.current.isWalletAvailable).toBe(true);
  });
});

describe("connect", () => {
  it("requests accounts and stores address and chain", async () => {
    mockSend.mockImplementation(async (method) =>
      method === "eth_requestAccounts" ? [ADDRESS] : [],
    );
    const { result } = renderHook(() => useWallet(), { wrapper });
    let out;
    await act(async () => {
      out = await result.current.connect();
    });
    expect(out).toBe(ADDRESS);
    expect(mockSend).toHaveBeenCalledWith("eth_requestAccounts", []);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.chainId).toBe(1);
    expect(result.current.isConnecting).toBe(false);
  });

  it("explains when no extension is installed", async () => {
    delete window.ethereum;
    const { result } = renderHook(() => useWallet(), { wrapper });
    let out;
    await act(async () => {
      out = await result.current.connect();
    });
    expect(out).toBeNull();
    expect(result.current.error).toMatch(/No wallet extension detected/);
  });

  it("reports a rejected request (EIP-1193 code 4001)", async () => {
    mockSend.mockImplementation(async (method) => {
      if (method === "eth_requestAccounts")
        throw Object.assign(new Error("x"), { code: 4001 });
      return [];
    });
    const { result } = renderHook(() => useWallet(), { wrapper });
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.error).toBe("Connection request was rejected.");
    expect(result.current.isConnecting).toBe(false);
  });

  it("reports other wallet errors", async () => {
    mockSend.mockImplementation(async (method) => {
      if (method === "eth_requestAccounts")
        throw new Error("Already processing");
      return [];
    });
    const { result } = renderHook(() => useWallet(), { wrapper });
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.error).toBe("Already processing");
  });

  it("clears the previous error before retrying", async () => {
    delete window.ethereum;
    const { result } = renderHook(() => useWallet(), { wrapper });
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.error).not.toBe("");
    act(() => result.current.setError(""));
    expect(result.current.error).toBe("");
  });
});

describe("disconnect", () => {
  it("clears local state", async () => {
    mockSend.mockResolvedValue([ADDRESS]);
    const { result } = renderHook(() => useWallet(), { wrapper });
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    act(() => result.current.disconnect());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.chainId).toBeNull();
  });
});

describe("sendTransaction", () => {
  it("signs with the wallet, drops `from`, and returns the hash", async () => {
    const signer = {
      sendTransaction: jest.fn().mockResolvedValue({ hash: "0xhash" }),
    };
    mockGetSigner.mockResolvedValue(signer);
    const { result } = renderHook(() => useWallet(), { wrapper });
    let hash;
    await act(async () => {
      hash = await result.current.sendTransaction({
        from: ADDRESS,
        to: "0x2222",
        value: 5,
        data: "0xab",
      });
    });
    expect(hash).toBe("0xhash");
    expect(signer.sendTransaction).toHaveBeenCalledWith({
      to: "0x2222",
      value: 5,
      data: "0xab",
    });
  });

  it("fails clearly without a wallet", async () => {
    delete window.ethereum;
    const { result } = renderHook(() => useWallet(), { wrapper });
    await expect(result.current.sendTransaction({ to: "0x1" })).rejects.toThrow(
      "No wallet connected.",
    );
  });

  it("propagates wallet rejections", async () => {
    mockGetSigner.mockResolvedValue({
      sendTransaction: jest.fn().mockRejectedValue(new Error("User denied")),
    });
    const { result } = renderHook(() => useWallet(), { wrapper });
    await expect(result.current.sendTransaction({ to: "0x1" })).rejects.toThrow(
      "User denied",
    );
  });
});
