# Office regression tests

Regression tests for the Stage 2 modern-rite date bugs (plus the Ash Wednesday
fix) the Stage 3 Office Calendar toggle, the removal of the Office Mode
(Concise/Full) toggle, and the buildOffice split, recorded in
[`vault/raw/decisions/2026-08-23-office-rebuild-plan.md`](../../../vault/raw/decisions/2026-08-23-office-rebuild-plan.md).

These test Office behaviour in `index.html`. They have nothing to do with the
traditional corpus generator alongside them; they live here because this is
where Office tooling lives.

```
node tools/office-corpus/tests/test-season.js      # getLiturgicalSeason + getAshWednesday
node tools/office-corpus/tests/test-psalmweek.js   # getPsalmWeek rollover + anchor
node tools/office-corpus/tests/test-antiphon.js    # OFFICE_SEASONS antiphon wiring
node tools/office-corpus/tests/test-rite.js        # Office Calendar toggle + profile sync
node tools/office-corpus/tests/test-no-office-mode.js  # Office Mode removal stayed complete
node tools/office-corpus/tests/test-build-office.js    # characterisation golden for the buildOffice split
```

Each exits non-zero on failure. No dependencies, no test runner.

`test-rite.js` carries its own sandbox (stub `localStorage`, `fetch`, and
auth) rather than using `harness.js`, since it exercises network and storage
rather than a clock. It asserts the sign-in conflict rule directly: profile
wins on sign-in, local wins on explicit change, and a NULL profile adopts the
local value instead of resetting it.

`harness.js` extracts the real functions out of `index.html` by source anchor
and runs them under a frozen clock — it does **not** keep a copy of them, so
the tests cannot silently drift from the shipped code. If an anchor moves the
harness throws rather than testing nothing.

**Timezone note.** `getPsalmWeek()` and `getAshWednesday()` are DST-sensitive,
and these tests only exercise the machine's local zone. Node on Windows
ignores the `TZ` environment variable, so cross-timezone runs are not
meaningful there; use WSL or CI if that coverage is wanted.
