import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { useCallback, useEffect, useState } from "react";
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
  getApiErrorMessage,
  getNoteRequest,
  patchNoteRequest,
  type NoteDTO,
} from "../../../services/api";

const bg = "#F7F6F3";
const accent = "#3D3BF3";
const textPrimary = "#1A1A1A";

const FF = {
  serif: "DMSerifDisplay",
  sans: "DMSans",
  sansMedium: "DMSans-Medium",
  sansBold: "DMSans-Bold",
} as const;

export default function EditNoteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rawId = useLocalSearchParams<{ id?: string | string[] }>().id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [note, setNote] = useState<NoteDTO | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    DMSerifDisplay: DMSerifDisplay_400Regular,
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_500Medium,
    "DMSans-Bold": DMSans_700Bold,
  });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const n = await getNoteRequest(id);
      setNote(n);
      setTitle(n.title ?? "");
      setContent(n.content);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = useCallback(async () => {
    if (!note || !id || saving) return;
    const t = title.trim();
    const c = content.trim();
    if (!c) {
      Alert.alert("Content required", "Note content cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const body: { title?: string | null; content?: string } = {};
      if (c !== note.content) body.content = c;
      const titleVal = t.length > 0 ? t : null;
      if (titleVal !== (note.title ?? null)) body.title = titleVal;
      if (Object.keys(body).length === 0) {
        setSaving(false);
        router.back();
        return;
      }

      await patchNoteRequest(id, body);
      router.back();
    } catch (e) {
      Alert.alert("Could not save", getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [note, id, title, content, saving, router]);

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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { paddingHorizontal: 20 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Note</Text>
          <Pressable onPress={() => void onSave()} disabled={saving || loading}>
            {saving ? (
              <ActivityIndicator color={accent} size="small" />
            ) : (
              <Text style={styles.save}>Save</Text>
            )}
          </Pressable>
        </View>

        {error && !note ? (
          <View style={styles.center}>
            <Text style={styles.err}>{error}</Text>
            <Pressable onPress={() => void load()}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : loading && !note ? (
          <View style={styles.center}>
            <ActivityIndicator color={accent} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 24,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Title (optional)"
              placeholderTextColor="#AAAAAA"
              editable={!saving}
            />
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              placeholder="Note content"
              placeholderTextColor="#AAAAAA"
              editable={!saving}
            />
            <Pressable
              style={[styles.footerBtn, saving && { opacity: 0.7 }]}
              onPress={() => void onSave()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.footerBtnText}>Save Changes</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: FF.serif,
    fontSize: 20,
    color: textPrimary,
  },
  cancel: {
    fontFamily: FF.sans,
    fontSize: 16,
    color: "#888888",
  },
  save: {
    fontFamily: FF.sansMedium,
    fontSize: 16,
    color: accent,
  },
  titleInput: {
    fontFamily: FF.serif,
    fontSize: 22,
    color: textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingVertical: 10,
    marginBottom: 16,
  },
  contentInput: {
    fontFamily: FF.sans,
    fontSize: 16,
    color: textPrimary,
    lineHeight: 24,
    minHeight: 200,
    marginBottom: 24,
  },
  footerBtn: {
    backgroundColor: accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  footerBtnText: {
    fontFamily: FF.sansMedium,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
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
