import { describe, expect, it } from "vitest";
import { contradictsCountry, countriesIn } from "./relevance";

describe("countriesIn", () => {
  it("detects names, multi-word names and demonyms ignoring accents and case", () => {
    expect([...countriesIn("Elecciones generales de Uruguay de 2024")]).toEqual(["uy"]);
    expect([...countriesIn("Relaciones Estados Unidos-Venezuela")].sort()).toEqual(["us", "ve"]);
    expect([...countriesIn("la Armada ARGENTINA")]).toEqual(["ar"]);
    expect([...countriesIn("flota estadounidense y soldados venezolanos")].sort()).toEqual(["us", "ve"]);
    expect([...countriesIn("Guerra civil española")]).toEqual(["es"]);
    expect([...countriesIn("El Terror, Revolución francesa")]).toEqual(["fr"]);
  });
  it("finds nothing in country-free text and does not match inside other words", () => {
    expect(countriesIn("Toma de la Bastilla").size).toBe(0);
    expect(countriesIn("Armada en el Caribe").size).toBe(0);
    expect(countriesIn("Chinchilla y romanticismo").size).toBe(0);
  });
});

describe("contradictsCountry", () => {
  const ctx = "Antecedentes · El conflicto entre Estados Unidos y Venezuela";
  it("rejects a hit naming a country the query and context never mention", () => {
    expect(contradictsCountry("Elecciones de 2024", ctx, "Elecciones generales de Uruguay de 2024")).toBe(true);
    expect(contradictsCountry("Armada en el Caribe", ctx, "Armada Argentina")).toBe(true);
    expect(contradictsCountry("Armada en el Caribe", "", "Armada Argentina")).toBe(true);
  });
  it("accepts hits with no country or with countries from the query/context", () => {
    expect(contradictsCountry("Armada en el Caribe", ctx, "Operación Lanza del Sur")).toBe(false);
    expect(contradictsCountry("Ataques a lanchas", ctx, "Ataques de Estados Unidos contra supuestos narcotraficantes")).toBe(false);
    expect(contradictsCountry("Armada", ctx, "Armada venezolana")).toBe(false);
  });
});
