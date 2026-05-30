import React, { useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ChatAPI } from "../../services/chatApi";
import { COLORS, FONTS, RADIUS } from "../../constants/theme";

const STEPS = [
  { title: "Business Info", icon: "storefront-outline", desc: "Tell us about your business" },
  { title: "Services", icon: "construct-outline", desc: "What services do you offer?" },
  { title: "Availability", icon: "calendar-outline", desc: "When are you available?" },
  { title: "Skills & Links", icon: "code-slash-outline", desc: "Showcase your expertise" },
];

const DAYS = [
  { label: "Mon", value: 0 },
  { label: "Tue", value: 1 },
  { label: "Wed", value: 2 },
  { label: "Thu", value: 3 },
  { label: "Fri", value: 4 },
  { label: "Sat", value: 5 },
  { label: "Sun", value: 6 },
];

const CATEGORIES = [
  "Plumber", "Electrician", "Carpenter", "Painter", "Tutor",
  "Doctor", "Mechanic", "Cleaner", "Gardener", "Other",
];

function StepIndicator({ current, total }) {
  return (
    <View style={si.wrap}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            si.dot,
            i < current
              ? si.dotDone
              : i === current
              ? si.dotActive
              : si.dotFuture,
          ]}
        />
      ))}
    </View>
  );
}

function FieldLabel({ label, required }) {
  return (
    <Text style={fl.label}>
      {label}
      {required && <Text style={fl.req}> *</Text>}
    </Text>
  );
}

function Input({ label, required, ...props }) {
  return (
    <View style={inp.wrap}>
      <FieldLabel label={label} required={required} />
      <TextInput
        style={inp.input}
        placeholderTextColor={COLORS.textMuted}
        {...props}
      />
    </View>
  );
}

export default function ProviderOnboardingScreen({ navigation, onComplete }) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Step 0 — Business Info
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("0");

  // Step 1 — Services
  const [services, setServices] = useState([{ name: "", priceMin: "", priceMax: "", duration: "60" }]);

  // Step 2 — Availability
  const [availability, setAvailability] = useState(
    DAYS.map((d) => ({ ...d, enabled: d.value < 5, startTime: "09:00", endTime: "17:00" }))
  );

  // Step 3 — Skills & Links
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState([]);
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");

  const animateStep = (dir) => {
    const toValue = dir === "next" ? -400 : 400;
    Animated.sequence([
      Animated.timing(slideAnim, { toValue, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]).start();
  };

  const goNext = () => {
    if (step === 0 && (!businessName.trim() || !category || !city.trim() || !area.trim())) {
      Alert.alert("Required", "Please fill Business Name, Category, City and Area.");
      return;
    }
    animateStep("next");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    if (step === 0) { navigation.goBack(); return; }
    animateStep("back");
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        business_name: businessName.trim(),
        category: category.toLowerCase(),
        city: city.trim(),
        area: area.trim(),
        bio: bio.trim() || null,
        experience_years: parseInt(experienceYears) || 0,
        skills,
        languages: [],
        price_range: {},
        website: website.trim() || null,
        linkedin: linkedin.trim() || null,
        services: services
          .filter((s) => s.name.trim())
          .map((s) => ({
            name: s.name.trim(),
            price_min: parseInt(s.priceMin) || 0,
            price_max: parseInt(s.priceMax) || 0,
            duration_minutes: parseInt(s.duration) || 60,
          })),
        availability: availability
          .filter((a) => a.enabled)
          .map((a) => ({
            day_of_week: a.value,
            start_time: a.startTime,
            end_time: a.endTime,
            is_available: true,
          })),
      };

      await ChatAPI.onboardProvider(payload);
      Alert.alert("Success!", "Your provider profile is ready.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Error", "Could not create profile. " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills((prev) => [...prev, s]);
    setSkillInput("");
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Input label="Business Name" required value={businessName} onChangeText={setBusinessName} placeholder="e.g. Ali Plumbing Services" />
            <View style={inp.wrap}>
              <FieldLabel label="Category" required />
              <View style={cat.grid}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[cat.pill, category === c.toLowerCase() && cat.pillActive]}
                    onPress={() => setCategory(c.toLowerCase())}
                    activeOpacity={0.7}
                  >
                    <Text style={[cat.pillText, category === c.toLowerCase() && cat.pillTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Input label="City" required value={city} onChangeText={setCity} placeholder="e.g. Lahore" />
            <Input label="Area" required value={area} onChangeText={setArea} placeholder="e.g. DHA Phase 5" />
            <Input label="Bio" value={bio} onChangeText={setBio} placeholder="Tell clients about yourself…" multiline numberOfLines={3} />
            <Input label="Experience (years)" value={experienceYears} onChangeText={setExperienceYears} keyboardType="numeric" placeholder="0" />
          </ScrollView>
        );

      case 1:
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            {services.map((svc, i) => (
              <View key={i} style={svcS.card}>
                <View style={svcS.cardHeader}>
                  <Text style={svcS.cardTitle}>Service {i + 1}</Text>
                  {services.length > 1 && (
                    <TouchableOpacity
                      onPress={() => setServices((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                    </TouchableOpacity>
                  )}
                </View>
                <Input label="Service Name" required value={svc.name} onChangeText={(v) => setServices((prev) => prev.map((s, j) => j === i ? { ...s, name: v } : s))} placeholder="e.g. Pipe Repair" />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input label="Min Price (₨)" value={svc.priceMin} onChangeText={(v) => setServices((prev) => prev.map((s, j) => j === i ? { ...s, priceMin: v } : s))} keyboardType="numeric" placeholder="500" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Max Price (₨)" value={svc.priceMax} onChangeText={(v) => setServices((prev) => prev.map((s, j) => j === i ? { ...s, priceMax: v } : s))} keyboardType="numeric" placeholder="2000" />
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={svcS.addBtn}
              onPress={() => setServices((prev) => [...prev, { name: "", priceMin: "", priceMax: "", duration: "60" }])}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={svcS.addBtnText}>Add Service</Text>
            </TouchableOpacity>
          </ScrollView>
        );

      case 2:
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            {availability.map((day, i) => (
              <View key={day.label} style={av.row}>
                <TouchableOpacity
                  style={[av.toggle, day.enabled && av.toggleOn]}
                  onPress={() =>
                    setAvailability((prev) =>
                      prev.map((d, j) => j === i ? { ...d, enabled: !d.enabled } : d)
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Text style={[av.toggleText, day.enabled && av.toggleTextOn]}>
                    {day.label}
                  </Text>
                </TouchableOpacity>
                {day.enabled && (
                  <View style={av.timeRow}>
                    <TextInput
                      style={av.timeInput}
                      value={day.startTime}
                      onChangeText={(v) =>
                        setAvailability((prev) =>
                          prev.map((d, j) => j === i ? { ...d, startTime: v } : d)
                        )
                      }
                      placeholder="09:00"
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <Text style={av.timeSep}>–</Text>
                    <TextInput
                      style={av.timeInput}
                      value={day.endTime}
                      onChangeText={(v) =>
                        setAvailability((prev) =>
                          prev.map((d, j) => j === i ? { ...d, endTime: v } : d)
                        )
                      }
                      placeholder="17:00"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        );

      case 3:
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={inp.wrap}>
              <FieldLabel label="Skills" />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  style={[inp.input, { flex: 1 }]}
                  value={skillInput}
                  onChangeText={setSkillInput}
                  placeholder="e.g. Pipe Installation"
                  placeholderTextColor={COLORS.textMuted}
                  onSubmitEditing={addSkill}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={{ backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, justifyContent: "center" }}
                  onPress={addSkill}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
              {skills.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {skills.map((sk) => (
                    <TouchableOpacity
                      key={sk}
                      style={skillPill.pill}
                      onPress={() => setSkills((prev) => prev.filter((s) => s !== sk))}
                    >
                      <Text style={skillPill.text}>{sk}</Text>
                      <Ionicons name="close" size={12} color={COLORS.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <Input label="Website" value={website} onChangeText={setWebsite} placeholder="https://yoursite.com" keyboardType="url" autoCapitalize="none" />
            <Input label="LinkedIn" value={linkedin} onChangeText={setLinkedin} placeholder="https://linkedin.com/in/..." keyboardType="url" autoCapitalize="none" />
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={goBack} style={s.headerBack}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>{STEPS[step].title}</Text>
            <Text style={s.headerSub}>Step {step + 1} of {STEPS.length}</Text>
          </View>
        </View>

        <StepIndicator current={step} total={STEPS.length} />

        {/* Step Description */}
        <View style={s.stepDesc}>
          <Ionicons name={STEPS[step].icon} size={24} color={COLORS.primary} />
          <Text style={s.stepDescText}>{STEPS[step].desc}</Text>
        </View>

        {/* Step Content */}
        <Animated.View style={[s.content, { transform: [{ translateX: slideAnim }] }]}>
          {renderStep()}
        </Animated.View>

        {/* Footer Buttons */}
        <View style={s.footer}>
          {step < STEPS.length - 1 ? (
            <TouchableOpacity style={s.nextBtn} onPress={goNext} activeOpacity={0.85}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.violet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.nextBtnGrad}
              >
                <Text style={s.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.nextBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <LinearGradient
                colors={[COLORS.success, COLORS.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.nextBtnGrad}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={s.nextBtnText}>Create Profile</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 8 },
  headerBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textMuted },
  stepDesc: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.primary + "10",
    marginHorizontal: 16, borderRadius: 12, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.primary + "22",
  },
  stepDescText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  footer: { padding: 16 },
  nextBtn: { borderRadius: 14, overflow: "hidden" },
  nextBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15,
  },
  nextBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
});

const si = StyleSheet.create({
  wrap: { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotDone: { backgroundColor: COLORS.success },
  dotActive: { backgroundColor: COLORS.primary, width: 24 },
  dotFuture: { backgroundColor: COLORS.border },
});

const fl = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary, marginBottom: 6 },
  req: { color: COLORS.danger },
});

const inp = StyleSheet.create({
  wrap: { marginBottom: 16 },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: COLORS.text,
    fontSize: 14,
  },
});

const cat = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.card,
  },
  pillActive: { backgroundColor: COLORS.primary + "18", borderColor: COLORS.primary + "66" },
  pillText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  pillTextActive: { color: COLORS.primary },
});

const svcS = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.border, padding: 12, marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, padding: 12, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.primary + "44", borderStyle: "dashed",
  },
  addBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: "600" },
});

const av = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  toggle: {
    width: 52, height: 32, borderRadius: 8,
    backgroundColor: COLORS.surface, borderWidth: 1,
    borderColor: COLORS.border, alignItems: "center", justifyContent: "center",
  },
  toggleOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleText: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted },
  toggleTextOn: { color: "#fff" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  timeInput: {
    flex: 1, backgroundColor: COLORS.card,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 10, paddingVertical: 7,
    color: COLORS.text, fontSize: 13, textAlign: "center",
  },
  timeSep: { color: COLORS.textMuted, fontSize: 14 },
});

const skillPill = StyleSheet.create({
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.primary + "18",
    borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.primary + "33",
  },
  text: { fontSize: 12, color: COLORS.primary, fontWeight: "600" },
});
