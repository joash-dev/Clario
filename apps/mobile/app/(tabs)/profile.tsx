import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing, typography } from "../../styles/theme";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={typography.title}>Profile</Text>
      <Text style={styles.sub}>{user?.email ?? "—"}</Text>
      <Pressable onPress={() => void logout()} style={({ pressed }) => pressed && styles.pressed}>
        <Text style={styles.hint}>Log out</Text>
      </Pressable>
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
    marginTop: spacing.sm,
  },
  hint: {
    ...typography.body,
    color: colors.accent,
    marginTop: spacing.xl,
  },
  pressed: {
    opacity: 0.7,
  },
});
