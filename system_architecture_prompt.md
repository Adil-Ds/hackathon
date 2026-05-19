# ServiceAI — System Architecture & Frontend Design Prompt

You are Claude Design, tasked with building the **best possible frontend** for **ServiceAI**, an Agentic Service Provider Matching & Booking System. This document outlines the system architecture, API endpoints, data models, and the required design language to help you build a premium, agent-native frontend.

---

## 1. Project Overview
**ServiceAI** is a mobile-first AI system. A user describes what service they need in plain language (e.g., in Urdu/Roman Urdu: *"mujhe kal Gulshan mein plumber chahiye, 2000 se zyada nahi"*), and an agentic AI pipeline orchestrates the entire process: parsing intent, searching providers, ranking them with transparent reasoning, booking the service, and scheduling follow-ups.

**Target Market:** Pakistani local services (currency: PKR, cities: Karachi, Lahore, etc.).

---

## 2. Tech Stack Requirements
- **Framework:** React Native with Expo (SDK 51+)
- **Styling:** NativeWind v4 (Tailwind CSS syntax for React Native)
- **Routing:** React Navigation v6 (Stack Navigator + Custom Tab Bar)
- **Icons:** Ionicons
- **Backend Communication:** Standard HTTP REST API fetching from a FastAPI backend.

---

## 3. Design Aesthetics & Vibe
The app must feel **premium, intelligent, and highly dynamic**. It shouldn't look like a standard CRUD app; it should feel like you are interacting with a sophisticated AI.

- **Colors:** Rich palettes, distinct success colors (e.g., `#10D9A0`), gradients, and glow effects.
- **Micro-animations:** Spring-animated touchable buttons (`PressButton`), animated focus border glows on inputs, pulsing dots.
- **Agentic UX:** Real-time visibility into the AI's "thought process".
  - Use `TypewriterText` for text generation effects.
  - Implement `ThinkingDots` when waiting.
  - Show `ToolChip` components displaying actual function names being called (e.g., `parse_intent()`).
  - Use `SkeletonCard` shimmer loaders during data fetches.
- **Layout:** Collapsible cards, animated score bars, bento box layouts for stats, horizontally scrolling chips.

---

## 4. Key Screens to Implement

1. **Auth/Welcome Shell**
   - **SplashScreen:** Ambient rings expanding, gradient logo mark ✦, pulsing dots.
   - **LoginScreen:** Premium inputs with animated focus border glow.
2. **Main Navigation**
   - Custom TabBar with spring-scale animated TabIcons and active dot indicators.
3. **HomeScreen (Search)**
   - AI-native glowing textarea for the user's prompt.
   - Language toggle pills (اردو / EN).
4. **ReasoningScreen (The Agent Engine)**
   - Live agent state machine showing steps (pending → active → done).
   - Real-time display of tool calls, progress bars, and "Gemini API" chips.
5. **ResultsScreen**
   - Collapsible provider cards ranked 1, 2, 3.
   - The #1 card should have a gold shimmer.
   - Animated score bars showing the breakdown of why they matched (Distance, Rating, Price).
   - "AI Reasoning" box explaining the rank in plain English.
6. **Booking & Confirmation Flow**
   - **BookingScreen:** 2x2 slot grid for selecting time, premium provider summary.
   - **ConfirmationScreen:** Spring-animated success circle, detailed booking receipt, and follow-up cards.
7. **Provider & User Profiles**
   - **ProviderDashboard:** Earnings card with a glow orb effect, booking requests list.
   - **ProfileScreen:** Avatar initials, system stats/hackathon info, settings.

---

## 5. API Endpoints

The frontend will communicate with the following FastAPI endpoints (`/api/*`):

| Endpoint | Method | Input (Body) | Output (Response) | Purpose |
|----------|--------|--------------|-------------------|---------|
| `/analyze` | POST | `{ text: string, user_lat?: float, user_lng?: float }` | `AgentRunResult` | The core agentic loop. Orchestrates parsing, searching, and ranking. Returns the full trace of tool calls and final ranked providers. |
| `/parse-intent` | POST | `ServiceRequest` | `ParsedIntent` | Agent 1: Extracts structured data from user text. |
| `/search-providers`| POST | `ParsedIntent` | `SearchResult` | Agent 2: Filters the local DB/Mock data based on intent. |
| `/rank-providers` | POST | `{ intent, providers }` | `List[RankedProvider]` | Agent 3: Ranks filtered providers and generates AI reasoning. |
| `/book` | POST | `{ booking: BookingRequest, phone: string }` | `BookingConfirmation` | Agent 4: Simulates booking the provider. |
| `/schedule-followups`| POST | `BookingConfirmation` | `FollowUpSchedule` | Agent 5: Generates follow-up messages based on the booking. |
| `/providers` | GET | None | `List[Provider]` | Fetch all available mock providers. |
| `/bookings` | GET | None | `List[BookingConfirmation]` | Fetch user bookings. |
| `/provider/bookings/{id}`| GET | None | `List[BookingConfirmation]` | Fetch bookings for a specific provider. |
| `/booked-slots/{id}/{date}`| GET | None | `List[string]` | Fetch booked time slots for a provider. |

---

## 6. Data Models (Types / Schemas)

You must map your frontend state and API calls to these JSON structures:

```typescript
interface ServiceRequest {
    text: string;
    user_lat?: number;
    user_lng?: number;
}

interface ParsedIntent {
    service_category: string;
    location: string;
    city: string;
    area: string;
    date: string;
    budget_max_pkr?: number;
    urgency: string; // e.g., "scheduled"
    special_requirements?: string;
    raw_input: string;
}

interface Provider {
    id: string;
    name: string;
    category: string;
    city: string;
    area: string;
    lat: number;
    lng: number;
    rating: number;
    review_count: number;
    price_min: number;
    price_max: number;
    available_days: string[];
    phone: string;
    experience_years: number;
    verified: boolean;
}

interface RankedProvider {
    provider: Provider;
    score: number;
    distance_km: number;
    score_breakdown: Record<string, number>;
    reason: string;
    rank: number;
}

interface BookingRequest {
    provider_id: string;
    provider_name: string;
    service_category: string;
    user_name: string;
    location_address: string;
    date: string;
    time_slot: string;
    price_agreed: number;
}

interface BookingConfirmation {
    booking_id: string;
    provider_id: string;
    provider_name: string;
    service: string;
    user_name: string;
    location_address: string;
    date: string;
    time_slot: string;
    price_agreed: number;
    status: string; // "CONFIRMED", "PENDING", "CANCELLED"
    phone: string;
    created_at: string;
}

interface ToolCallStep {
    step: number;
    tool: string;
    tool_display_name: string;
    args: Record<string, any>;
    result_summary: string;
    status: string; // "success" | "error"
    duration_ms: number;
    icon: string;
}

interface AgentRunResult {
    intent?: Record<string, any>;
    ranked_providers: Record<string, any>[];
    providers_found: number;
    tool_call_trace: ToolCallStep[];
    gemini_final_reasoning: string;
    total_duration_ms: number;
    iterations: number;
    model: string;
}
```

---

## 7. Directives for Claude Design

1. **Build for the "Agentic UI" Paradigm:** Your components must accommodate unpredictable wait times with beautiful loading states. Expose the "brain" to the user using the `ToolCallStep` trace in `AgentRunResult`.
2. **Component Reusability:** Create a robust set of UI primitives (e.g., `Badge`, `PressButton`, `Skeleton`, `Card`).
3. **No Placeholders:** Ensure the UI looks populated and gorgeous, using mock data intelligently when rendering previews.
4. **Wow Factor:** Ensure the first impression is spectacular. Incorporate the requested glowing borders, spring animations, and smooth layout transitions to fulfill the high-quality frontend requirements for the hackathon.
