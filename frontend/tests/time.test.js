import { describe, expect, it } from "vitest";
import { evolutionLine, timeAgo } from "../src/lib/time";

const now = Date.parse("2026-10-14T12:00:00Z");

describe("evolution badge text", () => {
  it("matches the spec wording", () => {
    const evo = { last_evolved_at: "2026-10-14T09:00:00Z", commits_learned: 2 };
    expect(evolutionLine(evo, now)).toBe("Last evolved 3 hours ago · 2 new commits learned");
  });

  it("handles singular, zero and never", () => {
    expect(evolutionLine({ last_evolved_at: "2026-10-14T11:00:00Z", commits_learned: 1 }, now)).toBe(
      "Last evolved 1 hour ago · 1 new commit learned",
    );
    expect(evolutionLine({ last_evolved_at: "2026-10-12T12:00:00Z", commits_learned: 0 }, now)).toBe("Last evolved 2 days ago");
    expect(evolutionLine({ last_evolved_at: null, commits_learned: 0 }, now)).toBe("Not evolved yet");
    expect(timeAgo("2026-10-14T11:59:30Z", now)).toBe("just now");
  });
});
