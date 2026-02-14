#!/usr/bin/env node

/**
 * Check for dependency version mismatches across all package.json files in the monorepo.
 *
 * This script scans all package.json files and ensures that if the same dependency
 * appears in multiple packages, they all use the same version.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

/**
 * Recursively find all package.json files in a directory
 */
function findPackageJsonFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    // Skip node_modules and dist directories
    if (entry === "node_modules" || entry === "dist" || entry === ".git") {
      continue;
    }

    try {
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        findPackageJsonFiles(fullPath, files);
      } else if (entry === "package.json") {
        files.push(fullPath);
      }
    } catch (error) {
      // Skip files we can't read
      continue;
    }
  }

  return files;
}

function main() {
  const rootDir = process.cwd();

  // Find all package.json files
  const packageJsonFiles = findPackageJsonFiles(rootDir);

  console.log(`Found ${packageJsonFiles.length} package.json files`);

  // Map to store: dependency -> { version -> [files] }
  const dependencyVersions = new Map();

  // Read all package.json files and collect dependency versions
  for (const file of packageJsonFiles) {
    try {
      const content = JSON.parse(readFileSync(file, "utf-8"));
      const relativePath = relative(rootDir, file);

      // Process both dependencies and devDependencies
      const allDeps = {
        ...content.dependencies,
        ...content.devDependencies,
      };

      for (const [depName, version] of Object.entries(allDeps)) {
        // Skip workspace protocol dependencies (e.g., "workspace:*")
        if (version.startsWith("workspace:")) {
          continue;
        }

        if (!dependencyVersions.has(depName)) {
          dependencyVersions.set(depName, new Map());
        }

        const versionMap = dependencyVersions.get(depName);
        if (!versionMap.has(version)) {
          versionMap.set(version, []);
        }

        versionMap.get(version).push(relativePath);
      }
    } catch (error) {
      console.error(`${RED}Error reading ${file}: ${error.message}${RESET}`);
      process.exit(1);
    }
  }

  // Check for mismatches
  const mismatches = [];

  for (const [depName, versionMap] of dependencyVersions.entries()) {
    if (versionMap.size > 1) {
      mismatches.push({
        name: depName,
        versions: Array.from(versionMap.entries()).map(([version, files]) => ({
          version,
          files,
        })),
      });
    }
  }

  // Report results
  if (mismatches.length > 0) {
    console.error(`\n${RED}❌ Dependency version mismatches found:${RESET}\n`);

    for (const mismatch of mismatches) {
      console.error(`${YELLOW}${mismatch.name}:${RESET}`);
      for (const { version, files } of mismatch.versions) {
        console.error(`  - ${version}`);
        for (const file of files) {
          console.error(`      ${file}`);
        }
      }
      console.error("");
    }

    console.error(
      `${RED}Please ensure all packages use the same version for shared dependencies.${RESET}\n`,
    );
    process.exit(1);
  }

  console.log(`\n${GREEN}✅ All dependency versions are consistent across packages.${RESET}\n`);
  process.exit(0);
}

main();
