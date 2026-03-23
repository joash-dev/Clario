import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "clario_auth_token";

export async function getToken(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(TOKEN_KEY);
    return value ?? null;
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export async function clearToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
