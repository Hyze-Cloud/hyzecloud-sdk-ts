/**
 * Generates tests/frameworks/<id>.zip (one per supported framework) plus a
 * manifest.json that describes what each zip should be detected as.
 *
 *   bun run frameworks:generate
 *
 * The zips are committed to the repo so the framework smoke test runs against
 * the exact same fixtures on every machine.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FRAMEWORK_PROJECTS } from "./projects";
import { zipStore } from "./zip";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../tests/frameworks");

type ManifestEntry = {
  id: string;
  name: string;
  file: string;
  runtime: string;
  expectedKind: string;
  exposePort: number;
  memoryMB: number;
  path: string;
  marker: string;
};

const manifest: ManifestEntry[] = [];

await mkdir(outDir, { recursive: true });

for (const project of FRAMEWORK_PROJECTS) {
  const zip = zipStore(project.files);
  const file = `${project.id}.zip`;
  await writeFile(path.join(outDir, file), zip);
  manifest.push({
    id: project.id,
    name: project.name,
    file,
    runtime: project.runtime,
    expectedKind: project.expectedKind,
    exposePort: project.exposePort,
    memoryMB: project.memoryMB,
    path: project.path,
    marker: project.marker,
  });
  console.log(
    `${project.id.padEnd(10)} ${String(zip.byteLength).padStart(6)} bytes  ->  tests/frameworks/${file}`,
  );
}

await writeFile(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), frameworks: manifest }, null, 2),
);

console.log(`\nwrote ${manifest.length} zips + manifest.json to ${outDir}`);
