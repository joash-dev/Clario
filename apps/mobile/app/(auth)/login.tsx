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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { getApiErrorMessage } from "../../services/api";
import { normalizeLoginEmail } from "../../utils/loginForm";

const bg = "#F7F6F3";
const accent = "#3D3BF3";
const textPrimary = "#1A1A1A";
const textMuted = "#6B6966";
const inputFill = "#EFEDE8";
const inputBorder = "#E0DDD6";
const errorSoft = "#B54747";
const successMuted = "#4A6B59";

const fontSerif = "DMSerifDisplay_400Regular";
const fontSans = "DMSans_400Regular";
const fontSansMedium = "DMSans_500Medium";
const fontSansBold = "DMSans_700Bold";

function getEmailError(email: string): string | null {
  const t = normalizeLoginEmail(email);
  if (!t) return "Enter your email";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
    return "Enter a valid email";
  }
  return null;
}

function getPasswordError(password: string): string | null {
  if (!password) return "Enter your password";
  return null;
}

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ registered?: string }>();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [registeredBanner, setRegisteredBanner] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const [fontsLoaded, fontError] = useFonts({
    DMSerifDisplay_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    const v = params.registered;
    const ok = v === "1" || (Array.isArray(v) && v[0] === "1");
    if (ok) {
      setRegisteredBanner(true);
    }
  }, [params.registered]);

  useEffect(() => {
    if (!registeredBanner) return;
    const id = setTimeout(() => setRegisteredBanner(false), 10_000);
    return () => clearTimeout(id);
  }, [registeredBanner]);

  const emailErr =
    (touched.email || submitAttempted) ? getEmailError(email) : null;
  const passwordErr =
    (touched.password || submitAttempted) ? getPasswordError(password) : null;

  const buttonDisabled = loading;

  const onSubmit = useCallback(async () => {
    setSubmitAttempted(true);
    setError(null);

    const eErr = getEmailError(email);
    const pErr = getPasswordError(password);
    if (eErr || pErr) {
      return;
    }

    setLoading(true);
    try {
      const trimmedEmail = normalizeLoginEmail(email);
      await login(trimmedEmail, password);
      router.replace("/(tabs)");
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [email, password, login, router]);

  const scroll = (
    <View style={styles.screenBody}>
      <ScrollView
        style={styles.scrollFill}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.centerBlock}>
            <View style={styles.hero}>
              <Text
                style={[styles.wordmark, fontError ? styles.wordmarkSystem : null]}
                accessibilityRole="header"
              >
                Clario
              </Text>
              <Text style={[styles.tagline, fontError ? styles.taglineSystem : null]}>
                Sign in to continue
              </Text>
            </View>

            <View style={styles.formMain}>
              {registeredBanner ? (
                <Text
                  style={[styles.registeredBanner, fontError ? styles.textSystem : null]}
                  accessibilityLiveRegion="polite"
                >
                  Account created! Please sign in.
                </Text>
              ) : null}
              <View>
                <Text
                  style={[styles.label, fontError ? styles.labelSystem : null]}
                  nativeID="login-email-label"
                >
                  Email
                </Text>
                <TextInput
                  style={[styles.input, fontError ? styles.textSystem : null]}
                  value={email}
                  onChangeText={setEmail}
                  onBlur={() =>
                    setTouched((prev) => ({ ...prev, email: true }))
                  }
                  placeholder=""
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="username"
                  editable={!loading}
                  accessibilityLabel="Email"
                  accessibilityHint="Enter your account email address"
                />
                {emailErr ? (
                  <Text
                    style={[styles.fieldError, fontError ? styles.textSystem : null]}
                    accessibilityRole="alert"
                  >
                    {emailErr}
                  </Text>
                ) : null}
              </View>

              <View style={styles.passwordField}>
                <Text
                  style={[styles.label, fontError ? styles.labelSystem : null]}
                  nativeID="login-password-label"
                >
                  Password
                </Text>
                <TextInput
                  style={[styles.input, fontError ? styles.textSystem : null]}
                  value={password}
                  onChangeText={setPassword}
                  onBlur={() =>
                    setTouched((prev) => ({ ...prev, password: true }))
                  }
                  placeholder=""
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                  editable={!loading}
                  accessibilityLabel="Password"
                  accessibilityHint="Enter your password"
                />
                {passwordErr ? (
                  <Text
                    style={[styles.fieldError, fontError ? styles.textSystem : null]}
                    accessibilityRole="alert"
                  >
                    {passwordErr}
                  </Text>
                ) : null}
              </View>

              {error ? (
                <Text
                  style={[styles.apiError, fontError ? styles.textSystem : null]}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  {error}
                </Text>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  buttonDisabled && styles.buttonDisabled,
                  {
                    transform: [
                      { scale: pressed && !buttonDisabled ? 0.97 : 1 },
                    ],
                  },
                  error ? styles.buttonAfterApiError : styles.buttonSpacing,
                ]}
                onPress={() => void onSubmit()}
                disabled={buttonDisabled}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                accessibilityState={{ disabled: buttonDisabled }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" accessibilityLabel="Signing in" />
                ) : (
                  <Text style={[styles.buttonLabel, fontError ? styles.buttonLabelSystem : null]}>
                    Sign in
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomZone,
          { paddingBottom: 48 + insets.bottom },
        ]}
      >
        <Pressable
          onPress={() => router.push("/(auth)/register")}
          accessibilityRole="link"
          accessibilityLabel="Create account"
        >
          <Text style={[styles.registerText, fontError ? styles.registerTextSystem : null]}>
            Create account
          </Text>
        </Pressable>
      </View>
    </View>
  );

  if (!fontsLoaded && !fontError) {
    return (
      <View style={[styles.keyboardRoot, styles.fontsLoading]}>
        <ActivityIndicator size="small" color={accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      {Platform.OS === "web" ? (
        scroll
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          {scroll}
        </TouchableWithoutFeedback>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
    backgroundColor: bg,
  },
  screenBody: {
    flex: 1,
    flexDirection: "column",
  },
  scrollFill: {
    flex: 1,
    minHeight: 0,
  },
  fontsLoading: {
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  inner: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  centerBlock: {
    width: "100%",
  },
  hero: {
    paddingTop: 8,
  },
  wordmark: {
    fontFamily: fontSerif,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.5,
    color: textPrimary,
  },
  wordmarkSystem: {
    fontFamily: undefined,
    fontWeight: "400",
  },
  tagline: {
    fontFamily: fontSans,
    fontSize: 16,
    lineHeight: 22,
    color: textMuted,
    marginTop: 6,
  },
  taglineSystem: {
    fontFamily: undefined,
  },
  formMain: {
    marginTop: 40,
  },
  registeredBanner: {
    fontFamily: fontSans,
    fontSize: 14,
    lineHeight: 20,
    color: successMuted,
    marginBottom: 20,
  },
  passwordField: {
    marginTop: 20,
  },
  label: {
    fontFamily: fontSansMedium,
    fontSize: 14,
    lineHeight: 18,
    color: textMuted,
  },
  labelSystem: {
    fontFamily: undefined,
    fontWeight: "500",
  },
  input: {
    fontFamily: fontSans,
    marginTop: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    lineHeight: 22,
    color: textPrimary,
    backgroundColor: inputFill,
    borderWidth: 1,
    borderColor: inputBorder,
    borderRadius: 14,
  },
  fieldError: {
    fontFamily: fontSans,
    fontSize: 13,
    lineHeight: 18,
    color: errorSoft,
    marginTop: 2,
  },
  apiError: {
    fontFamily: fontSans,
    fontSize: 14,
    lineHeight: 20,
    color: errorSoft,
    marginTop: 12,
  },
  buttonSpacing: {
    marginTop: 32,
  },
  buttonAfterApiError: {
    marginTop: 20,
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonLabel: {
    fontFamily: fontSansBold,
    fontSize: 16,
    lineHeight: 22,
    color: "#FFFFFF",
  },
  buttonLabelSystem: {
    fontFamily: undefined,
    fontWeight: "700",
  },
  bottomZone: {
    paddingTop: 20,
    alignItems: "center",
  },
  registerText: {
    fontFamily: fontSans,
    fontSize: 15,
    lineHeight: 21,
    color: textMuted,
  },
  registerTextSystem: {
    fontFamily: undefined,
  },
  textSystem: {
    fontFamily: undefined,
  },
});
