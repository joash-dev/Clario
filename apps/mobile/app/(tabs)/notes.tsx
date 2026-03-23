import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../styles/theme";

export default function NotesScreen() {
  return (
    <View style={styles.container}>
      <Text style={typography.title}>Notes</Text>
      <Text style={styles.sub}>Placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  sub: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
