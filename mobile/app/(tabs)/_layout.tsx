import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/theme";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ fontSize: 11, color: focused ? colors.ink : colors.inkSoft }}>{label}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.ivory },
        headerTintColor: colors.ink,
        tabBarStyle: { backgroundColor: colors.ivory, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", headerTitle: "Ember & Wick", tabBarIcon: ({ focused }) => <TabIcon label="⌂" focused={focused} /> }}
      />
      <Tabs.Screen
        name="shop"
        options={{ title: "Shop", tabBarIcon: ({ focused }) => <TabIcon label="◍" focused={focused} /> }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{ title: "Saved", tabBarIcon: ({ focused }) => <TabIcon label="♡" focused={focused} /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{ title: "Cart", tabBarIcon: ({ focused }) => <TabIcon label="▤" focused={focused} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: ({ focused }) => <TabIcon label="☺" focused={focused} /> }}
      />
    </Tabs>
  );
}
