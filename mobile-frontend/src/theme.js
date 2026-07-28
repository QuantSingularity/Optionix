import { MD3DarkTheme } from "react-native-paper";

export const colors = {
  background: "#0b0e17",
  surface: "#111827",
  surfaceElevated: "#161d2e",
  primary: "#3b82f6",
  primaryDark: "#2563eb",
  secondary: "#f97316",
  gold: "#d4af6a",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  border: "rgba(255,255,255,0.08)",
  borderAccent: "rgba(59,130,246,0.3)",
};

export const paperTheme = {
  ...MD3DarkTheme,
  dark: true,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    onPrimary: "#ffffff",
    secondary: colors.gold,
    onSecondary: "#14110a",
    background: colors.background,
    onBackground: colors.textPrimary,
    surface: colors.surface,
    onSurface: colors.textPrimary,
    surfaceVariant: colors.surfaceElevated,
    onSurfaceVariant: colors.textSecondary,
    outline: colors.border,
    error: colors.danger,
    elevation: {
      level0: "transparent",
      level1: colors.surface,
      level2: colors.surfaceElevated,
      level3: colors.surfaceElevated,
      level4: colors.surfaceElevated,
      level5: colors.surfaceElevated,
    },
  },
};

export const navTheme = {
  dark: true,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.danger,
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "600" },
    bold: { fontFamily: "System", fontWeight: "700" },
    heavy: { fontFamily: "System", fontWeight: "800" },
  },
};

export const TONES = {
  success: {
    bg: "rgba(16,185,129,0.14)",
    fg: "#34d399",
    border: "rgba(16,185,129,0.3)",
  },
  danger: {
    bg: "rgba(239,68,68,0.14)",
    fg: "#f87171",
    border: "rgba(239,68,68,0.3)",
  },
  warning: {
    bg: "rgba(245,158,11,0.14)",
    fg: "#fbbf24",
    border: "rgba(245,158,11,0.3)",
  },
  info: {
    bg: "rgba(59,130,246,0.14)",
    fg: "#60a5fa",
    border: "rgba(59,130,246,0.3)",
  },
  gold: {
    bg: "rgba(212,175,106,0.14)",
    fg: colors.gold,
    border: "rgba(212,175,106,0.35)",
  },
  neutral: {
    bg: "rgba(255,255,255,0.07)",
    fg: colors.textSecondary,
    border: colors.border,
  },
};

export const CHART_COLORS = [
  "#3b82f6",
  "#d4af6a",
  "#10b981",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ef4444",
  "#ec4899",
];

export default colors;
