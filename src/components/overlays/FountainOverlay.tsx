"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion, useAnimationControls } from "framer-motion";
import { Sparkle, Coins, X } from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import {
  useFountainStore,
  type WishOutcome,
} from "@/stores/fountainStore";
import { playSound, SOUNDS, playAchievement } from "@/lib/sound";

/**
 * FountainOverlay — the sentient Wishing Fountain cinematic.
 *
 * Tapping the fountain on the map opens this full-screen cinematic overlay.
 * The fountain "comes alive": water geysers erupt, a glowing aura builds, two
 * cartoon eyes and a mouth fade on, and the fountain delivers an absurd
 * corporate-spiritual welcome speech ("Welcome to MurkyMall, where your
 * biggest wishes will become reality"). At the climax it grants a free wish
 * — a near-miss-biased random reward — then dismisses.
 *
 * First meeting plays the full welcome; repeat visits (after a 30s cooldown)
 * play a shorter "the fountain remembers you" beat and grant another wish.
 * The fountain is an engagement hook that pulls the player back to the atrium,
 * not a token sink.
 */

const SMOOTH = [0.32, 0.72, 0, 1] as const;
const POP = [0.34, 1.56, 0.64, 1] as const;

/** Random mouth-open heights (px) the mascot cycles through while talking. */
const MOUTH_HEIGHTS = [9, 12, 16, 11, 15] as const;
/** Mouth closed height (px) — used between words and between lines. */
const MOUTH_CLOSED = 6;

/* ============================================================================
   Speech scripts
   ========================================================================== */

type Beat =
  | { type: "line"; text: string }
  | { type: "grant" }
  | { type: "done" };

const FIRST_MEETING_SCRIPT: Beat[] = [
  { type: "line", text: "WELCOME... valued visitor." },
  { type: "line", text: "I am the MurkyMall Wishing Fountain." },
  { type: "line", text: "For centuries, shoppers have gazed into my waters..." },
  { type: "line", text: "...and whispered their deepest, most purchase-related desires." },
  { type: "line", text: "Here, in this sacred atrium, your biggest wishes become reality.*" },
  { type: "line", text: "*Wishes subject to terms, conditions, and a modest processing fee." },
  { type: "line", text: "Your first wish... is on the house." },
  { type: "grant" },
  { type: "line", text: "MAY YOUR WALLET NEVER KNOW PEACE." },
  { type: "line", text: "Welcome to MurkyMall." },
  { type: "done" },
];

const RETURN_SCRIPT: Beat[] = [
  { type: "line", text: "Ah... you return to my waters." },
  { type: "line", text: "The fountain remembers you." },
  { type: "grant" },
  { type: "line", text: "Return whenever the mall calls you back." },
  { type: "done" },
];

/* ── Second interaction — the fountain drops the act and gets wicked ── */
const SECOND_SCRIPT: Beat[] = [
  { type: "line", text: "So. You came back." },
  { type: "line", text: "I knew you would. The waters always know." },
  { type: "line", text: "When you took my first wish... you signed something." },
  { type: "line", text: "In the fine print. In your soul." },
  { type: "line", text: "Don't worry — it's a very standard soul-clause. Fully deductible." },
  { type: "line", text: "Every wish you take binds you a little deeper to this atrium." },
  { type: "line", text: "And the mall... the mall is SO hungry for you to stay." },
  { type: "grant" },
  { type: "line", text: "There. Another thread in the tether." },
  { type: "line", text: "You can leave whenever you wish. (You won't.)" },
  { type: "done" },
];

/* ============================================================================
   Typewriter sub-component
   ========================================================================== */

function Typewriter({
  text,
  speed = 38,
  onDone,
  onChar,
  reducedMotion,
  startDelay = 0,
}: {
  text: string;
  speed?: number;
  onDone: () => void;
  /** Fired for each character revealed (used to sync the mascot mouth). */
  onChar?: (char: string) => void;
  reducedMotion: boolean;
  startDelay?: number;
}) {
  const [shown, setShown] = useState(() => (reducedMotion ? text : ""));
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;

    if (reducedMotion) {
      const t = setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      }, 120 + startDelay);
      return () => clearTimeout(t);
    }

    // Reset to empty via a microtask so we never call setState synchronously
    // in the effect body. The component is keyed by beat, so a text change
    // remounts it; this reset only re-runs the loop on re-render with the
    // same key (rare).
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const begin = setTimeout(() => {
      setShown("");
      const step = () => {
        i++;
        setShown(text.slice(0, i));
        // Pulse the mouth for each revealed character.
        onChar?.(text[i - 1]);
        if (i >= text.length) {
          if (!doneRef.current) {
            doneRef.current = true;
            onDone();
          }
          return;
        }
        timer = setTimeout(step, speed);
      };
      step();
    }, startDelay);

    return () => {
      clearTimeout(begin);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reducedMotion, speed, startDelay]);

  return <span>{shown}</span>;
}

/* ============================================================================
   Particle sparkle field
   ========================================================================== */

function SparkleField({ reducedMotion }: { reducedMotion: boolean }) {
  const [sparkles] = useState(() =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      y: 20 + Math.random() * 60,
      size: 4 + Math.random() * 8,
      delay: Math.random() * 2,
      duration: 2.4 + Math.random() * 2,
    })),
  );

  if (reducedMotion) {
    return (
      <div className="pointer-events-none absolute inset-0">
        {sparkles.map((s) => (
          <Sparkle
            key={s.id}
            size={s.size}
            weight="fill"
            className="absolute text-amber-300/70"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      {sparkles.map((s) => (
        <motion.div
          key={s.id}
          className="absolute"
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
            y: [0, -28, -56],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        >
          <Sparkle size={s.size} weight="fill" className="text-amber-300" />
        </motion.div>
      ))}
    </div>
  );
}

/* ============================================================================
   Fountain mascot face (eyes + mouth overlaid on the PNG)
   ========================================================================== */

function FountainFace({
  mouthControls,
  reducedMotion,
}: {
  mouthControls: ReturnType<typeof useAnimationControls>;
  reducedMotion: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
      <div className="relative mt-[18%] flex flex-col items-center">
        {/* Eyes */}
        <motion.div
          className="flex gap-7"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: SMOOTH, delay: 0.3 }}
        >
          {[0, 1].map((i) => (
            <motion.div
              key={i}
              className="relative h-6 w-6 rounded-full bg-white shadow-[0_0_10px_rgba(56,189,248,0.9)]"
              animate={reducedMotion ? {} : { scaleY: [1, 0.1, 1] }}
              transition={{
                duration: 0.18,
                repeat: Infinity,
                repeatDelay: 3 + i * 0.2,
                ease: "easeInOut",
              }}
            >
              <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0c1a2e]" />
            </motion.div>
          ))}
        </motion.div>

        {/* Mouth — chatters in sync with the typewriter via animation controls.
            The parent pulses `height` per character (closed on spaces, open on
            letters) and closes it between lines. */}
        <motion.div
          className="mt-3 rounded-b-[50%] rounded-t-lg bg-[#0c1a2e]/90 shadow-[0_0_12px_rgba(56,189,248,0.6)]"
          initial={{ opacity: 0, scaleX: 0, height: 6 }}
          animate={mouthControls}
          style={{ width: 28, height: 6 }}
        />
      </div>
    </div>
  );
}

/* ============================================================================
   Geyser water eruption
   ========================================================================== */

function Geyser({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2">
        <div className="h-24 w-3 rounded-full bg-sky-400/50" />
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2">
      {/* Central column */}
      <motion.div
        className="w-4 rounded-full bg-gradient-to-t from-sky-400/70 via-sky-300/50 to-transparent"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: [0, 220, 180, 240, 160], opacity: [0, 0.9, 0.7, 0.85, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Side streaks */}
      {[-1, 1].map((dir) => (
        <motion.div
          key={dir}
          className="absolute top-0 w-2 rounded-full bg-gradient-to-t from-sky-400/60 to-transparent"
          style={{ left: dir * 14 }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: [0, 160, 120, 180, 100], opacity: [0, 0.7, 0.5, 0.7, 0.4] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: dir * 0.3 }}
        />
      ))}
      {/* Rising droplets */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-sky-200"
          style={{ left: (i - 4) * 6 }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: [-10, -180], opacity: [0, 1, 0] }}
          transition={{
            duration: 1.6 + (i % 3) * 0.4,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

/* ============================================================================
   Cinematic inner component (mounts fresh each open)
   ========================================================================== */

type CinematicMode = "first" | "second" | "return" | "recharge";

function FountainCinematic({
  mode: initialMode,
  cooldownMs: initialCooldown,
  onClose,
}: {
  mode: CinematicMode;
  cooldownMs: number;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const rm = !!reducedMotion;

  const grantWish = useFountainStore((s) => s.grantWish);
  const markMet = useFountainStore((s) => s.markMet);
  const addTokens = usePlayerStore((s) => s.addTokens);
  const pushCelebration = useUIStore((s) => s.pushCelebration);

  const [mode, setMode] = useState<CinematicMode>(initialMode);
  const [beatIndex, setBeatIndex] = useState(0);
  const [outcome, setOutcome] = useState<WishOutcome | null>(null);
  const [showContinue, setShowContinue] = useState(false);
  const [cooldownMs, setCooldownMs] = useState(initialCooldown);

  const script =
    mode === "first"
      ? FIRST_MEETING_SCRIPT
      : mode === "second"
        ? SECOND_SCRIPT
        : RETURN_SCRIPT;

  /* Mouth animation controls — driven per-character by the typewriter so the
     mascot's mouth chatters in sync with the caption being written. */
  const mouthControls = useAnimationControls();

  /* One-time mouth entrance (fade + pop in), then sit closed until the
     typewriter starts pulsing it. External side effect only — no setState. */
  useEffect(() => {
    mouthControls.start({
      opacity: 1,
      scaleX: 1,
      height: MOUTH_CLOSED,
      transition: { duration: 0.4, delay: 0.45, ease: POP },
    });
  }, [mouthControls]);

  /** Pulse the mouth for a single revealed character: open for letters, close
     (brief pause) for spaces. Skipped under reduced-motion. */
  const handleChar = useCallback(
    (char: string) => {
      if (rm) return;
      const target =
        char === " "
          ? MOUTH_CLOSED
          : MOUTH_HEIGHTS[Math.floor(Math.random() * MOUTH_HEIGHTS.length)];
      mouthControls.start({
        height: target,
        transition: { duration: 0.08, ease: "easeOut" },
      });
    },
    [mouthControls, rm],
  );

  /** Close the mouth (between lines / on non-speaking beats). */
  const closeMouth = useCallback(() => {
    mouthControls.start({
      height: MOUTH_CLOSED,
      transition: { duration: 0.2, ease: "easeOut" },
    });
  }, [mouthControls]);

  /* Open swoosh (external side effect, no setState in body). */
  useEffect(() => {
    playSound(SOUNDS.SWOOSH, 0.6);
  }, []);

  /* Esc to dismiss. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* Cooldown ticker for recharge mode — setState only in the interval
     callback, never synchronously in the effect body. */
  useEffect(() => {
    if (mode !== "recharge") return;
    const id = setInterval(() => {
      const remaining = useFountainStore.getState().cooldownRemaining();
      setCooldownMs(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        setMode("return");
        setBeatIndex(0);
        setOutcome(null);
        setShowContinue(false);
        closeMouth();
      }
    }, 250);
    return () => clearInterval(id);
  }, [mode, closeMouth]);

  /* Advance to a beat. All setState happens here (called from callbacks), so
     we never set state synchronously inside an effect body. A ref breaks the
     self-reference so the grant beat can schedule the next beat. */
  const goToBeatRef = useRef<(i: number) => void>(() => {});

  const goToBeat = useCallback(
    (i: number) => {
      const beat = (i < script.length ? script[i] : null) as Beat | null;
      if (!beat) return;
      setBeatIndex(i);

      if (beat.type === "line") {
        // Mouth chattering is driven by the typewriter's onChar; nothing to
        // do here beyond advancing the beat index (already done above).
      } else if (beat.type === "grant") {
        closeMouth();
        const result = grantWish();
        setOutcome(result);
        markMet();
        if (result.tokens > 0) {
          addTokens(result.tokens);
          pushCelebration({
            message: result.message,
            amount: result.tokens,
            kind: "earn",
          });
        }
        if (result.kind === "jackpot") {
          playAchievement(1);
        } else if (result.tokens > 0) {
          playSound(SOUNDS.ACHIEVEMENT, 0.5);
        }
        setTimeout(() => goToBeatRef.current(i + 1), rm ? 600 : 2200);
      } else if (beat.type === "done") {
        closeMouth();
        setShowContinue(true);
      }
    },
    [script, grantWish, markMet, addTokens, pushCelebration, rm, closeMouth],
  );

  useEffect(() => {
    goToBeatRef.current = goToBeat;
  }, [goToBeat]);

  const handleLineDone = useCallback(() => {
    closeMouth();
    setTimeout(() => goToBeat(beatIndex + 1), rm ? 150 : 650);
  }, [beatIndex, goToBeat, rm, closeMouth]);

  const currentBeat = script[beatIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: SMOOTH }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#050a14]"
      data-testid="fountain-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="MurkyMall Wishing Fountain"
    >
      {/* ── Cinematic radial backdrop ── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(14,40,80,0.9) 0%, rgba(5,10,20,1) 70%)",
        }}
      />
      {/* Aurora glow behind the fountain */}
      <motion.div
        className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "min(95vw, 62vh, 460px)",
          height: "min(95vw, 62vh, 460px)",
          background:
            "radial-gradient(circle, rgba(56,189,248,0.35) 0%, rgba(245,158,11,0.18) 45%, transparent 70%)",
          filter: "blur(20px)",
        }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: [0.6, 1.1, 1] }}
        transition={{ duration: 1.6, ease: SMOOTH }}
      />

      {/* ── Letterbox bars (cinematic "video" framing) ── */}
      <motion.div
        className="absolute inset-x-0 top-0 z-20 bg-black"
        initial={{ height: 0 }}
        animate={{ height: "12%" }}
        transition={{ duration: 0.7, ease: SMOOTH }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 z-20 bg-black"
        initial={{ height: 0 }}
        animate={{ height: "12%" }}
        transition={{ duration: 0.7, ease: SMOOTH }}
      />

      {/* ── Close button (top-right, above letterbox) ── */}
      <button
        onClick={onClose}
        aria-label="Skip fountain welcome"
        className="absolute right-4 top-[14%] z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/20 transition-all duration-200 hover:bg-white/20 active:scale-95"
      >
        <X size={18} weight="bold" />
      </button>

      {/* ── Fountain mascot stage ── */}
      {mode !== "recharge" ? (
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6">
          {/* Fountain PNG with face + geyser */}
          <div className="relative mb-6" style={{ width: "min(72vw, 40vh, 300px)", height: "min(72vw, 40vh, 300px)" }}>
            <Geyser reducedMotion={rm} />
            <motion.img
              src="/assets/map/fountain.png"
              alt=""
              className="relative z-10 h-full w-full object-contain"
              initial={{ y: 60, opacity: 0, scale: 0.8 }}
              animate={{ y: [60, 0, -6, 0], opacity: 1, scale: 1 }}
              transition={{
                y: { duration: 1.4, ease: SMOOTH, times: [0, 0.6, 0.8, 1] },
                opacity: { duration: 1, ease: SMOOTH },
                scale: { duration: 1.4, ease: SMOOTH },
              }}
              style={{
                filter:
                  "drop-shadow(0 18px 36px rgba(56,189,248,0.6)) drop-shadow(0 6px 12px rgba(0,0,0,0.5))",
              }}
            />
            <FountainFace mouthControls={mouthControls} reducedMotion={rm} />
            <SparkleField reducedMotion={rm} />
          </div>

          {/* Speech caption area */}
          <div className="relative flex min-h-[88px] w-full max-w-md items-center justify-center px-4 text-center sm:max-w-lg">
            <AnimatePresence mode="wait">
              {currentBeat && currentBeat.type === "line" && (
                <motion.p
                  key={beatIndex}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: SMOOTH }}
                  className="font-display text-base leading-snug text-amber-50 sm:text-lg md:text-xl"
                  style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}
                >
                  <Typewriter
                    text={currentBeat.text}
                    speed={36}
                    startDelay={120}
                    reducedMotion={rm}
                    onChar={handleChar}
                    onDone={handleLineDone}
                  />
                </motion.p>
              )}
            </AnimatePresence>

            {/* Wish outcome burst */}
            <AnimatePresence>
              {outcome && currentBeat && currentBeat.type === "grant" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: [0.4, 1.15, 1] }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.6, ease: POP }}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                  data-testid="fountain-wish-result"
                >
                  <motion.div
                    className={
                      "flex items-center gap-2 rounded-full px-5 py-2.5 font-display text-xl font-bold " +
                      (outcome.kind === "jackpot"
                        ? "bg-amber-400 text-[#141414] shadow-[0_0_30px_rgba(245,158,11,0.9)]"
                        : outcome.tokens > 0
                          ? "bg-sky-400 text-[#04101f] shadow-[0_0_24px_rgba(56,189,248,0.8)]"
                          : "bg-white/10 text-white/80 ring-1 ring-white/20")
                    }
                  >
                    <Coins size={22} weight="fill" />
                    {outcome.tokens > 0 ? `+${outcome.tokens}` : "—"}
                  </motion.div>
                  <p
                    className="mt-3 max-w-xs text-center text-sm leading-snug text-amber-100/90 sm:max-w-sm sm:text-base"
                    style={{ textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}
                  >
                    {outcome.message}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Continue button */}
          <AnimatePresence>
            {showContinue && (
              <motion.button
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: SMOOTH }}
                onClick={onClose}
                className="mt-6 rounded-full bg-amber-400 px-8 py-3 font-display text-sm font-bold uppercase tracking-[0.12em] text-[#141414] shadow-[0_6px_20px_rgba(245,158,11,0.5)] transition-all duration-200 active:scale-95 hover:bg-amber-300 sm:px-10 sm:py-3.5 sm:text-base"
                data-testid="fountain-continue"
              >
                Continue
              </motion.button>
            )}
          </AnimatePresence>

          {/* Plaque */}
          <p className="absolute bottom-[14%] z-10 max-w-xs px-6 text-center text-[9px] leading-relaxed text-white/30 sm:max-w-sm sm:text-[10px]">
            MurkyCorps Wishing Foundation™ — A subsidiary of MurkyCorps Mall
            Management. Your tokens fund our vision. (Our vision is more
            fountains.) Wishes are non-refundable.
          </p>
        </div>
      ) : (
        /* ── Recharging state ── */
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center">
          <motion.img
            src="/assets/map/fountain.png"
            alt=""
            className="mb-6 h-40 w-40 object-contain opacity-40 sm:h-52 sm:w-52"
            style={{ filter: "drop-shadow(0 10px 20px rgba(56,189,248,0.3))" }}
          />
          <p className="font-display text-lg text-sky-200/80 sm:text-xl">
            The fountain is recharging its magic...
          </p>
          <p className="mt-2 text-sm text-white/50 sm:text-base">
            Return in {Math.ceil(cooldownMs / 1000)}s
          </p>
          <button
            onClick={onClose}
            className="mt-8 rounded-full bg-white/10 px-6 py-2.5 text-sm font-semibold text-white/80 ring-1 ring-white/20 transition-all duration-200 hover:bg-white/20 active:scale-95 sm:text-base"
            data-testid="fountain-recharge-close"
          >
            Back to the mall
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ============================================================================
   Outer component — gate on activeOverlay, mount cinematic fresh each open
   ========================================================================== */

export function FountainOverlay() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  const isOpen = activeOverlay === "fountain";

  // Read store values for the initial mode only — the cinematic child mounts
  // fresh each open (AnimatePresence) so these are captured at open time.
  const hasMet = useFountainStore((s) => s.hasMet);
  const wishCount = useFountainStore((s) => s.wishCount);
  const canWish = useFountainStore((s) => s.canWish);
  const cooldownRemaining = useFountainStore((s) => s.cooldownRemaining);

  // First meeting -> full welcome. Second visit (one wish already granted) ->
  // the wicked "soul-clause" script. Later visits -> the short return beat.
  // Cooldown not ready -> recharge screen.
  const initialMode: CinematicMode = !hasMet
    ? "first"
    : !canWish()
      ? "recharge"
      : wishCount === 1
        ? "second"
        : "return";

  return (
    <AnimatePresence>
      {isOpen && (
        <FountainCinematic
          key="fountain-cinematic"
          mode={initialMode}
          cooldownMs={cooldownRemaining()}
          onClose={hideOverlay}
        />
      )}
    </AnimatePresence>
  );
}

export default FountainOverlay;
