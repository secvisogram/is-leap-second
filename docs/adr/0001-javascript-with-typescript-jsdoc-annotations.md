# ADR 0001: JavaScript with TypeScript JSDoc Annotations

Date: 2026-05-12

## Status

Accepted

## Context

`is-leap-second` is a small ESM npm library. TypeScript consumers expect `.d.ts`
declaration files so the public API is fully typed.

Two implementation strategies were considered:

1. **Write the package sources in TypeScript**, compile to JavaScript for
   distribution, and ship the compiled output.
2. **Write the package sources in plain JavaScript** with JSDoc type
   annotations, use `tsc` with `checkJs: true` to type-check them, and emit
   declaration files with `emitDeclarationOnly: true`.

Option 1 requires a compilation step before publishing and means the distributed
files are generated artefacts rather than the actual authored source. Consumers
who `npm install` the package end up running transpiled output.

Option 2 lets the distributed files _be_ the authored source. No transpilation
is required; the files listed in `package.json#files` (`index.js`, `lib/`) are
exactly what was written by hand. Type safety is still enforced by the
TypeScript compiler via `checkJs`, and TypeScript consumers receive complete
type information through the generated `dist/**/*.d.ts` declarations (referenced
by `package.json#exports.types`).

Some tooling in the repository - the test file (`index.test.ts`) and the
maintenance script (`scripts/update.ts`) - genuinely benefits from full
TypeScript syntax (e.g. native `import type`, complex generic expressions).
These files are dev-only and are never part of the published package, so using
real TypeScript there carries no cost to consumers.

## Decision

The package sources (`index.js`, `lib/leapSeconds.js`) are written as plain
JavaScript and annotated with JSDoc type comments. TypeScript checks them at
development time (`checkJs: true`, `strict: true`) and produces declaration
files from them (`emitDeclarationOnly: true`, output to `dist/`).

Files that are not part of the published package - the test suite
(`index.test.ts`) and utility scripts (`scripts/update.ts`) - use real
TypeScript syntax. This gives the test and script authors the full
expressiveness of the TypeScript language without affecting what consumers
receive.

## Consequences

- **Positive**: consumers install and run the exact source that was authored; no
  compile step is needed before publishing (only `tsc -b tsconfig.src.json` to
  emit declarations).
- **Positive**: TypeScript consumers get full type coverage through the
  generated `.d.ts` files; the experience is identical to a TypeScript-native
  package.
- **Positive**: the repository has a single source of truth for each module;
  there are no generated `.js` files to keep in sync with `.ts` sources.
- **Trade-off**: JSDoc annotations are more verbose than inline TypeScript
  syntax for some constructs (e.g. generic types, conditional types).
- **Note**: advanced TypeScript type features that are not directly expressible
  in JSDoc (e.g. mapped types, template literal types) can be defined in
  dedicated `.ts` type-only files and imported into JSDoc annotations via
  `@import` tags or `@typedef {import('./types.js').MyType} MyType`. This keeps
  the distribution artefacts as plain JavaScript while still supporting the full
  TypeScript type system when needed.
