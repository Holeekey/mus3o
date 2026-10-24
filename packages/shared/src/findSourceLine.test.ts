import { describe, expect, it } from "vitest";
import { findSourceLine } from "./sources";

const NOTES = [
  "# Biología",
  "",
  "- Mitocondria: produce ATP mediante respiración celular",
  "- Núcleo: guarda el ADN de la célula",
  "Los ribosomas sintetizan proteínas a partir del ARN mensajero",
  "Texto sin relación alguna con nada",
].join("\n");

describe("findSourceLine", () => {
  it("finds the line containing the title, accent-insensitive", () => {
    expect(findSourceLine(NOTES, { title: "Nucleo", text: "" })).toEqual({
      quote: "- Núcleo: guarda el ADN de la célula",
      line: 4,
    });
  });

  it("finds by token overlap when the title is not literally present", () => {
    const hit = findSourceLine(NOTES, { title: "Síntesis de proteínas", text: "Los ribosomas sintetizan proteínas" });
    expect(hit?.line).toBe(5);
  });

  it("ignores stopwords and returns null below the threshold", () => {
    expect(findSourceLine(NOTES, { title: "El de la", text: "para por con" })).toBeNull();
    expect(findSourceLine(NOTES, { title: "Fotosíntesis", text: "" })).toBeNull();
  });

  it("caps the quote at 240 chars and trims it", () => {
    const long = "  Mitocondria " + "x".repeat(400);
    const hit = findSourceLine(long, { title: "Mitocondria" });
    expect(hit?.quote.length).toBe(240);
    expect(hit?.quote.startsWith("Mitocondria")).toBe(true);
  });

  it("returns 1-based lines on CRLF notes and handles empty notes", () => {
    expect(findSourceLine("uno\r\nMitocondria: ATP", { title: "Mitocondria" })?.line).toBe(2);
    expect(findSourceLine("", { title: "Mitocondria" })).toBeNull();
  });
});
