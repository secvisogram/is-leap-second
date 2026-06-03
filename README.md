# is-leap-second

Provides a basic check whether an RFC 3339 timestamp is a leap second.

## Installation

```sh
npm install is-leap-second
```

## Usage

```js
import { isLeapSecond } from 'is-leap-second'

isLeapSecond('2016-12-31T23:59:60Z') // true
isLeapSecond('2017-01-01T00:59:60+01:00') // true  (same UTC moment)
isLeapSecond('2016-12-31T23:59:60.5Z') // true  (fractional seconds accepted)
isLeapSecond('2020-06-30T23:59:60Z') // false (not a known leap second date)
isLeapSecond('2016-12-31T23:59:59Z') // false (seconds != 60)
isLeapSecond('not-a-timestamp') // false
```

## API

### `isLeapSecond(timestamp)`

Returns `true` if `timestamp` is a known positive leap second, `false`
otherwise.

**Parameters**

| Name        | Type     | Description                                                                                                                      |
| ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `timestamp` | `string` | An [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) timestamp with an explicit timezone offset, e.g. `"2016-12-31T23:59:60Z"`. |

**Returns** `boolean`

**Throws** `TypeError` if `timestamp` is not a string.

### `toTime(timestamp)`

Converts an RFC 3339 / ISO 8601 timestamp string (with explicit timezone offset)
to a Unix nanosecond timestamp as a `bigint`, handling leap seconds correctly.

- For ordinary timestamps, returns the equivalent of
  `new Date(timestamp).getTime() * 1_000_000n`.
- Fractional seconds are preserved up to 9 digits (nanoseconds). Fractions with
  more than 9 digits are truncated to nanosecond precision.
- For known leap seconds (e.g., `"2016-12-31T23:59:60Z"`), returns the
  nanosecond value for the leap second (i.e., one second after
  `23:59:59`).
- For known leap-second timestamps, any fractional part is ignored (same behavior
  as `isLeapSecond`).
- Returns `null` for invalid or non-leap-second timestamps with `seconds=60`.
- Throws `TypeError` if the input is not a string.

```js
import { toTime } from 'is-leap-second'

toTime('2016-12-31T23:59:60Z') // millisecond value for the leap second
toTime('2024-03-15T12:30:00+02:00') // same as BigInt(new Date(...).getTime()) * 1_000_000n
toTime('not-a-timestamp') // null
toTime(42) // throws TypeError
```

**Parameters**

| Name        | Type     | Description                                                                                                                      |
| ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `timestamp` | `string` | An [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) timestamp with an explicit timezone offset, e.g. `"2016-12-31T23:59:60Z"`. |

**Returns** `bigint | null` — Nanoseconds since the Unix epoch, or `null` if invalid.

**Throws** `TypeError` if `timestamp` is not a string.

### `roundLeapSecond(timestamp)`

Rounds a leap-second RFC 3339 timestamp down to the nearest valid instant
accepted by the [Temporal API](https://tc39.es/proposal-temporal/docs/).

Because leap seconds (`:60`) are not representable in the Temporal API, this
function normalises them to the last nanosecond of the preceding second:
`<UTC-date>T23:59:59.999999999Z`.

If the input is **not** a leap second (seconds field ≠ `60`, or the
UTC-normalised time is not `23:59`, or the date is not a known leap second),
the timestamp is returned **unchanged**.

```js
import { roundLeapSecond } from 'is-leap-second'

roundLeapSecond('2016-12-31T23:59:60Z') // '2016-12-31T23:59:59.999999999Z'
roundLeapSecond('2017-01-01T00:59:60+01:00') // '2016-12-31T23:59:59.999999999Z'
roundLeapSecond('2016-12-31T23:59:60.5Z') // '2016-12-31T23:59:59.999999999Z'
roundLeapSecond('2016-12-31T23:59:59Z') // '2016-12-31T23:59:59Z'  (unchanged)
roundLeapSecond('2020-06-30T23:59:60Z') // '2020-06-30T23:59:60Z'  (not a known leap second, unchanged)
roundLeapSecond('not-a-timestamp') // 'not-a-timestamp'        (unchanged)
```

**Parameters**

| Name        | Type     | Description                                                                                                                      |
| ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `timestamp` | `string` | An [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) timestamp with an explicit timezone offset, e.g. `"2016-12-31T23:59:60Z"`. |

**Returns** `string` — A Temporal-compatible UTC instant string, or the original `timestamp` if it is not a leap second.

**Throws** `TypeError` if `timestamp` is not a string.

### Detection logic

A timestamp is considered a leap second when **both** conditions hold:

1. The seconds field equals `60`.
2. After normalising to UTC, the date and time (`23:59:60 UTC`) match one of the
   leap seconds announced by the IERS.

Timestamps without an explicit timezone (e.g. `"2016-12-31T23:59:60"`) are
**rejected** — RFC 3339 requires a timezone designator.

Fractional seconds (e.g. `"23:59:60.5Z"`) are accepted; only the integer part of
the seconds field is evaluated.

## Known leap seconds

The library contains a hardcoded list of all 27 positive leap seconds up to and
including **2016-12-31**.

Source: [IERS Bulletin C](https://data.iana.org/time-zones/data/leap-seconds.list) / NIST

### Updating the leap second list

When a new leap second is announced, run the following command to fetch the
latest data from the IANA time zone database and regenerate `lib/leapSeconds.js`:

```sh
npm run update-leap-seconds
```

## Contributing

### Source language

Package sources (`index.js`, `lib/`) are plain JavaScript with
[JSDoc](https://jsdoc.app/) type annotations. No compilation step is needed
before publishing — what you author is what gets distributed.

The key benefit of this approach is that the package can be linked directly into
other projects with `npm link` without releasing a new version first. This makes
it practical to test new features end-to-end in a consuming project before
committing to a release.

The test suite (`index.test.ts`) and maintenance scripts (`scripts/update.ts`)
are dev-only and never published, so they use real TypeScript syntax.

### Type-checking and declaration files

TypeScript checks the JavaScript sources via `checkJs: true` and emits
declaration files to `dist/` with `emitDeclarationOnly: true`. No `.js` output
is produced. The `prepublishOnly` script in `package.json` runs this
automatically before every `npm publish`, but you can also run it manually to
verify types:

```sh
tsc -b tsconfig.src.json
```

### Advanced TypeScript types

JSDoc cannot express every TypeScript feature (e.g. mapped types, template
literal types). When you need them, define the types in a dedicated `.ts`
type-only file and import them into JSDoc annotations via `@import` or
`@typedef {import('./types.js').MyType} MyType`. This keeps the distributed
files as plain JavaScript while still supporting the full TypeScript type system.

### Test runner

The test suite uses the Node.js built-in test runner (`node:test`) together with
the built-in assertion library (`node:assert/strict`). No third-party test
framework is installed.

Run the tests with coverage:

```sh
npm test
```

This executes `c8 node --test`, collecting coverage in the same step without a
separate runner invocation. The familiar `describe` / `it` API is used throughout
— the style will be recognisable to developers coming from Jest or Mocha.

Because `node:test` is part of Node.js itself, there is no test-framework
dependency to install, update, or audit. The minimum required Node.js version is
**20**, where `node:test` became stable.

## License

[Apache-2.0](LICENSE)
