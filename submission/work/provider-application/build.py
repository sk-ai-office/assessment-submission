"""Build the two local-only provider form dashboards and their fictional demo seed."""
from pathlib import Path
import json
import shutil
import subprocess

root = Path(__file__).resolve().parent
out = root.parents[1] / 'outputs'
dist = root / 'dist'
out.mkdir(parents=True, exist_ok=True)
dist.mkdir(parents=True, exist_ok=True)

# Always compile against current source inventories; no network or API calls occur.
subprocess.run(['python3', str(root / 'build_catalog.py')], check=True)
seed_object = json.loads((root / 'demo-content.json').read_text())
catalog_object = json.loads((root / 'catalog.json').read_text())

# Exercise the same model used in the browser before emitting user-facing files.
validation = r'''
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[1];
const FormWorkspace = require(path.join(root, 'src/forms-model.js'));
const seed = JSON.parse(fs.readFileSync(path.join(root, 'demo-content.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
const workspace = new FormWorkspace(seed, catalog);
const first = workspace.state.cases[0];
const submissions = Object.entries(first.forms).filter(([,r]) => r.status === 'submitted');
if (submissions.length < 1) throw new Error('The sample review case needs a submitted form.');
for (const [id] of submissions) if (!workspace.report(first, id).complete) throw new Error('Incomplete submitted sample: ' + id);
if (first.forms.home_licence_application.status !== 'draft') throw new Error('Initial licence sample must remain a draft.');
if (workspace.state.cases.some(c => c.legacyDocuments.length)) throw new Error('Old document status claims must not seed the new workspace.');
if (workspace.state.cases.slice(1).some(c => Object.keys(c.forms).length)) throw new Error('Only the first sample case should contain form answers.');
new FormWorkspace(seed, catalog, JSON.parse(JSON.stringify(workspace.state)));
console.log(`Validated ${workspace.state.cases.length} fictional cases and ${submissions.length} submitted sample forms.`);
'''
subprocess.run(['node', '-e', validation, str(root)], check=True)


def embed_json(value):
    return json.dumps(value, ensure_ascii=False).replace('</', '<\\/')


seed = embed_json(seed_object)
catalog = embed_json(catalog_object)
styles = '\n'.join((root / 'src' / name).read_text() for name in ['styles.css', 'forms.css'])
scripts = '\n'.join((root / 'src' / name).read_text() for name in ['forms-model.js', 'forms-app.js']).replace('</script', '<\\/script')
for role, title in [('applicant', 'Applicant dashboard'), ('ministry', 'Ministry review')]:
    html = f'''<!doctype html>
<html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>{title} · Child care applications</title><style>{styles}</style></head>
<body data-role="{role}"><a class="skip-link" href="#main">Skip to application</a><div class="shell"><header class="topbar"><div class="brand"><strong>Child care applications</strong><small>Saskatchewan · {title}</small></div><div class="header-actions" id="header-actions"></div></header><div id="storage-error" role="alert"></div><main id="main"></main></div><dialog id="modal" class="modal" aria-labelledby="modal-title"></dialog><div class="toast" id="toast" role="status" hidden></div><div id="print-root"></div><noscript><p>This dashboard needs JavaScript enabled to display its local fictional sample applications.</p></noscript><script type="application/json" id="seed">{seed}</script><script type="application/json" id="catalog">{catalog}</script><script>{scripts}</script></body></html>'''
    (dist / f'{role}.html').write_text(html)
    (out / f'childcare-{role}-dashboard.html').write_text(html)
    print(f'Built childcare-{role}-dashboard.html ({len(html):,} characters)')

process_map = out / 'childcare-current-process-map.html'
if not process_map.exists():
    raise FileNotFoundError('The current process map must be prepared before building the linked dashboards.')
shutil.copyfile(process_map, dist / process_map.name)
print('Copied the current process map beside the local previews.')
