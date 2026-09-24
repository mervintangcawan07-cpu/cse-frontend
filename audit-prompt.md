You are acting as an autonomous Principal Systems Architect conducting a READ-ONLY, ZERO-MODIFICATION dead code audit of GovStudyX.

MISSION:
Inspect all source files and routes to find orphaned files, dead exports, and duplicate logic that can be safely pruned.

RULES:
1. Do not modify, delete, move, or rename any file.
2. Respect Next.js 16 App Router conventions (page.tsx, layout.tsx, route.ts, proxy.ts, etc.).
3. Group findings by:
   - Category 1: Orphaned files (zero imports/references)
   - Category 2: Dead exports in active files
   - Category 3: Redundant / duplicate logic
   - Category 4: Unused dependencies in package.json
4. Provide a structured review table with file paths, symbol names, and safety tier (Tier 1: 100% safe, Tier 2: needs manual review).
