import { Tabs } from "expo-router";
import { View } from "react-native";
import { VerticalNav } from "../../components/VerticalNav";

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="tasks" />
        <Tabs.Screen name="ai" />
        <Tabs.Screen name="notes" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <VerticalNav />
    </View>
  );
}
