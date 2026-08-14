# CSE-PPT Professional Question Bank Generator (v3.0)

Dedicated, self-contained automated generation and validation workspace for Civil Service Examination (CSE-PPT) Professional & Subprofessional question banks.

## Workspace Layout
- `generated_questions/`: Generated batch CSV files awaiting import or review.
- `state/`: Generation state, progress tracking, and execution metadata.
  - `progress.json`: Real-time batch and topic progress tracker.
  - `exclusions/`: Exclusion sets, duplicate prevention hashes, and prior prompts.
- `backups/`: Snapshots and disaster recovery backups of generated content.
- `logs/`: Generation execution logs and error diagnostics.
- `validators/`: Data-integrity, schema, and educational quality validation engines.
- `scripts/`: Generation automation, batch processors, and sync utilities.
- `config/`: Model configurations, topic blueprints, and taxonomy settings.
- `test/`: Verification test suites and dummy batches.

## Safety & Isolation
- Completely decoupled from the production application, user data, and live database tables.
- Does not modify or overwrite production configuration or `Gemini.md`.
