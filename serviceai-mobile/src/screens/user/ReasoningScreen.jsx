import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Animated,
  TouchableOpacity, Dimensions, Linking, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, RADIUS, SHADOWS } from "../../constants/theme";
import MapSearchOverlay, { MAP_HEIGHT } from "../../components/MapSearchOverlay";
import { API } from "../../services/api";
import { ANALYZE_TIMEOUT_MS } from "../../config/constants";

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms)),
  ]);
}

const { width } = Dimensions.get("window");

// Only these tools are shown on screen (others run silently in background)
const VISIBLE_TOOLS = new Set(["scrape_realtime_providers"]);

// Color and description per tool — drives AgentCard visuals
const STEP_COLORS = {
  parse_intent:              "#60A5FA",
  search_providers:          COLORS.primary,
  rank_providers:            COLORS.success,
  search_web_providers:      COLORS.info,
  scrape_realtime_providers: "#34D399",
  ask_clarification:         COLORS.warning,
};

const STEP_DESC = {
  parse_intent:              "Extracting intent from multilingual input",
  search_providers:          "Querying provider database with filters",
  rank_providers:            "Scoring by proximity, rating & price",
  search_web_providers:      "Searching the web for nearby businesses",
  scrape_realtime_providers: "Searching Google Maps & Google Search for live results",
  ask_clarification:         "Requesting clarification from user",
};

// ── Typewriter Text ──────────────────────────────────────────────────────────
function TypewriterText({ text, delay = 0, color = COLORS.textSecondary, style }) {
  const [displayed, setDisplayed] = useState("");
  const timerRef = useRef(null);

  useEffect(() => {
    const safeText = text || "";
    if (!safeText) return;
    const startTimeout = setTimeout(() => {
      let index = 0;
      timerRef.current = setInterval(() => {
        index += 2;
        setDisplayed(safeText.slice(0, index));
        if (index >= safeText.length) clearInterval(timerRef.current);
      }, 18);
    }, delay);
    return () => {
      clearTimeout(startTimeout);
      clearInterval(timerRef.current);
    };
  }, [text, delay]);

  return <Text style={[{ color, fontSize: 13, lineHeight: 20 }, style]}>{displayed}</Text>;
}

// ── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ progress, totalAgents }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: totalAgents > 0 ? progress / totalAgents : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressBg}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
          ]}
        />
      </View>
      <Text style={styles.progressText}>{progress} / {totalAgents} agents complete</Text>
    </View>
  );
}

// ── Tool Call Chip ───────────────────────────────────────────────────────────
function ToolChip({ tool, visible }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[styles.toolChip, { opacity }]}>
      <Text style={styles.toolChipText}>{tool}</Text>
      <View style={styles.toolChipDone}>
        <Ionicons name="checkmark" size={9} color={COLORS.success} />
      </View>
    </Animated.View>
  );
}

// ── AI Model Badge — shows real model name ────────────────────────────────────
function GeminiCallBadge({ visible, modelName }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 400, delay: 400, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[styles.geminiBadge, { opacity }]}>
      <Text style={styles.geminiDot}>✦</Text>
      <Text style={styles.geminiBadgeText}>{modelName || "llama-3.3-70b-versatile"} called</Text>
      <View style={styles.geminiCheck}>
        <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
      </View>
    </Animated.View>
  );
}

// ── Duration Chip — shows real execution time ─────────────────────────────────
function DurationChip({ durationMs, visible }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: 600, useNativeDriver: true }).start();
    }
  }, [visible]);

  const label = durationMs < 1000
    ? `${durationMs}ms`
    : `${(durationMs / 1000).toFixed(1)}s`;

  return (
    <Animated.View style={[styles.durationChip, { opacity }]}>
      <Ionicons name="timer-outline" size={10} color={COLORS.textMuted} />
      <Text style={styles.durationText}>{label}</Text>
    </Animated.View>
  );
}

// ── Thinking Dots ────────────────────────────────────────────────────────────
function ThinkingDots() {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    anims.forEach((anim, i) => {
      const loop = () => {
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.2, duration: 300, useNativeDriver: true }),
          Animated.delay(450 - i * 150),
        ]).start(loop);
      };
      loop();
    });
  }, []);

  return (
    <View style={styles.thinkingRow}>
      <Text style={styles.thinkingLabel}>Thinking</Text>
      {anims.map((anim, i) => (
        <Animated.View key={i} style={[styles.thinkingDot, { opacity: anim }]} />
      ))}
    </View>
  );
}

// ── Web Result Row — one provider found by the scraper ───────────────────────
function WebResultRow({ provider, index }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 80, useNativeDriver: true }).start();
  }, []);

  const accent = "#4285F4";
  const address  = [provider.address, provider.city].filter(Boolean).join(", ");
  const link     = provider.source_url || provider.website || null;

  return (
    <Animated.View style={{ opacity: fadeAnim, marginBottom: 8 }}>
      <View style={[styles.wrCard, { borderLeftColor: accent }]}>
        <View style={styles.wrNameRow}>
          <Text style={[styles.wrNum, { color: accent }]}>#{index + 1}</Text>
          <Text style={styles.wrName} numberOfLines={2}>{provider.name}</Text>
        </View>
        {!!address && (
          <View style={styles.wrInfoRow}>
            <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.wrInfoText} numberOfLines={1}>{address}</Text>
          </View>
        )}
        {provider.distance_km != null && (
          <View style={styles.wrInfoRow}>
            <Ionicons name="navigate-outline" size={12} color={accent} />
            <Text style={[styles.wrInfoText, { color: accent }]}>{provider.distance_km} km away</Text>
          </View>
        )}
        {(provider.phone || link) ? (
          <View style={styles.wrActions}>
            {!!provider.phone && (
              <TouchableOpacity
                style={styles.wrPhoneBtn}
                onPress={() => Linking.openURL(`tel:${provider.phone.replace(/[\s\-()+]/g, "")}`)}
                activeOpacity={0.85}
              >
                <Ionicons name="call" size={11} color="#fff" />
                <Text style={styles.wrPhoneText}>{provider.phone}</Text>
              </TouchableOpacity>
            )}
            {!!link && (
              <TouchableOpacity
                style={[styles.wrLinkBtn, { borderColor: accent + "55" }]}
                onPress={() => Linking.openURL(link)}
                activeOpacity={0.8}
              >
                <Ionicons name="open-outline" size={11} color={accent} />
                <Text style={[styles.wrLinkText, { color: accent }]}>Google Maps</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ── Web Results Section — list of providers found by scraper ─────────────────
function WebResultsSection({ webResults }) {
  if (!webResults || webResults.length === 0) return null;
  return (
    <View style={styles.wrSection}>
      <View style={styles.wrSectionHeader}>
        <View style={styles.wrSectionIcon}>
          <Ionicons name="wifi-outline" size={13} color="#34D399" />
        </View>
        <Text style={styles.wrSectionTitle}>Live Results</Text>
        <View style={styles.wrCountBadge}>
          <Text style={styles.wrCountText}>{webResults.length} found</Text>
        </View>
      </View>
      {webResults.map((p, i) => (
        <WebResultRow key={i} provider={p} index={i} />
      ))}
    </View>
  );
}

// ── Agent Step Card — driven entirely by real traceStep data ──────────────────
function AgentCard({ traceStep, state, modelName }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isDone    = state === "done";
  const isActive  = state === "active";
  const isPending = state === "pending";

  const color = STEP_COLORS[traceStep.tool] || COLORS.primary;
  const desc  = STEP_DESC[traceStep.tool]   || traceStep.tool_display_name;

  useEffect(() => {
    if (!isPending) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8,   useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8,   useNativeDriver: true }),
      ]).start();
    }
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [state]);

  const cardBorder = isDone
    ? color + "55"
    : isActive
    ? color + "88"
    : COLORS.border;

  return (
    <Animated.View
      style={{
        opacity:   isPending ? 0.4 : fadeAnim,
        transform: isPending
          ? []
          : [{ translateY: slideAnim }, { scale: scaleAnim }],
      }}
    >
      <Animated.View style={{ transform: [{ scale: isActive ? pulseAnim : 1 }] }}>
        <View style={[styles.agentCard, { borderColor: cardBorder }]}>

          {/* Top glow strip when active */}
          {isActive && (
            <LinearGradient
              colors={[color + "33", "transparent"]}
              style={styles.activeGlow}
            />
          )}

          {/* ── Card Header ─────────────────────────── */}
          <View style={styles.agentHeader}>
            <View style={[
              styles.agentCircle,
              {
                backgroundColor: isDone || isActive ? color + "22" : COLORS.border + "33",
                borderColor:     isDone || isActive ? color + "55" : COLORS.border,
              },
            ]}>
              {isDone ? (
                <Ionicons name="checkmark" size={16} color={color} />
              ) : isActive ? (
                <Text style={[styles.agentNum, { color }]}>{traceStep.step}</Text>
              ) : (
                <Text style={styles.agentNumPending}>{traceStep.step}</Text>
              )}
            </View>

            <View style={styles.agentInfo}>
              <View style={styles.agentNameRow}>
                <Ionicons
                  name={traceStep.icon || "cog-outline"}
                  size={13}
                  color={isDone || isActive ? color : COLORS.textMuted}
                />
                <Text style={styles.agentName}>{traceStep.tool_display_name}</Text>
              </View>
              <Text style={styles.agentDesc}>{desc}</Text>
            </View>

            <View style={[
              styles.statusBadge,
              (isDone || isActive) && {
                backgroundColor: color + "18",
                borderColor:     color + "44",
              },
            ]}>
              <Text style={[
                styles.statusText,
                { color: isDone ? color : isActive ? color : COLORS.textMuted },
              ]}>
                {isDone ? "Done" : isActive ? "Active" : "Waiting"}
              </Text>
            </View>
          </View>

          {/* ── Active state: thinking animation ───── */}
          {isActive && <ThinkingDots />}

          {/* ── Done state: real trace data ─────────── */}
          {isDone && (
            <View style={styles.doneContent}>
              <View style={styles.toolRow}>
                {/* Real function name called by Gemini */}
                <ToolChip tool={`${traceStep.tool}()`} visible />
                {/* Real model name */}
                <GeminiCallBadge visible modelName={modelName} />
                {/* Real execution duration */}
                <DurationChip durationMs={traceStep.duration_ms} visible />
              </View>

              {/* Real result summary from backend */}
              <View style={[styles.summaryBox, { borderLeftColor: color }]}>
                <TypewriterText
                  text={traceStep.result_summary}
                  delay={0}
                  color={COLORS.textSecondary}
                />
              </View>

              {/* Error indicator */}
              {traceStep.status === "error" && (
                <View style={styles.errorChip}>
                  <Ionicons name="alert-circle-outline" size={11} color={COLORS.danger} />
                  <Text style={styles.errorChipText}>Tool returned an error — model adapted</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Pending state: skeleton ──────────────── */}
          {isPending && (
            <View style={styles.skeletonBlock}>
              <View style={[styles.skelLine, { width: "70%" }]} />
              <View style={[styles.skelLine, { width: "50%" }]} />
            </View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ── Intent Info Card ─────────────────────────────────────────────────────────
function IntentCard({ intent }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, useNativeDriver: true }).start();
  }, []);

  const rows = [
    { icon: "construct-outline", label: "Service",  value: intent.service_category?.replace(/_/g, " ") },
    { icon: "location-outline",  label: "Location", value: `${intent.area || intent.city}, ${intent.city}` },
    { icon: "calendar-outline",  label: "Date",     value: intent.date },
    intent.budget_max_pkr && {
      icon: "cash-outline",
      label: "Budget",
      value: `₨${intent.budget_max_pkr.toLocaleString()}`,
    },
  ].filter(Boolean);

  return (
    <Animated.View style={[
      styles.intentCard,
      { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] },
    ]}>
      <LinearGradient colors={["#12123A", "#0D0D2A"]} style={styles.intentGrad}>
        <View style={styles.intentHeader}>
          <Text style={styles.intentTitle}>Parsed Intent</Text>
          <View style={[
            styles.urgencyChip,
            intent.urgency === "emergency" ? styles.urgencyRed : styles.urgencyGreen,
          ]}>
            <Text style={styles.urgencyText}>
              {intent.urgency === "emergency" ? "🚨 Emergency" : `⏰ ${intent.urgency}`}
            </Text>
          </View>
        </View>
        <View style={styles.intentGrid}>
          {rows.map((r, i) => (
            <View key={i} style={styles.intentRow}>
              <View style={styles.intentIconWrap}>
                <Ionicons name={r.icon} size={14} color={COLORS.primary} />
              </View>
              <Text style={styles.intentLabel}>{r.label}</Text>
              <Text style={styles.intentValue} numberOfLines={1}>{r.value}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ── Groq Final Reasoning Card ─────────────────────────────────────────────────
function GeminiReasoningCard({ text, modelName }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, delay: 200, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[
      styles.reasoningCard,
      { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
    ]}>
      <View style={styles.reasoningHeader}>
        <View style={styles.reasoningLeft}>
          <Text style={styles.geminiDot}>✦</Text>
          <Text style={styles.reasoningTitle}>Groq Final Reasoning</Text>
        </View>
        <View style={styles.modelChip}>
          <Text style={styles.modelChipText}>{modelName || "llama-3.3-70b-versatile"}</Text>
        </View>
      </View>
      <TypewriterText
        text={text}
        delay={300}
        color={COLORS.textSecondary}
        style={{ lineHeight: 22 }}
      />
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ReasoningScreen({ route, navigation }) {
  const {
    result,
    userText,
    useSSE  = false,
    usePost = false,
    userCoords = null,
    demoMode = false,
  } = route.params;

  // All data as state so SSE events can populate them live
  const [trace,           setTrace]           = useState(result?.tool_call_trace  || []);
  const [ranked,          setRanked]          = useState(result?.ranked_providers || []);
  const [intent,          setIntent]          = useState(result?.intent           || null);
  const [modelName,       setModelName]       = useState(result?.model            || "llama-3.3-70b-versatile");
  const [geminiReasoning, setGeminiReasoning] = useState(result?.gemini_final_reasoning || "");
  const [clarification,   setClarification]   = useState(result?.clarification    || null);
  const [totalDurationMs, setTotalDurationMs] = useState(result?.total_duration_ms || 0);
  const [iterations,      setIterations]      = useState(result?.iterations        || 0);
  const [webResults,      setWebResults]      = useState(result?.web_results     || []);

  const [agentStates, setAgentStates] = useState(
    (result?.tool_call_trace || []).map(() => "pending")
  );
  const [showCTA,    setShowCTA]    = useState(false);
  const [sseError,   setSseError]   = useState(null);

  // ── Map state ────────────────────────────────────────────────────────────
  const [mapProviders,   setMapProviders]   = useState([]);
  const [isMapSearching, setIsMapSearching] = useState(true);

  const ctaAnim    = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(1)).current; // start visible
  const scrollRef  = useRef(null);

  // Only show tools in VISIBLE_TOOLS set; keep index into agentStates for state lookup
  const visibleTraceWithStates = trace
    .map((traceStep, i) => ({ traceStep, state: agentStates[i] || "pending" }))
    .filter(({ traceStep }) => VISIBLE_TOOLS.has(traceStep.tool));

  const totalSteps = visibleTraceWithStates.length || 1;

  // ── Helper: replay agent animation from a trace array ───────────────────
  const replayTrace = (initialTrace, cancelRef) => {
    if (initialTrace.length === 0) {
      setShowCTA(true);
      Animated.spring(ctaAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      return;
    }
    initialTrace.forEach((_, i) => {
      setTimeout(() => {
        if (cancelRef?.current) return;
        setAgentStates((prev) => { const n = [...prev]; n[i] = "active"; return n; });
      }, i * 1100);
      setTimeout(() => {
        if (cancelRef?.current) return;
        setAgentStates((prev) => { const n = [...prev]; n[i] = "done"; return n; });
        if (i === initialTrace.length - 1) {
          setTimeout(() => {
            if (cancelRef?.current) return;
            setShowCTA(true);
            Animated.spring(ctaAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
          }, 600);
        }
      }, i * 1100 + 800);
    });
  };

  // ── usePost / demoMode: make the API call here so the map shows immediately ─
  useEffect(() => {
    if (!usePost && !demoMode) return;

    // Mutable ref so setTimeout callbacks see the latest cancelled state
    const dead = { current: false };

    const fetchData = async () => {
      try {
        const res = await withTimeout(
          API.analyze(userText, userCoords?.lat, userCoords?.lng),
          ANALYZE_TIMEOUT_MS
        );
        if (dead.current) return;

        const tr = res?.tool_call_trace || [];
        setTrace(tr);
        setAgentStates(tr.map(() => "pending"));
        setRanked(res?.ranked_providers         || []);
        setIntent(res?.intent                   || null);
        setModelName(res?.model                 || "llama-3.3-70b-versatile");
        setGeminiReasoning(res?.gemini_final_reasoning || "");
        setTotalDurationMs(res?.total_duration_ms      || 0);
        setIterations(res?.iterations           || 0);
        setWebResults(res?.web_results          || []);

        // Feed providers into the map — pins spring-bounce in
        setMapProviders([...(res?.web_results || []), ...(res?.ranked_providers || [])]);
        setIsMapSearching(false);

        replayTrace(tr, dead);
      } catch (e) {
        if (dead.current) return;
        setSseError(
          e.message === "TIMEOUT"
            ? "Request timed out. Make sure the backend is running on port 8001."
            : "Connection error: " + e.message
        );
        setIsMapSearching(false);
        setShowCTA(true);
        Animated.spring(ctaAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      }
    };

    fetchData();
    return () => { dead.current = true; };
  }, []);

  // ── Direct result mode (result passed as param — legacy / compat) ─────────
  useEffect(() => {
    if (useSSE || usePost || demoMode) return;

    Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const initialTrace = result?.tool_call_trace || [];
    setMapProviders([...(result?.web_results || []), ...(result?.ranked_providers || [])]);
    // Let radar show briefly before stopping
    setTimeout(() => setIsMapSearching(false), 1400);

    replayTrace(initialTrace, null);
  }, []);

  // ── SSE mode: EventSource live events ────────────────────────────────────
  useEffect(() => {
    if (!useSSE || typeof EventSource === "undefined") return;

    Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    // Build SSE URL
    const params = new URLSearchParams({ q: userText });
    if (userCoords?.lat != null) params.set("user_lat", userCoords.lat);
    if (userCoords?.lng != null) params.set("user_lng", userCoords.lng);

    // BASE_URL for web is always localhost:8001
    const sseUrl = `http://localhost:8001/api/analyze/stream?${params.toString()}`;
    const es = new EventSource(sseUrl);

    es.addEventListener("agent_start", (e) => {
      const data = JSON.parse(e.data);
      // Add a placeholder trace step with "active" state
      setTrace((prev) => [
        ...prev,
        {
          step:             data.step,
          tool:             data.tool,
          tool_display_name: data.tool_display_name,
          icon:             data.icon || "cog-outline",
          args:             data.args || {},
          result_summary:   "",
          status:           "running",
          duration_ms:      0,
        },
      ]);
      setAgentStates((prev) => [...prev, "active"]);
    });

    es.addEventListener("agent_done", (e) => {
      const data = JSON.parse(e.data);
      setTrace((prev) =>
        prev.map((s) =>
          s.step === data.step
            ? { ...s, result_summary: data.summary, status: data.status, duration_ms: data.duration_ms }
            : s
        )
      );
      setAgentStates((prev) => {
        const next = [...prev];
        next[data.step - 1] = "done";
        return next;
      });
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      setRanked(data.ranked_providers || []);
      setIntent(data.intent           || null);
      setGeminiReasoning(data.gemini_final_reasoning || "");
      setModelName(data.model         || "llama-3.3-70b-versatile");
      setTotalDurationMs(data.total_duration_ms || 0);
      setIterations(data.iterations   || 0);
      setTrace(data.tool_call_trace   || []);
      setWebResults(data.web_results  || []);
      // Feed map providers — markers spring in
      setMapProviders([...(data.web_results || []), ...(data.ranked_providers || [])]);
      setIsMapSearching(false);
      setShowCTA(true);
      Animated.spring(ctaAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      es.close();
    });

    es.addEventListener("clarification", (e) => {
      const data = JSON.parse(e.data);
      setClarification(data.clarification || null);
      setTrace(data.tool_call_trace || []);
      setShowCTA(true);
      Animated.spring(ctaAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      es.close();
    });

    es.addEventListener("error", (e) => {
      es.close();
      // e.data is set for server-sent "event: error" events; absent for connection failures
      let msg = "Connection to backend failed. Make sure it is running on port 8001.";
      if (e.data) {
        try {
          const parsed = JSON.parse(e.data);
          msg = parsed.message || msg;
        } catch (_) {}
      }
      setSseError(msg);
      setShowCTA(true);
      Animated.spring(ctaAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    });

    return () => es.close();
  }, [useSSE]);

  const doneCount = visibleTraceWithStates.filter(({ state }) => state === "done").length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Animated map — radar while searching, pins when providers arrive ── */}
      <Animated.View
        style={[
          styles.mapSection,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }],
          },
        ]}
      >
        <MapSearchOverlay
          userCoords={userCoords}
          providers={mapProviders}
          isSearching={isMapSearching}
        />
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────── */}
        <Animated.View style={[
          styles.screenHeader,
          { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] },
        ]}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.screenTitle}>AI Agents Working</Text>
              <Text style={styles.screenSubtitle}>
                Groq orchestrating · searching live providers
              </Text>
            </View>
            <View style={styles.geminiMark}>
              <Text style={styles.geminiMarkText}>✦</Text>
            </View>
          </View>

          <ProgressBar progress={doneCount} totalAgents={totalSteps} />

          <View style={styles.queryBubble}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.queryText} numberOfLines={2}>"{userText}"</Text>
          </View>
        </Animated.View>

        {/* ── Live Scraper Agent Card (only visible tool) ──── */}
        <View style={styles.agentsSection}>
          {visibleTraceWithStates.length > 0
            ? visibleTraceWithStates.map(({ traceStep, state }) => (
                <AgentCard
                  key={traceStep.step}
                  traceStep={traceStep}
                  state={state}
                  modelName={modelName}
                />
              ))
            : /* Fallback: scraper not started yet */
              [1].map((n) => (
                <View key={n} style={[styles.agentCard, { borderColor: COLORS.border, opacity: 0.35 }]}>
                  <View style={styles.skeletonBlock}>
                    <View style={[styles.skelLine, { width: "60%" }]} />
                    <View style={[styles.skelLine, { width: "40%" }]} />
                  </View>
                </View>
              ))
          }
        </View>

        {/* ── Each scraped provider as its own row ───── */}
        {webResults.length > 0 && <WebResultsSection webResults={webResults} />}

        {/* ── CTA — after all agents done ───────────── */}
        {showCTA && (
          <Animated.View style={[
            styles.ctaWrap,
            { opacity: ctaAnim, transform: [{ translateY: ctaAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] },
          ]}>
            {clarification ? (
              /* Clarification needed */
              <View style={styles.clarificationCard}>
                <View style={styles.clarificationHeader}>
                  <Ionicons name="help-circle-outline" size={20} color={COLORS.warning} />
                  <Text style={styles.clarificationTitle}>AI needs clarification</Text>
                </View>
                <Text style={styles.clarificationQuestion}>{clarification.question}</Text>
                {(clarification.options || []).map((opt, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.clarificationOption}
                    onPress={() => navigation.navigate("Search", { prefill: opt })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.clarificationOptionText}>{opt}</Text>
                    <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : ranked.length > 0 || webResults.length > 0 ? (
              <>
                {/* Groq final reasoning — real model output */}
                {geminiReasoning ? (
                  <GeminiReasoningCard text={geminiReasoning} modelName={modelName} />
                ) : null}

                <LinearGradient
                  colors={ranked.length > 0 ? ["#0D1A0D", "#071207"] : ["#0D0D1A", "#070710"]}
                  style={styles.successCard}
                >
                  <View style={styles.successRow}>
                    <Ionicons
                      name={ranked.length > 0 ? "checkmark-circle" : "globe-outline"}
                      size={22}
                      color={ranked.length > 0 ? COLORS.success : COLORS.info}
                    />
                    <View>
                      <Text style={[styles.successTitle, ranked.length === 0 && { color: COLORS.info }]}>
                        {ranked.length > 0 ? "All agents complete" : "Web results found"}
                      </Text>
                      <Text style={styles.successSub}>
                        {ranked.length > 0
                          ? `Found ${ranked.length} matching provider${ranked.length !== 1 ? "s" : ""} · ${totalDurationMs ? `${(totalDurationMs / 1000).toFixed(1)}s total` : ""}`
                          : `${webResults.length} online source${webResults.length !== 1 ? "s" : ""} found via web search`}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>

                <TouchableOpacity
                  onPress={() => navigation.navigate("Results", {
                    ranked,
                    intent,
                    geminiReasoning,
                    modelName,
                    webResults,
                  })}
                  activeOpacity={0.9}
                  style={styles.viewResultsBtn}
                >
                  <LinearGradient
                    colors={ranked.length > 0 ? ["#6C63FF", "#8B5CF6"] : ["#0EA5E9", "#38BDF8"]}
                    style={styles.viewResultsGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name={ranked.length > 0 ? "trophy-outline" : "globe-outline"} size={20} color="#fff" />
                    <Text style={styles.viewResultsText}>
                      {ranked.length > 0
                        ? `View ${ranked.length} Match${ranked.length !== 1 ? "es" : ""}`
                        : `View ${webResults.length} Web Result${webResults.length !== 1 ? "s" : ""}`}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : sseError ? (
              <View style={styles.noResults}>
                <Ionicons name="cloud-offline-outline" size={40} color={COLORS.danger} />
                <Text style={styles.noResultsTitle}>Stream Error</Text>
                <Text style={styles.noResultsText}>{sseError}</Text>
                <TouchableOpacity
                  style={[styles.retryBtn, { borderColor: COLORS.danger + "55" }]}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={[styles.retryText, { color: COLORS.danger }]}>Go Back & Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.noResults}>
                <Ionicons name="search-outline" size={40} color={COLORS.textMuted} />
                <Text style={styles.noResultsTitle}>No providers found</Text>
                <Text style={styles.noResultsText}>
                  Try a different area or remove the budget limit.
                </Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
                  <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── Technical footer ──────────────────────── */}
        <View style={styles.techFooter}>
          <Ionicons name="code-slash-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.techFooterText}>
            {modelName} · FastAPI · {trace.length} tool calls · {webResults.length} results
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.bg },
  container:  { padding: 20, paddingBottom: 48 },
  mapSection: {
    height: MAP_HEIGHT,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 18,
    overflow: "hidden",
    // Soft shadow to lift map off the dark bg
    shadowColor: "#6C63FF",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  // Header
  screenHeader: { marginBottom: 20 },
  headerTop:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  headerLeft:   {},
  screenTitle:    { fontSize: 22, ...FONTS.extraBold, color: COLORS.text, marginBottom: 3 },
  screenSubtitle: { fontSize: 12, color: COLORS.textSecondary },
  geminiMark: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.primaryGlow,
    borderWidth: 1, borderColor: COLORS.primary + "55",
    alignItems: "center", justifyContent: "center",
  },
  geminiMarkText: { fontSize: 16, color: COLORS.primary, ...FONTS.bold },

  // Progress
  progressWrap: { marginBottom: 14 },
  progressBg: {
    height: 4, backgroundColor: COLORS.border,
    borderRadius: 2, overflow: "hidden", marginBottom: 6,
  },
  progressFill: {
    height: 4, backgroundColor: COLORS.primary, borderRadius: 2,
    shadowColor: COLORS.primary, shadowOpacity: 0.8, shadowRadius: 4,
  },
  progressText: { fontSize: 11, color: COLORS.textMuted, ...FONTS.medium },

  // Query bubble
  queryBubble: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  queryText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, fontStyle: "italic", lineHeight: 18 },

  // Intent card
  intentCard: {
    marginBottom: 16, borderRadius: RADIUS.xl, overflow: "hidden",
    borderWidth: 1, borderColor: COLORS.primary + "33",
  },
  intentGrad: { padding: 16 },
  intentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  intentTitle: { fontSize: 11, ...FONTS.bold, color: COLORS.primary, textTransform: "uppercase", letterSpacing: 0.8 },
  urgencyChip:  { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  urgencyRed:   { backgroundColor: COLORS.dangerGlow,   borderColor: COLORS.danger  + "44" },
  urgencyGreen: { backgroundColor: COLORS.successGlow,  borderColor: COLORS.success + "44" },
  urgencyText:  { fontSize: 11, ...FONTS.semiBold, color: COLORS.text },
  intentGrid:   { gap: 8 },
  intentRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  intentIconWrap: {
    width: 24, height: 24, borderRadius: 8,
    backgroundColor: COLORS.primaryGlow, alignItems: "center", justifyContent: "center",
  },
  intentLabel: { fontSize: 11, color: COLORS.textMuted, width: 58 },
  intentValue: { fontSize: 13, ...FONTS.semiBold, color: COLORS.text, flex: 1 },

  // Agents section
  agentsSection: { gap: 10, marginBottom: 16 },

  // Agent card
  agentCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 14, borderWidth: 1, overflow: "hidden", position: "relative",
  },
  activeGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 48 },

  agentHeader:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  agentCircle:  {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  agentNum:        { fontSize: 14, ...FONTS.bold },
  agentNumPending: { fontSize: 14, ...FONTS.bold, color: COLORS.textMuted },
  agentInfo:       { flex: 1 },
  agentNameRow:    { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  agentName:       { fontSize: 14, ...FONTS.semiBold, color: COLORS.text },
  agentDesc:       { fontSize: 11, color: COLORS.textMuted, lineHeight: 15 },
  statusBadge: {
    borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: "transparent",
  },
  statusText: { fontSize: 11, ...FONTS.semiBold },

  // Thinking
  thinkingRow:  { flexDirection: "row", alignItems: "center", gap: 5, paddingTop: 2 },
  thinkingLabel: { fontSize: 12, color: COLORS.textMuted, fontStyle: "italic" },
  thinkingDot:   { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary },

  // Done content
  doneContent: { gap: 10 },
  toolRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },

  toolChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  toolChipText: { fontSize: 11, color: COLORS.textCode, ...FONTS.mono },
  toolChipDone: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.successGlow, alignItems: "center", justifyContent: "center",
  },

  geminiBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.primaryGlow, borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.primary + "33",
  },
  geminiDot:      { fontSize: 10, color: COLORS.primary },
  geminiBadgeText: { fontSize: 10, color: COLORS.primary, ...FONTS.mono },
  geminiCheck:    {},

  durationChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    paddingHorizontal: 7, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  durationText: { fontSize: 10, color: COLORS.textMuted, ...FONTS.mono },

  summaryBox:  { borderLeftWidth: 2, paddingLeft: 10, paddingVertical: 2 },

  errorChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.dangerGlow, borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.danger + "33",
  },
  errorChipText: { fontSize: 10, color: COLORS.danger },

  // Skeleton
  skeletonBlock: { gap: 6 },
  skelLine:      { height: 8, backgroundColor: COLORS.border, borderRadius: 4 },

  // Gemini reasoning card
  reasoningCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.xl,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.primary + "33",
    ...SHADOWS.md,
  },
  reasoningHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  reasoningLeft:   { flexDirection: "row", alignItems: "center", gap: 6 },
  reasoningTitle:  { fontSize: 11, ...FONTS.bold, color: COLORS.primary, textTransform: "uppercase", letterSpacing: 0.8 },
  modelChip: {
    backgroundColor: COLORS.primaryGlow, borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.primary + "44",
  },
  modelChipText: { fontSize: 9, color: COLORS.primary, ...FONTS.semiBold },

  // CTA
  ctaWrap:     { gap: 12, marginBottom: 8 },
  successCard: { borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.success + "44" },
  successRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  successTitle: { fontSize: 14, ...FONTS.semiBold, color: COLORS.success, marginBottom: 2 },
  successSub:   { fontSize: 12, color: COLORS.textSecondary },

  viewResultsBtn:  { borderRadius: RADIUS.lg, overflow: "hidden", ...SHADOWS.glow },
  viewResultsGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 16, gap: 10, borderRadius: RADIUS.lg,
  },
  viewResultsText: { fontSize: 16, ...FONTS.semiBold, color: "#fff", flex: 1, textAlign: "center" },

  // Clarification
  clarificationCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.xl,
    padding: 20, borderWidth: 1, borderColor: COLORS.warning + "44", gap: 12,
  },
  clarificationHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  clarificationTitle:  { fontSize: 14, ...FONTS.semiBold, color: COLORS.warning },
  clarificationQuestion: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  clarificationOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  clarificationOptionText: { fontSize: 14, color: COLORS.text, ...FONTS.medium },

  // No results
  noResults: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 28,
    alignItems: "center", borderWidth: 1, borderColor: COLORS.dangerGlow, gap: 8,
  },
  noResultsTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  noResultsText:  { fontSize: 13, color: COLORS.textSecondary, textAlign: "center" },
  retryBtn: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.border, marginTop: 4,
  },
  retryText: { color: COLORS.text, ...FONTS.semiBold },

  // Web result rows
  wrSection: { marginBottom: 16 },
  wrSectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
  },
  wrSectionIcon: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: "#34D39918", borderWidth: 1, borderColor: "#34D39944",
    alignItems: "center", justifyContent: "center",
  },
  wrSectionTitle: { fontSize: 12, ...FONTS.bold, color: COLORS.text, flex: 1 },
  wrCountBadge: {
    backgroundColor: "#34D39918", borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "#34D39944",
  },
  wrCountText: { fontSize: 10, ...FONTS.semiBold, color: "#34D399" },

  wrCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 12, borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 3,
  },
  wrNameRow:  { flexDirection: "row", alignItems: "flex-start", gap: 7, marginBottom: 8 },
  wrNum:      { fontSize: 12, ...FONTS.extraBold, minWidth: 24 },
  wrName:     { flex: 1, fontSize: 13, ...FONTS.semiBold, color: COLORS.text, lineHeight: 19 },
  wrInfoRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
  wrInfoText: { flex: 1, fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },
  wrActions:  { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  wrPhoneBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.success, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 1 },
  wrPhoneText:{ color: "#fff", fontSize: 11, ...FONTS.semiBold, flexShrink: 1 },
  wrLinkBtn:  { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, backgroundColor: "transparent" },
  wrLinkText: { fontSize: 11, ...FONTS.semiBold },

  // Footer
  techFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 8, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  techFooterText: { fontSize: 11, color: COLORS.textMuted, ...FONTS.medium },
});
