import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isLeapSecond, roundLeapSecond, toTime } from './index.js'

describe('isLeapSecond', () => {
  describe('known leap seconds', () => {
    it('accepts the most recent leap second in UTC', () => {
      assert.equal(isLeapSecond('2016-12-31T23:59:60Z'), true)
    })

    it('accepts a leap second expressed with a positive offset (+01:00)', () => {
      // 2017-01-01T00:59:60+01:00 == 2016-12-31T23:59:60Z
      assert.equal(isLeapSecond('2017-01-01T00:59:60+01:00'), true)
    })

    it('accepts a leap second expressed with a negative offset (-05:00)', () => {
      // 2016-12-31T18:59:60-05:00 == 2016-12-31T23:59:60Z
      assert.equal(isLeapSecond('2016-12-31T18:59:60-05:00'), true)
    })

    it('accepts a leap second with fractional seconds', () => {
      assert.equal(isLeapSecond('2016-12-31T23:59:60.5Z'), true)
    })

    it('accepts the first ever leap second (1972-06-30)', () => {
      assert.equal(isLeapSecond('1972-06-30T23:59:60Z'), true)
    })

    it('accepts a leap second with a large positive offset that shifts the date back (+05:30)', () => {
      // 2012-07-01T05:29:60+05:30 == 2012-06-30T23:59:60Z
      assert.equal(isLeapSecond('2012-07-01T05:29:60+05:30'), true)
    })

    it('accepts a leap second with offset that shifts the date forward (-01:00)', () => {
      // 2015-06-30T22:59:60-01:00 == 2015-06-30T23:59:60Z
      assert.equal(isLeapSecond('2015-06-30T22:59:60-01:00'), true)
    })

    it('accepts a leap second with a large negative offset that keeps UTC on the same day (-12:00)', () => {
      // 2016-12-31T11:59:60-12:00 == 2016-12-31T23:59:60Z
      assert.equal(isLeapSecond('2016-12-31T11:59:60-12:00'), true)
    })
  })

  describe('non-leap-second timestamps', () => {
    it('rejects a valid UTC timestamp with seconds=59', () => {
      assert.equal(isLeapSecond('2016-12-31T23:59:59Z'), false)
    })

    it('rejects a correctly-timed seconds=60 on a non-leap-second date', () => {
      assert.equal(isLeapSecond('2020-06-30T23:59:60Z'), false)
    })

    it('rejects a timestamp where seconds=60 but wrong UTC minute (not 23:59)', () => {
      assert.equal(isLeapSecond('2016-12-31T22:59:60Z'), false)
    })

    it('rejects a seconds=60 timestamp where a large negative offset shifts UTC to the next calendar day', () => {
      // 2016-12-30T12:00:60-12:00 → UTC 2016-12-31T00:00:60Z (UTC date is 2016-12-31 but UTC time is 00:00, not 23:59)
      assert.equal(isLeapSecond('2016-12-30T12:00:60-12:00'), false)
    })
  })

  describe('malformed / invalid input', () => {
    it('returns false for a completely invalid string', () => {
      assert.equal(isLeapSecond('not-a-timestamp'), false)
    })

    it('returns false for a timestamp missing the timezone', () => {
      assert.equal(isLeapSecond('2016-12-31T23:59:60'), false)
    })

    it('returns false for an empty string', () => {
      assert.equal(isLeapSecond(''), false)
    })

    it('throws TypeError for a non-string input (number)', () => {
      assert.throws(() => isLeapSecond(42 as any), TypeError)
    })

    it('throws TypeError for null', () => {
      assert.throws(() => isLeapSecond(null as any), TypeError)
    })

    it('throws TypeError for undefined', () => {
      assert.throws(() => isLeapSecond(undefined as any), TypeError)
    })
  })
})

describe('roundLeapSecond', () => {
  describe('known leap seconds', () => {
    it('rounds a UTC leap second down to 23:59:59.999999999Z', () => {
      assert.equal(
        roundLeapSecond('2016-12-31T23:59:60Z'),
        '2016-12-31T23:59:59.999999999Z',
      )
    })

    it('normalises a positive-offset leap second (+01:00) and rounds down', () => {
      // 2017-01-01T00:59:60+01:00 == 2016-12-31T23:59:60Z
      assert.equal(
        roundLeapSecond('2017-01-01T00:59:60+01:00'),
        '2016-12-31T23:59:59.999999999Z',
      )
    })

    it('normalises a negative-offset leap second (-05:00) and rounds down', () => {
      // 2016-12-31T18:59:60-05:00 == 2016-12-31T23:59:60Z
      assert.equal(
        roundLeapSecond('2016-12-31T18:59:60-05:00'),
        '2016-12-31T23:59:59.999999999Z',
      )
    })

    it('ignores fractional seconds in the input and outputs full nanosecond precision', () => {
      assert.equal(
        roundLeapSecond('2016-12-31T23:59:60.5Z'),
        '2016-12-31T23:59:59.999999999Z',
      )
    })

    it('handles a large positive offset that shifts the UTC date back (+05:30)', () => {
      // 2012-07-01T05:29:60+05:30 == 2012-06-30T23:59:60Z
      assert.equal(
        roundLeapSecond('2012-07-01T05:29:60+05:30'),
        '2012-06-30T23:59:59.999999999Z',
      )
    })
  })

  describe('pass-through (non-leap-second input)', () => {
    it('returns input unchanged when seconds=59', () => {
      assert.equal(
        roundLeapSecond('2016-12-31T23:59:59Z'),
        '2016-12-31T23:59:59Z',
      )
    })

    it('returns input unchanged when seconds=60 but wrong UTC minute', () => {
      assert.equal(
        roundLeapSecond('2016-12-31T22:59:60Z'),
        '2016-12-31T22:59:60Z',
      )
    })

    it('returns input unchanged when a large negative offset shifts UTC to the next calendar day', () => {
      // 2016-12-30T12:00:60-12:00 → UTC 2016-12-31T00:00:60Z (UTC time is 00:00, not 23:59)
      assert.equal(
        roundLeapSecond('2016-12-30T12:00:60-12:00'),
        '2016-12-30T12:00:60-12:00',
      )
    })

    it('returns input unchanged for a non-leap-second date with seconds=60', () => {
      assert.equal(
        roundLeapSecond('2020-06-30T23:59:60Z'),
        '2020-06-30T23:59:60Z',
      )
    })

    it('returns input unchanged for an unparseable string', () => {
      assert.equal(roundLeapSecond('not-a-timestamp'), 'not-a-timestamp')
    })

    it('returns input unchanged for a timestamp missing the timezone', () => {
      assert.equal(
        roundLeapSecond('2016-12-31T23:59:60'),
        '2016-12-31T23:59:60',
      )
    })
  })

  describe('invalid input', () => {
    it('throws TypeError for a number', () => {
      assert.throws(() => roundLeapSecond(42 as any), TypeError)
    })

    it('throws TypeError for null', () => {
      assert.throws(() => roundLeapSecond(null as any), TypeError)
    })

    it('throws TypeError for undefined', () => {
      assert.throws(() => roundLeapSecond(undefined as any), TypeError)
    })
  })
})

describe('toTime', () => {
  describe('known leap seconds', () => {
    it('returns the leap-second millisecond value for a UTC leap second', () => {
      assert.equal(
        toTime('2016-12-31T23:59:60Z'),
        new Date('2016-12-31T23:59:59Z').getTime() + 1000,
      )
    })

    it('returns the leap-second value for a positive-offset timestamp (+01:00)', () => {
      // 2017-01-01T00:59:60+01:00 == 2016-12-31T23:59:60Z
      assert.equal(
        toTime('2017-01-01T00:59:60+01:00'),
        new Date('2016-12-31T23:59:59Z').getTime() + 1000,
      )
    })

    it('returns the leap-second value for a negative-offset timestamp (-05:00)', () => {
      // 2016-12-31T18:59:60-05:00 == 2016-12-31T23:59:60Z
      assert.equal(
        toTime('2016-12-31T18:59:60-05:00'),
        new Date('2016-12-31T23:59:59Z').getTime() + 1000,
      )
    })

    it('ignores fractional seconds and returns the leap-second value', () => {
      assert.equal(
        toTime('2016-12-31T23:59:60.5Z'),
        new Date('2016-12-31T23:59:59Z').getTime() + 1000,
      )
    })

    it('returns the leap-second value for the first ever leap second (1972-06-30)', () => {
      assert.equal(
        toTime('1972-06-30T23:59:60Z'),
        new Date('1972-06-30T23:59:59Z').getTime() + 1000,
      )
    })

    it('returns the leap-second value for a large positive offset shifting UTC date back (+05:30)', () => {
      // 2012-07-01T05:29:60+05:30 == 2012-06-30T23:59:60Z
      assert.equal(
        toTime('2012-07-01T05:29:60+05:30'),
        new Date('2012-06-30T23:59:59Z').getTime() + 1000,
      )
    })
  })

  describe('ordinary timestamps', () => {
    it('returns the same value as new Date().getTime() for a regular UTC timestamp', () => {
      assert.equal(
        toTime('2016-12-31T23:59:59Z'),
        new Date('2016-12-31T23:59:59Z').getTime(),
      )
    })

    it('returns the same value as new Date().getTime() for a timestamp with a non-zero offset', () => {
      assert.equal(
        toTime('2024-03-15T12:30:00+02:00'),
        new Date('2024-03-15T12:30:00+02:00').getTime(),
      )
    })
  })

  describe('seconds=60 pass-through (not a known leap second)', () => {
    it('returns NaN for a non-leap-second date with seconds=60 at correct UTC time', () => {
      // 2020-06-30 is not a leap second date; Date cannot parse :60
      assert.ok(Number.isNaN(toTime('2020-06-30T23:59:60Z')))
    })

    it('returns NaN for seconds=60 at a wrong UTC minute', () => {
      // seconds=60 but UTC time is 22:59, not 23:59 — not a leap second candidate
      assert.ok(Number.isNaN(toTime('2016-12-31T22:59:60Z')))
    })
  })

  describe('invalid input', () => {
    it('returns NaN for a string that does not match RFC 3339', () => {
      assert.ok(Number.isNaN(toTime('not-a-timestamp')))
    })

    it('throws TypeError for a number', () => {
      assert.throws(() => toTime(42 as any), TypeError)
    })

    it('throws TypeError for null', () => {
      assert.throws(() => toTime(null as any), TypeError)
    })

    it('throws TypeError for undefined', () => {
      assert.throws(() => toTime(undefined as any), TypeError)
    })
  })
})
