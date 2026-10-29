import { Linking } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { SignClient } from "@walletconnect/sign-client";
import { WalletProvider, useWallet } from "../../context/WalletContext";

jest.mock("@env", () => ({ WALLETCONNECT_PROJECT_ID: "test-project" }), {
  virtual: true,
});

const ADDRESS = "0x1111111111111111111111111111111111111111";
const session = (topic = "t1") => ({
  topic,
  namespaces: { eip155: { accounts: [`eip155:1:${ADDRESS}`] } },
});

let client;
let listeners;

beforeEach(() => {
  listeners = {};
  client = {
    session: { getAll: jest.fn(() => []) },
    on: jest.fn((evt, cb) => {
      listeners[evt] = cb;
    }),
    connect: jest.fn(),
    request: jest.fn(),
    disconnect: jest.fn(() => Promise.resolve()),
  };
  SignClient.init.mockReset();
  SignClient.init.mockResolvedValue(client);
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

const wrapper = ({ children }) => <WalletProvider>{children}</WalletProvider>;
const ready = async () => {
  const hook = renderHook(() => useWallet(), { wrapper });
  await waitFor(() => expect(hook.result.current.isInitializing).toBe(false));
  return hook;
};

describe("initialization", () => {
  it("creates a SignClient with the project id and app metadata", async () => {
    const { result } = await ready();
    expect(SignClient.init).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "test-project",
        metadata: expect.objectContaining({ name: "Optionix" }),
      }),
    );
    expect(result.current.isConfigured).toBe(true);
    expect(result.current.isConnected).toBe(false);
  });

  it("restores an existing eip155 session", async () => {
    client.session.getAll.mockReturnValue([
      { topic: "x", namespaces: {} },
      session(),
    ]);
    const { result } = await ready();
    expect(result.current.isConnected).toBe(true);
    expect(result.current.address).toBe(ADDRESS);
  });

  it("clears the session when the wallet deletes or expires it", async () => {
    client.session.getAll.mockReturnValue([session()]);
    const { result } = await ready();
    act(() => listeners.session_delete());
    expect(result.current.isConnected).toBe(false);

    client.session.getAll.mockReturnValue([session()]);
  });

  it("clears the session on expiry", async () => {
    client.session.getAll.mockReturnValue([session()]);
    const { result } = await ready();
    act(() => listeners.session_expire());
    expect(result.current.address).toBeNull();
  });

  it("surfaces initialization failures", async () => {
    SignClient.init.mockRejectedValue(new Error("relay unreachable"));
    const { result } = await ready();
    expect(result.current.error).toBe("relay unreachable");
  });
});

describe("connect", () => {
  it("proposes eip155 on mainnet, opens the wallet app, and stores the session", async () => {
    let approve;
    client.connect.mockResolvedValue({
      uri: "wc:abc",
      approval: () => new Promise((r) => (approve = r)),
    });
    const { result } = await ready();

    let promise;
    act(() => {
      promise = result.current.connect();
    });
    await waitFor(() => expect(result.current.pairingUri).toBe("wc:abc"));
    expect(result.current.isConnecting).toBe(true);
    expect(Linking.openURL).toHaveBeenCalledWith("wc:abc");
    expect(client.connect).toHaveBeenCalledWith({
      requiredNamespaces: {
        eip155: {
          methods: [
            "eth_sendTransaction",
            "eth_signTransaction",
            "personal_sign",
          ],
          chains: ["eip155:1"],
          events: ["accountsChanged", "chainChanged"],
        },
      },
    });

    let address;
    await act(async () => {
      approve(session());
      address = await promise;
    });
    expect(address).toBe(ADDRESS);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.pairingUri).toBeNull();
    expect(result.current.isConnecting).toBe(false);
  });

  it("still works when no wallet app handles the wc: scheme", async () => {
    Linking.openURL.mockRejectedValue(new Error("no handler"));
    client.connect.mockResolvedValue({
      uri: "wc:abc",
      approval: async () => session(),
    });
    const { result } = await ready();
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.isConnected).toBe(true);
  });

  it("reports a rejected pairing and resets state", async () => {
    client.connect.mockResolvedValue({
      uri: "wc:abc",
      approval: async () => {
        throw new Error("User rejected");
      },
    });
    const { result } = await ready();
    let out;
    await act(async () => {
      out = await result.current.connect();
    });
    expect(out).toBeNull();
    expect(result.current.error).toBe("User rejected");
    expect(result.current.pairingUri).toBeNull();
    expect(result.current.isConnecting).toBe(false);
  });

  it("tells the user when the client is not ready", async () => {
    SignClient.init.mockRejectedValue(new Error("init failed"));
    const { result } = await ready();
    let out;
    await act(async () => {
      out = await result.current.connect();
    });
    expect(out).toBeNull();
    expect(result.current.error).toMatch(/isn't ready/);
  });
});

describe("disconnect", () => {
  it("disconnects the session on the client and clears local state", async () => {
    client.session.getAll.mockReturnValue([session("topic-9")]);
    const { result } = await ready();
    await act(async () => {
      await result.current.disconnect();
    });
    expect(client.disconnect).toHaveBeenCalledWith({
      topic: "topic-9",
      reason: { code: 6000, message: "User disconnected" },
    });
    expect(result.current.isConnected).toBe(false);
  });

  it("clears local state even if the remote disconnect fails", async () => {
    client.session.getAll.mockReturnValue([session()]);
    client.disconnect.mockRejectedValue(new Error("gone"));
    const { result } = await ready();
    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.isConnected).toBe(false);
  });
});

describe("sendTransaction", () => {
  const connected = async () => {
    client.session.getAll.mockReturnValue([session("topic-1")]);
    return ready();
  };

  it("converts numeric fields to hex and forwards the request", async () => {
    client.request.mockResolvedValue("0xhash");
    const { result } = await connected();
    let hash;
    await act(async () => {
      hash = await result.current.sendTransaction({
        from: ADDRESS,
        to: "0x2222",
        data: "0xdead",
        value: 255,
        gas: 21000,
        gasPrice: "1000000000",
        nonce: 7,
      });
    });
    expect(hash).toBe("0xhash");
    expect(client.request).toHaveBeenCalledWith({
      topic: "topic-1",
      chainId: "eip155:1",
      request: {
        method: "eth_sendTransaction",
        params: [
          {
            from: ADDRESS,
            to: "0x2222",
            data: "0xdead",
            value: "0xff",
            gas: "0x5208",
            gasPrice: "0x3b9aca00",
            nonce: "0x7",
          },
        ],
      },
    });
  });

  it("defaults value to 0x0 and omits undefined fields", async () => {
    client.request.mockResolvedValue("0xh");
    const { result } = await connected();
    await act(async () => {
      await result.current.sendTransaction({ from: ADDRESS, to: "0x2222" });
    });
    expect(client.request.mock.calls[0][0].request.params[0]).toEqual({
      from: ADDRESS,
      to: "0x2222",
      value: "0x0",
    });
  });

  it("propagates wallet rejections", async () => {
    client.request.mockRejectedValue(new Error("User denied"));
    const { result } = await connected();
    await expect(result.current.sendTransaction({ to: "0x1" })).rejects.toThrow(
      "User denied",
    );
  });
});
