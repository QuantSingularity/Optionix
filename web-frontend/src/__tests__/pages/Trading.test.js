import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import Trading from "../../pages/Trading";
import tradingService from "../../services/tradingService";
import { renderWithRouter } from "../../testUtils/render";

jest.mock(
  "../../components/common/CreateAccountPrompt",
  () =>
    ({ onCreated }) => (
      <button onClick={() => onCreated({ id: 1 })}>create-account</button>
    ),
);
jest.mock("../../services/tradingService", () => ({
  __esModule: true,
  default: {
    listAccounts: jest.fn(),
    getAccountSummary: jest.fn(),
    listOrders: jest.fn(),
    listPositions: jest.fn(),
    placeOrder: jest.fn(),
    cancelOrder: jest.fn(),
  },
}));

const positions = [
  {
    position_id: "P1",
    symbol: "AAPL",
    position_type: "call",
    size: 2,
    entry_price: 5,
    current_price: 6,
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
    price: 5,
    executed_price: 5.25,
    status: "executed",
    created_at: "2024-03-15T12:00:00Z",
  },
  {
    trade_id: "T2",
    symbol: "MSFT",
    trade_type: "sell",
    order_type: "market",
    quantity: 1,
    price: 9,
    status: "pending",
    created_at: "2024-03-16T12:00:00Z",
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  tradingService.listAccounts.mockResolvedValue([{ id: 7 }]);
  tradingService.getAccountSummary.mockResolvedValue({
    balance_usd: 50000,
    margin_used: 1000,
    margin_available: 25000,
    total_unrealised_pnl: 80,
  });
  tradingService.listOrders.mockResolvedValue(orders);
  tradingService.listPositions.mockResolvedValue(positions);
});

const mount = async () => {
  renderWithRouter(<Trading />);
  await screen.findByText("Place Order");
};
const set = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () =>
  fireEvent.submit(screen.getByLabelText("Symbol").closest("form"));

describe("Trading data", () => {
  it("loads the first account's summary, 20 orders and open positions", async () => {
    await mount();
    expect(tradingService.getAccountSummary).toHaveBeenCalledWith(7);
    expect(tradingService.listOrders).toHaveBeenCalledWith({ limit: 20 });
    expect(tradingService.listPositions).toHaveBeenCalledWith({
      status: "open",
    });
  });

  it("shows the account summary", async () => {
    await mount();
    expect(screen.getByText("$50,000.00")).toBeInTheDocument();
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
    expect(screen.getByText("$25,000.00")).toBeInTheDocument();
    expect(screen.getByText("$80.00")).toBeInTheDocument();
  });

  it("lists positions, falling back to the entry price when there is no current price", async () => {
    await mount();
    expect(screen.getByText("2 open")).toBeInTheDocument();
    expect(screen.getByText("$6.00")).toBeInTheDocument();
    expect(screen.getAllByText("$7.50")).toHaveLength(2);
    expect(screen.getByText("$120.00")).toBeInTheDocument();
    expect(screen.getByText("-$40.00")).toBeInTheDocument();
  });

  it("lists orders preferring the executed price", async () => {
    await mount();
    expect(screen.getByText("2 total")).toBeInTheDocument();
    expect(screen.getByText("$5.25")).toBeInTheDocument();
    expect(screen.getByText("$9.00")).toBeInTheDocument();
    expect(screen.getByText("executed")).toBeInTheDocument();
  });

  it("shows empty states", async () => {
    tradingService.listOrders.mockResolvedValue([]);
    tradingService.listPositions.mockResolvedValue([]);
    await mount();
    expect(screen.getByText("No open positions")).toBeInTheDocument();
    expect(screen.getByText("No orders placed yet")).toBeInTheDocument();
  });

  it("prompts users without an account and reloads once one exists", async () => {
    tradingService.listAccounts.mockResolvedValueOnce([]);
    renderWithRouter(<Trading />);
    fireEvent.click(await screen.findByText("create-account"));
    expect(await screen.findByText("Place Order")).toBeInTheDocument();
  });

  it("shows an error when loading fails", async () => {
    tradingService.getAccountSummary.mockRejectedValue(
      new Error("Summary failed"),
    );
    renderWithRouter(<Trading />);
    expect(await screen.findByText("Summary failed")).toBeInTheDocument();
  });
});

describe("order form", () => {
  it("defaults to a market buy of 1 and hides the price field", async () => {
    await mount();
    expect(screen.getByLabelText("Quantity")).toHaveValue(1);
    expect(screen.getByLabelText("Order type")).toHaveValue("market");
    expect(screen.queryByLabelText(/price/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Buy Order" }),
    ).toBeInTheDocument();
  });

  it("requires a symbol", async () => {
    await mount();
    submit();
    expect(await screen.findByText(/Enter a symbol/)).toBeInTheDocument();
    expect(tradingService.placeOrder).not.toHaveBeenCalled();
  });

  it.each(["", "0", "-2"])("rejects quantity %p", async (qty) => {
    await mount();
    set("Symbol", "aapl");
    set("Quantity", qty);
    submit();
    expect(
      await screen.findByText("Quantity must be greater than zero."),
    ).toBeInTheDocument();
    expect(tradingService.placeOrder).not.toHaveBeenCalled();
  });

  it("labels the price field by order type and requires it for non-market orders", async () => {
    await mount();
    set("Order type", "limit");
    expect(screen.getByLabelText("Limit price")).toBeInTheDocument();
    set("Order type", "stop");
    expect(screen.getByLabelText("Stop price")).toBeInTheDocument();
    set("Symbol", "aapl");
    submit();
    expect(
      await screen.findByText("Enter a limit/stop price for this order type."),
    ).toBeInTheDocument();
    expect(tradingService.placeOrder).not.toHaveBeenCalled();
  });

  it("places an upper-cased market order on the active account and resets the form", async () => {
    tradingService.placeOrder.mockResolvedValue({});
    await mount();
    set("Symbol", " aapl240119c00190000 ");
    set("Quantity", "3");
    submit();
    expect(
      await screen.findByText("Order submitted successfully."),
    ).toBeInTheDocument();
    expect(tradingService.placeOrder).toHaveBeenCalledWith({
      accountId: 7,
      symbol: "AAPL240119C00190000",
      tradeType: "buy",
      orderType: "market",
      quantity: 3,
      price: undefined,
      stopLoss: undefined,
      takeProfit: undefined,
    });
    expect(screen.getByLabelText("Symbol")).toHaveValue("");
    expect(screen.getByLabelText("Quantity")).toHaveValue(1);
  });

  it("places a limit sell with price, stop loss and take profit", async () => {
    tradingService.placeOrder.mockResolvedValue({});
    await mount();
    set("Symbol", "msft");
    fireEvent.click(screen.getByRole("button", { name: "Sell" }));
    set("Order type", "limit");
    set("Quantity", "2");
    set("Limit price", "12.5");
    set("Stop loss (optional)", "10");
    set("Take profit (optional)", "15.5");
    expect(
      screen.getByRole("button", { name: "Sell msft" }),
    ).toBeInTheDocument();
    submit();
    await waitFor(() =>
      expect(tradingService.placeOrder).toHaveBeenCalledWith({
        accountId: 7,
        symbol: "MSFT",
        tradeType: "sell",
        orderType: "limit",
        quantity: 2,
        price: 12.5,
        stopLoss: 10,
        takeProfit: 15.5,
      }),
    );
  });

  it("refreshes orders and positions after a successful order", async () => {
    tradingService.placeOrder.mockResolvedValue({});
    await mount();
    set("Symbol", "x");
    submit();
    await screen.findByText("Order submitted successfully.");
    expect(tradingService.listOrders).toHaveBeenCalledTimes(2);
    expect(tradingService.listPositions).toHaveBeenCalledTimes(2);
  });

  it("shows the server error and keeps the entered values", async () => {
    tradingService.placeOrder.mockRejectedValue(
      new Error("Insufficient margin"),
    );
    await mount();
    set("Symbol", "aapl");
    set("Quantity", "999");
    submit();
    expect(await screen.findByText("Insufficient margin")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity")).toHaveValue(999);
    expect(screen.getByLabelText("Symbol")).toHaveValue("aapl");
  });

  it("disables the submit button while the order is in flight", async () => {
    tradingService.placeOrder.mockReturnValue(new Promise(() => {}));
    await mount();
    set("Symbol", "aapl");
    submit();
    expect(
      await screen.findByRole("button", { name: "Submitting…" }),
    ).toBeDisabled();
  });

  it("clears the success banner on the next submit", async () => {
    tradingService.placeOrder.mockResolvedValueOnce({});
    await mount();
    set("Symbol", "x");
    submit();
    await screen.findByText("Order submitted successfully.");
    submit();
    await waitFor(() =>
      expect(
        screen.queryByText("Order submitted successfully."),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("cancelling orders", () => {
  it("only offers Cancel for pending orders", async () => {
    await mount();
    expect(screen.getAllByRole("button", { name: /Cancel/ })).toHaveLength(1);
    const row = screen.getByText("MSFT").closest("tr");
    expect(
      within(row).getByRole("button", { name: /Cancel/ }),
    ).toBeInTheDocument();
  });

  it("cancels and reloads the account data", async () => {
    tradingService.cancelOrder.mockResolvedValue({});
    await mount();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    await waitFor(() =>
      expect(tradingService.cancelOrder).toHaveBeenCalledWith("T2"),
    );
    await waitFor(() =>
      expect(tradingService.listOrders).toHaveBeenCalledTimes(2),
    );
  });

  it("shows Cancelling… while in flight", async () => {
    tradingService.cancelOrder.mockReturnValue(new Promise(() => {}));
    await mount();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(
      await screen.findByRole("button", { name: /Cancelling…/ }),
    ).toBeDisabled();
  });

  it("shows an error if cancelling fails and re-enables the button", async () => {
    tradingService.cancelOrder.mockRejectedValue(new Error("Already filled"));
    await mount();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(await screen.findByText("Already filled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeEnabled();
  });
});
