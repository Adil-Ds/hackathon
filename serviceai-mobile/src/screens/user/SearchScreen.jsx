import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Animated, Keyboard,
  KeyboardAvoidingView, Platform, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { API } from "../../services/api";
import { COLORS, FONTS, RADIUS, SHADOWS, SERVICE_CATEGORIES } from "../../constants/theme";
import { DEMO_MODE } from "../../config/constants";

// Optional: expo-location for GPS (run `npx expo install expo-location` if not installed)
let Location = null;
try { Location = require("expo-location"); } catch (_) {}

async function tryGetCoords() {
  if (!Location) return null;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy?.Balanced ?? 3 });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (_) {
    return null;
  }
}

const SUGGESTIONS = [
  "mujhe kal Gulshan mein plumber chahiye, 2000 se zyada nahi",
  "Need an electrician in DHA Lahore this Saturday, budget 3500 PKR",
  "I need a house cleaner in Gulshan Karachi tomorrow morning",
  "Painter needed in DHA Lahore, want to repaint 2 rooms",
  "AC technician needed in Clifton, urgent repair",
  "Need a mechanic for car repair in Nazimabad Karachi",
];

export default function SearchScreen({ route, navigation }) {
  const prefill = route.params?.prefill || "";
  const [text, setText] = useState(prefill);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cardAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: focused ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.border, COLORS.primary],
  });

  const handleAnalyze = async () => {
    if (!text.trim()) {
      Alert.alert("Describe your need", "Type what service you need — in Urdu or English.");
      return;
    }
    Keyboard.dismiss();
    setLoading(true);

    // Get GPS quietly — only blocks for ~1s then navigates
    const coords = await tryGetCoords();
    setLoading(false);

    // Navigate immediately — ReasoningScreen owns the API call so the map
    // shows right away with the radar animation while the backend responds.
    navigation.navigate("Reasoning", {
      userText: text,
      userCoords: coords,
      useSSE:  !DEMO_MODE && Platform.OS === "web",
      usePost: !DEMO_MODE && Platform.OS !== "web",
      // DEMO_MODE: neither flag set — ReasoningScreen uses API.analyze() which returns mock
      demoMode: DEMO_MODE,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View style={{ opacity: cardAnim, transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
            <Text style={styles.title}>Find a Service</Text>
            <Text style={styles.subtitle}>
              5 AI agents will match & book the best provider for you — in Urdu or English
            </Text>
          </Animated.View>

          {/* Agent Pipeline Visual */}
          <View style={styles.pipelineCard}>
            {[
              { icon: "🧠", label: "Parse", color: COLORS.info },
              { icon: "🔍", label: "Search", color: COLORS.primary },
              { icon: "📊", label: "Rank", color: COLORS.success },
              { icon: "📋", label: "Book", color: COLORS.warning },
              { icon: "🔔", label: "Follow-up", color: "#A78BFA" },
            ].map((step, i) => (
              <React.Fragment key={i}>
                <View style={styles.pipelineStep}>
                  <Text style={styles.stepIcon}>{step.icon}</Text>
                  <Text style={[styles.stepLabel, { color: step.color }]}>{step.label}</Text>
                </View>
                {i < 4 && (
                  <Ionicons name="chevron-forward" size={12} color={COLORS.textMuted} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* Main AI Input */}
          <Animated.View style={{ borderRadius: RADIUS.xl, borderWidth: 1.5, borderColor, marginBottom: 14, ...SHADOWS.md }}>
            <LinearGradient colors={["#12123A", "#0D0D28", "#0A0A1E"]} style={styles.inputGradient}>
              {/* Input header */}
              <View style={styles.inputHeader}>
                <View style={styles.inputHeaderLeft}>
                  <View style={styles.aiDot} />
                  <Text style={styles.inputHeaderText}>Describe your need</Text>
                </View>
                <View style={styles.langPills}>
                  <Text style={styles.langPill}>اردو</Text>
                  <Text style={styles.langPill}>EN</Text>
                </View>
              </View>

              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder={"e.g. mujhe kal Gulshan mein plumber chahiye...\nor: Need electrician in DHA Lahore"}
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />

              {text.length > 0 && (
                <TouchableOpacity style={styles.clearBtn} onPress={() => setText("")}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}

              <View style={styles.inputFooter}>
                <View style={styles.inputHint}>
                  <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.hintText}>Mention area + city</Text>
                </View>
                <Text style={[styles.charCount, text.length > 200 && { color: COLORS.warning }]}>
                  {text.length}
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* CTA Button */}
          <TouchableOpacity
            style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
            onPress={handleAnalyze}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={loading ? [COLORS.surface, COLORS.card] : ["#6C63FF", "#8B5CF6"]}
              style={styles.analyzeBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={COLORS.primary} size="small" />
                  <Text style={[styles.analyzeBtnText, { color: COLORS.primary }]}>Running AI Agents...</Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={styles.analyzeBtnText}>Analyze & Find Providers</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Quick Categories */}
          <Text style={styles.sectionTitle}>Quick Select</Text>
          <View style={styles.catGrid}>
            {SERVICE_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                style={({ pressed }) => [styles.catCard, { borderColor: cat.color + "44", opacity: pressed ? 0.8 : 1 }]}
                onPress={() => setText(`I need a ${cat.label.toLowerCase()} near me`)}
              >
                <Text style={styles.catIcon}>{cat.icon}</Text>
                <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Sample Queries */}
          <Text style={styles.sectionTitle}>Sample Queries</Text>
          {SUGGESTIONS.map((s, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.75, borderColor: COLORS.primary + "55" }]}
              onPress={() => setText(s)}
            >
              <Text style={styles.suggestionText} numberOfLines={2}>{s}</Text>
              <View style={styles.tapChip}>
                <Ionicons name="arrow-up-circle" size={14} color={COLORS.primary} />
                <Text style={styles.tapLabel}>Use</Text>
              </View>
            </Pressable>
          ))}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 40 },

  title: { fontSize: 28, ...FONTS.extraBold, color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 20 },

  pipelineCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  pipelineStep: { alignItems: "center", gap: 3 },
  stepIcon: { fontSize: 16 },
  stepLabel: { fontSize: 9, ...FONTS.semiBold },

  inputGradient: { padding: 16, borderRadius: RADIUS.xl - 1 },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  inputHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  inputHeaderText: { fontSize: 12, color: COLORS.primary, ...FONTS.semiBold },
  langPills: { flexDirection: "row", gap: 6 },
  langPill: {
    fontSize: 10,
    color: COLORS.textMuted,
    backgroundColor: COLORS.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    ...FONTS.medium,
  },
  input: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 24,
    minHeight: 90,
  },
  clearBtn: {
    alignSelf: "flex-end",
    padding: 2,
  },
  inputFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  inputHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  hintText: { fontSize: 11, color: COLORS.textMuted },
  charCount: { fontSize: 11, color: COLORS.textMuted },

  analyzeBtn: {
    marginBottom: 24,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    ...SHADOWS.glow,
  },
  analyzeBtnDisabled: { opacity: 0.7, shadowOpacity: 0 },
  analyzeBtnGrad: { paddingVertical: 16, alignItems: "center", borderRadius: RADIUS.lg },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  analyzeBtnText: { color: "#fff", fontSize: 16, ...FONTS.semiBold },

  sectionTitle: {
    fontSize: 11,
    ...FONTS.bold,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  catCard: {
    width: "30.5%",
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 1,
    gap: 6,
  },
  catIcon: { fontSize: 22 },
  catLabel: { fontSize: 11, ...FONTS.semiBold },

  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  suggestionText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, fontStyle: "italic" },
  tapChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  tapLabel: { fontSize: 10, color: COLORS.primary, ...FONTS.semiBold },
});
