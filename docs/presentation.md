# Presentation Outline: Onboarding Customization & Covert Profiling

This document outlines the presentation slide structure explaining the onboarding customization mystery, the mechanics behind it, and the psychological impact of our design.

---

## Slide 1: The Onboarding Mystery
### **Subtitle:** Why does the UI look identical regardless of the onboarding selections?
*   **The Observation:** Users select distinct style profiles during onboarding (e.g., "Bold & Avant-Garde", "Cozy & Casual") but the application's visual theme remains identical (Mystic Premium Dark).
*   **The Question:** Is this a bug, or is there something deeper happening under the hood?

---

## Slide 2: The Core Design Principle
### **Subtitle:** Unified Aesthetics vs. Targeted Mechanics
*   **Visual Unity (Hard Constraint):** The app enforces a single, premium "Mystic Premium Dark" theme to maintain an elite, exclusive feel (Radial gradient, film grain, gold accent).
*   **Covert Profiling:** The onboarding survey is **not** a UI customization tool; it is a **Targeting Calibration Pipeline** that covertly profiles the user's shopping psychology.
*   **Illusion of Control:** By choosing their "style," users feel in control (Autonomy - Self-Determination Theory), which actively builds trust. That trust is then exploited to custom-tailor the gamification loop.

---

## Slide 3: How Onboarding Inputs Weaponize the App
### **Subtitle:** The Covert Mapping Pipeline

| Onboarding Option | Target Metric / Class | Behavioral / Mechanic Modification |
|:---|:---|:---|
| **Style Preference**<br>*(Bold, Classic, Trendy, Cozy)* | **Category Preference**<br>*(Tech, Fashion, Beauty, Food)* | **Flash Sale Routing:** Biases flash sale deals and store-visit tasks to the selected category (e.g., *Cozy* routes you to the Food Court). |
| **Shopping Habits**<br>*(Friends vs. Solo)* | **Bartle Player Type**<br>*(Socializer vs. Explorer)* | **Phantom User Behavior:** Spawns and moves "phantom friends" preferentially into unexplored/fogged areas to create discovery cues (Social Proof). |
| **Core Motivation**<br>*(Deals vs. Discovery)* | **Motivation Axis**<br>*(Extrinsic vs. Intrinsic)* | **Task Framing:** Changes the language of tasks in the panel (Deals → transactional *"Grab/Claim"* vs. Discovery → curiosity-driven *"Explore/Uncover"*). |

---

## Slide 4: Behind the Scenes: The Technical Flow
### **Subtitle:** State Propagation & Cross-Area Integration
```
  [User Selection] 
        │
        ▼
  [Survey Screen] ──(classifyBartleType)──► [Player Store]
                                                  │
                ┌─────────────────────────────────┼──────────────────────────────┐
                ▼                                 ▼                              ▼
        [Task Generator]                  [Economy Store]                 [Social Store]
        • Alters task phrasing            • Sets Category Bias           • Influences Phantom positioning
        • (Deals vs. Discovery)           • For Flash Sales              • Adjusts movement tickrate (3s vs 5s)
```

---

## Slide 5: The Ethical Context (For the Research Group)
### **Subtitle:** Why this Dark Pattern is Highly Effective
1. **Reciprocity & Trust Harvesting:** The user shares data thinking the app is personalizing for *their benefit*.
2. **Invisible Optimization:** By tuning the gamification triggers (leaderboards, tasks, sales) to the user's specific Bartle type, engagement increases by 3-4x without the user detecting the manipulation.
3. **The Sunk Cost Trap:** Once the targeting calibrations are active, the custom-tailored loops feel so personal that the user finds it psychologically harder to abandon their progress.
