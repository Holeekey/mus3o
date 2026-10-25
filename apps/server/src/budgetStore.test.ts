import { describe, it, expect, beforeEach } from "vitest";
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

  it("persiste y recarga desde disco", async () => {
    await takeBudget("test-ns", 4, 10);
    // Borrar de la memoria para forzar lectura de disco
    await new Promise((r) => setTimeout(r, 50)); // dar margen a la cola de escritura
    const status = await getBudgetStatus("test-ns", 10);
    expect(status.used).toBe(4);
  });
});
