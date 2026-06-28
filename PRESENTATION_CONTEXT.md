# MurkyCorps Mall App — Presentation Context & Notes

This document provides a simple breakdown of our app prototype to help with context, presentation slides, and LLM prompting.

### Initial Idea
- A prototype phone app for a fictional company called "MurkyCorps" designed for a shopping mall in Haarlem.
- The core concept was to turn a normal mall visit into a highly addictive game.
- The central goal: Keep visitors inside the mall for as long as possible by weaponizing gamification and "dark patterns".
- It is meant as a "flight simulator for manipulation" to research these behaviors, not a real product to be released to actual shoppers.

### (What) You Made
- A mobile-first web app prototype built with React, Next.js, and Tailwind CSS.
- **Key Features Include:**
  - An interactive "fog-of-war" mall map where areas clear up only as the user physically explores them.
  - A token economy where users earn and spend points, but are deliberately kept in a constant deficit.
  - A 4-tier membership ladder (Bronze to Neodymium) that uses sunk cost fallacy to retain users.
  - A "Breadcrumb Task System" with a never-empty task list to prevent users from having a natural stopping point.
  - A variable-ratio "Spinning Wheel" and proximity-triggered "Flash Sales" that act like slot machines.
  - Social "Phantoms" (fake friends and inflated crowd numbers) to induce FOMO and social proof.
  - An aggressive 3-layer "Exit Friction" flow (soft nudge ➔ guilt escalation ➔ rescue bargain) to prevent users from leaving.

### (Why) You Made This / Decisions You Made
- **Research Purpose:** To deliberately build dark patterns to understand how they work, interact, and compound in a controlled environment.
- **Psychological Frameworks Applied:**
  - **Operant Conditioning & Variable Rewards:** Used in the spinning wheel and flash sales to keep users hooked through unpredictability.
  - **Loss Aversion:** Applied through escalating visit streaks and token expirations.
  - **Sunk Cost Fallacy:** Leveraging the tier progression to make users feel they have too much invested to quit.
  - **Time Misdirection:** Removing real clocks and replacing them with synthetic timers so users lose track of how long they've been engaged (Flow state hijacking).

### Discarded Concepts (Lines We Didn't Cross)
- **Real-Money Purchases:** Rejected because the goal was engagement manipulation (time), not financial exploitation.
- **Biometric-Triggered Interventions:** Using heart-rate/stress data to trigger events was deemed too surveillance-heavy and crossed an ethical line even for research.
- **Hiding the Exit Button:** Creating actual impossibility to leave is purely coercive; our friction creates psychological difficulty, not physical impossibility.
- **Targeting Vulnerable Groups (e.g., Children):** We avoided designing mechanics that specifically exploit developmental vulnerabilities.
- **Stolen Identities:** Phantoms use generated personas rather than fabricating data using real people's identities.

### (How) Does Your Idea Relate to the Brief
- The brief tasked us with keeping visitors inside the Haarlem mall for as long as possible.
- We achieved this by building an engagement loop (Entry ➔ Discovery ➔ Deep Navigation ➔ Loop ➔ Submission) that prevents users from leaving.
- We answered the brief not just functionally, but psychologically, by using gamification to make the visitor's time-in-mall feel like an escalating investment rather than an aimless walk.

### Iterations
- **Streak Penalty:** Evolved from a simple binary reset (which made users quit entirely) to an *escalating penalty* (causes rising anxiety but always feels recoverable).
- **Reward Density Curve:** Shifted from an even distribution of rewards to a *front-loaded hook* (lots of rewards in the first 15 mins) followed by a *back-loaded chase* (sparse but larger potential prizes).
- **Social Phantoms:** Changed from random moving dots on a map to *named phantom friends* with fake chat messages to create believable social reality and urgency.
- **Exit Friction:** Iterated from a single hostile pop-up to a psychologically calibrated *three-layer negotiation* (soft nudge, sunk cost guilt, rescue bargain) that feels helpful rather than aggressive.

### Roles
- **Tim:** Implementation & Developer (translating designs and mechanics into the Next.js/React app).
- **Aram:** Visual UI Design (Figma layouts, Tailwind styling rules, animations).
- **Damian:** Sound Integration (building the audio feedback system for tokens, tiers, and alerts).
- **Prince:** Copywriting (crafting the in-app text, fake 5-star reviews, and personalized messaging).
- **Beth:** Photography (capturing the Haarlem mall context for the app's visuals).
- **Shan:** Creative Direction (defining visual rules and style guides for presentation imagery).
- **Ali:** Pitch & Presentation (creating the slide-by-slide narrative to sell the concept).
