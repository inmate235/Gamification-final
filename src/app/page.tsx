import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * Placeholder home page for the foundation scaffold.
 * Renders a Mystic Premium hero confirming the design system is wired.
 * The real invite entry screen is built in a subsequent feature.
 */
export default function HomePage() {
  return (
    <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 py-24">
      {/* Eyebrow tag */}
      <span className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium text-[#a1a1aa] ring-1 ring-white/10">
        <Sparkle size={12} weight="light" className="text-[#d4af37]" />
        Members Only
      </span>

      {/* Hero card - double bezel */}
      <div className="bezel-card w-full max-w-md">
        <div className="bezel-card-inner flex flex-col items-center text-center">
          <h1 className="text-gradient-gold text-4xl font-bold tracking-tight sm:text-5xl">
            MurkyCorps Mall
          </h1>
          <p className="mt-4 text-sm text-[#a1a1aa]">
            An exclusive, invitation-only mall experience. The design system is
            online and ready.
          </p>
          <div
            className={cn(
              "mt-8 flex items-center gap-2 rounded-full bg-white/5 px-4 py-2",
              "text-xs text-[#4fd1c5] ring-1 ring-white/10"
            )}
          >
            <span className="h-2 w-2 rounded-full bg-[#4fd1c5] glow-teal" />
            Foundation scaffold operational
          </div>
        </div>
      </div>
    </main>
  );
}
