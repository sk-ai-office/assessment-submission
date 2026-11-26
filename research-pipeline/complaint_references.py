"""Append-only reference IDs, independent of sort order or display names."""
import json
from pathlib import Path

REGISTRY = Path(__file__).with_name('complaint-reference-ids.json')

def assign_references(data):
    registry = json.loads(REGISTRY.read_text()) if REGISTRY.exists() else {'issues': {}, 'evidence': {}}
    for key, rows, prefix in [('issues', data['issues'], 'SK-C'), ('evidence', data['observations'], 'SK-E')]:
        mapping = registry[key]
        assert len(set(mapping.values())) == len(mapping), 'Duplicate reference ID'
        next_number = max((int(value[len(prefix):]) for value in mapping.values()), default=0) + 1
        for row in rows:
            if row['id'] not in mapping:
                mapping[row['id']] = f'{prefix}{next_number:03d}'
                next_number += 1
            row['referenceId'] = mapping[row['id']]
    for record in data['observations']:
        record['complaintReferenceId'] = registry['issues'][record['issueId']]
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n')
    data['referenceGuide'] = {
        'complaints': 'SK-C identifies a grouped concern, not an official government case.',
        'evidence': 'SK-E identifies an individual evidence record; original research IDs remain available.',
        'stability': 'Reference IDs are stored in an append-only registry and do not change with sorting, filtering or title edits.'
    }
    return data
