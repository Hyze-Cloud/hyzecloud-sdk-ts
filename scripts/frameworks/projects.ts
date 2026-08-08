/**
 * Minimal but real projects, one per framework the platform detector knows.
 * Each project must (a) be detected as `expectedKind` by inspect-env and
 * (b) build + start with `startupCommand: "auto"` on the platform.
 *
 * `marker` is the string the running app must return on `path` (HTTP check).
 */

export type FrameworkProject = {
  /** Stable id — also used as zip file name and subdomain prefix. */
  id: string;
  /** Human-readable label for reports. */
  name: string;
  runtime: "node" | "bun" | "python";
  /** Kind the detector must return for this project. */
  expectedKind: string;
  /** Port the app listens on (also the exposePort used on deploy). */
  exposePort: number;
  /** RAM requested for the app (matches detector defaults). */
  memoryMB: number;
  /** HTTP path probed after the app is running. */
  path: string;
  /** Substring expected in the HTTP response body. */
  marker: string;
  files: Array<{ name: string; content: string }>;
};

const pkg = (json: Record<string, unknown>) => JSON.stringify(json, null, 2);

export const FRAMEWORK_PROJECTS: FrameworkProject[] = [
  {
    id: "next",
    name: "Next.js",
    runtime: "node",
    expectedKind: "next",
    exposePort: 3000,
    memoryMB: 2048,
    path: "/",
    marker: "hyze next",
    files: [
      {
        name: "package.json",
        content: pkg({
          name: "hyze-fw-next",
          version: "1.0.0",
          private: true,
          scripts: { dev: "next dev", build: "next build", start: "next start" },
          dependencies: { next: "^15.1.0", react: "^19.0.0", "react-dom": "^19.0.0" },
        }),
      },
      { name: "next.config.mjs", content: "export default {};\n" },
      {
        name: "app/layout.jsx",
        content: [
          "export default function RootLayout({ children }) {",
          "  return (",
          "    <html lang=\"en\">",
          "      <body>{children}</body>",
          "    </html>",
          "  );",
          "}",
          "",
        ].join("\n"),
      },
      {
        name: "app/page.jsx",
        content: 'export default function Home() {\n  return <h1>hyze next</h1>;\n}\n',
      },
    ],
  },
  {
    id: "vite",
    name: "Vite + React",
    runtime: "node",
    expectedKind: "vite",
    exposePort: 3000,
    memoryMB: 1024,
    path: "/",
    marker: "hyze vite",
    files: [
      {
        name: "package.json",
        content: pkg({
          name: "hyze-fw-vite",
          version: "1.0.0",
          private: true,
          type: "module",
          scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
          dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
          devDependencies: { vite: "^6.0.0", "@vitejs/plugin-react": "^4.3.0" },
        }),
      },
      {
        name: "vite.config.ts",
        content: [
          'import { defineConfig } from "vite";',
          'import react from "@vitejs/plugin-react";',
          "",
          "export default defineConfig({ plugins: [react()] });",
          "",
        ].join("\n"),
      },
      {
        name: "index.html",
        content: [
          "<!doctype html>",
          '<html lang="en">',
          "  <head>",
          '    <meta charset="UTF-8" />',
          '    <title>hyze vite</title>',
          "  </head>",
          "  <body>",
          '    <div id="root"></div>',
          '    <script type="module" src="/src/main.tsx"></script>',
          "  </body>",
          "</html>",
          "",
        ].join("\n"),
      },
      {
        name: "src/main.tsx",
        content: [
          'import { createRoot } from "react-dom/client";',
          'import App from "./App";',
          "",
          'createRoot(document.getElementById("root")!).render(<App />);',
          "",
        ].join("\n"),
      },
      {
        name: "src/App.tsx",
        content: 'export default function App() {\n  return <h1>hyze vite</h1>;\n}\n',
      },
    ],
  },
  {
    id: "nuxt",
    name: "Nuxt",
    runtime: "node",
    expectedKind: "nuxt",
    exposePort: 3000,
    memoryMB: 1024,
    path: "/",
    marker: "hyze nuxt",
    files: [
      {
        name: "package.json",
        content: pkg({
          name: "hyze-fw-nuxt",
          version: "1.0.0",
          private: true,
          scripts: {
            dev: "nuxt dev",
            build: "nuxt build",
            preview: "nuxt preview",
            start: "node .output/server/index.mjs",
          },
          devDependencies: { nuxt: "^3.17.0" },
        }),
      },
      { name: "nuxt.config.ts", content: "export default defineNuxtConfig({});\n" },
      {
        name: "app.vue",
        content: "<template>\n  <h1>hyze nuxt</h1>\n</template>\n",
      },
    ],
  },
  {
    id: "astro",
    name: "Astro",
    runtime: "node",
    expectedKind: "astro",
    exposePort: 4321,
    memoryMB: 1024,
    path: "/",
    marker: "hyze astro",
    files: [
      {
        name: "package.json",
        content: pkg({
          name: "hyze-fw-astro",
          version: "1.0.0",
          private: true,
          scripts: { dev: "astro dev", build: "astro build", preview: "astro preview" },
          devDependencies: { astro: "^5.0.0" },
        }),
      },
      {
        name: "astro.config.mjs",
        content: [
          'import { defineConfig } from "astro/config";',
          "",
          "export default defineConfig({});",
          "",
        ].join("\n"),
      },
      {
        name: "src/pages/index.astro",
        content: [
          "---",
          "---",
          "",
          "<html lang=\"en\">",
          "  <body>",
          "    <h1>hyze astro</h1>",
          "  </body>",
          "</html>",
          "",
        ].join("\n"),
      },
    ],
  },
  {
    id: "remix",
    name: "Remix (Vite)",
    runtime: "node",
    expectedKind: "remix",
    exposePort: 3000,
    memoryMB: 1024,
    path: "/",
    marker: "hyze remix",
    files: [
      {
        name: "package.json",
        content: pkg({
          name: "hyze-fw-remix",
          version: "1.0.0",
          private: true,
          type: "module",
          scripts: {
            dev: "remix vite:dev",
            build: "remix vite:build",
            start: "remix-serve ./build/server/index.js",
          },
          dependencies: {
            react: "^18.3.0",
            "react-dom": "^18.3.0",
            "@remix-run/react": "^2.15.0",
            "@remix-run/node": "^2.15.0",
            "@remix-run/serve": "^2.15.0",
            // The Remix CLI auto-installs isbot unless it is already present;
            // that nested install prunes devDeps under NODE_ENV=production
            // and breaks the vite build. Keep it declared.
            isbot: "^4.4.0",
          },
          devDependencies: { "@remix-run/dev": "^2.15.0", vite: "^5.4.0" },
        }),
      },
      {
        name: "vite.config.ts",
        content: [
          'import { vitePlugin as remix } from "@remix-run/dev";',
          'import { defineConfig } from "vite";',
          "",
          "export default defineConfig({ plugins: [remix()] });",
          "",
        ].join("\n"),
      },
      {
        name: "tsconfig.json",
        content: pkg({
          compilerOptions: {
            jsx: "react-jsx",
            lib: ["DOM", "DOM.Iterable", "ES2022"],
            module: "ES2022",
            moduleResolution: "bundler",
            target: "ES2022",
            strict: true,
            skipLibCheck: true,
            noEmit: true,
          },
          include: ["**/*.ts", "**/*.tsx"],
        }),
      },
      {
        name: "app/root.tsx",
        content: [
          'import { Outlet } from "@remix-run/react";',
          "",
          "export default function Root() {",
          "  return (",
          "    <html lang=\"en\">",
          "      <body>",
          "        <Outlet />",
          "      </body>",
          "    </html>",
          "  );",
          "}",
          "",
        ].join("\n"),
      },
      {
        name: "app/routes/_index.tsx",
        content: [
          "export default function Index() {",
          "  return <h1>hyze remix</h1>;",
          "}",
          "",
        ].join("\n"),
      },
    ],
  },
  {
    id: "sveltekit",
    name: "SvelteKit (adapter-node)",
    runtime: "node",
    expectedKind: "sveltekit",
    exposePort: 3000,
    memoryMB: 1024,
    path: "/",
    marker: "hyze sveltekit",
    files: [
      {
        name: "package.json",
        content: pkg({
          name: "hyze-fw-sveltekit",
          version: "1.0.0",
          private: true,
          type: "module",
          scripts: { dev: "vite dev", build: "vite build", preview: "vite preview" },
          dependencies: { "@sveltejs/adapter-node": "^5.2.0" },
          devDependencies: {
            "@sveltejs/kit": "^2.5.0",
            "@sveltejs/vite-plugin-svelte": "^3.1.0",
            svelte: "^4.2.0",
            vite: "^5.4.0",
          },
        }),
      },
      {
        name: "svelte.config.js",
        content: [
          'import adapter from "@sveltejs/adapter-node";',
          "",
          "export default {",
          "  kit: { adapter: adapter() },",
          "};",
          "",
        ].join("\n"),
      },
      {
        name: "vite.config.ts",
        content: [
          'import { sveltekit } from "@sveltejs/kit/vite";',
          'import { defineConfig } from "vite";',
          "",
          "export default defineConfig({ plugins: [sveltekit()] });",
          "",
        ].join("\n"),
      },
      {
        name: "src/app.html",
        content: [
          "<!doctype html>",
          '<html lang="en">',
          "  <head>",
          '    <meta charset="utf-8" />',
          "    %sveltekit.head%",
          "  </head>",
          "  <body>",
          "    %sveltekit.body%",
          "  </body>",
          "</html>",
          "",
        ].join("\n"),
      },
      {
        name: "src/routes/+page.svelte",
        content: "<h1>hyze sveltekit</h1>\n",
      },
    ],
  },
  {
    id: "angular",
    name: "Angular",
    runtime: "node",
    expectedKind: "angular",
    exposePort: 4000,
    memoryMB: 1024,
    path: "/",
    marker: "hyze angular",
    files: [
      {
        name: "package.json",
        content: pkg({
          name: "hyze-fw-angular",
          version: "1.0.0",
          private: true,
          scripts: { ng: "ng", start: "ng serve", build: "ng build" },
          dependencies: {
            "@angular/common": "^17.3.0",
            "@angular/compiler": "^17.3.0",
            "@angular/core": "^17.3.0",
            "@angular/platform-browser": "^17.3.0",
            "@angular/platform-browser-dynamic": "^17.3.0",
            rxjs: "~7.8.0",
            tslib: "^2.3.0",
            "zone.js": "~0.14.0",
          },
          devDependencies: {
            "@angular-devkit/build-angular": "^17.3.0",
            "@angular/cli": "^17.3.0",
            "@angular/compiler-cli": "^17.3.0",
            typescript: "~5.4.0",
          },
        }),
      },
      {
        name: "angular.json",
        content: pkg({
          $schema: "./node_modules/@angular/cli/lib/config/schema.json",
          version: 1,
          newProjectRoot: "projects",
          projects: {
            app: {
              projectType: "application",
              root: "",
              sourceRoot: "src",
              prefix: "app",
              architect: {
                build: {
                  builder: "@angular-devkit/build-angular:browser",
                  options: {
                    outputPath: "dist",
                    index: "src/index.html",
                    main: "src/main.ts",
                    polyfills: ["zone.js"],
                    tsConfig: "tsconfig.app.json",
                    assets: [],
                    styles: ["src/styles.css"],
                    scripts: [],
                  },
                  configurations: {
                    production: { budgets: [], outputHashing: "all" },
                  },
                },
                serve: {
                  builder: "@angular-devkit/build-angular:dev-server",
                  options: { buildTarget: "app:build" },
                  configurations: {
                    production: { buildTarget: "app:build:production" },
                  },
                },
              },
            },
          },
        }),
      },
      {
        name: "tsconfig.app.json",
        content: pkg({
          compilerOptions: {
            target: "ES2022",
            module: "ES2022",
            moduleResolution: "bundler",
            experimentalDecorators: true,
            useDefineForClassFields: false,
            strict: true,
            skipLibCheck: true,
            lib: ["ES2022", "DOM"],
          },
          include: ["src/**/*.ts"],
        }),
      },
      {
        name: "src/main.ts",
        content: [
          'import { bootstrapApplication } from "@angular/platform-browser";',
          'import { Component } from "@angular/core";',
          "",
          "@Component({",
          '  selector: "app-root",',
          "  standalone: true,",
          '  template: "<h1>hyze angular</h1>",',
          "})",
          "export class AppComponent {}",
          "",
          "bootstrapApplication(AppComponent).catch((err) => console.error(err));",
          "",
        ].join("\n"),
      },
      {
        name: "src/index.html",
        content: [
          "<!doctype html>",
          '<html lang="en">',
          "  <head>",
          '    <meta charset="utf-8" />',
          '    <title>hyze angular</title>',
          '    <base href="/" />',
          "  </head>",
          "  <body>",
          "    <app-root></app-root>",
          "  </body>",
          "</html>",
          "",
        ].join("\n"),
      },
      { name: "src/styles.css", content: "/* hyze angular */\n" },
    ],
  },
  {
    id: "fastapi",
    name: "FastAPI",
    runtime: "python",
    expectedKind: "fastapi",
    exposePort: 8000,
    memoryMB: 512,
    path: "/",
    marker: "hyze fastapi",
    files: [
      { name: "requirements.txt", content: "fastapi\nuvicorn\n" },
      {
        name: "main.py",
        content: [
          "from fastapi import FastAPI",
          "",
          "app = FastAPI()",
          "",
          "",
          '@app.get("/")',
          "def root():",
          '    return {"message": "hyze fastapi"}',
          "",
        ].join("\n"),
      },
    ],
  },
  {
    id: "flask",
    name: "Flask",
    runtime: "python",
    expectedKind: "flask",
    exposePort: 5000,
    memoryMB: 512,
    path: "/",
    marker: "hyze flask",
    files: [
      { name: "requirements.txt", content: "flask\n" },
      {
        name: "main.py",
        content: [
          "from flask import Flask",
          "",
          "app = Flask(__name__)",
          "",
          "",
          "@app.route(\"/\")",
          "def root():",
          '    return "hyze flask"',
          "",
        ].join("\n"),
      },
    ],
  },
  {
    id: "django",
    name: "Django",
    runtime: "python",
    expectedKind: "django",
    exposePort: 8000,
    memoryMB: 512,
    path: "/",
    marker: "hyze django",
    files: [
      { name: "requirements.txt", content: "Django>=5.0\n" },
      {
        name: "manage.py",
        content: [
          "#!/usr/bin/env python",
          "import os",
          "import sys",
          "",
          "if __name__ == \"__main__\":",
          '    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")',
          "    from django.core.management import execute_from_command_line",
          "",
          "    execute_from_command_line(sys.argv)",
          "",
        ].join("\n"),
      },
      { name: "core/__init__.py", content: "" },
      {
        name: "core/settings.py",
        content: [
          'SECRET_KEY = "hyze-framework-test"',
          "DEBUG = False",
          'ALLOWED_HOSTS = ["*"]',
          "INSTALLED_APPS = []",
          "MIDDLEWARE = []",
          'ROOT_URLCONF = "core.urls"',
          "TEMPLATES = []",
          "WSGI_APPLICATION = \"core.wsgi.application\"",
          "DATABASES = {}",
          "USE_TZ = True",
          "",
        ].join("\n"),
      },
      {
        name: "core/urls.py",
        content: [
          "from django.http import HttpResponse",
          "from django.urls import path",
          "",
          "",
          "def index(request):",
          '    return HttpResponse("hyze django")',
          "",
          "urlpatterns = [path(\"\", index)]",
          "",
        ].join("\n"),
      },
    ],
  },
  {
    id: "python",
    name: "Python (generic)",
    runtime: "python",
    expectedKind: "python",
    exposePort: 3000,
    memoryMB: 512,
    path: "/",
    marker: "hyze python",
    files: [
      {
        name: "main.py",
        content: [
          "import os",
          "from http.server import BaseHTTPRequestHandler, HTTPServer",
          "",
          "",
          "class Handler(BaseHTTPRequestHandler):",
          "    def do_GET(self):",
          '        body = b"hyze python\\n"',
          "        self.send_response(200)",
          '        self.send_header("Content-Type", "text/plain")',
          '        self.send_header("Content-Length", str(len(body)))',
          "        self.end_headers()",
          "        self.wfile.write(body)",
          "",
          "    def log_message(self, *args):",
          "        pass",
          "",
          "",
          "if __name__ == \"__main__\":",
          '    port = int(os.environ.get("PORT", "3000"))',
          "    HTTPServer((\"0.0.0.0\", port), Handler).serve_forever()",
          "",
        ].join("\n"),
      },
    ],
  },
  {
    id: "static",
    name: "Static HTML",
    runtime: "node",
    expectedKind: "static",
    exposePort: 3000,
    memoryMB: 256,
    path: "/",
    marker: "hyze static",
    files: [
      {
        name: "index.html",
        content: [
          "<!doctype html>",
          '<html lang="en">',
          "  <body>",
          "    <h1>hyze static</h1>",
          "  </body>",
          "</html>",
          "",
        ].join("\n"),
      },
      {
        name: "package.json",
        content: pkg({
          name: "hyze-fw-static",
          version: "1.0.0",
          private: true,
          scripts: { start: "serve ." },
        }),
      },
    ],
  },
  {
    id: "node-api",
    name: "Node.js API",
    runtime: "node",
    expectedKind: "node-api",
    exposePort: 3000,
    memoryMB: 512,
    path: "/",
    marker: "hyze node",
    files: [
      {
        name: "package.json",
        content: pkg({
          name: "hyze-fw-node-api",
          version: "1.0.0",
          private: true,
          main: "server.js",
          scripts: { start: "node server.js" },
        }),
      },
      {
        name: "server.js",
        content: [
          'const http = require("http");',
          "const port = Number(process.env.PORT || process.env.EXPOSE_PORT || 3000);",
          "const server = http.createServer((req, res) => {",
          '  res.writeHead(200, { "Content-Type": "text/plain" });',
          '  res.end("hyze node\\n");',
          "});",
          "server.listen(port, () => {",
          '  console.log("hyze node-api listening on", port);',
          "});",
          "",
        ].join("\n"),
      },
    ],
  },
];
