## Architecture
- FRIDAY analysis runs entirely in the browser (src/lib/friday/*); uploaded code must never be sent to a server or executed — the privacy claim in the UI depends on it.
- AI remediation (src/lib/ai-remediation.functions.ts) sends only vulnerability type, framework and a short developer note to the AI provider — never scanned code, file paths or findings evidence — to keep the privacy claim true.
- All app data persists in IndexedDB via src/lib/friday/store.ts; every page reads that one store so views stay consistent.
- Findings are matched across scans by a stable fingerprint (category, rule, file, function, normalized sink, source), not line numbers.
- No ML model is bundled; never label rule-based output as ML.
