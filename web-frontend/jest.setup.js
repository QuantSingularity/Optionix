/* eslint-env jest */
import "@testing-library/jest-dom";

// jsdom does not implement these browser APIs, which charts and layout code
// touch. Minimal stand-ins keep component tests focused on behaviour.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

window.scrollTo = window.scrollTo || (() => {});
Element.prototype.scrollIntoView =
  Element.prototype.scrollIntoView || (() => {});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
