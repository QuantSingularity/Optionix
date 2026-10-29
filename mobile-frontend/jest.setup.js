/* eslint-env jest */
// Global Jest setup for the mobile app.
//
// Only native / environment-specific modules are replaced here. UI libraries
// (react-native-paper) and navigation are deliberately NOT auto-mocked so
// component tests exercise the real rendering path; individual test files
// mock navigation hooks explicitly where they need to.

// Gesture handler needs its own Jest bootstrap before navigators render.
require("react-native-gesture-handler/jestSetup");

// AsyncStorage: official in-memory mock (supports getItem/setItem/multiRemove...)
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
  },
}));

// Icons render their name as text so tests can find them.
jest.mock("react-native-vector-icons/MaterialCommunityIcons", () => {
  const mockReact = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }) => mockReact.createElement(Text, null, name);
  return { __esModule: true, default: Icon };
});

jest.mock("react-native-safe-area-context", () => {
  const mockReact = require("react");
  const { View } = require("react-native");
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children, ...props }) =>
      mockReact.createElement(View, props, children),
    SafeAreaInsetsContext: mockReact.createContext(insets),
    SafeAreaFrameContext: mockReact.createContext(frame),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

jest.mock("react-native-get-random-values", () => ({}));
jest.mock("react-native-svg", () => ({}));
jest.mock("react-native-qrcode-svg", () => "QRCode");

jest.mock("@walletconnect/sign-client", () => ({
  SignClient: {
    init: jest.fn(() =>
      Promise.resolve({
        session: { getAll: () => [] },
        on: jest.fn(),
        connect: jest.fn(),
        request: jest.fn(),
        disconnect: jest.fn(),
      }),
    ),
  },
}));

// React Native animates screens/opacity on timers and React reports them as
// un-act()ed updates to "Animated(...)", "RNSScreen" and "VirtualizedList".
// They are internal to the libraries and unrelated to the behaviour under
// test; everything else still reaches the console.
const originalConsoleError = console.error;
const INTERNAL_COMPONENTS = /^(Animated\(|RNSScreen|VirtualizedList|Screen)/;
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((...args) => {
    const [format, component] = args;
    if (
      typeof format === "string" &&
      format.includes("not wrapped in act") &&
      INTERNAL_COMPONENTS.test(String(component))
    ) {
      return;
    }
    originalConsoleError(...args);
  });
});
afterAll(() => {
  console.error.mockRestore?.();
});
