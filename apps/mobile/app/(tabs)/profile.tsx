import { Ionicons } from "@expo/vector-icons";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { useCallback, type ComponentProps, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  APP_VERSION,
  DISPLAY_AI_PROVIDER_LABEL,
} from "../../constants/config";
import { useAuth } from "../../context/AuthContext";
import type { AuthUser } from "../../services/api";

const bg = "#F7F6F3";
const accent = "#3D3BF3";
const textPrimary = "#1A1A1A";
const cardBg = "#FFFFFF";
const rowBorder = "#F0F0EC";
const labelMuted = "#AAAAAA";
const danger = "#E24B4A";

const FF = {
  serif: "DMSerifDisplay",
  sans: "DMSans",
  sansMedium: "DMSans-Medium",
  sansBold: "DMSans-Bold",
} as const;

function formatMemberSince(iso: string | undefined): string {
  if (!iso) return "2026";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "2026";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function avatarInitial(user: AuthUser | null): string {
  if (!user) return "?";
  const n = user.name?.trim();
  if (n) return n.charAt(0).toUpperCase();
  return user.email.charAt(0).toUpperCase() || "?";
}

function displayFullName(user: AuthUser | null): string {
  if (!user) return "";
  const n = user.name?.trim();
  if (n) return n;
  return user.email.split("@")[0] || "User";
}

function ProfileRow({
  icon,
  iconColor = accent,
  children,
  isLast,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  children: ReactNode;
  isLast: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.rowInner, !isLast && styles.rowBorder]}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <View style={styles.rowMiddle}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.75 }]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [fontsLoaded] = useFonts({
    DMSerifDisplay: DMSerifDisplay_400Regular,
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_500Medium,
    "DMSans-Bold": DMSans_700Bold,
  });

  const onLogoutPress = useCallback(() => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await logout();
            router.replace("/(auth)/login");
          })();
        },
      },
    ]);
  }, [logout, router]);

  if (!fontsLoaded) {
    return null;
  }

  const showSkeleton = user === null;
  const nameValue = user?.name?.trim() || "—";
  const emailValue = user?.email ?? "—";
  const memberValue = formatMemberSince(user?.createdAt);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Profile</Text>

        <View style={styles.avatarBlock}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{avatarInitial(user)}</Text>
          </View>
          {showSkeleton ? (
            <>
              <View style={styles.skeletonLineWide} />
              <View style={styles.skeletonLineNarrow} />
            </>
          ) : (
            <>
              <Text style={styles.heroName}>{displayFullName(user)}</Text>
              <Text style={styles.heroEmail}>{user!.email}</Text>
            </>
          )}
        </View>

        <View style={styles.card}>
          <ProfileRow icon="person-outline" isLast={false}>
            <>
              <Text style={styles.rowLabel}>Full Name</Text>
              {showSkeleton ? (
                <View style={styles.skeletonValue} />
              ) : (
                <Text style={styles.rowValue}>{nameValue}</Text>
              )}
            </>
          </ProfileRow>
          <ProfileRow icon="mail-outline" isLast={false}>
            <>
              <Text style={styles.rowLabel}>Email</Text>
              {showSkeleton ? (
                <View style={styles.skeletonValue} />
              ) : (
                <Text style={styles.rowValue}>{emailValue}</Text>
              )}
            </>
          </ProfileRow>
          <ProfileRow icon="calendar-outline" isLast>
            <>
              <Text style={styles.rowLabel}>Member since</Text>
              {showSkeleton ? (
                <View style={styles.skeletonValueShort} />
              ) : (
                <Text style={styles.rowValue}>{memberValue}</Text>
              )}
            </>
          </ProfileRow>
        </View>

        <View style={styles.card}>
          <ProfileRow icon="information-circle-outline" isLast={false}>
            <>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>{APP_VERSION}</Text>
            </>
          </ProfileRow>
          <ProfileRow icon="sparkles-outline" isLast>
            <>
              <Text style={styles.rowLabel}>AI Provider</Text>
              <View style={styles.aiPill}>
                <Text style={styles.aiPillText}>{DISPLAY_AI_PROVIDER_LABEL}</Text>
              </View>
            </>
          </ProfileRow>
        </View>

        <View style={[styles.card, styles.dangerCard]}>
          <ProfileRow
            icon="log-out-outline"
            iconColor={danger}
            isLast
            onPress={onLogoutPress}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </ProfileRow>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingRight: 80,
  },
  screenTitle: {
    fontFamily: FF.serif,
    fontSize: 28,
    lineHeight: 34,
    color: textPrimary,
    marginBottom: 8,
  },
  avatarBlock: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontFamily: FF.sansMedium,
    fontSize: 32,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  heroName: {
    fontFamily: FF.sansMedium,
    fontSize: 18,
    fontWeight: "600",
    color: textPrimary,
    marginTop: 12,
    textAlign: "center",
  },
  heroEmail: {
    fontFamily: FF.sans,
    fontSize: 14,
    color: "#888888",
    marginTop: 4,
    textAlign: "center",
  },
  skeletonLineWide: {
    marginTop: 12,
    height: 20,
    width: 160,
    borderRadius: 6,
    backgroundColor: "#E0DDD8",
  },
  skeletonLineNarrow: {
    marginTop: 8,
    height: 14,
    width: 200,
    borderRadius: 6,
    backgroundColor: "#E0DDD8",
  },
  skeletonValue: {
    marginTop: 2,
    height: 17,
    width: "70%",
    maxWidth: 220,
    borderRadius: 4,
    backgroundColor: "#E8E6E1",
  },
  skeletonValueShort: {
    marginTop: 2,
    height: 17,
    width: 100,
    borderRadius: 4,
    backgroundColor: "#E8E6E1",
  },
  card: {
    backgroundColor: cardBg,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  dangerCard: {
    marginBottom: 32,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: rowBorder,
  },
  rowMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  rowLabel: {
    fontFamily: FF.sans,
    fontSize: 12,
    color: labelMuted,
    marginBottom: 2,
  },
  rowValue: {
    fontFamily: FF.sans,
    fontSize: 15,
    color: textPrimary,
  },
  aiPill: {
    alignSelf: "flex-start",
    marginTop: 2,
    backgroundColor: "#EEEDFE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  aiPillText: {
    fontFamily: FF.sans,
    fontSize: 12,
    color: accent,
  },
  logoutText: {
    fontFamily: FF.sansMedium,
    fontSize: 15,
    fontWeight: "500",
    color: danger,
  },
});
