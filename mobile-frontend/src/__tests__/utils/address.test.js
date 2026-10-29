import { generateEthereumAddress, shortenAddress } from "../../utils/format";

describe("generateEthereumAddress", () => {
  it("returns a 0x-prefixed 40 character hex string", () => {
    expect(generateEthereumAddress()).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("produces different addresses across calls", () => {
    const seen = new Set(Array.from({ length: 20 }, generateEthereumAddress));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("uses Math.random deterministically when mocked", () => {
    const spy = jest.spyOn(Math, "random").mockReturnValue(0);
    expect(generateEthereumAddress()).toBe(`0x${"0".repeat(40)}`);
    spy.mockReturnValue(0.99999);
    expect(generateEthereumAddress()).toBe(`0x${"f".repeat(40)}`);
    spy.mockRestore();
  });
});

describe("shortenAddress", () => {
  const addr = "0x1234567890abcdef1234567890abcdef12345678";

  it("shortens long addresses", () => {
    expect(shortenAddress(addr)).toBe("0x1234…5678");
  });

  it("honours custom length", () => {
    expect(shortenAddress(addr, 6)).toBe("0x123456…345678");
  });

  it("returns short values unchanged", () => {
    expect(shortenAddress("0x12")).toBe("0x12");
  });

  it("returns a dash for empty values", () => {
    expect(shortenAddress("")).toBe("-");
    expect(shortenAddress(null)).toBe("-");
    expect(shortenAddress(undefined)).toBe("-");
  });
});
