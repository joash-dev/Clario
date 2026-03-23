import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { useCallback, useState } from "react";
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
import { getApiErrorMessage, registerRequest } from "../../services/api";
import { normalizeLoginEmail } from "../../utils/loginForm";

const bg = "#F7F6F3";
const accent = "#3D3BF3";
const textPrimary = "#1A1A1A";
const textMuted = "#6B6966";
const inputFill = "#EFEDE8";
const inputBorder = "#E0DDD6";
const errorSoft = "#B54747";

const fontSerif = "DMSerifDisplay_400Regular";
const fontSans = "DMSans_400Regular";
const fontSansMedium = "DMSans_500Medium";
const fontSansBold = "DMSans_700Bold";

function normalizeFullName(name: string): string {
  return name.trim();
}

function getNameError(name: string): string | null {
  const t = normalizeFullName(name);
  if (!t) return "Enter your full name";
  if (t.length < 2) return "Name must be at least 2 characters";
  return null;
}

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
  if (password.length < 8) return "Password must be at least 8 characters";
  return null;
}

function getConfirmError(password: string, confirm: string): string | null {
  if (!confirm) return "Confirm your password";
  if (confirm !== password) return "Passwords do not match";
  return null;
}

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    DMSerifDisplay_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  const nameErr = submitAttempted ? getNameError(fullName) : null;
  const emailErr = submitAttempted ? getEmailError(email) : null;
  const passwordErr = submitAttempted ? getPasswordError(password) : null;
  const confirmErr = submitAttempted
    ? getConfirmError(password, confirmPassword)
    : null;

  const buttonDisabled = loading;

  const onSubmit = useCallback(async () => {
    setSubmitAttempted(true);
    setApiError(null);

    const nErr = getNameError(fullName);
    const eErr = getEmailError(email);
    const pErr = getPasswordError(password);
    const cErr = getConfirmError(password, confirmPassword);
    if (nErr || eErr || pErr || cErr) {
      return;
    }

    setLoading(true);
    try {
      await registerRequest({
        name: normalizeFullName(fullName),
        email: normalizeLoginEmail(email),
        password,
      });
      router.replace("/(auth)/login?registered=1");
    } catch (e) {
      setApiError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [fullName, email, password, confirmPassword, router]);

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
                Create your account
              </Text>
            </View>

            <View style={styles.formMain}>
              <View>
                <Text
                  style={[styles.label, fontError ? styles.labelSystem : null]}
                  nativeID="register-name-label"
                >
                  Full Name
                </Text>
                <TextInput
                  style={[styles.input, fontError ? styles.textSystem : null]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder=""
                  autoCapitalize="words"
                  autoCorrect
                  textContentType="name"
                  editable={!loading}
                  accessibilityLabel="Full name"
                />
                {nameErr ? (
                  <Text
                    style={[styles.fieldError, fontError ? styles.textSystem : null]}
                    accessibilityRole="alert"
                  >
                    {nameErr}
                  </Text>
                ) : null}
              </View>

              <View style={styles.fieldGap}>
                <Text
                  style={[styles.label, fontError ? styles.labelSystem : null]}
                  nativeID="register-email-label"
                >
                  Email
                </Text>
                <TextInput
                  style={[styles.input, fontError ? styles.textSystem : null]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder=""
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  editable={!loading}
                  accessibilityLabel="Email"
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

              <View style={styles.fieldGap}>
                <Text
                  style={[styles.label, fontError ? styles.labelSystem : null]}
                  nativeID="register-password-label"
                >
                  Password
                </Text>
                <TextInput
                  style={[styles.input, fontError ? styles.textSystem : null]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder=""
                  secureTextEntry
                  autoComplete="password-new"
                  textContentType="newPassword"
                  editable={!loading}
                  accessibilityLabel="Password"
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

              <View style={styles.fieldGap}>
                <Text
                  style={[styles.label, fontError ? styles.labelSystem : null]}
                  nativeID="register-confirm-label"
                >
                  Confirm Password
                </Text>
                <TextInput
                  style={[styles.input, fontError ? styles.textSystem : null]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder=""
                  secureTextEntry
                  autoComplete="password-new"
                  textContentType="newPassword"
                  editable={!loading}
                  accessibilityLabel="Confirm password"
                />
                {confirmErr ? (
                  <Text
                    style={[styles.fieldError, fontError ? styles.textSystem : null]}
                    accessibilityRole="alert"
                  >
                    {confirmErr}
                  </Text>
                ) : null}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  buttonDisabled && styles.buttonDisabled,
                  {
                    transform: [
                      { scale: pressed && !buttonDisabled ? 0.97 : 1 },
                    ],
                  },
                  styles.buttonSpacing,
                ]}
                onPress={() => void onSubmit()}
                disabled={buttonDisabled}
                accessibilityRole="button"
                accessibilityLabel="Create account"
                accessibilityState={{ disabled: buttonDisabled }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" accessibilityLabel="Creating account" />
                ) : (
                  <Text style={[styles.buttonLabel, fontError ? styles.buttonLabelSystem : null]}>
                    Create account
                  </Text>
                )}
              </Pressable>

              {apiError ? (
                <Text
                  style={[styles.apiErrorBelowButton, fontError ? styles.textSystem : null]}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  {apiError}
                </Text>
              ) : null}
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
          onPress={() => router.push("/(auth)/login")}
          accessibilityRole="link"
          accessibilityLabel="Already have an account? Sign in"
        >
          <Text style={[styles.bottomLinkText, fontError ? styles.bottomLinkTextSystem : null]}>
            Already have an account? Sign in
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
  fieldGap: {
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
  apiErrorBelowButton: {
    fontFamily: fontSans,
    fontSize: 14,
    lineHeight: 20,
    color: errorSoft,
    marginTop: 12,
    textAlign: "center",
  },
  buttonSpacing: {
    marginTop: 32,
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
  bottomLinkText: {
    fontFamily: fontSans,
    fontSize: 15,
    lineHeight: 21,
    color: textMuted,
  },
  bottomLinkTextSystem: {
    fontFamily: undefined,
  },
  textSystem: {
    fontFamily: undefined,
  },
});
