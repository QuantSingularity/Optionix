import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import theme from "../theme";

/** Renders the current router location so tests can assert on navigation. */
export const LocationProbe = () => {
  const { pathname, search, state } = useLocation();
  return (
    <div data-testid="location">
      {pathname}
      {search}
      {state?.from?.pathname ? `|from:${state.from.pathname}` : ""}
    </div>
  );
};

/** Render inside the app's real styled-components theme. */
export const renderWithTheme = (ui, options) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>, options);

/** Render inside theme + MemoryRouter (with a LocationProbe alongside). */
export const renderWithRouter = (ui, { route = "/", ...options } = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
        <LocationProbe />
      </MemoryRouter>
    </ThemeProvider>,
    options,
  );
