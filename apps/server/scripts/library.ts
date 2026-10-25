/**
 * Curaduría de la biblioteca propia desde la terminal (sin servidor ni claves):
 *   npm run library -w @mus3o/server -- list [pending|approved|rejected]
 *   npm run library -w @mus3o/server -- show <id>
 *   npm run library -w @mus3o/server -- add-glb <archivo.glb> --keywords "sword,blade" [--title "Espada"]
 *   npm run library -w @mus3o/server -- add-recipe <partes.json> --keywords "key" [--title "Llave"]
 *   npm run library -w @mus3o/server -- import <dibujos.json> [--origin ai|manual]   (lote de recetas revisadas, entran aprobadas)
 *   npm run library -w @mus3o/server -- approve|reject|reset|remove <id>
 * Escribe en LIBRARY_DIR (por defecto apps/server/seed/library): lo que apruebes aquí lo versionas con git.
 */
import { readFile } from "node:fs/promises";
import { addGlb, addRecipe, getEntry, importRecipes, libraryDir, listLibrary, removeEntry, setLibraryStatus, type LibraryStatus } from "../src/library";

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const positional = rest.filter((a, i) => !a.startsWith("--") && !rest[i - 1]?.startsWith("--"));
const keywords = () => (flag("keywords") ?? "").split(",");

function line(e: Awaited<ReturnType<typeof getEntry>>) {
  if (!e) return "";
  return `${e.id}  ${e.status.padEnd(8)} ${e.kind.padEnd(6)} ${e.origin.padEnd(13)} usos ${String(e.uses).padStart(3)}  [${e.keywords.join(", ")}] ${e.title}`;
}

async function main() {
  switch (cmd) {
    case "list": {
      const status = (["pending", "approved", "rejected"] as const).find((s) => s === positional[0]);
      const all = await listLibrary(status as LibraryStatus | undefined);
      console.log(all.length ? all.map(line).join("\n") : "(vacía)");
      console.log(`\n${libraryDir()}`);
      return;
    }
    case "show": {
      const e = await getEntry(positional[0] ?? "");
      console.log(e ? JSON.stringify(e, null, 2) : "No encontrada");
      return;
    }
    case "add-glb": {
      const file = positional[0];
      if (!file) throw new Error("Falta el archivo .glb");
      console.log(line(await addGlb({ keywords: keywords(), title: flag("title") ?? "", data: await readFile(file) })));
      return;
    }
    case "add-recipe": {
      const file = positional[0];
      if (!file) throw new Error("Falta el archivo .json con las partes");
      const json = JSON.parse(await readFile(file, "utf8")) as unknown;
      const parts = Array.isArray(json) ? json : (json as { parts?: unknown }).parts;
      console.log(line(await addRecipe({ keywords: keywords(), title: flag("title") ?? "", parts })));
      return;
    }
    case "import": {
      const file = positional[0];
      if (!file) throw new Error("Falta el archivo .json ({ palabra: partes })");
      const origin = flag("origin") === "manual" ? "manual" : "ai";
      const { added, skipped } = await importRecipes(JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>, origin);
      console.log(`${added.length} añadidas, ${skipped.length} omitidas${skipped.length ? ` (${skipped.join(", ")})` : ""}`);
      return;
    }
    case "approve":
    case "reject":
    case "reset": {
      const status = ({ approve: "approved", reject: "rejected", reset: "pending" } as const)[cmd];
      const e = await setLibraryStatus(positional[0] ?? "", status);
      console.log(e ? line(e) : "No encontrada");
      return;
    }
    case "remove":
      console.log((await removeEntry(positional[0] ?? "")) ? "Eliminada" : "No encontrada");
      return;
    default:
      console.log("Comandos: list [estado] | show <id> | add-glb <archivo> --keywords a,b [--title T] | add-recipe <json> --keywords a,b [--title T] | import <json> [--origin ai|manual] | approve|reject|reset|remove <id>");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
