import { Ionicons } from "@expo/vector-icons";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useFonts } from "expo-font";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { chatRequest, type ChatHistoryTurn } from "../../services/api";

const bg = "#F7F6F3";
const accent = "#3D3BF3";
const textPrimary = "#1A1A1A";

const FF = {
  serif: "DMSerifDisplay",
  sans: "DMSans",
  sansMedium: "DMSans-Medium",
  sansBold: "DMSans-Bold",
} as const;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

const WELCOME_TEXT =
  "Hi! I'm Clario. I can help you manage your tasks and notes. What would you like to know?";

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function formatMessageTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function TypingDots() {
  const d1 = useRef(new Animated.Value(0.3)).current;
  const d2 = useRef(new Animated.Value(0.3)).current;
  const d3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = (v: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(v, {
            toValue: 1,
            duration: 350,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.3,
            duration: 350,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    const a1 = pulse(d1, 0);
    const a2 = pulse(d2, 150);
    const a3 = pulse(d3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [d1, d2, d3]);

  return (
    <View style={styles.typingBubble}>
      <View style={styles.typingRow}>
        <Animated.View style={[styles.typingDot, { opacity: d1 }]} />
        <Animated.View style={[styles.typingDot, { opacity: d2 }]} />
        <Animated.View style={[styles.typingDot, { opacity: d3 }]} />
      </View>
    </View>
  );
}

const SUGGESTIONS = [
  "What's due today?",
  "Summarize my notes",
  "What should I focus on?",
  "Show my high priority tasks",
];

export default function AiTabScreen() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME_TEXT,
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    DMSerifDisplay: DMSerifDisplay_400Regular,
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_500Medium,
    "DMSans-Bold": DMSans_700Bold,
  });

  const onlyWelcome = useMemo(
    () => messages.length === 1 && messages[0]?.id === "welcome",
    [messages]
  );

  const displayedMessages = useMemo(
    () => (onlyWelcome ? [] : messages),
    [onlyWelcome, messages]
  );

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isLoading, scrollToBottom]);

  const handleClear = useCallback(() => {
    setInputText("");
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: WELCOME_TEXT,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    const historyPayload: ChatHistoryTurn[] = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }))
      .slice(-10);

    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const { reply } = await chatRequest({
        message: text,
        conversationHistory: historyPayload,
      });
      const aiMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        content: reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      const errMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        content:
          "Sorry, I couldn't process that. Please try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages]);

  const showTimestamp = useCallback((index: number) => {
    const m = displayedMessages[index];
    const next = displayedMessages[index + 1];
    if (!next) return true;
    return next.role !== m.role;
  }, [displayedMessages]);

  const firstAssistantIndex = useMemo(
    () => displayedMessages.findIndex((m) => m.role === "assistant"),
    [displayedMessages]
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isUser = item.role === "user";
      const showTs = showTimestamp(index);
      const showSparkleHeader =
        item.role === "assistant" && index === firstAssistantIndex;

      return (
        <View
          style={{
            alignSelf: isUser ? "flex-end" : "flex-start",
            maxWidth: "80%",
            marginBottom: 8,
          }}
        >
          {!isUser && showSparkleHeader ? (
            <Ionicons
              name="sparkles"
              size={12}
              color={accent}
              style={{ marginBottom: 4 }}
            />
          ) : null}
          <View
            style={{
              alignSelf: isUser ? "flex-end" : "flex-start",
              backgroundColor: isUser ? "#3D3BF3" : "white",
              borderRadius: 18,
              borderBottomRightRadius: isUser ? 4 : 18,
              borderBottomLeftRadius: isUser ? 18 : 4,
              paddingVertical: 10,
              paddingHorizontal: 14,
              maxWidth: "100%",
              borderWidth: isUser ? 0 : 1,
              borderColor: "#E8E8E4",
            }}
          >
            <Text
              style={{
                fontFamily: FF.sans,
                fontSize: 15,
                color: isUser ? "white" : "#1A1A1A",
                lineHeight: 22,
              }}
            >
              {item.content}
            </Text>
            {showTs ? (
              <Text
                style={{
                  fontFamily: FF.sans,
                  fontSize: 11,
                  color: isUser ? "rgba(255,255,255,0.6)" : "#AAAAAA",
                  marginTop: 4,
                  alignSelf: isUser ? "flex-end" : "flex-start",
                }}
              >
                {formatMessageTime(item.timestamp)}
              </Text>
            ) : null}
          </View>
        </View>
      );
    },
    [showTimestamp, firstAssistantIndex]
  );

  const trimmedLen = inputText.trim().length;
  const sendActive = trimmedLen > 0 && !isLoading;

  if (!fontsLoaded) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerSide} />
        <View style={styles.headerTitleWrap}>
          <Ionicons
            name="sparkles"
            size={16}
            color={accent}
            style={styles.headerSparkle}
          />
          <Text style={styles.headerTitle}>Clario AI</Text>
        </View>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <Pressable onPress={handleClear} hitSlop={8}>
            <Text style={styles.clearBtn}>Clear</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        style={styles.list}
        data={displayedMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        inverted={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.listContent, { paddingRight: 80 }]}
        onLayout={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
        ListHeaderComponent={
          onlyWelcome ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 60,
              }}
            >
              <Ionicons
                name="sparkles"
                size={48}
                color={accent}
                style={{ opacity: 0.3 }}
              />
              <Text style={styles.welcomeTitle}>Ask me anything</Text>
              <Text style={styles.welcomeSub}>
                I know your tasks and notes
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillScroll}
              >
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    style={styles.pill}
                    onPress={() => setInputText(s)}
                  >
                    <Text style={styles.pillText}>{s}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading ? (
            <View style={styles.typingWrap}>
              <TypingDots />
            </View>
          ) : null
        }
      />

      <View
        style={[
          styles.inputBar,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask Clario..."
          placeholderTextColor="#AAAAAA"
          multiline={false}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => void handleSend()}
          editable={!isLoading}
        />
        <Pressable
          style={[
            styles.sendBtn,
            !sendActive && styles.sendBtnDisabled,
          ]}
          onPress={() => void handleSend()}
          disabled={trimmedLen === 0 || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Ionicons name="send" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: bg,
  },
  headerSide: {
    flex: 1,
  },
  headerSideRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 2,
  },
  headerSparkle: {
    marginRight: 6,
  },
  headerTitle: {
    fontFamily: FF.sansMedium,
    fontSize: 16,
    fontWeight: "600",
    color: textPrimary,
  },
  clearBtn: {
    fontFamily: FF.sans,
    fontSize: 14,
    color: "#AAAAAA",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexGrow: 1,
  },
  typingWrap: {
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  typingBubble: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E8E8E4",
    maxWidth: "80%",
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#AAAAAA",
  },
  welcomeTitle: {
    fontFamily: FF.serif,
    fontSize: 22,
    color: textPrimary,
    marginTop: 16,
    textAlign: "center",
  },
  welcomeSub: {
    fontFamily: FF.sans,
    fontSize: 14,
    color: "#AAAAAA",
    marginTop: 8,
    textAlign: "center",
  },
  pillScroll: {
    marginTop: 16,
    gap: 8,
    paddingHorizontal: 4,
  },
  pill: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  pillText: {
    fontFamily: FF.sans,
    fontSize: 13,
    color: accent,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E8E8E4",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#F0EFF8",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontFamily: FF.sans,
    fontSize: 15,
    color: textPrimary,
  },
  sendBtn: {
    marginLeft: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#E0E0E0",
  },
});
