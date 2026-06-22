import { InviteScreen } from "@/components/onboarding/InviteScreen";

/**
 * Home route `/` — the invite entry screen.
 *
 * Renders the invite code input, welcome animation, and social proof.
 * On valid code submission, navigates forward to /survey (single forward flow).
 */
export default function HomePage() {
  return <InviteScreen />;
}
