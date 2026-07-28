import {
  formatCurrency,
  formatPercent,
  generateEthereumAddress,
} from "../utils/format";

describe("format utilities", () => {
  test("formatCurrency formats a positive number as USD", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  test("formatCurrency handles non-numeric input gracefully", () => {
    expect(formatCurrency("not-a-number")).toBe("—");
  });

  test("formatPercent appends a percent sign", () => {
    expect(formatPercent(12.345)).toBe("12.35%");
  });

  test("generateEthereumAddress returns a well-formed 0x address", () => {
    const addr = generateEthereumAddress();
    expect(addr).toMatch(/^0x[0-9a-f]{40}$/);
  });

  test("generateEthereumAddress returns different values across calls", () => {
    const a = generateEthereumAddress();
    const b = generateEthereumAddress();
    expect(a).not.toBe(b);
  });
});
