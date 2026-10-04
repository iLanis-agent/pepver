# PepVer

Sorts Python (PEP 440) versions, normalizes them, and tests them against requirement clauses (`==`, `!=`, `~=`, `<=`, `>=`, `<`, `>`, `===`, `.*` prefixes), naming the clause that rejects each one.

Open `app.html` (static, client-side). Run `node test-engine.js` (needs python3 with `packaging`) for the checks.

## Sources
- PEP 440: https://peps.python.org/pep-0440/ (fetched; sections Public version identifiers, Pre/Post/Developmental releases, Version epochs, Normalization, Version specifiers and the ordering examples were read).
- Appendix B (the regular expression) was not in the fetched text. The parsing regex here is written from the Normalization section and then verified against the `packaging` library, not copied from the PEP.
- The default of hiding pre-releases unless a clause names one follows PEP 440's "Handling of pre-releases" (a SHOULD for resolution tools) and pip behavior; the checkbox overrides it.

## Checks (24058 comparisons, all passing)
- PEP examples: normalization list, the ordering chain from the PEP, `>1.7` / `<1.7` / `~=` / `==` examples.
- 6000 random strings (valid and invalid, with spellings, separators, case, epochs, locals) vs `packaging.version.Version` (packaging 26.3): same validity, same normalized string.
- 8000 random version pairs vs packaging comparison.
- 10000 random clause and candidate pairs vs `Specifier.contains(prereleases=True)`; invalid clauses must also be rejected by packaging.

## Deviations
- `==1.0a1.*` and `==1.0.post1.*` (prefix match after a pre or post segment): the PEP text discusses prefix matching of pre-releases, but packaging rejects such clauses. This tool rejects them too, with that message.
- Clause sets are checked clause by clause; the packaging library's SpecifierSet pre-release logic beyond the default is not reproduced.
