import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { usePathname, useRouter } from "expo-router";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

const TABS: {
  href: "/(tabs)/index" | "/(tabs)/tasks" | "/(tabs)/ai" | "/(tabs)/notes" | "/(tabs)/profile";
  outline: IoniconsName;
  filled: IoniconsName;
}[] = [
  { href: "/(tabs)/index", outline: "grid-outline", filled: "grid" },
  {
    href: "/(tabs)/tasks",
    outline: "checkmark-circle-outline",
    filled: "checkmark-circle",
  },
  { href: "/(tabs)/ai", outline: "sparkles-outline", filled: "sparkles" },
  {
    href: "/(tabs)/notes",
    outline: "document-text-outline",
    filled: "document-text",
  },
  { href: "/(tabs)/profile", outline: "person-outline", filled: "person" },
];

function activeIndexFromPath(pathname: string): number {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p.includes("/tasks")) return 1;
  if (p.includes("/ai")) return 2;
  if (p.includes("/notes")) return 3;
  if (p.includes("/profile")) return 4;
  return 0;
}

export function VerticalNav() {
  const router = useRouter();
  const pathname = usePathname();
  const activeIdx = useMemo(() => activeIndexFromPath(pathname), [pathname]);

  const opacities = useRef(
    [1, 0, 0, 0, 0].map((v) => new Animated.Value(v))
  ).current;
  const scales = useRef(
    [1.1, 1, 1, 1, 1].map((v) => new Animated.Value(v))
  ).current;

  useEffect(() => {
    const springs = TABS.flatMap((_, i) => {
      const active = i === activeIdx;
      return [
        Animated.spring(opacities[i], {
          toValue: active ? 1 : 0,
          useNativeDriver: true,
          tension: 70,
          friction: 10,
        }),
        Animated.spring(scales[i], {
          toValue: active ? 1.1 : 1,
          useNativeDriver: true,
          tension: 70,
          friction: 10,
        }),
      ];
    });
    Animated.parallel(springs).start();
  }, [activeIdx, opacities, scales]);

  return (
    <View
      style={styles.container}
      pointerEvents="box-none"
      accessibilityRole="tablist"
    >
      <View style={styles.pill}>
        {TABS.map((tab, i) => {
          const focused = i === activeIdx;
          const isAi = tab.href === "/(tabs)/ai";
          return (
            <Pressable
              key={tab.href}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => router.navigate(tab.href)}
              style={[
                styles.tabPress,
                isAi && focused && styles.tabPressAiGlow,
              ]}
            >
              <View style={styles.tabItem}>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.activeBg, { opacity: opacities[i] }]}
                />
                <Animated.View
                  style={{ transform: [{ scale: scales[i] }] }}
                >
                  <Ionicons
                    name={focused ? tab.filled : tab.outline}
                    size={20}
                    color={
                      focused
                        ? "#FFFFFF"
                        : "rgba(255,255,255,0.45)"
                    }
                  />
                </Animated.View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 16,
    top: "50%",
    zIndex: 999,
    transform: [{ translateY: -140 }],
  },
  pill: {
    backgroundColor: "#1A1830",
    borderRadius: 32,
    paddingVertical: 12,
    paddingHorizontal: 8,
    width: 56,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
      default: {},
    }),
  },
  tabPress: {
    marginVertical: 4,
    borderRadius: 20,
  },
  tabPressAiGlow: {
    ...Platform.select({
      ios: {
        shadowColor: "#3D3BF3",
        shadowOpacity: 0.6,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      },
      android: {
        elevation: 6,
        shadowColor: "#3D3BF3",
      },
      default: {},
    }),
  },
  tabItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  activeBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#3D3BF3",
    borderRadius: 20,
  },
});
