import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS, FONTS, RADIUS, SHADOWS, SERVICE_CATEGORIES } from "../../constants/theme";

// ── Sub-components ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, keyboard = "default", secure = false, required = false }) {
  const [show, setShow] = useState(false);
  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label}
        {required ? <Text style={{ color: COLORS.danger }}> *</Text> : null}
      </Text>
      <View style={s.inputWrap}>
        <TextInput
          style={[s.input, { flex: 1, borderWidth: 0, backgroundColor: "transparent" }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={keyboard}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secure && !show}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShow((v) => !v)} style={{ paddingHorizontal: 12 }}>
            <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <View style={s.sectionHeader}>
      <Ionicons name={icon} size={15} color={COLORS.primary} />
      <Text style={s.sectionHeaderText}>{title}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function RegisterScreen({ route, navigation }) {
  const role       = route.params?.role || "user";
  const { signUp } = useAuth();
  const isProvider = role === "provider";

  const [form, setForm] = useState({
    // Common
    name:            "",
    email:           "",
    password:        "",
    phone:           "",
    // Provider-only
    businessName:    "",
    category:        SERVICE_CATEGORIES[0]?.key || "plumber",
    city:            "",
    area:            "",
    address:         "",
    experienceYears: "",
  });
  const [loading,      setLoading]      = useState(false);
  const [locLoading,   setLocLoading]   = useState(false);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  // ── Auto-detect location ──────────────────────────────────────────────────
  const detectLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Allow location to auto-fill your city.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (place) {
        const city = place.city || place.subregion || "";
        const area = place.district || place.subregion || place.neighborhood || "";
        const addr = [place.street, place.name].filter(Boolean).join(", ");
        setForm((f) => ({
          ...f,
          city:    f.city    || city,
          area:    f.area    || area,
          address: f.address || addr,
        }));
      }
    } catch (e) {
      Alert.alert("Location Error", "Could not detect location. Please enter manually.");
    } finally {
      setLocLoading(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    if (!form.name.trim())  { Alert.alert("Required", "Please enter your full name."); return false; }
    if (!form.email.trim()) { Alert.alert("Required", "Please enter your email."); return false; }
    if (form.password.length < 6) { Alert.alert("Weak Password", "Password must be at least 6 characters."); return false; }
    if (isProvider) {
      if (!form.phone.trim())  { Alert.alert("Required", "Phone number is required."); return false; }
      if (!form.city.trim())   { Alert.alert("Required", "City is required."); return false; }
      if (!form.area.trim())   { Alert.alert("Required", "Area / neighbourhood is required."); return false; }
      if (!form.experienceYears.trim() || isNaN(Number(form.experienceYears))) {
        Alert.alert("Required", "Enter valid years of experience (e.g. 3)."); return false;
      }
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signUp({
        email:           form.email.trim().toLowerCase(),
        password:        form.password,
        name:            form.name.trim(),
        role,
        phone:           form.phone.trim(),
        businessName:    form.businessName.trim() || form.name.trim(),
        category:        form.category,
        city:            form.city.trim(),
        area:            form.area.trim(),
        address:         form.address.trim(),
        experienceYears: Number(form.experienceYears) || 0,
      });
      // Navigation handled by RootNavigator via onAuthStateChanged
    } catch (e) {
      Alert.alert(
        "Registration Failed",
        e.message.replace("Firebase: ", "").replace(/\(auth\/.*\)/, "").trim()
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <LinearGradient colors={["#07070F", "#0E0E1A"]} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

            {/* Back */}
            <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back-outline" size={20} color={COLORS.textSecondary} />
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={s.header}>
              <View style={[s.roleBadge, isProvider && s.roleBadgeProvider]}>
                <Text style={s.roleBadgeText}>{isProvider ? "🛠️ Service Provider" : "🙋 User"}</Text>
              </View>
              <Text style={s.title}>Create Account</Text>
              <Text style={s.subtitle}>Join Pakistan's AI-powered service network</Text>
            </View>

            <View style={s.card}>
              {/* ── Basic Info ── */}
              <SectionHeader icon="person-outline" title="Basic Information" />

              <Field label="Full Name" value={form.name} onChange={set("name")} placeholder="Ahmed Khan" required />
              <Field label="Email Address" value={form.email} onChange={set("email")} placeholder="you@example.com" keyboard="email-address" required />
              <Field label="Password" value={form.password} onChange={set("password")} placeholder="Min. 6 characters" secure required />
              <Field label="Phone Number" value={form.phone} onChange={set("phone")} placeholder="0300-1234567" keyboard="phone-pad" required={isProvider} />

              {/* ── Provider Fields ── */}
              {isProvider && (
                <>
                  {/* Business Name */}
                  <SectionHeader icon="storefront-outline" title="Business Details" />

                  <Field
                    label="Business / Trade Name"
                    value={form.businessName}
                    onChange={set("businessName")}
                    placeholder="e.g. Ahmed Plumbing Services (optional)"
                  />

                  <View style={s.field}>
                    <Text style={s.label}>Years of Experience <Text style={{ color: COLORS.danger }}>*</Text></Text>
                    <View style={s.expRow}>
                      {["0", "1", "2", "3", "5", "7", "10", "15+"].map((yr) => (
                        <TouchableOpacity
                          key={yr}
                          style={[s.expPill, form.experienceYears === yr && s.expPillActive]}
                          onPress={() => set("experienceYears")(yr.replace("+", ""))}
                          activeOpacity={0.75}
                        >
                          <Text style={[s.expText, form.experienceYears === yr && s.expTextActive]}>
                            {yr === "0" ? "New" : yr}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {/* Also allow manual input */}
                    <TextInput
                      style={[s.input, { marginTop: 8 }]}
                      value={form.experienceYears}
                      onChangeText={set("experienceYears")}
                      placeholder="Or type exact number, e.g. 4"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                    />
                  </View>

                  {/* Service Category */}
                  <View style={s.field}>
                    <Text style={s.label}>Service Category <Text style={{ color: COLORS.danger }}>*</Text></Text>
                    <View style={s.chipGrid}>
                      {SERVICE_CATEGORIES.map((c) => (
                        <TouchableOpacity
                          key={c.key}
                          style={[s.chip, form.category === c.key && s.chipActive]}
                          onPress={() => set("category")(c.key)}
                          activeOpacity={0.75}
                        >
                          <Text style={s.chipIcon}>{c.icon}</Text>
                          <Text style={[s.chipText, form.category === c.key && s.chipTextActive]}>
                            {c.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Location */}
                  <SectionHeader icon="location-outline" title="Your Location" />

                  {/* GPS button */}
                  <TouchableOpacity
                    style={s.gpsBtn}
                    onPress={detectLocation}
                    activeOpacity={0.8}
                    disabled={locLoading}
                  >
                    <LinearGradient
                      colors={[COLORS.primary + "22", COLORS.violet + "14"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={s.gpsBtnGrad}
                    >
                      {locLoading
                        ? <ActivityIndicator size="small" color={COLORS.primary} />
                        : <Ionicons name="locate-outline" size={18} color={COLORS.primary} />
                      }
                      <Text style={s.gpsBtnText}>
                        {locLoading ? "Detecting…" : "Auto-detect my location"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={s.locationHint}>
                    <Ionicons name="information-circle-outline" size={13} color={COLORS.textMuted} />
                    <Text style={s.locationHintText}>
                      GPS fills city/area automatically — you can edit any field below.
                    </Text>
                  </View>

                  {/* City — free text, not a hardcoded list */}
                  <Field
                    label="City"
                    value={form.city}
                    onChange={set("city")}
                    placeholder="e.g. Lahore, Karachi, Islamabad, Peshawar…"
                    required
                  />

                  {/* Area / Neighbourhood */}
                  <Field
                    label="Area / Neighbourhood"
                    value={form.area}
                    onChange={set("area")}
                    placeholder="e.g. DHA Phase 5, Gulberg, F-7"
                    required
                  />

                  {/* Full Address */}
                  <View style={s.field}>
                    <Text style={s.label}>Full Address (optional)</Text>
                    <TextInput
                      style={[s.input, { height: 72, textAlignVertical: "top" }]}
                      value={form.address}
                      onChangeText={set("address")}
                      placeholder="Street, building, landmark — helps users find you"
                      placeholderTextColor={COLORS.textMuted}
                      multiline
                    />
                  </View>
                </>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[s.btn, isProvider && s.btnProvider, loading && s.btnDisabled]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnText}>
                    {isProvider ? "Create Provider Account" : "Create Account"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={s.loginRow}>
              <Text style={s.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login", { role })}>
                <Text style={[s.loginLink, isProvider && s.loginLinkProvider]}>Sign In</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 24, paddingTop: 16 },
  back:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  backText: { color: COLORS.textSecondary, fontSize: 14 },
  header: { marginBottom: 24 },
  roleBadge: {
    backgroundColor: COLORS.primaryGlow, borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 6, alignSelf: "flex-start",
    marginBottom: 14, borderWidth: 1, borderColor: COLORS.primary + "44",
  },
  roleBadgeProvider: { backgroundColor: COLORS.providerGlow, borderColor: COLORS.provider + "44" },
  roleBadgeText: { fontSize: 13, color: COLORS.text, ...FONTS.medium },
  title:    { fontSize: 28, ...FONTS.extraBold, color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary },

  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.xl,
    padding: 20, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOWS.md, marginBottom: 20,
  },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 7,
    marginBottom: 14, marginTop: 8,
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sectionHeaderText: { fontSize: 12, fontWeight: "700", color: COLORS.primary, letterSpacing: 0.5, textTransform: "uppercase" },

  field: { marginBottom: 16 },
  label: { fontSize: 11, color: COLORS.textSecondary, ...FONTS.medium, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  input: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    paddingHorizontal: 13, paddingVertical: 13,
    color: COLORS.text, fontSize: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },

  // Experience pills
  expRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  expPill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  expPillActive: { backgroundColor: COLORS.provider + "18", borderColor: COLORS.provider + "66" },
  expText: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary },
  expTextActive: { color: COLORS.provider },

  // Category chips
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    paddingHorizontal: 11, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { borderColor: COLORS.provider, backgroundColor: COLORS.providerGlow },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: 12, color: COLORS.textSecondary, ...FONTS.medium },
  chipTextActive: { color: COLORS.provider },

  // GPS button
  gpsBtn: { borderRadius: 12, overflow: "hidden", marginBottom: 10, borderWidth: 1, borderColor: COLORS.primary + "33" },
  gpsBtnGrad: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  gpsBtnText: { fontSize: 13, fontWeight: "700", color: COLORS.primary },

  locationHint: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 14 },
  locationHintText: { fontSize: 11, color: COLORS.textMuted, flex: 1, lineHeight: 16 },

  // Submit
  btn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: "center", marginTop: 8,
  },
  btnProvider: { backgroundColor: COLORS.provider },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, ...FONTS.semiBold },

  loginRow: { flexDirection: "row", justifyContent: "center", marginBottom: 40 },
  loginText: { color: COLORS.textSecondary, fontSize: 14 },
  loginLink: { color: COLORS.primary, fontSize: 14, ...FONTS.semiBold },
  loginLinkProvider: { color: COLORS.provider },
});
