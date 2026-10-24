import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projects = JSON.parse(
  readFileSync(resolve(root, "projects.json"), "utf8"),
);
const archive = readFileSync(resolve(root, "projects.html"), "utf8");
const errors = [];
for (const page of ["index.html", "projects.html"]) {
  const source = readFileSync(resolve(root, page), "utf8");
  if (!source.includes("script-src 'self'"))
    errors.push(`${page}: missing strict script policy`);
  if (/<script\b(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(source))
    errors.push(`${page}: executable inline script`);
  if (/\son[a-z]+\s*=/i.test(source))
    errors.push(`${page}: inline event handler`);
  for (const [, attribute, value] of source.matchAll(
    /\b(href|src)="([^"]+)"/g,
  )) {
    if (/^(https:|mailto:|#)/.test(value)) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      errors.push(`${page}: unsafe ${attribute} protocol`);
      continue;
    }
    const file = resolve(root, value.split("#")[0].split("?")[0]);
    if (!existsSync(file)) errors.push(`${page}: missing ${value}`);
  }
}
for (const project of projects) {
  if (new URL(project.url).protocol !== "https:")
    errors.push(`Unsafe URL for ${project.title}`);
  if (
    !archive.includes(
      project.title.replaceAll("&", "&amp;").replaceAll("'", "&#x27;"),
    )
  ) {
    errors.push(`Static fallback is missing ${project.title}`);
  }
}
const syntax = spawnSync(
  process.execPath,
  ["--check", resolve(root, "main.js")],
  { encoding: "utf8" },
);
if (syntax.status !== 0) errors.push(syntax.stderr);
JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `PASS: 2 pages, ${projects.length} project links, strict CSP, local assets, manifest and JS syntax.`,
);
