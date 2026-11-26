# Snapshot and timestamp provenance

This GitHub repository was created after the submission was sent. GitHub repository/release creation and upload times record the archival action now. They are not evidence that the GitHub upload happened before the assessment deadline.

The existing publication Git history is preserved unchanged as ancestors of the current main branch. Author and committer dates are the dates already present in those original commits; none are backdated by this import. Git commit dates are client-supplied metadata, not independently verified timestamps.

- `90b91d7503e812a8fdaa59edf480a51e94be6f92`: publication source for the submission landing page; the ZIP was a deployed/downloadable asset and was not tracked in that commit; recorded November 25, 2026, 23:49:15 Saskatchewan time (UTC-06:00).
- `e84ed615e5245603dc09361a11fea3e657d99ad7`: publication source adding the narrated video; recorded November 25, 2026, 23:56:07 Saskatchewan time (UTC-06:00).
- `artifacts/SK-AI-Office-submission-2026-11-25.zip`: exact unchanged submitted package, with its original 525 entries.
- The `submission/` tree makes the source inspectable and includes additional launcher and publication verification records. The immutable reference for the original packaged contents is the dated ZIP and its SHA-256, not this evolving directory.
- The narrated video and Vercel deployment were added after that ZIP was prepared. They are stored separately so the original package is not silently replaced.

`existing-commit-history.tsv` exports the original commit metadata. `SHA256SUMS` and `artifact-checksums.json` identify the exact archived files. GitHub release metadata provides the server-recorded publication time of this archive. Tags are created at archival time and point to the preserved earlier commits; tag creation times are not backdated.

The earlier complaints README explains that older standalone HTML snapshots were recovered together in the initial commit. They are recovered snapshots, not a reconstruction of every prior edit. Provider and family directories had no earlier independent Git repositories; their source is preserved in the dated submission ZIP and is unpacked into Git for inspection in this import. The original ZIP was ignored by the earlier publication repository, so earlier publication commits do not themselves contain its source code. This import adds the unchanged ZIP as a tracked artifact.
