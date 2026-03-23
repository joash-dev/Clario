import { Ionicons } from "@expo/vector-icons";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import {
  getApiErrorMessage,
  listNotesRequest,
  listTasksRequest,
  type NoteDTO,
  type TaskDTO,
} from "../../services/api";

const bg = "#F7F6F3";
const accent = "#3D3BF3";
const textPrimary = "#1A1A1A";
const textMuted = "#6B6966";
const cardSurface = "#EBE9E4";
const summaryCardBg = "#EFEFEC";
const borderSoft = "#E0DDD6";
const summaryLabelMuted = "#9E9E9E";
const emptyTextMuted = "#AAAAAA";

/** Loaded via useFonts — must match keys in useFonts() */
const FF = {
  serif: "DMSerifDisplay",
  sans: "DMSans",
  sansMedium: "DMSans-Medium",
  sansBold: "DMSans-Bold",
} as const;

function displayName(user: { name: string | null; email: string } | null): string {
  if (!user) return "there";
  const n = user.name?.trim();
  if (n) return n;
  return user.email.split("@")[0] || "there";
}

function greetingLabel(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function isDueToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function noteHeadline(note: NoteDTO): string {
  if (note.title?.trim()) return note.title.trim();
  const line = note.content.split(/\r?\n/).find((l) => l.trim().length > 0);
  return line?.trim().slice(0, 80) || "Untitled";
}

function notePreview(note: NoteDTO): string {
  const t = note.content.replace(/\s+/g, " ").trim();
  return t.length > 160 ? `${t.slice(0, 157)}…` : t;
}

function priorityStyle(p: TaskDTO["priority"]) {
  switch (p) {
    case "LOW":
      return { bg: "#E3EDE5", text: "#3D5A42" };
    case "MEDIUM":
      return { bg: "#F5EDD6", text: "#8A6A1B" };
    case "HIGH":
      return { bg: "#F5E4E4", text: "#9B3D3D" };
    default:
      return { bg: "#E8E8E8", text: textMuted };
  }
}

function statusDotColor(status: TaskDTO["status"]): string {
  switch (status) {
    case "TODO":
      return "#9CA3AF";
    case "IN_PROGRESS":
      return accent;
    case "DONE":
      return "#4A7C59";
    default:
      return "#9CA3AF";
  }
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskDTO[] | null>(null);
  const [notes, setNotes] = useState<NoteDTO[] | null>(null);
  const [notesTotal, setNotesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const fabSpin = useRef(new Animated.Value(0)).current;
  const firstFocus = useRef(true);

  const [fontsLoaded] = useFonts({
    DMSerifDisplay: DMSerifDisplay_400Regular,
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_500Medium,
    "DMSans-Bold": DMSans_700Bold,
  });

  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    Animated.timing(fabSpin, {
      toValue: fabOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fabOpen, fabSpin]);

  const fetchDashboard = useCallback(
    async (opts?: { initial?: boolean; refresh?: boolean }) => {
      try {
        if (opts?.refresh) setRefreshing(true);
        else if (opts?.initial) setLoading(true);
        setLoadError(null);
        const [tRes, nRes] = await Promise.all([
          listTasksRequest({ page: 1, limit: 50 }),
          listNotesRequest({ page: 1, limit: 2 }),
        ]);
        setTasks(tRes.data);
        setNotes(nRes.data);
        setNotesTotal(nRes.meta.total);
      } catch (e) {
        setLoadError(getApiErrorMessage(e));
        setTasks((t) => (t === null ? [] : t));
        setNotes((n) => (n === null ? [] : n));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        void fetchDashboard({ initial: true });
      } else {
        void fetchDashboard({});
      }
    }, [fetchDashboard])
  );

  const tasksDueToday = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => isDueToday(t.dueAt));
  }, [tasks]);

  const tasksTodayCount = tasksDueToday.length;

  const displayTasks = useMemo(() => {
    if (!tasks) return [];
    if (tasksDueToday.length > 0) return tasksDueToday.slice(0, 3);
    return [...tasks]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, 3);
  }, [tasks, tasksDueToday]);

  const firstName =
    user?.name?.trim()?.split(/\s+/)?.[0] ||
    user?.email?.split("@")[0] ||
    "there";
  const nameForGreeting = displayName(user);
  const initial =
    nameForGreeting.trim().charAt(0).toUpperCase() || "?";

  const spin = fabSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollInner,
            {
              paddingTop: 16,
              paddingBottom: 100,
            },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void fetchDashboard({ refresh: true })}
              tintColor={accent}
              colors={[accent]}
            />
          }
        >
        <View style={styles.horizontal}>
          {loadError ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{loadError}</Text>
              <Pressable
                onPress={() => void fetchDashboard({ initial: true })}
                style={styles.retryBtn}
              >
                <Text style={styles.retryLabel}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.headerRow}>
            <View style={styles.headerTextCol}>
              <Text
                style={styles.greeting}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {greetingLabel()}, {firstName}
              </Text>
              <Text style={styles.dateSub}>{formatTodayDate()}</Text>
            </View>
            <Pressable
              onPress={() => router.push("/(tabs)/profile")}
              style={styles.avatar}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              <Text style={styles.avatarLetter}>{initial}</Text>
            </Pressable>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={accent}
                style={styles.summaryCardIcon}
              />
              <Text style={styles.summaryCount}>
                {tasks ? tasksTodayCount : "—"}
              </Text>
              <Text style={styles.summaryLabel}>due today</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color={accent}
                style={styles.summaryCardIcon}
              />
              <Text style={styles.summaryCount}>
                {tasks ? notesTotal : "—"}
              </Text>
              <Text style={styles.summaryLabel}>total notes</Text>
            </View>
          </View>

          <View style={[styles.sectionHeadRow, styles.firstSectionHead]}>
            <Text style={styles.sectionTitle}>{"Today's Tasks"}</Text>
            <Pressable
              onPress={() => router.push("/(tabs)/tasks")}
              hitSlop={8}
            >
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>

          {loading && tasks === null ? (
            <View style={styles.taskList}>
              {[0, 1, 2].map((i) => (
                <Animated.View
                  key={i}
                  style={[styles.taskSkeleton, { opacity: pulse }]}
                />
              ))}
            </View>
          ) : displayTasks.length > 0 ? (
            <View style={styles.taskList}>
              {displayTasks.map((task) => (
                <Pressable
                  key={task.id}
                  style={styles.taskRow}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/tasks",
                      params: { openTaskId: task.id },
                    })
                  }
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusDotColor(task.status) },
                    ]}
                  />
                  <View style={styles.taskMain}>
                    <Text
                      style={[
                        styles.taskTitle,
                        task.status === "DONE" && styles.taskTitleDone,
                      ]}
                      numberOfLines={1}
                    >
                      {task.title}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.priorityPill,
                      { backgroundColor: priorityStyle(task.priority).bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        { color: priorityStyle(task.priority).text },
                      ]}
                    >
                      {task.priority}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : !loadError ? (
            <View style={styles.emptyBlock}>
              <Ionicons
                name="clipboard-outline"
                size={56}
                color="#CCCCCC"
                style={styles.emptyStateIcon}
              />
              <Text style={styles.emptyTitle}>No tasks yet</Text>
              <Pressable
                style={styles.outlineBtn}
                onPress={() => router.push("/(tabs)/tasks")}
              >
                <Text style={styles.outlineBtnLabel}>
                  Create your first task
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.sectionDivider} />

          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionTitle}>Recent Notes</Text>
            <Pressable
              onPress={() => router.push("/(tabs)/notes")}
              hitSlop={8}
            >
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>

          {loading && notes === null ? (
            <View style={styles.noteCardList}>
              {[0, 1].map((i) => (
                <Animated.View
                  key={i}
                  style={[styles.noteSkeleton, { opacity: pulse }]}
                />
              ))}
            </View>
          ) : notes && notes.length > 0 ? (
            <View style={styles.noteCardList}>
              {notes.map((note) => (
                <Pressable
                  key={note.id}
                  style={styles.noteCard}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/notes",
                      params: { openNoteId: note.id },
                    })
                  }
                >
                  {note.summary ? (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  ) : null}
                  <Text style={styles.noteCardTitle} numberOfLines={1}>
                    {noteHeadline(note)}
                  </Text>
                  <Text style={styles.noteCardPreview} numberOfLines={2}>
                    {notePreview(note)}
                  </Text>
                  <Text style={styles.noteCardTime}>
                    {formatRelative(note.updatedAt)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : !loadError ? (
            <View style={styles.emptyNotes}>
              <Ionicons
                name="document-outline"
                size={56}
                color="#CCCCCC"
                style={styles.emptyStateIcon}
              />
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Pressable
                style={styles.outlineBtn}
                onPress={() => router.push("/(tabs)/notes")}
              >
                <Text style={styles.outlineBtnLabel}>
                  Write your first note
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
      </SafeAreaView>

      {fabOpen ? (
        <Pressable
          style={styles.fabBackdrop}
          onPress={() => setFabOpen(false)}
        />
      ) : null}

      <View
        style={[
          styles.fabStack,
          { bottom: 32 + insets.bottom, right: 20 },
        ]}
      >
        {fabOpen ? (
          <View style={styles.fabActions}>
            <Pressable
              style={styles.fabMini}
              onPress={() => {
                setFabOpen(false);
                router.push({
                  pathname: "/(tabs)/tasks",
                  params: { compose: "1" },
                });
              }}
            >
              <Text style={styles.fabMiniLabel}>New Task</Text>
            </Pressable>
            <Pressable
              style={styles.fabMini}
              onPress={() => {
                setFabOpen(false);
                router.push({
                  pathname: "/(tabs)/notes",
                  params: { compose: "1" },
                });
              }}
            >
              <Text style={styles.fabMiniLabel}>New Note</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable
          style={styles.fab}
          onPress={() => setFabOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel="Quick actions"
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: bg,
  },
  safeArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
  },
  horizontal: {
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
  },
  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F5E8E8",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8D4D4",
  },
  inlineErrorText: {
    flex: 1,
    fontFamily: FF.sans,
    fontSize: 13,
    lineHeight: 18,
    color: "#8B3D3D",
    minWidth: 120,
  },
  retryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  retryLabel: {
    fontFamily: FF.sansMedium,
    fontSize: 14,
    fontWeight: "600",
    color: accent,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    fontFamily: FF.serif,
    fontSize: 26,
    lineHeight: 32,
    color: textPrimary,
  },
  dateSub: {
    fontFamily: FF.sans,
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#9E9E9E",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: accent,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontFamily: FF.sansBold,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  summaryCard: {
    flex: 1,
    minHeight: 110,
    backgroundColor: summaryCardBg,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E8E8E4",
  },
  summaryCardIcon: {
    opacity: 0.6,
    marginBottom: 8,
  },
  summaryCount: {
    fontFamily: FF.sansBold,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
    color: accent,
  },
  summaryLabel: {
    fontFamily: FF.sans,
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    color: summaryLabelMuted,
  },
  sectionHeadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  firstSectionHead: {
    marginTop: 32,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#E8E8E4",
    marginTop: 40,
    marginBottom: 32,
    marginHorizontal: 0,
  },
  sectionTitle: {
    fontFamily: FF.serif,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: textPrimary,
  },
  seeAll: {
    fontFamily: FF.sansMedium,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
    color: accent,
  },
  taskList: {
    marginTop: 14,
    gap: 10,
  },
  taskSkeleton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#D8D6D1",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: cardSurface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: borderSoft,
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskMain: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    fontFamily: FF.sansMedium,
    fontSize: 15,
    lineHeight: 20,
    color: textPrimary,
    fontWeight: "500",
  },
  taskTitleDone: {
    textDecorationLine: "line-through",
    color: textMuted,
    fontWeight: "400",
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  priorityText: {
    fontFamily: FF.sansMedium,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  emptyBlock: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyStateIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: FF.sans,
    fontSize: 15,
    lineHeight: 21,
    color: emptyTextMuted,
    marginBottom: 16,
    textAlign: "center",
  },
  outlineBtn: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: accent,
    backgroundColor: "transparent",
    alignItems: "center",
  },
  outlineBtnLabel: {
    fontFamily: FF.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: accent,
  },
  emptyNotes: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 16,
  },
  noteCardList: {
    marginTop: 14,
    gap: 12,
  },
  noteSkeleton: {
    height: 108,
    borderRadius: 14,
    backgroundColor: "#D8D6D1",
  },
  noteCard: {
    backgroundColor: cardSurface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: borderSoft,
    position: "relative",
  },
  aiBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: `${accent}18`,
  },
  aiBadgeText: {
    fontFamily: FF.sansBold,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    color: accent,
    letterSpacing: 0.5,
  },
  noteCardTitle: {
    fontFamily: FF.sansBold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: textPrimary,
    paddingRight: 48,
  },
  noteCardPreview: {
    fontFamily: FF.sans,
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: textMuted,
  },
  noteCardTime: {
    fontFamily: FF.sans,
    marginTop: 10,
    fontSize: 12,
    lineHeight: 16,
    color: textMuted,
  },
  fabBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 40,
  },
  fabStack: {
    position: "absolute",
    zIndex: 50,
    alignItems: "flex-end",
  },
  fabActions: {
    marginBottom: 12,
    gap: 10,
    alignItems: "flex-end",
  },
  fabMini: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderSoft,
  },
  fabMiniLabel: {
    fontFamily: FF.sans,
    fontSize: 14,
    fontWeight: "600",
    color: textPrimary,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
});
