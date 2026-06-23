/**
 * taskGenerator - breadcrumb task auto-generation (architecture.md).
 *
 * The canonical source of new tasks. Each generated task references a REAL
 * map location (a zone id from mallData, and for "visit-stores" tasks a set
 * of real store ids). Completing a task auto-generates a new one with an
 * escalated chain level and slightly larger reward so the task list is never
 * empty and difficulty ramps over a session.
 *
 * Task types:
 *   - explore-zone : reach a specific zone (completes on zone entry)
 *   - find-token   : find a hidden token in a zone (completes on first
 *                    reveal / token pickup in that zone)
 *   - visit-stores : visit N stores in a zone (completes when all target
 *                    stores have been opened)
 *
 * Time-gating: ~30% of tasks generated after chain level 0 carry a 15-minute
 * gate (`gateUntil`) that prevents early completion.
 */

import type { Task, TaskType, Zone } from "@/types";
import {
  zones,
  storesByZone,
  ZONE_FOOD_COURT,
} from "@/data/mallData";

/* ============================================================================
   Constants
   ========================================================================== */

export const TIME_GATE_MS = 15 * 60 * 1000; // 15 minutes

interface TaskTemplate {
  type: TaskType;
  /** Build the human-readable description. */
  buildDescription: (zone: Zone, storeCount: number) => string;
  baseReward: number;
  difficulty: number;
  /** Relative weight for random selection. */
  weight: number;
}

const TEMPLATES: TaskTemplate[] = [
  {
    type: "explore-zone",
    buildDescription: (zone) => `Explore the ${zone.name}`,
    baseReward: 3,
    difficulty: 1,
    weight: 3,
  },
  {
    type: "find-token",
    buildDescription: (zone) => `Find a hidden token in the ${zone.name}`,
    baseReward: 4,
    difficulty: 2,
    weight: 2,
  },
  {
    type: "visit-stores",
    buildDescription: (zone, n) => `Visit ${n} stores in the ${zone.name}`,
    baseReward: 5,
    difficulty: 3,
    weight: 2,
  },
  {
    // The furthest zone holds the secret token — a premium find-token task.
    type: "find-token",
    buildDescription: (zone) => `Collect the secret token at the ${zone.name}`,
    baseReward: 10,
    difficulty: 4,
    weight: 1,
  },
];

/* ============================================================================
   RNG (injectable for tests; defaults to Math.random)
   ========================================================================== */

export type Rng = () => number;

/* ============================================================================
   ID counter (module-level, monotonic, reset-safe)
   ========================================================================== */

let taskCounter = 0;

export function nextTaskId(): string {
  taskCounter += 1;
  return `task-${taskCounter}`;
}

/** Reset the id counter (test helper). */
export function __resetTaskIdCounter(): void {
  taskCounter = 0;
}

/* ============================================================================
   Helpers
   ========================================================================== */

/** Weighted random template selection from a (possibly filtered) list. */
function pickTemplate(list: TaskTemplate[], rng: Rng): TaskTemplate {
  if (list.length === 0) return TEMPLATES[0]!;
  const total = list.reduce((sum, t) => sum + t.weight, 0);
  let r = rng() * total;
  for (const t of list) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return list[0]!;
}

/**
 * The subset of templates that are currently solvable. find-token tasks are
 * only solvable while at least one zone is still fogged (completion fires on
 * a zone reveal / token pickup), and the secret-token variant additionally
 * requires the Food Court to be fogged. When every zone is revealed, all
 * find-token templates are excluded so we fall back to explore-zone /
 * visit-stores tasks instead.
 */
function eligibleTemplates(revealedZoneIds: Set<string>): TaskTemplate[] {
  const anyFogged = zones.some((z) => !revealedZoneIds.has(z.id));
  const foodCourtFogged = !revealedZoneIds.has(ZONE_FOOD_COURT);
  return TEMPLATES.filter((t) => {
    if (t.type !== "find-token") return true;
    if (t.baseReward >= 10) return foodCourtFogged;
    return anyFogged;
  });
}

/**
 * Pick a target zone for a task.
 *
 * - For the secret-token template we always target the Food Court, but ONLY
 *   while it is still fogged (a revealed Food Court can never produce a new
 *   zone-reveal / token-pickup event, so a find-token task there would be
 *   impossible). Returns null if the Food Court is already revealed.
 * - For find-token we ONLY target zones that are still fogged, because
 *   find-token completion fires on the first fog reveal / token pickup in
 *   the target zone. If all zones are revealed there is no valid target and
 *   we return null (the caller then skips the find-token template entirely).
 * - For explore-zone / visit-stores we pick any eligible zone
 *   (visit-stores excludes Central Plaza which has no stores).
 *
 * Returning null signals "this template is unsolvable right now — try a
 * different template."
 */
function pickZone(
  template: TaskTemplate,
  revealedZoneIds: Set<string>,
  rng: Rng
): Zone | null {
  // Secret-token template -> Food Court, but only while it is still fogged.
  if (template.type === "find-token" && template.baseReward >= 10) {
    if (revealedZoneIds.has(ZONE_FOOD_COURT)) return null;
    return zones.find((z) => z.id === ZONE_FOOD_COURT) ?? null;
  }

  if (template.type === "visit-stores") {
    // Zones that actually contain stores.
    const withStores = zones.filter((z) => (storesByZone[z.id] ?? []).length > 0);
    return withStores[Math.floor(rng() * withStores.length)] ?? zones[0]!;
  }

  if (template.type === "find-token") {
    // Only fogged zones are valid targets — completion requires a reveal
    // event in the target zone, which can only happen while it is fogged.
    const fogged = zones.filter((z) => !revealedZoneIds.has(z.id));
    if (fogged.length === 0) return null; // all revealed -> skip find-token
    return fogged[Math.floor(rng() * fogged.length)]!;
  }

  // explore-zone: any zone.
  return zones[Math.floor(rng() * zones.length)]!;
}

/** Number of stores to visit for a visit-stores task (2..max, scales w/ chain). */
function storeVisitCount(zone: Zone, chainLevel: number): number {
  const available = (storesByZone[zone.id] ?? []).length;
  if (available <= 0) return 1;
  const desired = 2 + (chainLevel % 3); // 2, 3, or 4
  return Math.min(desired, available);
}

/** Pick `count` distinct store ids from the zone. */
function pickStoreIds(zone: Zone, count: number, rng: Rng): string[] {
  const pool = [...(storesByZone[zone.id] ?? [])];
  // Fisher-Yates partial shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count).map((s) => s.id);
}

/* ============================================================================
   Generation options
   ========================================================================== */

export interface GenerateOptions {
  chainLevel: number;
  /** Set of currently-revealed zone ids (used to keep find-token solvable). */
  revealedZoneIds?: Set<string>;
  /**
   * Avoid generating a task with the same (type, targetZone) as the
   * just-completed task so completed tasks do not instantly reappear
   * (VAL-TASK-019).
   */
  avoid?: { type: TaskType; targetZone: string };
  rng?: Rng;
}

/* ============================================================================
   Core generator
   ========================================================================== */

/**
 * Generate a single task. Pure function — does not touch any store.
 */
export function generateTask(options: GenerateOptions): Task {
  const {
    chainLevel,
    revealedZoneIds = new Set<string>(),
    avoid,
    rng = Math.random,
  } = options;

  const eligible = eligibleTemplates(revealedZoneIds);

  // Try a few times to pick a solvable template+zone that does not exactly
  // duplicate the just-completed task (VAL-TASK-019). A null zone means the
  // picked find-token template has no valid (fogged) target — retry.
  let template = pickTemplate(eligible, rng);
  let zone = pickZone(template, revealedZoneIds, rng);
  let attempts = 0;
  while (
    attempts < 16 &&
    (zone === null ||
      (avoid &&
        avoid.type === template.type &&
        avoid.targetZone === zone.id))
  ) {
    template = pickTemplate(eligible, rng);
    zone = pickZone(template, revealedZoneIds, rng);
    attempts += 1;
  }

  // Fallback: if every attempt produced an unsolvable find-token (e.g. all
  // zones revealed and rng kept landing on find-token before filtering),
  // force a non-find-token template, which is always solvable.
  if (zone === null) {
    const nonFindToken = TEMPLATES.filter((t) => t.type !== "find-token");
    for (let i = 0; i < nonFindToken.length && zone === null; i++) {
      template = nonFindToken[Math.floor(rng() * nonFindToken.length)]!;
      zone = pickZone(template, revealedZoneIds, rng);
    }
  }
  if (zone === null) {
    // Absolute last resort — explore the entrance zone.
    template = TEMPLATES.find((t) => t.type === "explore-zone") ?? TEMPLATES[0]!;
    zone = zones[0]!;
  }

  const storeCount = storeVisitCount(zone, chainLevel);
  const description = template.buildDescription(zone, storeCount);

  const reward = template.baseReward + chainLevel;
  const difficulty = template.difficulty + Math.floor(chainLevel / 2);

  // ~30% of tasks after the first chain level are time-gated.
  const timeGated = chainLevel > 0 && rng() < 0.3;
  const now = Date.now();

  const task: Task = {
    id: nextTaskId(),
    type: template.type,
    description,
    targetZone: zone.id,
    reward,
    timeGated,
    gateUntil: timeGated ? now + TIME_GATE_MS : undefined,
    difficulty,
    chainLevel,
    assignedAt: now,
  };

  if (template.type === "visit-stores") {
    task.targetStores = pickStoreIds(zone, storeCount, rng);
  }

  return task;
}

/**
 * Seed the initial active task list (2-4 tasks at chain level 0). Guarantees
 * at least two distinct task types so the panel shows variety immediately
 * and the list is never empty on first load.
 */
export function generateInitialTasks(
  revealedZoneIds: Set<string> = new Set<string>(),
  rng: Rng = Math.random
): Task[] {
  const now = Date.now();
  const seeded: Task[] = [];
  const seenTypes = new Set<TaskType>();
  const seenZones = new Set<string>();

  for (const template of TEMPLATES) {
    if (seenTypes.has(template.type)) continue;
    if (seeded.length >= 3) break;

    // Pick a zone for this template that we have not yet used. find-token
    // templates return null when no fogged target exists — skip those.
    let zone: Zone | null = null;
    for (let i = 0; i < 6; i++) {
      const candidate = pickZone(template, revealedZoneIds, rng);
      if (candidate && !seenZones.has(candidate.id)) {
        zone = candidate;
        break;
      }
    }
    if (!zone) zone = pickZone(template, revealedZoneIds, rng);
    if (!zone) continue; // no solvable target for this template — skip it
    seenZones.add(zone.id);

    const storeCount = storeVisitCount(zone, 0);
    const description = template.buildDescription(zone, storeCount);
    const task: Task = {
      id: nextTaskId(),
      type: template.type,
      description,
      targetZone: zone.id,
      reward: template.baseReward, // chainLevel 0
      timeGated: false, // initial tasks never gated
      difficulty: template.difficulty,
      chainLevel: 0,
      assignedAt: now,
    };
    if (template.type === "visit-stores") {
      task.targetStores = pickStoreIds(zone, storeCount, rng);
    }
    seeded.push(task);
    seenTypes.add(template.type);
  }

  // Safety: ensure at least one task exists.
  if (seeded.length === 0) {
    seeded.push(generateTask({ chainLevel: 0, revealedZoneIds, rng }));
  }
  return seeded;
}

export default generateTask;
