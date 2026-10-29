import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  generateEthereumAddress,
  shortenAddress,
} from "../../utils/format";

describe("formatCurrency", () => {
  it("formats USD with two decimals by default", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(-9.999)).toBe("-$10.00");
  });

  it("honours the decimals option", () => {
    expect(formatCurrency(1234.5678, { decimals: 0 })).toBe("$1,235");
    expect(formatCurrency(1.5, { decimals: 4 })).toBe("$1.5000");
  });

  it("accepts numeric strings", () => {
    expect(formatCurrency("42")).toBe("$42.00");
  });

  it.each([undefined, "abc", NaN])("returns a dash for %p", (v) => {
    expect(formatCurrency(v)).toBe("-");
  });

  it("treats null as zero (Number(null) === 0)", () => {
    expect(formatCurrency(null)).toBe("$0.00");
  });
});

describe("formatNumber", () => {
  it("groups thousands with two decimals by default", () => {
    expect(formatNumber(1234567.891)).toBe("1,234,567.89");
    expect(formatNumber(5)).toBe("5.00");
  });

  it("honours decimals", () => {
    expect(formatNumber(1.23456, { decimals: 4 })).toBe("1.2346");
    expect(formatNumber(1234.5, { decimals: 0 })).toBe("1,235");
  });

  it.each([undefined, "abc", NaN])("returns a dash for %p", (v) => {
    expect(formatNumber(v)).toBe("-");
  });
});

describe("formatPercent", () => {
  it("appends a percent sign", () => {
    expect(formatPercent(12.345)).toBe("12.35%");
    expect(formatPercent(0)).toBe("0.00%");
    expect(formatPercent(-3.2)).toBe("-3.20%");
  });

  it("honours decimals", () => {
    expect(formatPercent(12.345, { decimals: 1 })).toBe("12.3%");
  });

  it.each([undefined, "abc", NaN])("returns a dash for %p", (v) => {
    expect(formatPercent(v)).toBe("-");
  });
});

describe("formatDate / formatDateTime", () => {
  it("formats an ISO date", () => {
    expect(formatDate("2024-03-15T12:00:00Z")).toBe("Mar 15, 2024");
  });

  it("accepts Intl overrides", () => {
    expect(formatDate("2024-03-15T12:00:00Z", { month: "long" })).toBe(
      "March 15, 2024",
    );
  });

  it("includes the time in formatDateTime", () => {
    const out = formatDateTime("2024-03-15T12:00:00Z");
    expect(out).toMatch(/Mar 1[45]/);
    expect(out).toMatch(/\d{2}:\d{2}/);
  });

  it.each([null, undefined, "", "not-a-date"])("returns a dash for %p", (v) => {
    expect(formatDate(v)).toBe("-");
    expect(formatDateTime(v)).toBe("-");
  });
});

describe("generateEthereumAddress", () => {
  it("returns a 0x-prefixed 40 character hex string", () => {
    expect(generateEthereumAddress()).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("is driven by Math.random", () => {
    const spy = jest.spyOn(Math, "random").mockReturnValue(0);
    expect(generateEthereumAddress()).toBe(`0x${"0".repeat(40)}`);
    spy.mockRestore();
  });
});

describe("shortenAddress", () => {
  const addr = "0x1234567890abcdef1234567890abcdef12345678";

  it("shortens long addresses", () => {
    expect(shortenAddress(addr)).toBe("0x1234…5678");
    expect(shortenAddress(addr, 6)).toBe("0x123456…345678");
  });

  it("returns short values unchanged and a dash for empty ones", () => {
    expect(shortenAddress("0x12")).toBe("0x12");
    expect(shortenAddress("")).toBe("-");
    expect(shortenAddress(null)).toBe("-");
  });
});
