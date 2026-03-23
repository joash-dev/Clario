import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  createTaskRequest,
  deleteTaskRequest,
  getApiErrorMessage,
  listTasksRequest,
  patchTaskRequest,
  type TaskDTO,
  type TaskPriority,
  type TaskStatus,
} from "../../services/api";

const bg = "#F7F6F3";
const accent = "#3D3BF3";
const textPrimary = "#1A1A1A";
const pillBg = "#EFEFEC";
const cardBg = "#FAFAF8";
const deleteRed = "#E24B4A";

const FF = {
  serif: "DMSerifDisplay",
  sans: "DMSans",
  sansMedium: "DMSans-Medium",
  sansBold: "DMSans-Bold",
} as const;

type FilterTab = "ALL" | TaskStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TODO", label: "TODO" },
  { key: "IN_PROGRESS", label: "IN PROGRESS" },
  { key: "DONE", label: "DONE" },
];

function nextStatus(s: TaskStatus): TaskStatus {
  if (s === "TODO") return "IN_PROGRESS";
  if (s === "IN_PROGRESS") return "DONE";
  return "TODO";
}

function formatDueLine(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `Due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function isOverdue(iso: string | null, status: TaskStatus): boolean {
  if (!iso || status === "DONE") return false;
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
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

async function fetchAllTasksSorted(): Promise<TaskDTO[]> {
  const all: TaskDTO[] = [];
  let page = 1;
  const limit = 50;
  while (true) {
    const res = await listTasksRequest({ page, limit });
    all.push(...res.data);
    if (res.data.length < limit || all.length >= res.meta.total) break;
    page += 1;
  }
  return all.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function TaskCheckbox({
  status,
  onPress,
}: {
  status: TaskStatus;
  onPress: () => void;
}) {
  const fire = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };
  if (status === "DONE") {
    return (
      <Pressable
        onPress={fire}
        style={[styles.checkboxBase, styles.checkboxDone]}
        accessibilityRole="button"
        accessibilityLabel="Mark task not done"
      >
        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
      </Pressable>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <Pressable
        onPress={fire}
        style={[styles.checkboxBase, styles.checkboxProgressOuter]}
        accessibilityRole="button"
        accessibilityLabel="Advance task status"
      >
        <View style={styles.checkboxProgressInner} />
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={fire}
      style={[styles.checkboxBase, styles.checkboxTodo]}
      accessibilityRole="button"
      accessibilityLabel="Start task"
    />
  );
}

export default function TasksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    compose?: string;
    openTaskId?: string;
  }>();

  const [tasks, setTasks] = useState<TaskDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createPriority, setCreatePriority] = useState<TaskPriority>("MEDIUM");
  const [createDue, setCreateDue] = useState<Date | null>(null);
  const [createSaving, setCreateSaving] = useState(false);
  const [iosDatePicker, setIosDatePicker] = useState(false);
  const [androidDatePicker, setAndroidDatePicker] = useState(false);

  const sheetY = useRef(
    new Animated.Value(Dimensions.get("window").height)
  ).current;
  const filterAnim = useRef(new Animated.Value(0)).current;
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const firstFocus = useRef(true);

  const [fontsLoaded] = useFonts({
    DMSerifDisplay: DMSerifDisplay_400Regular,
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_500Medium,
    "DMSans-Bold": DMSans_700Bold,
  });

  const screenH = Dimensions.get("window").height;

  const loadTasks = useCallback(async (opts?: { initial?: boolean }) => {
    try {
      if (opts?.initial) setLoading(true);
      setLoadError(null);
      const data = await fetchAllTasksSorted();
      setTasks(data);
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
      setTasks((t) => (t === null ? [] : t));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        void loadTasks({ initial: true });
      } else {
        void loadTasks();
      }
    }, [loadTasks])
  );

  useEffect(() => {
    if (params.compose !== "1") return;
    setCreateVisible(true);
    setCreateTitle("");
    setCreatePriority("MEDIUM");
    setCreateDue(null);
    requestAnimationFrame(() => {
      router.setParams({ compose: undefined });
    });
  }, [params.compose, router]);

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

  useEffect(() => {
    if (filterSheetOpen) {
      filterAnim.setValue(0);
      Animated.timing(filterAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [filterAnim, filterSheetOpen]);

  const closeCreate = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(sheetY, {
      toValue: screenH,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setCreateVisible(false);
        setIosDatePicker(false);
        setAndroidDatePicker(false);
      }
    });
  }, [screenH, sheetY]);

  const openCreate = useCallback(() => {
    setCreateTitle("");
    setCreatePriority("MEDIUM");
    setCreateDue(null);
    setIosDatePicker(false);
    setAndroidDatePicker(false);
    setCreateVisible(true);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadTasks();
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (filter === "ALL") return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const emptyMessage =
    filter === "ALL"
      ? "No tasks yet"
      : "No tasks match this filter";

  const onCycleStatus = useCallback(
    async (task: TaskDTO) => {
      const next = nextStatus(task.status);
      swipeRefs.current.get(task.id)?.close();
      setTasks((prev) => {
        if (!prev) return prev;
        return prev.map((t) =>
          t.id === task.id ? { ...t, status: next } : t
        );
      });
      try {
        const updated = await patchTaskRequest(task.id, { status: next });
        setTasks((prev) => {
          if (!prev) return prev;
          return prev.map((t) => (t.id === task.id ? updated : t));
        });
      } catch (e) {
        setLoadError(getApiErrorMessage(e));
        setTasks((prev) => {
          if (!prev) return prev;
          return prev.map((t) => (t.id === task.id ? task : t));
        });
      }
    },
    []
  );

  const onDelete = useCallback(async (id: string) => {
    swipeRefs.current.get(id)?.close();
    const prevTasks = tasks;
    setTasks((t) => (t ? t.filter((x) => x.id !== id) : t));
    try {
      await deleteTaskRequest(id);
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
      if (prevTasks) setTasks(prevTasks);
    }
  }, [tasks]);

  const onCreate = useCallback(async () => {
    const title = createTitle.trim();
    if (!title || createSaving) return;
    setCreateSaving(true);
    try {
      const task = await createTaskRequest({
        title,
        priority: createPriority,
        due_at: createDue ? createDue.toISOString() : undefined,
      });
      setTasks((prev) => {
        const list = prev ?? [];
        return [task, ...list].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );
      });
      closeCreate();
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
    } finally {
      setCreateSaving(false);
    }
  }, [createTitle, createPriority, createDue, createSaving, closeCreate]);

  const backdropOpacity = filterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  const filterSheetTranslate = filterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [280, 0],
  });

  if (!fontsLoaded) {
    return null;
  }

  const renderTask = ({ item }: { item: TaskDTO }) => {
    const overdue = isOverdue(item.dueAt, item.status);
    const pri = priorityBadge(item.priority);
    const done = item.status === "DONE";

    return (
      <Swipeable
        ref={(r) => {
          if (r) swipeRefs.current.set(item.id, r);
          else swipeRefs.current.delete(item.id);
        }}
        friction={2}
        overshootRight={false}
        renderRightActions={() => (
          <Pressable
            style={styles.swipeDeleteBtn}
            onPress={() => void onDelete(item.id)}
            accessibilityRole="button"
            accessibilityLabel="Delete task"
          >
            <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
          </Pressable>
        )}
      >
        <View style={styles.taskCard}>
          <TaskCheckbox
            status={item.status}
            onPress={() => void onCycleStatus(item)}
          />
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.taskCardTouchable}
            onPress={() =>
              router.push({
                pathname: "/task/[id]",
                params: { id: item.id },
              })
            }
          >
            <View style={styles.taskCenter}>
              <Text
                style={[styles.taskTitle, done && styles.taskTitleDone]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {item.dueAt ? (
                <Text
                  style={[
                    styles.taskDue,
                    overdue && !done && styles.taskDueOverdue,
                  ]}
                >
                  {formatDueLine(item.dueAt)}
                </Text>
              ) : null}
            </View>
            <View style={styles.taskRight}>
              <View style={[styles.badge, { backgroundColor: pri.bg }]}>
                <Text style={[styles.badgeText, { color: pri.text }]}>
                  {item.priority}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward-outline"
                size={16}
                color="#CCCCCC"
              />
            </View>
          </TouchableOpacity>
        </View>
      </Swipeable>
    );
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      {loadError ? (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{loadError}</Text>
          <Pressable
            onPress={() => void loadTasks({ initial: true })}
            style={styles.retryBtn}
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Tasks</Text>
        <Pressable
          onPress={() => setFilterSheetOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Open filters"
        >
          <Ionicons name="funnel-outline" size={26} color={accent} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={styles.pillScrollContent}
      >
        {FILTER_TABS.map((tab) => {
          const selected = filter === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={[
                styles.pill,
                selected ? styles.pillSelected : styles.pillIdle,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  selected ? styles.pillTextSelected : styles.pillTextIdle,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {loading && tasks === null ? (
        <View style={styles.shell}>
          <View style={styles.headerBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.screenTitle}>Tasks</Text>
              <Ionicons name="funnel-outline" size={26} color={accent} />
            </View>
            <View style={styles.skelPillRow}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.skelPill} />
              ))}
            </View>
          </View>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderTask}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.listContent, { paddingRight: 80 }]}
          ListEmptyComponent={
            !loadError ? (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="clipboard-outline"
                  size={64}
                  color="#CCCCCC"
                />
                <Text style={styles.emptyTitle}>{emptyMessage}</Text>
                <Pressable style={styles.outlineBtn} onPress={openCreate}>
                  <Text style={styles.outlineBtnLabel}>
                    Create your first task
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={accent}
              colors={[accent]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        style={[
          styles.fab,
          { bottom: 32 + insets.bottom, right: 20 },
        ]}
        onPress={openCreate}
        accessibilityRole="button"
        accessibilityLabel="New task"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <Modal
        visible={filterSheetOpen}
        transparent
        animationType="none"
        onRequestClose={() => setFilterSheetOpen(false)}
      >
        <View style={styles.filterModalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFilterSheetOpen(false)}
          >
            <Animated.View
              style={[styles.filterBackdrop, { opacity: backdropOpacity }]}
            />
          </Pressable>
          <Animated.View
            style={[
              styles.filterSheet,
              { paddingBottom: insets.bottom + 16 },
              { transform: [{ translateY: filterSheetTranslate }] },
            ]}
          >
          <Text style={styles.filterSheetTitle}>Filter by status</Text>
          {FILTER_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={styles.filterRow}
              onPress={() => {
                setFilter(tab.key);
                setFilterSheetOpen(false);
              }}
            >
              <Text
                style={[
                  styles.filterRowText,
                  filter === tab.key && styles.filterRowTextActive,
                ]}
              >
                {tab.label}
              </Text>
              {filter === tab.key ? (
                <Ionicons name="checkmark" size={20} color={accent} />
              ) : null}
            </Pressable>
          ))}
        </Animated.View>
        </View>
      </Modal>

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
              <Text style={styles.createTitle}>New Task</Text>
              <Pressable
                onPress={closeCreate}
                hitSlop={12}
                accessibilityLabel="Close"
              >
                <Text style={styles.createClose}>×</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.titleInput}
              placeholder="What needs to be done?"
              placeholderTextColor="#AAAAAA"
              value={createTitle}
              onChangeText={setCreateTitle}
              autoFocus
              editable={!createSaving}
            />

            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {(["LOW", "MEDIUM", "HIGH"] as const).map((p) => {
                const sel = createPriority === p;
                const col = priorityBadge(p);
                return (
                  <Pressable
                    key={p}
                    onPress={() => setCreatePriority(p)}
                    style={[
                      styles.priorityBtn,
                      sel && { backgroundColor: col.bg, borderColor: col.text },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityBtnText,
                        { color: sel ? col.text : "#888888" },
                      ]}
                    >
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={styles.dueRow}
              onPress={() => {
                if (Platform.OS === "android") {
                  setAndroidDatePicker(true);
                } else {
                  setIosDatePicker((v) => !v);
                }
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={accent} />
              <View style={styles.dueRowText}>
                <Text style={styles.fieldLabel}>Due date</Text>
                <Text style={styles.dueValue}>
                  {createDue
                    ? createDue.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "No due date"}
                </Text>
              </View>
              {createDue ? (
                <Pressable
                  onPress={() => setCreateDue(null)}
                  hitSlop={8}
                >
                  <Text style={styles.clearDue}>Clear</Text>
                </Pressable>
              ) : null}
            </Pressable>

            {Platform.OS === "ios" && iosDatePicker ? (
              <DateTimePicker
                value={createDue ?? new Date()}
                mode="date"
                display="spinner"
                onChange={(_, date) => {
                  if (date) setCreateDue(date);
                }}
              />
            ) : null}

            {Platform.OS === "android" && androidDatePicker ? (
              <DateTimePicker
                value={createDue ?? new Date()}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setAndroidDatePicker(false);
                  if (event.type === "dismissed" || !date) return;
                  setCreateDue(date);
                }}
              />
            ) : null}

            <Pressable
              style={[
                styles.primaryBtn,
                createSaving && styles.primaryBtnDisabled,
              ]}
              onPress={() => void onCreate()}
              disabled={createSaving || !createTitle.trim()}
            >
              {createSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Create Task</Text>
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
  headerBlock: {
    paddingTop: 16,
    marginBottom: 0,
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
  pillScroll: {
    marginBottom: 20,
    marginHorizontal: -4,
  },
  pillScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  pillSelected: {
    backgroundColor: accent,
  },
  pillIdle: {
    backgroundColor: pillBg,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  pillText: {
    fontFamily: FF.sans,
    fontSize: 13,
  },
  pillTextSelected: {
    color: "#FFFFFF",
  },
  pillTextIdle: {
    color: "#888888",
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
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: cardBg,
    borderRadius: 14,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#F0F0EE",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  taskCardTouchable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  checkboxBase: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  checkboxTodo: {
    borderWidth: 2,
    borderColor: "#CCCCCC",
    backgroundColor: "transparent",
  },
  checkboxProgressOuter: {
    borderWidth: 2,
    borderColor: accent,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxProgressInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: accent,
  },
  checkboxDone: {
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
  taskCenter: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    overflow: "hidden",
  },
  taskTitle: {
    fontFamily: FF.sansMedium,
    fontSize: 16,
    fontWeight: "500",
    color: textPrimary,
  },
  taskTitleDone: {
    textDecorationLine: "line-through",
    color: "#AAAAAA",
  },
  taskDue: {
    marginTop: 4,
    fontFamily: FF.sans,
    fontSize: 12,
    color: "#AAAAAA",
  },
  taskDueOverdue: {
    color: deleteRed,
  },
  taskRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: FF.sansMedium,
    fontSize: 11,
    fontWeight: "500",
  },
  swipeDeleteBtn: {
    backgroundColor: deleteRed,
    justifyContent: "center",
    alignItems: "center",
    width: 76,
    marginBottom: 10,
    marginLeft: 8,
    borderRadius: 14,
  },
  filterModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
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
  },
  outlineBtnLabel: {
    fontFamily: FF.sans,
    fontSize: 14,
    fontWeight: "500",
    color: accent,
  },
  skeletonCard: {
    height: 88,
    borderRadius: 14,
    backgroundColor: "#E0DDD8",
    marginBottom: 10,
    opacity: 0.6,
  },
  skelPillRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  skelPill: {
    width: 72,
    height: 34,
    borderRadius: 20,
    backgroundColor: "#E0DDD8",
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
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  filterSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  filterSheetTitle: {
    fontFamily: FF.serif,
    fontSize: 20,
    color: textPrimary,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8E8E4",
  },
  filterRowText: {
    fontFamily: FF.sans,
    fontSize: 16,
    color: "#666666",
  },
  filterRowTextActive: {
    color: accent,
    fontWeight: "600",
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
    fontFamily: FF.sans,
    fontSize: 16,
    color: textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingVertical: 10,
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: FF.sansMedium,
    fontSize: 13,
    color: "#666666",
    marginBottom: 8,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FAFAF8",
  },
  priorityBtnText: {
    fontFamily: FF.sansMedium,
    fontSize: 12,
  },
  dueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  dueRowText: {
    flex: 1,
  },
  dueValue: {
    fontFamily: FF.sans,
    fontSize: 15,
    color: textPrimary,
    marginTop: 2,
  },
  clearDue: {
    fontFamily: FF.sans,
    fontSize: 14,
    color: accent,
  },
  primaryBtn: {
    backgroundColor: accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontFamily: FF.sansMedium,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
