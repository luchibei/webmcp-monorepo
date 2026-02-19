import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packagesDir = resolve(rootDir, "packages");

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertDistPath(value) {
  return typeof value === "string" && value.startsWith("./dist/");
}

async function readWorkspacePackages() {
  const entries = await readdir(packagesDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function main() {
  const packageNames = await readWorkspacePackages();
  const errors = [];
  const warnings = [];

  for (const packageName of packageNames) {
    const manifestPath = resolve(packagesDir, packageName, "package.json");
    const raw = await readFile(manifestPath, "utf-8");
    const pkg = JSON.parse(raw);
    const label = pkg.name ?? packageName;

    if (!isObject(pkg.exports)) {
      errors.push(`${label}: missing exports field.`);
      continue;
    }

    if (typeof pkg.types !== "string" || !assertDistPath(pkg.types)) {
      errors.push(`${label}: types must point to ./dist/*.d.ts.`);
    }

    if (typeof pkg.main !== "string" || !assertDistPath(pkg.main)) {
      errors.push(`${label}: main must point to ./dist/*.js.`);
    }

    if (pkg.sideEffects !== false) {
      warnings.push(`${label}: sideEffects is not false.`);
    }

    for (const [exportKey, exportTarget] of Object.entries(pkg.exports)) {
      if (typeof exportTarget === "string") {
        if (!assertDistPath(exportTarget)) {
          errors.push(`${label}: exports[${exportKey}] should point to ./dist/*.`);
        }
        continue;
      }

      if (!isObject(exportTarget)) {
        errors.push(`${label}: exports[${exportKey}] must be a string or object.`);
        continue;
      }

      if (typeof exportTarget.import !== "string" || !assertDistPath(exportTarget.import)) {
        errors.push(`${label}: exports[${exportKey}].import must point to ./dist/*.js.`);
      }

      if (typeof exportTarget.types !== "string" || !assertDistPath(exportTarget.types)) {
        errors.push(`${label}: exports[${exportKey}].types must point to ./dist/*.d.ts.`);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn("Manifest warnings:");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error("Manifest check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Manifest checks passed for ${packageNames.length} packages.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown manifest check failure.";
  console.error(message);
  process.exit(1);
});
