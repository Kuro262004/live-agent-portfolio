// Real bugs hit while building this portfolio, told as monster cards. Edit freely; keep each one true.
// (Add bugs from other projects only with permission: nothing from GOLI Company unless they allow it.)
export const BUGS = [
  {
    id: "001",
    name: "The Echo Wraith",
    rarity: "legendary",
    habitat: "real-time voice calls",
    symptom: "The AI heard its own voice through the speakers and replied to itself.",
    weakness: "Barge-in handling, and pausing speech recognition while the voice is speaking.",
    defeatedIn: "Portfolio voice call",
  },
  {
    id: "002",
    name: "The Ghost Timestamps",
    rarity: "rare",
    habitat: "the mission log",
    symptom: "Log times were right on screen, then jumped to UTC after a reload.",
    weakness: "SQLite drops time zones. A time-zone-aware column type plus formatting in the visitor's own zone fixed it.",
    defeatedIn: "Mission Control",
  },
  {
    id: "003",
    name: "The Stale Seed",
    rarity: "rare",
    habitat: "the local database",
    symptom: "Re-seeding the content silently kept the old data.",
    weakness: "A leftover server process still held the database file. Stop every server before deleting and re-seeding.",
    defeatedIn: "Portfolio backend",
  },
  {
    id: "004",
    name: "The Vanishing Panel",
    rarity: "common",
    habitat: "the call window",
    symptom: "Opening the call panel crashed with \"destroy is not a function\".",
    weakness: "An effect returned the result of a scroll call. Wrapping it in braces so it returns nothing fixed it.",
    defeatedIn: "Call panel",
  },
];
