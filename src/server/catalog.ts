export const EXERCISE_IDS = [
  "pronation",
  "supination",
  "rising",
  "cupping",
  "cupping_top_roll",
  "cupping_hook",
  "back_pressure",
  "side_pressure",
  "imitation",
  "table_riser",
  "finger_curl",
  "shoulder_internal_rotation",
  "gripper_close",
  "table_hook_pulls",
  "table_top_roll",
  "table_isometric_holds",
] as const;

export type ExerciseId = (typeof EXERCISE_IDS)[number];

export const ISOMETRIC_EXERCISE: ExerciseId = "table_isometric_holds";

export const EQUIPMENT = [
  { id: "thin-handle", image: "/media/thin-handle.jpg" },
  { id: "cylindrical-handle", image: "/media/cylindrical-handle.jpg" },
  { id: "eccentric-handle", image: "/media/eccentric-handle.jpg" },
  { id: "strap-handle", image: "/media/strap-handle.jpg" },
  { id: "multi-spinner-standard", image: "/media/multi-spinner-standard.jpg" },
  { id: "multi-spinner-thick", image: "/media/multi-spinner-thick.jpg" },
  { id: "armwrestling-belt", image: "/media/armwrestling-belt.jpg" },
  { id: "gripper-40", image: "/media/gripper-40.jpg" },
  { id: "gripper-coc3", image: "/media/gripper-coc3.jpg" },
] as const;

export type EquipmentId = (typeof EQUIPMENT)[number]["id"];

export const BLOCK_HEIGHTS = ["highest", "above_mid", "below_mid", "lowest"] as const;

export type BlockHeight = (typeof BLOCK_HEIGHTS)[number];

export const BANDS = ["green_heavy", "purple", "green_light", "red"] as const;

export type BandId = (typeof BANDS)[number];

export function kyivToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
  }).format(now);
}

export function windowStart(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 6);
  return date.toISOString().slice(0, 10);
}
