#!/usr/bin/env bun
/**
 * Drift check: toda rota que o SDK chama ainda existe na API?
 *
 * Por que existe: este repo é público e o pacote vai pro npm, mas a API vive em outro
 * repositório. Nada impede a API de renomear/remover um endpoint e o SDK publicado passar a
 * dar 404 em runtime — drift silencioso. Este check fecha isso sem precisar de API key:
 *
 *   - extrai (método, rota) dos arquivos em src/resources/
 *   - chama cada rota SEM autenticação, com o método certo e um placeholder nos parâmetros
 *   - 404 = a rota não existe mais  -> FALHA
 *     qualquer outro status (401/400/403/405/…) = a rota existe (só pede auth/body válido)
 *
 * A distinção é confiável porque a autenticação roda antes da resolução da rota nesta API.
 * Controle negativo: uma rota inventada devolve 404 (tests do job "API routes (live)").
 *
 * Uso:  bun run scripts/check-api-routes.ts [--base-url https://api.hyzecloud.com/api]
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

function baseUrl(): string {
  const i = process.argv.indexOf("--base-url");
  return (i > -1 ? process.argv[i + 1] : undefined) ?? "https://api.hyzecloud.com/api";
}

interface Call {
  method: string;
  path: string;
  source: string;
}

/** Extrai as chamadas do client de cada resource (são literais, por convenção do repo). */
async function collectCalls(dir: string): Promise<Call[]> {
  const calls: Call[] = [];
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".ts"))) {
    const text = await readFile(join(dir, file), "utf8");
    const re = /this\.client\.(get|post|put|patch|delete|request)\s*(?:<[^>]*>)?\s*\(\s*([`"'])([\s\S]*?)\2/gu;
    for (const match of text.matchAll(re)) {
      const [, fn, , raw] = match;
      if (!raw.startsWith("/")) continue;
      let method = fn.toUpperCase();
      if (fn === "request") {
        // request("/apps/deploy", { method: "POST", … })
        const tail = text.slice(match.index ?? 0, (match.index ?? 0) + 300);
        method = /method:\s*"([A-Z]+)"/.exec(tail)?.[1] ?? "GET";
      }
      calls.push({
        method,
        path: raw.replace(/\$\{[^}]*\}/g, PLACEHOLDER),
        source: `src/resources/${file}`,
      });
    }
  }
  return calls.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

async function main() {
  const base = baseUrl().replace(/\/+$/, "");
  const calls = await collectCalls(new URL("../src/resources", import.meta.url).pathname);

  if (calls.length === 0) {
    console.error("nenhuma chamada encontrada em src/resources — o extrator quebrou?");
    process.exit(1);
  }

  const gone: Call[] = [];
  const rows: string[] = [];

  await Promise.all(
    calls.map(async (call) => {
      let status = 0;
      try {
        const response = await fetch(`${base}${call.path}`, {
          method: call.method,
          headers: { "content-type": "application/json" },
          body: call.method === "GET" || call.method === "DELETE" ? undefined : "{}",
          redirect: "manual",
          signal: AbortSignal.timeout(20_000),
        });
        status = response.status;
        // não lemos o corpo: rotas de download/stream responderiam 401 de qualquer forma
      } catch (error) {
        console.error(`   ERRO DE REDE em ${call.method} ${call.path}: ${error}`);
        process.exitCode = 1;
        return;
      }
      if (status === 404) gone.push(call);
      rows.push(`${status === 404 ? "404" : status}  ${call.method.padEnd(6)} ${call.path}`);
    }),
  );

  rows.sort();
  for (const row of rows) console.log(`   ${row}`);
  console.log(`\n   ${calls.length} rotas verificadas em ${base}`);

  if (gone.length > 0) {
    console.error(`\nDRIFT: ${gone.length} rota(s) que o SDK chama não existem mais na API:`);
    for (const call of gone) console.error(`   ${call.method} ${call.path}   (${call.source})`);
    console.error("\nCorrija o SDK (ou a API) antes de publicar — cliente publicado com rota morta é 404 pro usuário.");
    process.exit(1);
  }
  console.log("   ok: nenhuma rota do SDK sumiu da API");
}

await main();
