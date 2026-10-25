import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Gestor de presupuestos y cuotas diarias persistido en disco.
 * Evita que reinicios de dynos/contenedores en Render reinicien a 0 los topes de seguridad.
 * Utiliza memoria para lecturas inmediatas y escrituras atómicas en disco por namespace.
 */

export interface BudgetRecord {
  day: string;
  used: number;
}

const memoryBudgets = new Map<string, BudgetRecord>();
const loading = new Map<string, Promise<BudgetRecord>>();
const writeQueues = new Map<string, Promise<void>>();

const budgetDir = () => {
  const dir = process.env.BUDGET_CACHE_DIR || process.env.CACHE_DIR;
  return resolve(dir && dir !== "undefined" ? dir : ".cache/budget");
};

const fileFor = (namespace: string) => join(budgetDir(), `${namespace}.json`);

const todayUtc = () => new Date().toISOString().slice(0, 10);

async function readFromDisk(namespace: string): Promise<BudgetRecord | null> {
  try {
    const raw = await readFile(fileFor(namespace), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.day === "string" && typeof parsed.used === "number") {
      return { day: parsed.day, used: parsed.used };
    }
    return null;
  } catch {
    return null;
  }
}

async function writeToDisk(namespace: string, record: BudgetRecord): Promise<void> {
  const dir = budgetDir();
  const target = fileFor(namespace);
  const tmp = `${target}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(tmp, JSON.stringify(record, null, 2), "utf8");
    await rename(tmp, target);
  } catch (err) {
    // La cuota sigue vigente en memoria; solo se pierde la persistencia, y se avisa.
    console.error(`budgetStore: no se pudo persistir "${namespace}": ${(err as Error).name}`);
    await unlink(tmp).catch(() => {});
  }
}

function queueDiskWrite(namespace: string, record: BudgetRecord) {
  const current = writeQueues.get(namespace) ?? Promise.resolve();
  const next = current
    .then(() => writeToDisk(namespace, record))
    .catch(() => {})
    .finally(() => {
      if (writeQueues.get(namespace) === next) {
        writeQueues.delete(namespace);
      }
    });
  writeQueues.set(namespace, next);
}

/**
 * Carga o inicializa el registro para el día actual. La carga inicial desde disco se comparte por namespace:
 * así llamadas concurrentes en frío usan el mismo objeto y no se pierden incrementos.
 */
async function getOrCreateBudget(namespace: string): Promise<BudgetRecord> {
  const today = todayUtc();
  let record = memoryBudgets.get(namespace);

  if (!record) {
    let pending = loading.get(namespace);
    if (!pending) {
      pending = readFromDisk(namespace)
        .then((onDisk) => {
          const loaded = onDisk && onDisk.day === today ? onDisk : { day: today, used: 0 };
          memoryBudgets.set(namespace, loaded);
          return loaded;
        })
        .finally(() => loading.delete(namespace));
      loading.set(namespace, pending);
    }
    record = await pending;
  }

  if (record.day !== today) {
    record.day = today;
    record.used = 0;
  }

  return record;
}

/**
 * Intenta consumir una cantidad del presupuesto para un namespace específico.
 * Devuelve true si la cuota no fue superada; false si ya alcanzó o superaría maxLimit.
 */
export async function takeBudget(namespace: string, amount: number = 1, maxLimit: number): Promise<boolean> {
  const record = await getOrCreateBudget(namespace);
  if (record.used + amount > maxLimit) {
    return false;
  }

  record.used += amount;
  queueDiskWrite(namespace, record);
  return true;
}

/**
 * Devuelve el estado actual de la cuota del día para un namespace.
 */
export async function getBudgetStatus(namespace: string, maxLimit: number): Promise<{ day: string; used: number; remaining: number }> {
  const record = await getOrCreateBudget(namespace);
  return {
    day: record.day,
    used: record.used,
    remaining: Math.max(0, maxLimit - record.used),
  };
}

/**
 * Reinicia la cuota para tests unitarios.
 */
export async function resetBudgetForTesting(namespace?: string): Promise<void> {
  if (namespace) {
    // La memoria se limpia de inmediato (los tests reinician de forma síncrona); luego se espera la cola de escritura.
    memoryBudgets.delete(namespace);
    loading.delete(namespace);
    await writeQueues.get(namespace);
    await unlink(fileFor(namespace)).catch(() => {});
  } else {
    memoryBudgets.clear();
    loading.clear();
    await Promise.all([...writeQueues.values()]);
  }
}
