import { leapSeconds } from './lib/leapSeconds.js'

/**
 * RFC 3339 regex capturing:
 *   [1] year, [2] month, [3] day,
 *   [4] hour, [5] minute, [6] second  (integer part only),
 *   [7] timezone  ("Z" | "+HH:MM" | "-HH:MM")
 *
 * See: https://datatracker.ietf.org/doc/html/rfc3339#section-5.6
 */
const RFC3339_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/i

/**
 * Checks whether an RFC 3339 timestamp represents a leap second.
 *
 * A timestamp is a leap second when:
 *  - its seconds field equals 60, **and**
 *  - the UTC-normalised date matches a known historical leap second date
 *    (i.e. the IERS-announced positive leap seconds since 1972).
 *
 * Fractional seconds (e.g. `23:59:60.5`) are accepted; the fraction is
 * discarded after confirming that the integer seconds value is 60.
 *
 * @param {string} timestamp - An RFC 3339 / ISO 8601 timestamp with explicit
 *   timezone offset (e.g. `"2016-12-31T23:59:60Z"`).
 * @returns {boolean} - `true` if the timestamp is a known leap second,
 *   `false` otherwise.
 * @throws {TypeError} - If `timestamp` is not a string.
 */
export function isLeapSecond(timestamp) {
  if (typeof timestamp !== 'string') {
    throw new TypeError(`Expected a string, got ${typeof timestamp}`)
  }

  const utcDate = parseLeapSecond(timestamp)
  return utcDate !== null && leapSeconds.has(utcDate)
}

/**
 * Converts an RFC 3339 timestamp to a Unix millisecond timestamp.
 *
 * For ordinary timestamps the value is equivalent to `new
 * Date(timestamp).getTime()`.
 *
 * For a known leap-second timestamp (seconds field `60` and a UTC-normalised
 * time of `23:59`), the function returns the millisecond value of the leap
 * second itself: `<UTC-date>T23:59:59Z` + 1 000 ms.  This places the leap
 * second one second after the last regular second of the minute, making it
 * possible to order or compare leap-second instants on the Unix timeline.
 *
 * If the timestamp has seconds field `60` but does not match a known historical
 * leap second, it is passed through to `Date` as-is.
 *
 * @param {string} timestamp - An RFC 3339 / ISO 8601 timestamp with explicit
 *   timezone offset (e.g. `"2016-12-31T23:59:60Z"`).
 * @returns {number} - Unix millisecond timestamp for the given instant.
 * @throws {TypeError} - If `timestamp` is not a string.
 */
export function toTime(timestamp) {
  if (typeof timestamp !== 'string') {
    throw new TypeError(`Expected a string, got ${typeof timestamp}`)
  }

  if (!RFC3339_RE.test(timestamp)) return NaN

  const utcDate = parseLeapSecond(timestamp)
  return utcDate === null || !leapSeconds.has(utcDate)
    ? new Date(timestamp).getTime()
    : new Date(`${utcDate}T23:59:59Z`).getTime() + 1000
}

/**
 * Rounds a leap-second RFC 3339 timestamp down to the nearest valid instant
 * accepted by the Temporal API.
 *
 * Because leap seconds (`:60`) are not representable in the Temporal API, this
 * function normalises them to the closest valid instant by rounding **down** to
 * the last nanosecond of the preceding second:
 * `<UTC-date>T23:59:59.999999999Z`.
 *
 * If the input does not represent a leap second (seconds field is not `60`, or
 * the UTC-normalised time is not `23:59`) the timestamp is returned unchanged.
 *
 * @param {string} timestamp - An RFC 3339 / ISO 8601 timestamp with explicit
 *   timezone offset (e.g. `"2016-12-31T23:59:60Z"`).
 * @returns {string} - A Temporal-compatible UTC instant string, or the original
 *   `timestamp` if it is not a leap second.
 * @throws {TypeError} - If `timestamp` is not a string.
 */
export function roundLeapSecond(timestamp) {
  if (typeof timestamp !== 'string') {
    throw new TypeError(`Expected a string, got ${typeof timestamp}`)
  }

  const utcDate = parseLeapSecond(timestamp)
  if (utcDate === null || !leapSeconds.has(utcDate)) return timestamp
  return `${utcDate}T23:59:59.999999999Z`
}

/**
 * Parses an RFC 3339 timestamp and returns the UTC date string ("YYYY-MM-DD")
 * if the timestamp is structured as a leap-second candidate (seconds field is
 * 60 and the UTC-normalised time is 23:59), or `null` otherwise.
 *
 * @param {string} timestamp
 */
function parseLeapSecond(timestamp) {
  const match = RFC3339_RE.exec(timestamp)
  if (!match) return null

  const seconds = Number(match[6])
  if (seconds !== 60) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const tz = String(match[7])

  // Convert local HH:MM to UTC total minutes
  const localMinutes = hour * 60 + minute
  const offsetMinutes = tzOffsetMinutes(tz)
  let utcMinutes = localMinutes - offsetMinutes

  const minutesOfDay = 1440

  // Determine day delta and normalise utcMinutes into [0, 1439].
  // Subtracting a positive offset (e.g. +05:30) can push utcMinutes below 0,
  // meaning the UTC time crossed back into the previous calendar day.
  // Subtracting a negative offset (e.g. -12:00) can push utcMinutes >= 1440,
  // meaning the UTC time crossed forward into the next calendar day. In both
  // cases we record the day shift in deltaDays and wrap utcMinutes back into
  // the valid [0, 1439] range by adding or subtracting one full day.
  let deltaDays = 0
  if (utcMinutes < 0) {
    // UTC time is on the previous calendar day
    deltaDays = -1
    utcMinutes += minutesOfDay
  } else if (utcMinutes >= minutesOfDay) {
    // UTC time is on the next calendar day
    deltaDays = 1
    utcMinutes -= minutesOfDay
  }

  // Leap seconds always occur at 23:59:60 UTC
  if (utcMinutes !== 23 * 60 + 59) return null

  return shiftDate(year, month, day, deltaDays)
}

/**
 * Returns the signed UTC offset in minutes for an RFC 3339 timezone string.
 *
 * @param {string} tz  e.g. "Z", "+05:30", "-08:00"
 */
function tzOffsetMinutes(tz) {
  if (tz.toUpperCase() === 'Z') return 0
  const sign = tz[0] === '+' ? 1 : -1
  const [h = 0, m = 0] = tz.slice(1).split(':').map(Number)
  return sign * (h * 60 + m)
}

/**
 * Pads a number to two digits.
 *
 * @param {number} n
 */
const pad2 = (n) => String(n).padStart(2, '0')

/**
 * Adds `deltaDays` (+1 or -1) to a date given as year/month/day integers and
 * returns the result as a "YYYY-MM-DD" string.
 *
 * @param {number} year
 * @param {number} month  1–12
 * @param {number} day
 * @param {number} deltaDays  -1 | 0 | 1
 */
function shiftDate(year, month, day, deltaDays) {
  const d = new Date(year, month - 1, day + deltaDays)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
