import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootLayoutInner } from "../components/RootLayoutInner";

/**
 * Web: skip react-native-gesture-handler — full package import breaks Metro web
 * (e.g. ForceTouchGestureHandler resolution). Native uses app/_layout.tsx instead.
 */
export default function RootLayout() {
  return (
    <View style={styles.root}>
      <SafeAreaProvider>
        <RootLayoutInner />
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
