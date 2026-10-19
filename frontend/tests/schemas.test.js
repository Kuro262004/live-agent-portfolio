import { describe, expect, it } from "vitest";
import seed from "../src/content/seed.json";
import { missionFormSchema, portfolioSchema } from "../src/lib/schemas";
import { templates } from "./server";

describe("schemas", () => {
  it("accepts the seed content", () => {
    expect(portfolioSchema.safeParse(seed).success).toBe(true);
  });

  it("validates a mission form from the template definition", () => {
    const schema = missionFormSchema(templates[1]);
    expect(schema.safeParse({ business: "Kape", channels: "chat", notes: "" }).success).toBe(true);
    const bad = schema.safeParse({ business: "", channels: "carrier pigeon", notes: "" });
    expect(bad.success).toBe(false);
    expect(bad.error.issues.map((i) => i.path[0]).sort()).toEqual(["business", "channels"]);
    expect(missionFormSchema(templates[0]).safeParse({ process: "x".repeat(21) }).success).toBe(false);
  });
});
