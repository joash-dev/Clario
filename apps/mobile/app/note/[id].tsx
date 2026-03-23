import { Ionicons } from "@expo/vector-icons";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  createTaskRequest,
  deleteNoteRequest,
  getApiErrorMessage,
  getNoteRequest,
  summarizeNoteRequest,
  suggestTasksFromNoteRequest,
  type NoteDTO,
  type SuggestedTaskFromNote,
  type TaskPriority,
} from "../../services/api";

const bg = "#F7F6F3";
const accent = "#3D3BF3";
const textPrimary = "#1A1A1A";
const contentColor = "#3D3D3A";

const FF = {
  serif: "DMSerifDisplay",
  sans: "DMSans",
  sansMedium: "DMSans-Medium",
  sansBold: "DMSans-Bold",
} as const;

function formatCreated(iso: string): string {
  const d = new Date(iso);
  return `Created ${d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;
}

function cleanSuggestedTitle(title: string): string {
  return title.replace(/['"]/g, "").replace(/,\s*$/, "").trim();
}

function priorityBadge(p: TaskPriority): { bg: string; text: string } {
  switch (p) {
    case "LOW":
      return { bg: "#EAF3DE", text: "#3B6D11" };
    case "MEDIUM":
      return { bg: "#FAEEDA", text: "#854F0B" };
    case "HIGH":
      return { bg: "#FCEBEB", text: "#A32D2D" };
    default:
      return { bg: "#E8E8E8", text: "#666666" };
  }
}

type SuggestionRow = SuggestedTaskFromNote & { key: string };

export default function NoteDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rawId = useLocalSearchParams<{ id?: string | string[] }>().id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [note, setNote] = useState<NoteDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [addedKeys, setAddedKeys] = useState<Record<string, boolean>>({});
  const hasLoadedOnce = useRef(false);

  const [fontsLoaded] = useFonts({
    DMSerifDisplay: DMSerifDisplay_400Regular,
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_500Medium,
    "DMSans-Bold": DMSans_700Bold,
  });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      setLoadError(null);
      const n = await getNoteRequest(id);
      setNote(n);
      hasLoadedOnce.current = true;
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
      setNote(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    hasLoadedOnce.current = false;
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openMenu = useCallback(() => {
    if (!note) return;
    const edit = () =>
      router.push({ pathname: "/note/edit/[id]", params: { id: note.id } });
    const del = () => {
      Alert.alert(
        "Delete note",
        "This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await deleteNoteRequest(note.id);
                  router.back();
                } catch (e) {
                  Alert.alert("Could not delete", getApiErrorMessage(e));
                }
              })();
            },
          },
        ]
      );
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Edit", "Delete"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) edit();
          if (buttonIndex === 2) del();
        }
      );
    } else {
      Alert.alert("Note", undefined, [
        { text: "Edit", onPress: edit },
        { text: "Delete", style: "destructive", onPress: del },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [note, router]);

  const onSummarize = useCallback(async () => {
    if (!note || summarizing) return;
    setSummarizing(true);
    try {
      const { summary } = await summarizeNoteRequest(note.id);
      setNote((n) => (n ? { ...n, summary } : n));
    } catch (e) {
      Alert.alert("Summarize failed", getApiErrorMessage(e));
    } finally {
      setSummarizing(false);
    }
  }, [note, summarizing]);

  const onGenerateTasks = useCallback(async () => {
    if (!note || generating) return;
    setGenerating(true);
    try {
      const { tasks } = await suggestTasksFromNoteRequest(note.id);
      setSuggestions(
        tasks.map((t, i) => ({
          ...t,
          priority: (t.priority ?? "MEDIUM") as TaskPriority,
          key: `${i}-${t.title.slice(0, 24)}`,
        }))
      );
      setAddedKeys({});
    } catch (e) {
      Alert.alert("Could not generate tasks", getApiErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  }, [note, generating]);

  const onAddSuggestion = useCallback(
    async (row: SuggestionRow) => {
      if (addedKeys[row.key]) return;
      try {
        await createTaskRequest({
          title: row.title,
          priority: row.priority ?? "MEDIUM",
          description: row.description ?? undefined,
        });
        setAddedKeys((prev) => ({ ...prev, [row.key]: true }));
      } catch (e) {
        Alert.alert("Could not add task", getApiErrorMessage(e));
      }
    },
    [addedKeys]
  );

  const dismissSuggestion = useCallback((key: string) => {
    setSuggestions((prev) => prev.filter((s) => s.key !== key));
  }, []);

  const displayTitle = useMemo(() => {
    if (!note) return "";
    if (note.title?.trim()) return note.title.trim();
    const line = note.content.split(/\r?\n/).find((l) => l.trim().length > 0);
    return line?.trim().slice(0, 200) || "Untitled";
  }, [note]);

  if (!fontsLoaded) {
    return null;
  }

  if (!id) {
    return (
      <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]}>
        <Text style={styles.err}>Invalid note.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={[styles.topBar, { paddingHorizontal: 20 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back-outline" size={28} color={accent} />
        </Pressable>
        <Pressable onPress={openMenu} hitSlop={12} disabled={!note}>
          <Ionicons
            name="ellipsis-horizontal"
            size={24}
            color={note ? accent : "#CCCCCC"}
          />
        </Pressable>
      </View>

      {loading && !note ? (
        <View style={styles.skeletonWrap}>
          <View style={styles.skelTitle} />
          <View style={styles.skelLine} />
          <View style={styles.skelBlock} />
        </View>
      ) : loadError && !note ? (
        <View style={styles.centerMsg}>
          <Text style={styles.err}>{loadError}</Text>
          <Pressable onPress={() => void load()}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </View>
      ) : note ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{displayTitle}</Text>
          <Text style={styles.createdLine}>{formatCreated(note.createdAt)}</Text>
          <View style={styles.divider} />
          <Text style={styles.bodyText}>{note.content}</Text>

          {note.summary ? (
            <View style={styles.summaryGlassOuter}>
              <View style={styles.summaryFrostLayer1} />
              <View style={styles.summaryFrostLayer2} />
              <View style={styles.summaryShimmerLine} />
              <View style={styles.summaryGlassInner}>
                <View style={styles.summaryHeaderRow}>
                  <Ionicons name="sparkles" size={13} color="#3D3BF3" />
                  <Text style={styles.summaryHeaderLabel}>AI Summary</Text>
                </View>
                <Text style={styles.summaryBodyText}>{note.summary}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.aiRow}>
            <Pressable
              style={[styles.aiBtnOutline, summarizing && { opacity: 0.7 }]}
              onPress={() => void onSummarize()}
              disabled={summarizing}
            >
              {summarizing ? (
                <ActivityIndicator color={accent} size="small" />
              ) : (
                <Ionicons name="star-outline" size={18} color={accent} />
              )}
              <Text style={styles.aiBtnOutlineText}>Summarize</Text>
            </Pressable>
            <Pressable
              style={[styles.aiBtnSolid, generating && { opacity: 0.7 }]}
              onPress={() => void onGenerateTasks()}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.aiBtnSolidText}>Generate Tasks</Text>
            </Pressable>
          </View>

          {suggestions.length > 0 ? (
            <View style={styles.suggestedSection}>
              <Text style={styles.suggestedTitle}>Suggested Tasks</Text>
              {suggestions.map((s) => {
                const pri = priorityBadge(s.priority ?? "MEDIUM");
                const added = addedKeys[s.key];
                return (
                  <View key={s.key} style={styles.suggestionCard}>
                    <Text style={styles.suggestionTitle}>
                      {cleanSuggestedTitle(s.title)}
                    </Text>
                    <View style={[styles.priBadge, { backgroundColor: pri.bg }]}>
                      <Text style={[styles.priBadgeText, { color: pri.text }]}>
                        {s.priority ?? "MEDIUM"}
                      </Text>
                    </View>
                    <View style={styles.suggestionBtnRow}>
                      <Pressable
                        style={[
                          styles.addTaskBtn,
                          added && styles.addTaskBtnDone,
                        ]}
                        onPress={() => void onAddSuggestion(s)}
                        disabled={added}
                      >
                        <Text
                          style={[
                            styles.addTaskBtnText,
                            added && styles.addTaskBtnTextDone,
                          ]}
                        >
                          {added ? "Added ✓" : "Add Task"}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => dismissSuggestion(s.key)}>
                        <Text style={styles.dismissText}>Dismiss</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: bg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginBottom: 8,
  },
  title: {
    fontFamily: FF.serif,
    fontSize: 24,
    lineHeight: 30,
    color: textPrimary,
    marginBottom: 8,
  },
  createdLine: {
    fontFamily: FF.sans,
    fontSize: 12,
    color: "#AAAAAA",
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0EC",
    marginVertical: 16,
  },
  bodyText: {
    fontFamily: FF.sans,
    fontSize: 16,
    color: contentColor,
    lineHeight: 26,
  },
  summaryGlassOuter: {
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(61, 59, 243, 0.18)",
    backgroundColor: "rgba(238, 237, 254, 0.7)",
  },
  summaryFrostLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 16,
  },
  summaryFrostLayer2: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 16,
  },
  summaryShimmerLine: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    zIndex: 2,
  },
  summaryGlassInner: {
    padding: 14,
    zIndex: 3,
  },
  summaryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryHeaderLabel: {
    fontFamily: FF.sansMedium,
    fontSize: 12,
    fontWeight: "600",
    color: "#3D3BF3",
    marginLeft: 6,
    letterSpacing: 0.4,
  },
  summaryBodyText: {
    fontFamily: FF.sans,
    fontSize: 13,
    color: "#3D3D3A",
    lineHeight: 20,
  },
  aiRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },
  aiBtnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: accent,
    borderRadius: 12,
    paddingVertical: 12,
  },
  aiBtnOutlineText: {
    fontFamily: FF.sans,
    fontSize: 14,
    color: accent,
  },
  aiBtnSolid: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: accent,
    borderRadius: 12,
    paddingVertical: 12,
  },
  aiBtnSolidText: {
    fontFamily: FF.sans,
    fontSize: 14,
    color: "#FFFFFF",
  },
  suggestedSection: {
    marginTop: 24,
  },
  suggestedTitle: {
    fontFamily: FF.sansMedium,
    fontSize: 13,
    fontWeight: "600",
    color: textPrimary,
    marginBottom: 12,
  },
  suggestionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E8E8E4",
  },
  suggestionTitle: {
    fontFamily: FF.sans,
    fontSize: 15,
    color: textPrimary,
    marginBottom: 8,
  },
  priBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  priBadgeText: {
    fontFamily: FF.sansMedium,
    fontSize: 11,
    fontWeight: "500",
  },
  suggestionBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addTaskBtn: {
    backgroundColor: accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addTaskBtnDone: {
    backgroundColor: "#22C55E",
  },
  addTaskBtnText: {
    fontFamily: FF.sansMedium,
    fontSize: 13,
    color: "#FFFFFF",
  },
  addTaskBtnTextDone: {
    color: "#FFFFFF",
  },
  dismissText: {
    fontFamily: FF.sans,
    fontSize: 13,
    color: "#AAAAAA",
  },
  skeletonWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  skelTitle: {
    height: 28,
    width: "70%",
    borderRadius: 8,
    backgroundColor: "#E0DDD8",
  },
  skelLine: {
    height: 14,
    width: "40%",
    borderRadius: 6,
    backgroundColor: "#E0DDD8",
  },
  skelBlock: {
    height: 120,
    borderRadius: 10,
    backgroundColor: "#E0DDD8",
    marginTop: 8,
  },
  centerMsg: {
    padding: 24,
    alignItems: "center",
  },
  err: {
    fontFamily: FF.sans,
    fontSize: 14,
    color: "#8B3D3D",
    textAlign: "center",
  },
  retry: {
    marginTop: 12,
    fontFamily: FF.sansMedium,
    fontSize: 16,
    color: accent,
  },
});
