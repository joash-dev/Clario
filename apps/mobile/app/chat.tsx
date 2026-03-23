import { Redirect } from "expo-router";

/**
 * Legacy route: chat lives on the AI tab. Keeps deep links to /chat working.
 */
export default function ChatRedirectScreen() {
  return <Redirect href="/(tabs)/ai" />;
}
