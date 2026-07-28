import { StyleSheet, Text, View } from "react-native";
import colors, { TONES } from "../theme";

export const Screen = ({ children, style }) => (
  <View style={[styles.screen, style]}>{children}</View>
);

export const SectionCard = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const CardHeaderRow = ({ children, style }) => (
  <View style={[styles.cardHeaderRow, style]}>{children}</View>
);

export const CardTitle = ({ children, style }) => (
  <Text style={[styles.cardTitle, style]}>{children}</Text>
);

export const CardMeta = ({ children, style }) => (
  <Text style={[styles.cardMeta, style]}>{children}</Text>
);

export const StatLabel = ({ children, style }) => (
  <Text style={[styles.statLabel, style]}>{children}</Text>
);

export const StatValue = ({ children, style }) => (
  <Text style={[styles.statValue, style]}>{children}</Text>
);

export const Row = ({ children, style }) => (
  <View style={[styles.row, style]}>{children}</View>
);

export const Grid2 = ({ children, style }) => (
  <View style={[styles.grid2, style]}>{children}</View>
);

export const Badge = ({ children, tone = "neutral", style, textStyle }) => {
  const t = TONES[tone] || TONES.neutral;
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: t.bg, borderColor: t.border },
        style,
      ]}
    >
      <Text style={[styles.badgeText, { color: t.fg }, textStyle]}>
        {children}
      </Text>
    </View>
  );
};

export const EmptyState = ({ icon, title, description }) => (
  <View style={styles.emptyState}>
    {icon}
    <Text style={styles.emptyTitle}>{title}</Text>
    {description ? (
      <Text style={styles.emptyDescription}>{description}</Text>
    ) : null}
  </View>
);

export const Divider = ({ style }) => <View style={[styles.divider, style]} />;

/** Simple horizontal bar used in place of a full chart library. */
export const SimpleBarRow = ({ label, valueLabel, pct, color }) => (
  <View style={styles.barRow}>
    <View style={styles.barRowHeader}>
      <Text style={styles.barLabel}>{label}</Text>
      <Text style={styles.barValue}>{valueLabel}</Text>
    </View>
    <View style={styles.barTrack}>
      <View
        style={[
          styles.barFill,
          {
            width: `${Math.min(100, Math.max(2, pct))}%`,
            backgroundColor: color || colors.primary,
          },
        ]}
      />
    </View>
  </View>
);

export const AlertBanner = ({ tone = "info", children }) => {
  const t = TONES[tone] || TONES.info;
  return (
    <View
      style={[styles.alert, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      <Text style={[styles.alertText, { color: t.fg }]}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  grid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 14.5,
    fontWeight: "700",
    marginTop: 10,
  },
  emptyDescription: {
    color: colors.textSecondary,
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  barRow: {
    marginBottom: 14,
  },
  barRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  barLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  barValue: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  alert: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  alertText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
