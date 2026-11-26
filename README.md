# Saskatchewan AI Office assessment

Three working prototypes, submitted as two parts: public-source problems discovery, followed by a child care service journey for provider applicants, ministry reviewers, families and providers.

**Live submission:** https://assessment.zaidsoomro.me/

**Original publication:** https://saskatchewan-service-complaints.soomrozaid.chatgpt.site/submission/

## Run locally

Install Node.js 24 or newer. From `submission/`, run:

```sh
node start.cjs
```

Open http://127.0.0.1:4182 for the submission hub and http://127.0.0.1:4180 for the family/provider application. No dependency installation or external account is needed to run the prebuilt prototypes. Use invented information only. See [setup instructions](submission/START-HERE.txt).

## Source and deliverables

| Location | Contents |
| --- | --- |
| `submission/work/saskatchewan-dashboard/` | Complaints dashboard source, data, briefs and rebuild tools |
| `submission/work/provider-application/` | Applicant/ministry guided forms, model, tests and research inventories |
| `submission/outputs/family-dashboard/` | React frontend, Node/SQLite backend, tests and compiled app |
| `submission/Build-record.pdf` | Two-page architecture, design, verification and governance record |
| `website/` | Exact public Vercel static site and deployment configuration, without credentials |
| `sites-publication/` | Original Sites source and static publication, retaining its Git history |
| `artifacts/` | Unchanged submission ZIP, narrated MP4 and transcript |
| `provenance/` | SHA-256 checksums and explanation of original versus archival timestamps |
| `reproduction-tools/` | Scripts and screenshot inputs for reproducing the build record and narrated video |
| `research-pipeline/` | Supporting research/data preparation scripts and inputs from development |
| `legacy/` | Clearly separate superseded prototype snapshots; not the current submitted implementation |

## Current boundaries

The family/provider application shares a real **local** SQLite database. Applicant/ministry forms share browser storage. Those two stores are not yet connected; ministry approval does not provision provider accounts. Optional grant forms support preparation, not funding decisions. The public website hosts the static demos and a download of the local family app; it does not host that backend. The video is a narrated walkthrough of real screenshots, not filmed click interactions.

Only public research and fictional demo accounts are included. Runtime databases, environment variables, credentials, installed dependencies and machine-specific hosting configuration are excluded.

## Verification

Fresh submission checks passed 11 family backend tests and 14 current provider form tests. Existing evidence records describe what was tested; they are not new test runs performed by this import.

```sh
# Requires Node 24+
cd submission/outputs/family-dashboard
node --test tests/backend.test.js
# From the repository root, in a separate shell:
node --test submission/work/provider-application/forms-model.test.cjs
```

See [family verification](submission/family-verification.txt), [launcher verification](submission/launcher-verification.txt), and [scope/next steps](submission/Scope-and-next-steps.txt).

## Timestamps

The existing publication history is preserved unchanged. This organization upload and its release are timestamped when actually performed. The exact original submission ZIP remains unchanged and is identified by SHA-256. See [provenance](provenance/README.md) for precise dates and limitations.
