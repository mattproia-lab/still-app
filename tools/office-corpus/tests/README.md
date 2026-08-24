# Modern-rite date function tests

Regression tests for the three Stage 2 modern-rite bugs (plus the Ash
Wednesday fix) recorded in
[`vault/raw/decisions/2026-08-23-office-rebuild-plan.md`](../../../vault/raw/decisions/2026-08-23-office-rebuild-plan.md).

These test the **modern** rite's date functions in `index.html`. They have
nothing to do with the traditional corpus generator alongside them; they live
here because this is where Office tooling lives.

```
node tools/office-corpus/tests/test-season.js      # getLiturgicalSeason + getAshWednesday
node tools/office-corpus/tests/test-psalmweek.js   # getPsalmWeek rollover + anchor
node tools/office-corpus/tests/test-antiphon.js    # OFFICE_SEASONS antiphon wiring
```

Each exits non-zero on failure. No dependencies, no test runner.

`harness.js` extracts the real functions out of `index.html` by source anchor
and runs them under a frozen clock — it does **not** keep a copy of them, so
the tests cannot silently drift from the shipped code. If an anchor moves the
harness throws rather than testing nothing.

**Timezone note.** `getPsalmWeek()` and `getAshWednesday()` are DST-sensitive,
and these tests only exercise the machine's local zone. Node on Windows
ignores the `TZ` environment variable, so cross-timezone runs are not
meaningful there; use WSL or CI if that coverage is wanted.
