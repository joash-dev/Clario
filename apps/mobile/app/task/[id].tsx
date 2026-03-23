import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
  deleteTaskRequest,
  getApiErrorMessage,
  getTaskRequest,
  patchTaskRequest,
  type TaskDTO,
  type TaskPriority,
  type TaskStatus,
} from "../../services/api";

const bg = "#F7F6F3";
const accent = "#3D3BF3";
const textPrimary = "#1A1A1A";
const rowBorder = "#F0F0EC";
const deleteRed = "#E24B4A";

const FF = {
  serif: "DMSerifDisplay",
  sans: "DMSans",
  sansMedium: "DMSans-Medium",
  sansBold: "DMSans-Bold",
} as const;

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

function statusPillView(status: TaskStatus): { bg: string; text: string } {
  switch (status) {
    case "TODO":
      return { bg: "#E8E8E8", text: "#666666" };
    case "IN_PROGRESS":
      return { bg: accent, text: "#FFFFFF" };
    case "DONE":
      return { bg: "#C8E6C9", text: "#1B5E20" };
    default:
      return { bg: "#E8E8E8", text: "#666666" };
  }
}

function statusLabel(status: TaskStatus): string {
  if (status === "IN_PROGRESS") return "IN PROGRESS";
  return status;
}

type Draft = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Date | null;
};

function taskToDraft(t: TaskDTO): Draft {
  return {
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt ? new Date(t.dueAt) : null,
  };
}

export default function TaskDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rawId = useLocalSearchParams<{ id?: string | string[] }>().id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [task, setTask] = useState<TaskDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [iosDateOpen, setIosDateOpen] = useState(false);
  const [androidDateOpen, setAndroidDateOpen] = useState(false);

  const [fontsLoaded] = useFonts({
    DMSerifDisplay: DMSerifDisplay_400Regular,
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_500Medium,
    "DMSans-Bold": DMSans_700Bold,
  });

  const load = useCallback(async () => {
    if (!id || typeof id !== "string") return;
    try {
      setLoading(true);
      setLoadError(null);
      const t = await getTaskRequest(id);
      setTask(t);
      setDraft(taskToDraft(t));
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const beginEdit = useCallback(() => {
    if (task) setDraft(taskToDraft(task));
    setEditing(true);
  }, [task]);

  const cancelEdit = useCallback(() => {
    if (task) setDraft(taskToDraft(task));
    setEditing(false);
    setIosDateOpen(false);
    setAndroidDateOpen(false);
  }, [task]);

  const onSave = useCallback(async () => {
    if (!task || !draft || saving) return;
    const title = draft.title.trim();
    if (!title) {
      Alert.alert("Title required", "Please enter a task title.");
      return;
    }
    setSaving(true);
    try {
      const body: {
        title?: string;
        status?: TaskStatus;
        priority?: TaskPriority;
        due_at?: string | null;
      } = {};
      if (title !== task.title) body.title = title;
      if (draft.status !== task.status) body.status = draft.status;
      if (draft.priority !== task.priority) body.priority = draft.priority;
      const prevDueIso = task.dueAt;
      const nextDueIso = draft.dueAt ? draft.dueAt.toISOString() : null;
      if (prevDueIso !== nextDueIso) {
        body.due_at = draft.dueAt ? draft.dueAt.toISOString() : null;
      }

      if (Object.keys(body).length === 0) {
        setEditing(false);
        setSaving(false);
        return;
      }

      const updated = await patchTaskRequest(task.id, body);
      setTask(updated);
      setDraft(taskToDraft(updated));
      setEditing(false);
      Alert.alert("Success", "Task updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Could not save", getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [task, draft, saving, router]);

  const onDelete = useCallback(() => {
    if (!task || deleting) return;
    Alert.alert(
      "Delete task",
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                await deleteTaskRequest(task.id);
                router.back();
              } catch (e) {
                Alert.alert("Could not delete", getApiErrorMessage(e));
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ]
    );
  }, [task, deleting, router]);

  const overdue = useMemo(
    () => (task ? isOverdue(task.dueAt, task.status) : false),
    [task]
  );

  if (!fontsLoaded) {
    return null;
  }

  if (!id) {
    return (
      <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]}>
        <Text style={styles.errText}>Invalid task.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.topBar, { paddingHorizontal: 20 }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back-outline" size={28} color={accent} />
          </Pressable>
          <View style={styles.topBarRight}>
            {!editing ? (
              <Pressable onPress={beginEdit} hitSlop={8}>
                <Text style={styles.headerAction}>Edit</Text>
              </Pressable>
            ) : (
              <>
                <Pressable onPress={cancelEdit} hitSlop={8} disabled={saving}>
                  <Text style={styles.headerCancel}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => void onSave()}
                  hitSlop={8}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={accent} />
                  ) : (
                    <Text style={styles.headerSave}>Save</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>

        {loading && !task ? (
          <View style={styles.skeletonWrap}>
            <View style={styles.skelLineLg} />
            <View style={styles.skelLine} />
            <View style={styles.skelLine} />
            <View style={styles.skelLine} />
          </View>
        ) : loadError && !task ? (
          <View style={styles.centerMsg}>
            <Text style={styles.errText}>{loadError}</Text>
            <Pressable style={styles.retry} onPress={() => void load()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : task && draft ? (
          <ScrollView
            contentContainerStyle={[
              styles.scrollInner,
              {
                paddingBottom: insets.bottom + 32,
                paddingHorizontal: 20,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!editing ? (
              <>
                <Text style={styles.viewTitle}>{task.title}</Text>

                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Status</Text>
                  {(() => {
                    const sp = statusPillView(task.status);
                    return (
                      <View style={[styles.statusPill, { backgroundColor: sp.bg }]}>
                        <Text style={[styles.statusPillText, { color: sp.text }]}>
                          {statusLabel(task.status)}
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Priority</Text>
                  {(() => {
                    const pb = priorityBadge(task.priority);
                    return (
                      <View style={[styles.priBadge, { backgroundColor: pb.bg }]}>
                        <Text style={[styles.priBadgeText, { color: pb.text }]}>
                          {task.priority}
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                {task.dueAt ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Due date</Text>
                    <Text
                      style={[
                        styles.rowValue,
                        overdue && styles.rowValueOverdue,
                      ]}
                    >
                      {formatLongDate(task.dueAt)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Created</Text>
                  <Text style={styles.rowValue}>
                    {formatLongDate(task.createdAt)}
                  </Text>
                </View>

                <View style={styles.divider} />
              </>
            ) : (
              <>
                <TextInput
                  style={styles.editTitle}
                  value={draft.title}
                  onChangeText={(t) => setDraft((d) => (d ? { ...d, title: t } : d))}
                  placeholder="Task title"
                  placeholderTextColor="#AAAAAA"
                  editable={!saving}
                />

                <Text style={styles.editSectionLabel}>Status</Text>
                <View style={styles.toggleRow}>
                  {STATUSES.map((s) => {
                    const sel = draft.status === s;
                    return (
                      <Pressable
                        key={s}
                        onPress={() =>
                          setDraft((d) => (d ? { ...d, status: s } : d))
                        }
                        style={[
                          styles.togglePill,
                          sel ? styles.togglePillOn : styles.togglePillOff,
                        ]}
                      >
                        <Text
                          style={[
                            styles.togglePillText,
                            sel && styles.togglePillTextOn,
                          ]}
                          numberOfLines={1}
                        >
                          {statusLabel(s)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.editSectionLabel}>Priority</Text>
                <View style={styles.toggleRow}>
                  {PRIORITIES.map((p) => {
                    const sel = draft.priority === p;
                    const col = priorityBadge(p);
                    return (
                      <Pressable
                        key={p}
                        onPress={() =>
                          setDraft((d) => (d ? { ...d, priority: p } : d))
                        }
                        style={[
                          styles.priToggle,
                          sel && { backgroundColor: col.bg, borderColor: col.text },
                        ]}
                      >
                        <Text
                          style={[
                            styles.priToggleText,
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
                  style={styles.dueEditRow}
                  onPress={() => {
                    if (Platform.OS === "android") setAndroidDateOpen(true);
                    else setIosDateOpen((o) => !o);
                  }}
                >
                  <Ionicons name="calendar-outline" size={20} color={accent} />
                  <View style={styles.dueEditText}>
                    <Text style={styles.rowLabel}>Due date</Text>
                    <Text style={styles.rowValue}>
                      {draft.dueAt
                        ? formatLongDate(draft.dueAt.toISOString())
                        : "No due date"}
                    </Text>
                  </View>
                  {draft.dueAt ? (
                    <Pressable
                      onPress={() => setDraft((d) => (d ? { ...d, dueAt: null } : d))}
                    >
                      <Text style={styles.clearDue}>Clear</Text>
                    </Pressable>
                  ) : null}
                </Pressable>

                {Platform.OS === "ios" && iosDateOpen ? (
                  <DateTimePicker
                    value={draft.dueAt ?? new Date()}
                    mode="date"
                    display="spinner"
                    onChange={(_, date) => {
                      if (date) setDraft((d) => (d ? { ...d, dueAt: date } : d));
                    }}
                  />
                ) : null}

                {Platform.OS === "android" && androidDateOpen ? (
                  <DateTimePicker
                    value={draft.dueAt ?? new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setAndroidDateOpen(false);
                      if (event.type === "dismissed" || !date) return;
                      setDraft((d) => (d ? { ...d, dueAt: date } : d));
                    }}
                  />
                ) : null}

                <Pressable
                  style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
                  onPress={onDelete}
                  disabled={deleting}
                >
                  <Text style={styles.deleteBtnText}>Delete Task</Text>
                </Pressable>

                <Pressable
                  style={[styles.saveFooterBtn, saving && { opacity: 0.7 }]}
                  onPress={() => void onSave()}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveFooterBtnText}>Save Changes</Text>
                  )}
                </Pressable>
              </>
            )}
          </ScrollView>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: bg,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  headerAction: {
    fontFamily: FF.sansMedium,
    fontSize: 16,
    color: accent,
  },
  headerCancel: {
    fontFamily: FF.sans,
    fontSize: 16,
    color: "#888888",
  },
  headerSave: {
    fontFamily: FF.sansMedium,
    fontSize: 16,
    color: accent,
  },
  scrollInner: {
    paddingTop: 8,
  },
  viewTitle: {
    fontFamily: FF.serif,
    fontSize: 24,
    lineHeight: 30,
    color: textPrimary,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: rowBorder,
  },
  rowLabel: {
    fontFamily: FF.sans,
    fontSize: 14,
    color: "#9E9E9E",
  },
  rowValue: {
    fontFamily: FF.sans,
    fontSize: 15,
    color: textPrimary,
    flex: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  rowValueOverdue: {
    color: deleteRed,
  },
  statusPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  statusPillText: {
    fontFamily: FF.sans,
    fontSize: 13,
  },
  priBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  priBadgeText: {
    fontFamily: FF.sansMedium,
    fontSize: 12,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: 20,
  },
  editTitle: {
    fontFamily: FF.serif,
    fontSize: 24,
    lineHeight: 30,
    color: textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingVertical: 8,
    marginBottom: 16,
  },
  editSectionLabel: {
    fontFamily: FF.sansMedium,
    fontSize: 13,
    color: "#9E9E9E",
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  togglePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#EFEFEC",
  },
  togglePillOff: {
    borderColor: "#E0E0E0",
    backgroundColor: "#EFEFEC",
  },
  togglePillOn: {
    backgroundColor: accent,
    borderColor: accent,
  },
  togglePillText: {
    fontFamily: FF.sans,
    fontSize: 12,
    color: "#888888",
  },
  togglePillTextOn: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  priToggle: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FAFAF8",
  },
  priToggleText: {
    fontFamily: FF.sansMedium,
    fontSize: 12,
  },
  dueEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: rowBorder,
    marginBottom: 24,
  },
  dueEditText: {
    flex: 1,
  },
  clearDue: {
    fontFamily: FF.sans,
    fontSize: 14,
    color: accent,
  },
  deleteBtn: {
    borderWidth: 1.5,
    borderColor: deleteRed,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  deleteBtnText: {
    fontFamily: FF.sansMedium,
    fontSize: 16,
    color: deleteRed,
  },
  saveFooterBtn: {
    backgroundColor: accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveFooterBtnText: {
    fontFamily: FF.sansMedium,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  skeletonWrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },
  skelLineLg: {
    height: 28,
    borderRadius: 8,
    backgroundColor: "#E0DDD8",
    width: "85%",
  },
  skelLine: {
    height: 20,
    borderRadius: 6,
    backgroundColor: "#E0DDD8",
    opacity: 0.85,
  },
  centerMsg: {
    padding: 24,
    alignItems: "center",
  },
  errText: {
    fontFamily: FF.sans,
    fontSize: 14,
    color: "#8B3D3D",
    textAlign: "center",
  },
  retry: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryText: {
    fontFamily: FF.sansMedium,
    fontSize: 16,
    color: accent,
  },
});
