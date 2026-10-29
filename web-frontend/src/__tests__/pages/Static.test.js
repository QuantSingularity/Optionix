import { fireEvent, screen } from "@testing-library/react";
import Home from "../../pages/Home";
import NotFound from "../../pages/NotFound";
import { renderWithRouter } from "../../testUtils/render";

describe("Home", () => {
  it("shows the hero headline and platform sections", () => {
    renderWithRouter(<Home />);
    expect(screen.getByText(/institutional precision\./)).toBeInTheDocument();
    expect(screen.getByText("Everything the desk needs")).toBeInTheDocument();
    expect(screen.getByText("Up and running in minutes")).toBeInTheDocument();
    expect(
      screen.getByText("Ready to trade with an edge?"),
    ).toBeInTheDocument();
  });

  it("routes every sign-up call to action to /signup", () => {
    renderWithRouter(<Home />);
    ["Get Started", "Start Trading Free", "Open Free Account"].forEach(
      (label) =>
        expect(
          screen.getByRole("link", { name: new RegExp(label) }),
        ).toHaveAttribute("href", "/signup"),
    );
  });

  it("routes sign-in links to /login", () => {
    renderWithRouter(<Home />);
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("link", { name: /View Dashboard/ }),
    ).toHaveAttribute("href", "/login");
  });

  it("only links to routes that exist", () => {
    renderWithRouter(<Home />);
    const known = new Set(["/login", "/signup"]);
    screen
      .getAllByRole("link")
      .forEach((a) => expect(known.has(a.getAttribute("href"))).toBe(true));
  });

  it("duplicates the ticker so the marquee loops seamlessly", () => {
    renderWithRouter(<Home />);
    const first = screen.getAllByText("AAPL");
    expect(first.length % 2).toBe(0);
  });

  it("shows the current year in the footer", () => {
    renderWithRouter(<Home />);
    expect(
      screen.getByText(
        new RegExp(`© ${new Date().getFullYear()} Optionix Inc\\.`),
      ),
    ).toBeInTheDocument();
  });
});

describe("NotFound", () => {
  it("explains the error", () => {
    renderWithRouter(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("This page doesn't exist")).toBeInTheDocument();
  });

  it("links home", () => {
    renderWithRouter(<NotFound />);
    expect(screen.getByRole("link", { name: /Go home/ })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("goes back in history", () => {
    const back = jest
      .spyOn(window.history, "back")
      .mockImplementation(() => {});
    renderWithRouter(<NotFound />);
    fireEvent.click(screen.getByRole("button", { name: /Go back/ }));
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });
});
