import { Platform, TextStyle, ViewStyle } from "react-native";

export const spacing = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  card: 16,
  input: 12,
} as const;

export const colors = {
  background: "#F5F5F7",
  surface: "#FFFFFF",
  text: "#1C1C1E",
  textMuted: "#6B7280",
  border: "#E5E5EA",
  accent: "#4F46E5",
  accentPressed: "#4338CA",
  error: "#DC2626",
} as const;

export const typography = {
  heading: {
    fontSize: 28,
    fontWeight: "700" as TextStyle["fontWeight"],
    lineHeight: 34,
    color: colors.text,
  },
  title: {
    fontSize: 18,
    fontWeight: "600" as TextStyle["fontWeight"],
    lineHeight: 24,
    color: colors.text,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as TextStyle["fontWeight"],
    lineHeight: 22,
    color: colors.text,
  },
};

export const shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: { elevation: 3 },
    default: {},
  }),
};
