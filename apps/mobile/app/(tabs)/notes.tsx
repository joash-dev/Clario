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
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  createNoteRequest,
  getApiErrorMessage,
  listNotesRequest,
  type NoteDTO,
} from "../../services/api";

const bg = "#F7F6F3";
const accent = "#3D3BF3";
const textPrimary = "#1A1A1A";
const cardBg = "#FAFAF8";
const searchBg = "#EFEFEC";

const FF = {
  serif: "DMSerifDisplay",
  sans: "DMSans",
  sansMedium: "DMSans-Medium",
  sansBold: "DMSans-Bold",
} as const;

function noteHeadline(note: NoteDTO): string {
  if (note.title?.trim()) return note.title.trim();
  const line = note.content.split(/\r?\n/).find((l) => l.trim().length > 0);
  return line?.trim().slice(0, 120) || "Untitled";
}

function notePreview(note: NoteDTO): string {
  const t = note.content.replace(/\s+/g, " ").trim();
  return t.length > 160 ? `${t.slice(0, 157)}…` : t;
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

async function fetchAllNotesByCreatedDesc(): Promise<NoteDTO[]> {
  const all: NoteDTO[] = [];
  let page = 1;
  const limit = 50;
  while (true) {
    const res = await listNotesRequest({
      page,
      limit,
      sortBy: "createdAt",
      order: "desc",
    });
    all.push(...res.data);
    if (res.data.length < limit || all.length >= res.meta.total) break;
    page += 1;
  }
  return all.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export default function NotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ compose?: string }>();

  const [notes, setNotes] = useState<NoteDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createVisible, setCreateVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  const sheetY = useRef(
    new Animated.Value(Dimensions.get("window").height)
  ).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.45)).current;
  const firstFocus = useRef(true);

  const [fontsLoaded] = useFonts({
    DMSerifDisplay: DMSerifDisplay_400Regular,
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_500Medium,
    "DMSans-Bold": DMSans_700Bold,
  });

  const screenH = Dimensions.get("window").height;

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
    Animated.timing(searchAnim, {
      toValue: searchOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [searchOpen, searchAnim]);

  useEffect(() => {
    if (!createVisible) return;
    sheetY.setValue(screenH);
    Animated.spring(sheetY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [createVisible, screenH, sheetY]);

  const loadNotes = useCallback(async (opts?: { initial?: boolean }) => {
    try {
      if (opts?.initial) setLoading(true);
      setLoadError(null);
      const data = await fetchAllNotesByCreatedDesc();
      setNotes(data);
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
      setNotes((n) => (n === null ? [] : n));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        void loadNotes({ initial: true });
      } else {
        void loadNotes();
      }
    }, [loadNotes])
  );

  useEffect(() => {
    if (params.compose !== "1") return;
    setCreateVisible(true);
    setNewTitle("");
    setNewContent("");
    requestAnimationFrame(() => {
      router.setParams({ compose: undefined });
    });
  }, [params.compose, router]);

  const closeCreate = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(sheetY, {
      toValue: screenH,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setCreateVisible(false);
    });
  }, [screenH, sheetY]);

  const openCreate = useCallback(() => {
    setNewTitle("");
    setNewContent("");
    setCreateVisible(true);
  }, []);

  const onSaveNote = useCallback(async () => {
    const content = newContent.trim();
    if (!content || saving) return;
    setSaving(true);
    try {
      const titleTrim = newTitle.trim();
      const note = await createNoteRequest({
        content,
        title: titleTrim.length > 0 ? titleTrim : null,
      });
      setNotes((prev) => {
        const list = prev ?? [];
        return [note, ...list].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );
      });
      closeCreate();
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [newContent, newTitle, saving, closeCreate]);

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const title = (n.title ?? "").toLowerCase();
      const content = n.content.toLowerCase();
      return title.includes(q) || content.includes(q);
    });
  }, [notes, searchQuery]);

  const searchHeight = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 52],
  });

  const searchOpacity = searchAnim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.5, 1],
  });

  if (!fontsLoaded) {
    return null;
  }

  const renderNote = ({ item }: { item: NoteDTO }) => (
    <Pressable
      style={styles.noteCard}
      onPress={() =>
        router.push({ pathname: "/note/[id]", params: { id: item.id } })
      }
    >
      <View style={styles.noteTopRow}>
        <Text style={styles.noteCardTitle} numberOfLines={1}>
          {noteHeadline(item)}
        </Text>
        {item.summary ? (
          <View style={styles.aiPill}>
            <Text style={styles.aiPillText}>AI</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.notePreview} numberOfLines={2}>
        {notePreview(item)}
      </Text>
      <View style={styles.noteBottomRow}>
        <Text style={styles.noteTime}>{formatRelative(item.updatedAt)}</Text>
        <Ionicons name="chevron-forward-outline" size={16} color="#CCCCCC" />
      </View>
    </Pressable>
  );

  const listHeader = (
    <View style={styles.listHeader}>
      {loadError ? (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{loadError}</Text>
          <Pressable onPress={() => void loadNotes({ initial: true })}>
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Notes</Text>
        <Pressable
          onPress={() => setSearchOpen((o) => !o)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Search notes"
        >
          <Ionicons name="search-outline" size={26} color={accent} />
        </Pressable>
      </View>
      <Animated.View style={{ height: searchHeight, overflow: "hidden" }}>
        <Animated.View style={{ opacity: searchOpacity }}>
          <View style={styles.searchInner}>
            <Ionicons name="search" size={20} color="#888888" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search notes..."
              placeholderTextColor="#AAAAAA"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onBlur={() => {
                if (!searchQuery.trim()) setSearchOpen(false);
              }}
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => {
                  setSearchQuery("");
                  setSearchOpen(false);
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={22} color="#AAAAAA" />
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {loading && notes === null ? (
        <View style={styles.shell}>
          <View style={styles.listHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.screenTitle}>Notes</Text>
              <Ionicons name="search-outline" size={26} color={accent} />
            </View>
          </View>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[styles.skeletonCard, { opacity: pulse }]}
            />
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          renderItem={renderNote}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.listContent, { paddingRight: 80 }]}
          ListEmptyComponent={
            !loadError ? (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="document-outline"
                  size={64}
                  color="#CCCCCC"
                />
                <Text style={styles.emptyTitle}>No notes yet</Text>
                <Pressable style={styles.outlineBtn} onPress={openCreate}>
                  <Text style={styles.outlineBtnLabel}>
                    Write your first note
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadNotes();
              }}
              tintColor={accent}
              colors={[accent]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        style={[styles.fab, { bottom: 32 + insets.bottom, right: 20 }]}
        onPress={openCreate}
        accessibilityRole="button"
        accessibilityLabel="New note"
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </Pressable>

      <Modal
        visible={createVisible}
        transparent
        animationType="none"
        onRequestClose={closeCreate}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.createBackdrop} onPress={closeCreate} />
          <Animated.View
            style={[
              styles.createSheet,
              {
                paddingBottom: insets.bottom + 16,
                maxHeight: screenH * 0.92,
                transform: [{ translateY: sheetY }],
              },
            ]}
          >
            <View style={styles.createHeader}>
              <Text style={styles.createTitle}>New Note</Text>
              <Pressable onPress={closeCreate} hitSlop={12}>
                <Text style={styles.createClose}>×</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.titleInput}
              placeholder="Title (optional)"
              placeholderTextColor="#AAAAAA"
              value={newTitle}
              onChangeText={setNewTitle}
              editable={!saving}
            />
            <TextInput
              style={styles.contentInput}
              placeholder="Write your note here..."
              placeholderTextColor="#AAAAAA"
              value={newContent}
              onChangeText={setNewContent}
              multiline
              textAlignVertical="top"
              editable={!saving}
            />
            <Pressable
              style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
              onPress={() => void onSaveNote()}
              disabled={saving || !newContent.trim()}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Save Note</Text>
              )}
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: bg,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  listContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  listHeader: {
    paddingTop: 16,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  screenTitle: {
    fontFamily: FF.serif,
    fontSize: 28,
    lineHeight: 34,
    color: textPrimary,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: searchBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: FF.sans,
    fontSize: 15,
    color: textPrimary,
    paddingVertical: 0,
  },
  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
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
    color: "#8B3D3D",
    minWidth: 120,
  },
  retryLabel: {
    fontFamily: FF.sansMedium,
    fontSize: 14,
    fontWeight: "600",
    color: accent,
  },
  noteCard: {
    backgroundColor: cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#F0F0EE",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  noteTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  noteCardTitle: {
    flex: 1,
    fontFamily: FF.serif,
    fontSize: 17,
    color: textPrimary,
    minWidth: 0,
  },
  aiPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#EEEDFE",
  },
  aiPillText: {
    fontFamily: FF.sans,
    fontSize: 10,
    fontWeight: "600",
    color: accent,
  },
  notePreview: {
    marginTop: 6,
    fontFamily: FF.sans,
    fontSize: 14,
    color: "#888888",
    lineHeight: 20,
  },
  noteBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  noteTime: {
    fontFamily: FF.sans,
    fontSize: 12,
    color: "#AAAAAA",
  },
  emptyWrap: {
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 32,
  },
  emptyTitle: {
    fontFamily: FF.sans,
    fontSize: 16,
    color: "#AAAAAA",
    marginTop: 16,
    marginBottom: 20,
  },
  outlineBtn: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: accent,
    backgroundColor: "transparent",
  },
  outlineBtnLabel: {
    fontFamily: FF.sans,
    fontSize: 14,
    fontWeight: "500",
    color: accent,
  },
  skeletonCard: {
    height: 120,
    borderRadius: 14,
    backgroundColor: "#E0DDD8",
    marginBottom: 12,
  },
  fab: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  createBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  createSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  createHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  createTitle: {
    fontFamily: FF.serif,
    fontSize: 20,
    color: textPrimary,
  },
  createClose: {
    fontSize: 28,
    color: "#888888",
    lineHeight: 32,
  },
  titleInput: {
    fontFamily: FF.serif,
    fontSize: 18,
    color: textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingVertical: 10,
    marginBottom: 12,
  },
  contentInput: {
    fontFamily: FF.sans,
    fontSize: 15,
    color: textPrimary,
    minHeight: 120,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    fontFamily: FF.sansMedium,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
