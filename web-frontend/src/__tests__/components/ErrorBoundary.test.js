import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "../../components/common/ErrorBoundary";

const Bomb = ({ explode = true }) => {
  if (explode) throw new Error("kaboom");
  return <p>safe</p>;
};

describe("ErrorBoundary", () => {
  let consoleError;
  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("safe")).toBeInTheDocument();
  });

  it("shows a styled-components-free fallback when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/Please reload the page/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reload Page" }),
    ).toBeInTheDocument();
  });

  it("logs the caught error", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(consoleError).toHaveBeenCalledWith(
      "ErrorBoundary caught:",
      expect.any(Error),
      expect.anything(),
    );
  });

  it("hides error details outside development", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.queryByText(/Error details/)).not.toBeInTheDocument();
  });

  it("shows error details in development", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      );
      expect(
        screen.getByText(/Error details \(development\)/),
      ).toBeInTheDocument();
      expect(screen.getByText(/kaboom/)).toBeInTheDocument();
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it("reloads the page from the fallback button", () => {
    const reload = jest.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, reload },
    });
    try {
      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Reload Page" }));
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      });
    }
  });
});
