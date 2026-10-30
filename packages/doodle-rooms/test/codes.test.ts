import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, isRoomCode, normalizeCode } from "../src";
import { cleanName } from "../src/server";

describe("room codes", () => {
  it("accepts six readable characters and nothing else", () => {
    expect(isRoomCode("ABC234")).toBe(true);
    expect(isRoomCode("ABC23")).toBe(false);
    expect(isRoomCode("ABCO01")).toBe(false); // O, 0 and 1 are never used
    expect(CODE_ALPHABET).not.toMatch(/[IO01]/);
  });

  it("forgives how people type a code", () => {
    expect(normalizeCode(" abc-234 ")).toBe("ABC234");
  });
});

it("cleanName strips control characters, trims, caps the length and falls back when empty", () => {
  expect(cleanName("  Ana\u0007 ", "Mush")).toBe("Ana");
  expect(cleanName("x".repeat(40), "Mush")).toHaveLength(14);
  expect(cleanName("\u0000 ", "Mush")).toBe("Mush");
  expect(cleanName(42, "Mush")).toBe("Mush");
});
