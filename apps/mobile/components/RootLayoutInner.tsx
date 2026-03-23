import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../context/AuthContext";
import { colors } from "../styles/theme";

/**
 * Shared tree for native + web root layouts (Auth, StatusBar, Stack).
 * Web root avoids react-native-gesture-handler (see app/_layout.web.tsx).
 */
export function RootLayoutInner() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </AuthProvider>
  );
}
