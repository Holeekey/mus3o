import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { takeBudget, getBudgetStatus, resetBudgetForTesting } from "./budgetStore";

describe("budgetStore", () => {
  beforeEach(async () => {
    await resetBudgetForTesting("test-ns");
  });

  it("permite consumir cuota dentro del límite", async () => {
    const ok1 = await takeBudget("test-ns", 5, 10);
    expect(ok1).toBe(true);

    const status1 = await getBudgetStatus("test-ns", 10);
    expect(status1.used).toBe(5);
    expect(status1.remaining).toBe(5);

    const ok2 = await takeBudget("test-ns", 5, 10);
    expect(ok2).toBe(true);

    const status2 = await getBudgetStatus("test-ns", 10);
    expect(status2.used).toBe(10);
    expect(status2.remaining).toBe(0);
  });

  it("rechaza el consumo cuando se excede el límite", async () => {
    await takeBudget("test-ns", 8, 10);
    const rejected = await takeBudget("test-ns", 3, 10);
    expect(rejected).toBe(false);

    const status = await getBudgetStatus("test-ns", 10);
    expect(status.used).toBe(8);
  });

  it("persiste y recarga desde disco tras un reinicio del proceso", async () => {
    await takeBudget("test-ns", 4, 10);
    await new Promise((r) => setTimeout(r, 100)); // dar margen a la cola de escritura
    vi.resetModules(); // simula el reinicio: memoria vacía, solo queda el archivo
    const fresh = await import("./budgetStore");
    const status = await fresh.getBudgetStatus("test-ns", 10);
    expect(status.used).toBe(4);
  });

  it("no pierde consumos en llamadas concurrentes en frío", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => takeBudget("test-ns", 1, 100)));
    expect(results.every(Boolean)).toBe(true);
    expect((await getBudgetStatus("test-ns", 100)).used).toBe(10);
  });

  it("nunca excede el tope con llamadas concurrentes", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => takeBudget("test-ns", 1, 3)));
    expect(results.filter(Boolean)).toHaveLength(3);
  });

  describe("cambio de día UTC", () => {
    afterEach(() => vi.useRealTimers());

    it("reinicia el consumo al pasar a otro día", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-25T23:59:00Z"));
      await takeBudget("test-ns", 10, 10);
      expect(await takeBudget("test-ns", 1, 10)).toBe(false);

      vi.setSystemTime(new Date("2026-10-26T00:01:00Z"));
      expect(await takeBudget("test-ns", 1, 10)).toBe(true);
      expect((await getBudgetStatus("test-ns", 10)).used).toBe(1);
    });
  });
});
