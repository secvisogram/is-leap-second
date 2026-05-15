# ADR 0002: Node.js Built-in Test Runner

Date: 2026-05-15

## Status

Accepted

## Context

`is-leap-second` is a small ESM npm library that requires an automated test
suite. Several test runner options were considered:

1. **Third-party test frameworks** such as Jest, Vitest, or Mocha – widely used,
   rich ecosystems, but each adds at least one runtime `devDependency` and its
   own configuration surface.
2. **Node.js built-in test runner** (`node:test`) – available in every
   sufficiently recent Node.js release without installation, paired with the
   built-in assertion library (`node:assert/strict`).

Because the library is intentionally small and has no production dependencies,
keeping the development toolchain equally lean is desirable. A third-party
framework would be the largest `devDependency` by far and would need to be kept
up to date independently of Node.js itself.

The `node:test` module has been stable since Node.js 20 and supports the
`describe` / `it` / `before` / `after` API that developers familiar with
mainstream frameworks already know. It outputs TAP by default and integrates
directly with coverage tools such as `c8` via `c8 node --test`.

## Decision

The test suite uses the Node.js built-in test runner (`node:test`) together with
the built-in assertion library (`node:assert/strict`). Tests are executed with
`c8 node --test` so that coverage is collected in the same step without an
additional test-framework dependency.

## Consequences

- **Positive**: no test-framework `devDependency` needs to be installed,
  updated, or audited; `node:test` ships with Node.js itself.
- **Positive**: native ESM support without any extra configuration – the library
  is pure ESM and `node:test` handles ESM modules out of the box.
- **Positive**: the familiar `describe` / `it` API keeps test code readable for
  developers coming from Jest or Mocha.
- **Positive**: coverage collection via `c8 node --test` requires no separate
  runner invocation or plugin.
- **Trade-off**: the `node:test` ecosystem (snapshot testing, browser test
  environments, extended matchers) is less mature than that of Vitest or Jest.
  For a focused utility library these capabilities are not required.
