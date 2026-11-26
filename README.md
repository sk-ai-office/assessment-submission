# Saskatchewan service complaints

Independent public-source research for AI Office review. This is not an official Government of Saskatchewan publication.

## Version history

Git had been initialized, but no versions had been committed before this change. The available earlier standalone files have now been recovered into `history/`:

- `v1-research-dashboard.html`: original research dashboard.
- `v2-listening-dashboard.html`: simplified listening dashboard before sharing controls.
- `v3-shareable-dashboard.html`: complete local app before PDF downloads and public links.

These are recovered snapshots, not a reconstruction of every historical edit. The first commit records them and the current source. Future changes are committed and tagged; no existing history is rewritten.

## Files

- `dist/index.html` and `dist/listening.js`, `listening.css`, `briefs.js`: application source and static site.
- `data/listening.json`: all 28 concerns and 80 evidence records, with source context and limitations.
- `data/reference-registry.json`: permanent complaint and evidence IDs. Never renumber or recycle existing IDs.
- `.openai/hosting.json`: Sites project and static output directory. Contains no credentials.

All counts refer to the reviewed sample. Public accounts are not verified individuals. Named people in reporting are counted separately. Archived snapshots retain their original limitations and may contain superseded wording.

## Build

The repository is self-contained. Install `tools/requirements.txt` in a Python environment, then run `node tools/build.cjs --export /absolute/path/to/output-folder`. Set `PDF_PYTHON` to that environment's Python executable if needed. No Node packages are required.

`tools/build.cjs` builds the site in `dist/`, renders all PDFs, and exports a standalone HTML app plus a ZIP containing every brief. The PDF and HTML downloads include all evidence regardless of dashboard filters. `data/dashboard-template.html` is the editable page template. `data/sharing.json` records the verified public origin and publication status.

Share URLs point to `/complaint-briefs/SK-Cxxx.html`. Public access means anyone with the link can open the content. `noindex` is a search-engine request, not access control. Publication uses the existing Sites project and the exact committed source.

## Restore a version

Use `git log --oneline` and `git tag` to inspect saved versions. To inspect an old version without changing the working app, use `git worktree add ../complaints-version-review <tag>`.
