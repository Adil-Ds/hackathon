import React, { useRef, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Pressable, Image, ScrollView,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { WSProvider } from "./src/contexts/WSContext";
import { COLORS, FONTS, RADIUS, SHADOWS } from "./src/constants/theme";
import { useChatStore } from "./src/stores/chatStore";
import { useNotificationStore } from "./src/stores/notificationStore";

// ── Auth Screens ──────────────────────────────────────────────────────────────
import SplashScreen from "./src/screens/auth/SplashScreen";
import WelcomeScreen from "./src/screens/auth/WelcomeScreen";
import LoginScreen from "./src/screens/auth/LoginScreen";
import RegisterScreen from "./src/screens/auth/RegisterScreen";

// ── User Screens ──────────────────────────────────────────────────────────────
import UserDashboard from "./src/screens/user/UserDashboard";
import SearchScreen from "./src/screens/user/SearchScreen";
import ReasoningScreen from "./src/screens/user/ReasoningScreen";
import ResultsScreen from "./src/screens/user/ResultsScreen";
import BookingScreen from "./src/screens/user/BookingScreen";
import ConfirmationScreen from "./src/screens/user/ConfirmationScreen";
import BookingHistoryScreen from "./src/screens/user/BookingHistoryScreen";
import ProfileScreen from "./src/screens/user/ProfileScreen";
import NotificationsScreen from "./src/screens/user/NotificationsScreen";
import LanguageScreen from "./src/screens/user/LanguageScreen";
import AppearanceScreen from "./src/screens/user/AppearanceScreen";
import HelpSupportScreen from "./src/screens/user/HelpSupportScreen";
import LiveSearchScreen from "./src/screens/user/LiveSearchScreen";
import DeepSearchScreen from "./src/screens/user/DeepSearchScreen";
import ProviderDiscoveryScreen from "./src/screens/user/ProviderDiscoveryScreen";

// ── Provider Screens ──────────────────────────────────────────────────────────
import ProviderDashboard from "./src/screens/provider/ProviderDashboard";
import BookingRequestsScreen from "./src/screens/provider/BookingRequestsScreen";
import ProviderProfileScreen from "./src/screens/provider/ProviderProfileScreen";
import ProviderPublicProfileScreen from "./src/screens/provider/ProviderPublicProfileScreen";
import ProviderOnboardingScreen from "./src/screens/provider/ProviderOnboardingScreen";

// ── Chat Screens ──────────────────────────────────────────────────────────────
import ChatInboxScreen from "./src/screens/chat/ChatInboxScreen";
import ChatRoomScreen from "./src/screens/chat/ChatRoomScreen";

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Tab Icon with spring animation ───────────────────────────────────────────
function TabIcon({ name, focused, color }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.18 : 1,
      useNativeDriver: true,
      speed: 32,
      bounciness: 10,
    }).start();
  }, [focused]);
  return (
    <Animated.View style={[tab.iconWrap, { transform: [{ scale }] }]}>
      <Ionicons name={name} size={22} color={color} />
      {focused && <View style={[tab.activeDot, { backgroundColor: color }]} />}
    </Animated.View>
  );
}

// ── Badge overlay (unread count) ──────────────────────────────────────────────
function BadgeIcon({ name, focused, color, count }) {
  return (
    <View style={{ position: "relative" }}>
      <TabIcon name={name} focused={focused} color={color} />
      {count > 0 && (
        <View style={tab.badge}>
          <Text style={tab.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </View>
  );
}

// ── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }) {
  const { colors: C } = useTheme();
  const totalUnread   = useChatStore((s) => s.totalUnread);
  const notifUnread   = useNotificationStore((s) => s.unreadCount);

  return (
    <View style={[tab.bar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused     = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        // Determine badge count per tab
        let badgeCount = 0;
        if (route.name === "ChatTab")   badgeCount = totalUnread;
        if (route.name === "AlertsTab") badgeCount = notifUnread;

        // ── Center AI FAB ────────────────────────────────────────────────────
        if (index === 2) {
          return (
            <View key={route.key} style={tab.fabWrap}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate("LiveSearch")}
                style={tab.fab}
              >
                <LinearGradient
                  colors={[COLORS.primary, COLORS.violet]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={tab.fabGrad}
                >
                  <Ionicons name="sparkles" size={22} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              <Text style={[tab.fabLabel, { color: C.textMuted }]}>AI</Text>
            </View>
          );
        }

        return (
          <Pressable key={route.key} onPress={onPress} style={tab.item}>
            {options.tabBarIcon({
              focused,
              color: focused ? C.primary : C.textMuted,
              badgeCount,
            })}
            <Text style={[tab.label, { color: focused ? C.primary : C.textMuted }]}>
              {options.title || route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── User Tab Navigator ────────────────────────────────────────────────────────
function UserTabs({ navigation }) {
  const { userProfile } = useAuth();
  const { colors: C }   = useTheme();
  const totalUnread     = useChatStore((s) => s.totalUnread);
  const notifUnread     = useNotificationStore((s) => s.unreadCount);

  const headerRight = () => (
    <TouchableOpacity
      onPress={() => navigation.navigate("Profile")}
      style={tab.avatarBtn}
      activeOpacity={0.8}
    >
      <View style={tab.avatarCircle}>
        <Text style={tab.avatarInitial}>
          {(userProfile?.name || "U")[0].toUpperCase()}
        </Text>
      </View>
      {notifUnread > 0 && <View style={tab.avatarBadge} />}
    </TouchableOpacity>
  );

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: C.surface },
        headerTintColor: C.text,
        headerTitleStyle: { ...FONTS.bold, fontSize: 17 },
        headerShadowVisible: false,
        headerRight,
      }}
    >
      {/* Tab 0 — Home */}
      <Tab.Screen
        name="HomeTab"
        component={UserDashboard}
        options={{
          title: "Home",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? "home" : "home-outline"} focused={focused} color={color} />
          ),
        }}
      />

      {/* Tab 1 — Browse Providers */}
      <Tab.Screen
        name="BrowseTab"
        component={ProviderDiscoveryScreen}
        options={{
          title: "Browse",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? "compass" : "compass-outline"} focused={focused} color={color} />
          ),
        }}
      />

      {/* Tab 2 — AI FAB (center) — renders as floating button above bar */}
      <Tab.Screen
        name="AITab"
        component={LiveSearchScreen}
        options={{
          title: "AI",
          tabBarIcon: () => null,
          headerShown: false,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
          },
        }}
      />

      {/* Tab 3 — Bookings */}
      <Tab.Screen
        name="BookingsTab"
        component={BookingHistoryScreen}
        options={{
          title: "Bookings",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? "receipt" : "receipt-outline"} focused={focused} color={color} />
          ),
        }}
      />

      {/* Tab 4 — Chat */}
      <Tab.Screen
        name="ChatTab"
        component={ChatInboxScreen}
        options={{
          title: "Chat",
          tabBarIcon: ({ focused, color, badgeCount }) => (
            <BadgeIcon
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              focused={focused}
              color={color}
              count={badgeCount}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ── Provider Tab Navigator ────────────────────────────────────────────────────
function ProviderTabs({ navigation }) {
  const { userProfile } = useAuth();
  const { colors: C }   = useTheme();
  const notifUnread     = useNotificationStore((s) => s.unreadCount);

  const headerRight = () => (
    <TouchableOpacity
      onPress={() => navigation.navigate("ProviderProfile")}
      style={tab.avatarBtn}
      activeOpacity={0.8}
    >
      <View style={[tab.avatarCircle, { backgroundColor: COLORS.violet + "30" }]}>
        <Text style={tab.avatarInitial}>
          {(userProfile?.name || "P")[0].toUpperCase()}
        </Text>
      </View>
      {notifUnread > 0 && <View style={tab.avatarBadge} />}
    </TouchableOpacity>
  );

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: C.surface },
        headerTintColor: C.text,
        headerTitleStyle: { ...FONTS.bold, fontSize: 17 },
        headerShadowVisible: false,
        headerRight,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={ProviderDashboard}
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? "grid" : "grid-outline"} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="RequestsTab"
        component={BookingRequestsScreen}
        options={{
          title: "Requests",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? "calendar" : "calendar-outline"} focused={focused} color={color} />
          ),
        }}
      />
      {/* Center AI FAB placeholder */}
      <Tab.Screen
        name="AITab"
        component={LiveSearchScreen}
        options={{
          title: "AI",
          tabBarIcon: () => null,
          headerShown: false,
        }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />
      <Tab.Screen
        name="ChatProviderTab"
        component={ChatInboxScreen}
        options={{
          title: "Chat",
          tabBarIcon: ({ focused, color, badgeCount }) => (
            <BadgeIcon
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              focused={focused}
              color={color}
              count={badgeCount}
            />
          ),
        }}
      />
      <Tab.Screen
        name="NotificationsProviderTab"
        component={NotificationsScreen}
        options={{
          title: "Alerts",
          tabBarIcon: ({ focused, color, badgeCount }) => (
            <BadgeIcon
              name={focused ? "notifications" : "notifications-outline"}
              focused={focused}
              color={color}
              count={badgeCount}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ── Root Navigator ────────────────────────────────────────────────────────────
function RootNavigator() {
  const { user, userProfile, loading } = useAuth();
  const { colors: C } = useTheme();

  if (loading) return <SplashScreen />;

  const isProvider = userProfile?.role === "provider";

  const commonHeader = {
    headerStyle: { backgroundColor: C.surface },
    headerTintColor: C.text,
    headerTitleStyle: { ...FONTS.semiBold, fontSize: 16 },
    contentStyle: { backgroundColor: C.bg },
    headerShadowVisible: false,
    animation: "slide_from_right",
    headerBackTitle: "",
  };

  return (
    <Stack.Navigator screenOptions={commonHeader}>
      {!user ? (
        <>
          <Stack.Screen name="Welcome"  component={WelcomeScreen}  options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen name="Login"    component={LoginScreen}    options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        </>
      ) : isProvider ? (
        <>
          <Stack.Screen name="ProviderTabs"      component={ProviderTabs}              options={{ headerShown: false }} />
          <Stack.Screen name="ProviderProfile"   component={ProviderProfileScreen}     options={{ title: "Profile" }} />
          <Stack.Screen name="ProviderOnboarding" component={ProviderOnboardingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ChatRoom"          component={ChatRoomScreen}            options={{ title: "Chat" }} />
          <Stack.Screen name="LiveSearch"        component={LiveSearchScreen}          options={{ headerShown: false }} />
        </>
      ) : (
        <>
          <Stack.Screen name="UserTabs"     component={UserTabs}     options={{ headerShown: false }} />
          <Stack.Screen name="Search"       component={SearchScreen}       options={{ title: "Find a Service" }} />
          <Stack.Screen name="Reasoning"    component={ReasoningScreen}    options={{ title: "AI Agents" }} />
          <Stack.Screen name="Results"      component={ResultsScreen}      options={{ title: "Top Matches" }} />
          <Stack.Screen name="Booking"      component={BookingScreen}      options={{ title: "Confirm Booking" }} />
          <Stack.Screen name="Confirmation" component={ConfirmationScreen} options={{ title: "Booking Confirmed", gestureEnabled: false }} />
          <Stack.Screen name="Profile"      component={ProfileScreen}      options={{ title: "My Profile" }} />
          <Stack.Screen name="Language"     component={LanguageScreen}     options={{ title: "Language" }} />
          <Stack.Screen name="Appearance"   component={AppearanceScreen}   options={{ title: "Appearance" }} />
          <Stack.Screen name="HelpSupport"  component={HelpSupportScreen}  options={{ title: "Help & Support" }} />
          <Stack.Screen name="LiveSearch"   component={LiveSearchScreen}   options={{ headerShown: false }} />
          <Stack.Screen name="DeepSearch"   component={DeepSearchScreen}   options={{ headerShown: false }} />
          <Stack.Screen name="ChatRoom"     component={ChatRoomScreen}     options={{ title: "Chat" }} />
          <Stack.Screen name="ProviderPublicProfile"  component={ProviderPublicProfileScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ProviderOnboarding"     component={ProviderOnboardingScreen}    options={{ headerShown: false }} />
          <Stack.Screen name="Notifications"          component={NotificationsScreen}         options={{ title: "Notifications" }} />
        </>
      )}
    </Stack.Navigator>
  );
}

// ── Inner App ─────────────────────────────────────────────────────────────────
function ThemedApp() {
  const { navTheme, isDark } = useTheme();
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={navTheme.colors.card} />
      <RootNavigator />
    </NavigationContainer>
  );
}

// ── Error Boundary ──────────────────────────────────────────────────────────
// Catches render crashes anywhere in the tree and shows a readable message
// instead of a blank white screen.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={eb.wrap}>
          <ScrollView contentContainerStyle={eb.scroll}>
            <Ionicons name="warning-outline" size={48} color="#F59E0B" />
            <Text style={eb.title}>Something went wrong</Text>
            <Text style={eb.msg}>{String(this.state.error?.message || this.state.error)}</Text>
            {this.state.error?.stack ? (
              <Text style={eb.stack}>{String(this.state.error.stack).slice(0, 600)}</Text>
            ) : null}
            <TouchableOpacity style={eb.btn} onPress={() => this.setState({ error: null })}>
              <Text style={eb.btnText}>Try Again</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  wrap:   { flex: 1, backgroundColor: "#0E0E1A" },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  title:  { fontSize: 20, fontWeight: "800", color: "#fff", textAlign: "center" },
  msg:    { fontSize: 14, color: "#FCA5A5", textAlign: "center" },
  stack:  { fontSize: 10, color: "#9CA3AF", fontFamily: "Courier New", marginTop: 8 },
  btn:    { marginTop: 16, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, backgroundColor: "#6C63FF" },
  btnText:{ color: "#fff", fontWeight: "700", fontSize: 15 },
});

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <WSProvider>
              <ThemedApp />
            </WSProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const tab = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingBottom: 24,
    paddingTop: 8,
    paddingHorizontal: 4,
    ...SHADOWS.md,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    paddingBottom: 2,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 30,
  },
  activeDot: {
    position: "absolute",
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontSize: 10,
    ...FONTS.medium,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#fff",
  },
  // Center FAB
  fabWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 2,
    gap: 3,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 16,
    marginTop: -18,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  fabGrad: {
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  fabLabel: {
    fontSize: 10,
    ...FONTS.medium,
  },
  // Avatar button
  avatarBtn: {
    marginRight: 14,
    position: "relative",
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary + "25",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.primary + "44",
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary,
  },
  avatarBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.danger,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
});
