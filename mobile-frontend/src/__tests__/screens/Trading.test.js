import { RefreshControl } from "react-native";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import TradingScreen from "../../screens/TradingScreen";
import tradingService from "../../services/tradingService";
import { typeInto, paperInputs } from "../../testUtils/paper";

jest.mock("../../context/WalletContext", () => ({
  useWallet: () => ({
    address: null,
    isConnected: false,
    isConnecting: false,
    connect: jest.fn(),
  }),
}));
jest.mock("../../services/tradingService", () => ({
  __esModule: true,
  default: {
    listAccounts: jest.fn(),
    getAccountSummary: jest.fn(),
    listOrders: jest.fn(),
    listPositions: jest.fn(),
    placeOrder: jest.fn(),
    createAccount: jest.fn(),
  },
}));

const positions = [
  {
    position_id: "P1",
    symbol: "AAPL",
    position_type: "call",
    size: 2,
    entry_price: 5,
    unrealized_pnl: 120,
  },
  {
    position_id: "P2",
    symbol: "TSLA",
    position_type: "put",
    size: 1,
    entry_price: 7.5,
    unrealized_pnl: -40,
  },
];
const orders = [
  {
    trade_id: "T1",
    symbol: "AAPL",
    trade_type: "buy",
    order_type: "limit",
    quantity: 2,
    status: "executed",
  },
  {
    trade_id: "T2",
    symbol: "MSFT",
    trade_type: "sell",
    order_type: "market",
    quantity: 1,
    status: "rejected",
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  tradingService.listAccounts.mockResolvedValue([{ id: 7 }]);
  tradingService.getAccountSummary.mockResolvedValue({
    balance_usd: 50000,
    margin_available: 25000,
  });
  tradingService.listOrders.mockResolvedValue(orders);
  tradingService.listPositions.mockResolvedValue(positions);
});

const mount = async () => {
  render(<TradingScreen />);
  await screen.findByText("Place Order");
};
// Input order in the form: symbol, quantity, [price]
const SYMBOL = 0;
const QUANTITY = 1;
const PRICE = 2;

describe("TradingScreen data", () => {
  it("loads the first account's summary, 20 orders and open positions", async () => {
    await mount();
    expect(tradingService.getAccountSummary).toHaveBeenCalledWith(7);
    expect(tradingService.listOrders).toHaveBeenCalledWith({ limit: 20 });
    expect(tradingService.listPositions).toHaveBeenCalledWith({
      status: "open",
    });
  });

  it("shows balances", async () => {
    await mount();
    expect(screen.getByText("$50,000.00")).toBeTruthy();
    expect(screen.getByText("$25,000.00")).toBeTruthy();
  });

  it("lists positions with coloured P&L and orders with status", async () => {
    await mount();
    expect(screen.getByText("1 open".replace("1", "2"))).toBeTruthy();
    expect(screen.getByText("$120.00")).toBeTruthy();
    expect(screen.getByText("-$40.00")).toBeTruthy();
    expect(screen.getByText(/call · 2 @ \$5\.00/)).toBeTruthy();
    expect(screen.getByText("2 total")).toBeTruthy();
    expect(screen.getByText("executed")).toBeTruthy();
    expect(screen.getByText("rejected")).toBeTruthy();
    expect(screen.getByText(/BUY · limit · 2/)).toBeTruthy();
  });

  it("does not crash on an order with no trade type", async () => {
    tradingService.listOrders.mockResolvedValue([
      { trade_id: "T9", symbol: "X", status: "failed" },
    ]);
    await mount();
    expect(screen.getByText("failed")).toBeTruthy();
  });

  it("shows empty states", async () => {
    tradingService.listOrders.mockResolvedValue([]);
    tradingService.listPositions.mockResolvedValue([]);
    await mount();
    expect(screen.getByText("No open positions")).toBeTruthy();
    expect(screen.getByText("No orders yet")).toBeTruthy();
  });

  it("prompts users without an account to create one", async () => {
    tradingService.listAccounts.mockResolvedValue([]);
    render(<TradingScreen />);
    expect(await screen.findByText("Open your trading account")).toBeTruthy();
    expect(tradingService.getAccountSummary).not.toHaveBeenCalled();
  });

  it("shows an error when loading fails", async () => {
    tradingService.getAccountSummary.mockRejectedValue(
      new Error("Summary failed"),
    );
    render(<TradingScreen />);
    expect(await screen.findByText("Summary failed")).toBeTruthy();
  });

  it("supports pull-to-refresh", async () => {
    await mount();
    await act(async () => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });
    await waitFor(() =>
      expect(tradingService.listAccounts).toHaveBeenCalledTimes(2),
    );
  });
});

describe("TradingScreen order form", () => {
  it("defaults to a market buy of 1", async () => {
    await mount();
    expect(paperInputs()[QUANTITY].props.value).toBe("1");
    expect(screen.getByText("Buy Order")).toBeTruthy();
    expect(paperInputs()).toHaveLength(2);
  });

  it("requires a symbol", async () => {
    await mount();
    fireEvent.press(screen.getByText("Buy Order"));
    expect(await screen.findByText(/Enter a symbol/)).toBeTruthy();
    expect(tradingService.placeOrder).not.toHaveBeenCalled();
  });

  it.each(["", "0", "-2"])("rejects quantity %p", async (qty) => {
    await mount();
    typeInto(SYMBOL, "aapl");
    typeInto(QUANTITY, qty);
    fireEvent.press(screen.getByText("Buy AAPL".replace("AAPL", "aapl")));
    expect(
      await screen.findByText("Quantity must be greater than zero."),
    ).toBeTruthy();
    expect(tradingService.placeOrder).not.toHaveBeenCalled();
  });

  it("shows the price field for limit and stop orders with the right label", async () => {
    await mount();
    fireEvent.press(screen.getByText("Limit"));
    expect(paperInputs()).toHaveLength(3);
    expect(screen.getAllByText("Limit price").length).toBeGreaterThan(0);
    fireEvent.press(screen.getByText("Stop"));
    expect(screen.getAllByText("Stop price").length).toBeGreaterThan(0);
    fireEvent.press(screen.getByText("Market"));
    expect(paperInputs()).toHaveLength(2);
  });

  it("requires a price for non-market orders", async () => {
    await mount();
    typeInto(SYMBOL, "aapl");
    fireEvent.press(screen.getByText("Limit"));
    fireEvent.press(screen.getByText("Buy aapl"));
    expect(
      await screen.findByText("Enter a limit/stop price for this order type."),
    ).toBeTruthy();
    expect(tradingService.placeOrder).not.toHaveBeenCalled();
  });

  it("places an upper-cased market order on the active account, then resets the form", async () => {
    tradingService.placeOrder.mockResolvedValue({});
    await mount();
    typeInto(SYMBOL, " aapl240119c00190000 ");
    typeInto(QUANTITY, "3");
    fireEvent.press(screen.getByText(/^Buy /));

    expect(
      await screen.findByText("Order submitted successfully."),
    ).toBeTruthy();
    expect(tradingService.placeOrder).toHaveBeenCalledWith({
      accountId: 7,
      symbol: "AAPL240119C00190000",
      tradeType: "buy",
      orderType: "market",
      quantity: 3,
      price: undefined,
    });
    expect(paperInputs()[SYMBOL].props.value).toBe("");
    expect(paperInputs()[QUANTITY].props.value).toBe("1");
  });

  it("refreshes positions and orders after a successful order", async () => {
    tradingService.placeOrder.mockResolvedValue({});
    await mount();
    typeInto(SYMBOL, "x");
    fireEvent.press(screen.getByText(/^Buy /));
    await screen.findByText("Order submitted successfully.");
    expect(tradingService.listOrders).toHaveBeenCalledTimes(2);
  });

  it("places a limit sell with its price", async () => {
    tradingService.placeOrder.mockResolvedValue({});
    await mount();
    typeInto(SYMBOL, "msft");
    fireEvent.press(screen.getByText("Sell"));
    fireEvent.press(screen.getByText("Limit"));
    typeInto(PRICE, "12.5");
    fireEvent.press(screen.getByText("Sell msft"));
    await waitFor(() =>
      expect(tradingService.placeOrder).toHaveBeenCalledWith({
        accountId: 7,
        symbol: "MSFT",
        tradeType: "sell",
        orderType: "limit",
        quantity: 1,
        price: 12.5,
      }),
    );
  });

  it("shows the server error and keeps the entered values", async () => {
    tradingService.placeOrder.mockRejectedValue(
      new Error("Insufficient margin"),
    );
    await mount();
    typeInto(SYMBOL, "aapl");
    typeInto(QUANTITY, "999");
    fireEvent.press(screen.getByText("Buy aapl"));
    expect(await screen.findByText("Insufficient margin")).toBeTruthy();
    expect(paperInputs()[QUANTITY].props.value).toBe("999");
  });

  it("clears the previous success banner on the next submit", async () => {
    tradingService.placeOrder.mockResolvedValueOnce({});
    await mount();
    typeInto(SYMBOL, "x");
    fireEvent.press(screen.getByText(/^Buy /));
    await screen.findByText("Order submitted successfully.");

    fireEvent.press(screen.getByText("Buy Order"));
    await waitFor(() =>
      expect(screen.queryByText("Order submitted successfully.")).toBeNull(),
    );
  });
});
