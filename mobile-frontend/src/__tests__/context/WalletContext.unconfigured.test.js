import { act, renderHook, waitFor } from "@testing-library/react-native";
import { SignClient } from "@walletconnect/sign-client";
import { WalletProvider, useWallet } from "../../context/WalletContext";

const wrapper = ({ children }) => <WalletProvider>{children}</WalletProvider>;

describe("WalletContext without WALLETCONNECT_PROJECT_ID", () => {
  it("throws outside a provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useWallet())).toThrow(
      "useWallet must be used within a WalletProvider",
    );
    spy.mockRestore();
  });

  it("finishes initializing without creating a client", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));
    expect(SignClient.init).not.toHaveBeenCalled();
    expect(result.current.isConfigured).toBe(false);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
  });

  it("explains the missing configuration when connecting", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));
    let out;
    await act(async () => {
      out = await result.current.connect();
    });
    expect(out).toBeNull();
    expect(result.current.error).toMatch(/WALLETCONNECT_PROJECT_ID/);
  });

  it("refuses to send transactions without a wallet", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });
    await expect(result.current.sendTransaction({ to: "0x1" })).rejects.toThrow(
      "No wallet connected.",
    );
  });

  it("disconnect is a safe no-op", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });
    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it("lets screens clear the error", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));
    await act(async () => {
      await result.current.connect();
    });
    act(() => result.current.setError(""));
    expect(result.current.error).toBe("");
  });
});
