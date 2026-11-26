#!/usr/bin/env python3
"""Create privacy-minimized dashboard data from the three internal research ledgers.

Re-run after source audits. Optional work/dashboard-metadata.json supplies routes,
official, and coverage without editing this script. Identity keys stay in work/.
"""
from __future__ import annotations

import csv
import json
import re
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

BASE = Path(__file__).resolve().parent.parent
WORK = BASE / "work"
OUT = BASE / "outputs"
DIST = WORK / "saskatchewan-dashboard" / "dist"
START, END = "2024-11-24", "2026-11-24"
EXCLUDED_IDS = {"H015"}  # Publication date is not established.

# Exact source labels deliberately remain separate unless they describe the same issue.
ISSUE_CONFIG = {
    "Hospital crowding and hallway care": ("hospital-crowding", "Health", "Saskatchewan Health Authority", "health", "Patients and families describe prolonged hallway care, limited privacy, crowding and communication concerns."),
    "Finding and retaining a family doctor": ("family-doctor-access", "Health", "Primary-care clinics / Saskatchewan Health Authority", "health", "Residents describe unsuccessful searches for a family doctor and difficulty replacing care after clinic closures."),
    "Surgery and specialist access delays": ("surgery-specialist-delays", "Health", "Saskatchewan Health Authority", "health", "Patients and families report delayed surgery, repeated cancellations and difficulty obtaining updates."),
    "Emergency and urgent-care waiting times": ("emergency-care-waits", "Health", "Saskatchewan Health Authority", "health", "Families describe lengthy emergency-care waits and repeated visits to obtain care."),
    "Breast screening and diagnostic waits": ("breast-screening-waits", "Health", "Saskatchewan Cancer Agency / Saskatchewan Health Authority", "health", "Residents describe long screening and diagnostic waits, repeated calls and travel to obtain appointments."),
    "Medical imaging waits": ("medical-imaging-waits", "Health", "Saskatchewan Health Authority", "health", "Patients question lengthy imaging waits, cancellation-list availability and the efficiency of booking appointments."),
    "Childcare access and waitlists": ("childcare-access", "Education", "Licensed childcare services / Ministry of Education", "childcare", "Families describe full waitlists, few callbacks and difficulty arranging affordable childcare before returning to work."),
    "Childcare licensing delays and refusals": ("childcare-licensing", "Education", "Ministry of Education — Early Years", "childcare", "A provider household reports a lengthy licensing process followed by refusal."),
    "SAID payment holds and delays": ("said-payment-delays", "Social Services", "Saskatchewan Assured Income for Disability", "income-assistance", "Recipients describe unexplained payment holds, delayed deposits and difficulty obtaining callbacks."),
    "Income-assistance communication and administration": ("income-assistance-administration", "Social Services", "SIS / SAID income-assistance programs", "income-assistance", "Applicants and recipients report unanswered calls, repeated paperwork, inconsistent guidance and unsatisfactory staff interactions."),
    "Income-assistance benefit adequacy": ("income-assistance-adequacy", "Social Services", "SIS / SAID income-assistance programs", "income-assistance", "Recipients and families question whether benefit levels cover living costs and independent housing."),
    "Income-assistance deductions and eligibility": ("income-assistance-eligibility", "Social Services", "SIS / SAID income-assistance programs", "income-assistance", "A recipient disputes how other income or reimbursement affected benefit eligibility."),
    "SAID policy clarity and consultation": ("said-policy-clarity", "Social Services", "Saskatchewan Assured Income for Disability", "income-assistance", "A recipient expresses uncertainty about program changes and continued support."),
    "School educational-assistant capacity": ("school-support-capacity", "Education", "School division / Ministry of Education", "schools", "A parent raises concerns about educational-assistant capacity and the continuity of classroom support."),
    "School bullying response": ("school-bullying-response", "Education", "School / school division", "schools", "A parent says bullying continued despite raising concerns with school leadership."),
    "Public-housing maintenance and pests": ("public-housing-maintenance", "Social Services", "Local housing authority / Saskatchewan Housing Corporation", "housing", "Housing accounts describe unsuccessful pest treatment and unresolved maintenance concerns."),
    "Unexpected electricity bills and billing explanations": ("power-billing", "Crown Investments Corporation (oversight)", "SaskPower", "power", "Customers question unexpected electricity bills, meter readings and the explanations received from customer service."),
    "Telephone service outages": ("telecom-outages", "Crown Investments Corporation (oversight)", "SaskTel", "telecom", "Customers report being unable to place telephone calls during a service outage."),
    "Paid mobile-data speed restoration problems": ("telecom-data-restoration", "Crown Investments Corporation (oversight)", "SaskTel", "telecom", "Customers say purchased data-speed restoration did not work as expected and follow-up was insufficient."),
    "mySASKTEL app reliability and account information": ("telecom-app", "Crown Investments Corporation (oversight)", "SaskTel", "telecom", "Customers criticize app reliability, access to bills and the accuracy of displayed usage information."),
    "Insurance claim delays and settlement disputes": ("sgi-claims", "Crown Investments Corporation (oversight)", "SGI CANADA", "sgi", "A homeowner disputes repair proposals and settlement terms after a prolonged insurance claim."),
    "Provincial highway maintenance and road safety": ("highway-maintenance", "Highways", "Ministry of Highways", "highways", "A road user raises safety concerns about potholes, deep ruts and rough highway surfaces."),
    "Confusing highway construction-zone signs": ("highway-signage", "Highways", "Ministry of Highways", "highways", "A driver describes unclear construction-zone boundaries and speed restrictions along provincial highways."),
    "Wildfire evacuee aid and communication delays": ("wildfire-evacuee-support", "Community Safety", "Saskatchewan Public Safety Agency", "wildfire", "Evacuees report delayed financial assistance, insufficient supplies and unclear updates or return-home instructions."),
    "Wildfire response resources and use of local expertise": ("wildfire-response", "Community Safety", "Saskatchewan Public Safety Agency", "wildfire", "Residents question operational support, use of local expertise and the response to community warnings."),
}

COVERAGE = [
    "Public-web snapshot covering November 24, 2024 through November 24, 2026; this is a purposive sample, not an internet-wide census.",
    "Named people and public accounts are shown separately. Accounts are not verified humans; identity matching across platforms was not attempted.",
    "Repeat items from the same identifiable source count once per issue. Upvotes, views, unnamed relatives and deleted-account identities do not increase unique counts.",
    "Reported complaints are not findings of wrongdoing. Historical complaints may have been resolved; the dashboard records the source's stated outcome where available.",
    "Reddit discussions, app reviews and local reporting dominate the sample. Private groups, unindexed content and deleted posts are not comprehensively covered.",
    "Some comment dates are approximate thread dates or month-level dates. The source detail flags this; one undated health report was excluded.",
    "Different people can discuss the same event. Three hospital speakers concern one family case; shared cases are retained without counting each as a separate incident.",
    "No evidence here means insufficient coverage, not zero complaints. Agriculture, parks, justice, SaskEnergy and several other services were not sufficiently represented.",
]

TITLE_OVERRIDES = {
    "H005": "Surgical access report", "H006": "Emergency department waiting report",
    "H009": "Hospital hallway care report", "H010": "Hospital hallway care report",
    "H011": "Hospital hallway care report", "H013": "Hospital capacity report",
    "H014": "Hospital hallway care report", "SE19": "SAID policy report",
    "OS10": "Mobile data-speed restoration discussion", "OS11": "Mobile data-speed restoration discussion",
    "OS14": "Mobile data usage discussion", "OS13": "mySASKTEL app review",
    "OS06": "Electricity billing after meter replacement discussion",
}

DOMAIN_PUBLISHERS = {
    "cjme.com": "980 CJME", "ckom.com": "650 CKOM", "620ckrm.com": "620 CKRM",
    "mbcradio.com": "MBC Radio", "apps.apple.com": "Apple App Store",
    "youtube.com": "CBC News", "embed-rech-01.dialog.cm": "Moose Jaw Express",
    "globalnews.ca": "Global News",
}


def identity_key(record):
    raw = record.get("attributionKey") or record.get("authorKey")
    if not raw:
        return None, "unknown"
    raw = raw.strip().lower()
    prefix, _, tail = raw.partition(":")
    if prefix in {"public-person", "person", "news-person"}:
        tail = re.sub(r"[^a-z0-9]+", "-", tail).strip("-")
        return "person:" + tail, "person"
    if prefix in {"reddit", "appstore-ca"}:
        return prefix + ":" + tail, "account"
    return raw, "unknown"


def publisher_for(record, url):
    if record.get("publisher"):
        return record["publisher"]
    host = urlparse(url).netloc.removeprefix("www.")
    if host == "reddit.com":
        match = re.search(r"/r/([^/]+)/", url)
        return "r/" + match.group(1) if match else "Reddit"
    return DOMAIN_PUBLISHERS.get(host, host)


def public_context(record):
    rid = record["id"]
    parts = []
    for field in ("sourceContext", "responseNote", "response"):
        if rid == "OS18" and field == "responseNote":
            continue
        text = record.get(field, "")
        if not text:
            continue
        # Remove internal instructions rather than exposing them in the dashboard.
        text = re.sub(r"\s*Source permits only.*", "", text)
        text = re.sub(r"\s*Estimated 5,000 affected.*", "", text)
        text = text.strip()
        if text and text not in parts:
            parts.append(text)
    if rid in {"H009", "H010", "H011"}:
        parts.append("Three separately attributed family speakers describe the same hospital event; one shared case.")
    if rid in {"H014", "OS16"}:
        parts.append("Reviewed through the search-index text; the direct page could not be opened.")
    if rid == "OS20":
        parts.append("Attribution and complaint reviewed in the publisher's video description; video not viewed.")
    if rid == "SE17":
        parts.append("Other commenters dispute the described rules; the complaint does not establish current program policy.")
    if rid == "SE20":
        parts.append("The reported concern is prospective; the article does not establish an individual support-worker layoff for this family.")
    if not any(record.get(k, False) for k in ("counted", "countEligible", "includedInUniqueCount")):
        parts.append("Excluded from unique counts because a deleted or unknown identity cannot be reliably deduplicated.")
    return " ".join(parts)


def date_fields(record):
    raw = record["date"]
    basis = record.get("datePrecision") or record.get("dateBasis") or "publication date"
    if record["id"] in {"SE06", "SE07", "SE08", "OS17"}:
        precision = "month"
        label = date.fromisoformat(raw).strftime("%B %Y") + " (approximate)"
    elif "thread" in basis.lower() or "approximate" in basis.lower():
        precision = "thread"
        label = date.fromisoformat(raw).strftime("%b %d, %Y").replace(" 0", " ") + " (thread date)"
    else:
        precision = "day"
        label = date.fromisoformat(raw).strftime("%b %d, %Y").replace(" 0", " ")
    return raw, label, precision


def main():
    raw = []
    for name in ("health-research.json", "social-education-research.json", "other-services-research.json"):
        raw.extend(json.loads((WORK / name).read_text())["observations"])
    raw = [r for r in raw if r["id"] not in EXCLUDED_IDS and START <= r["date"] <= END]
    map_path = WORK / "author-id-map.json"
    identity_map = json.loads(map_path.read_text()) if map_path.exists() else {}
    for r in raw:
        key, kind = identity_key(r)
        if key and key not in identity_map:
            prefix = {"person": "P", "account": "A", "unknown": "U"}[kind]
            last = max((int(v[1:]) for v in identity_map.values() if v.startswith(prefix)), default=0)
            identity_map[key] = f"{prefix}{last + 1:03d}"
    map_path.write_text(json.dumps(identity_map, indent=2) + "\n")

    observations = []
    issues = {}
    for r in raw:
        key, kind = identity_key(r)
        title = r["issue"]
        issue_id, ministry, service, route_id, issue_summary = ISSUE_CONFIG[title]
        issues[issue_id] = {"id": issue_id, "title": title, "summary": issue_summary, "ministry": ministry, "service": service, "routeId": route_id}
        url = r.get("url") or r.get("sourceUrl")
        source_page = r.get("sourcePage") or r.get("threadUrl") or r.get("parentUrl") or url
        stamp, date_label, precision = date_fields(r)
        eligible = any(r.get(field, False) for field in ("counted", "countEligible", "includedInUniqueCount"))
        counted = bool(eligible and key and kind != "unknown")
        if "attributionVerified" in r:
            counted = counted and bool(r["attributionVerified"])
        context = public_context(r)
        if precision == "thread":
            context = (context + " Exact comment date was not independently established; the discussion date is shown.").strip()
        elif precision == "month":
            context = (context + " Exact item date was not independently established; the month is shown.").strip()
        observations.append({
            "id": r["id"], "authorId": identity_map[key] if key else "Unknown",
            "authorType": kind, "date": stamp, "dateLabel": date_label, "datePrecision": precision,
            "issueId": issue_id, "summary": "Family member criticized a three-day hospital hallway stay." if r["id"] == "H013" else r["summary"], "url": url, "sourcePage": source_page,
            "sourceTitle": TITLE_OVERRIDES.get(r["id"], r["sourceTitle"]),
            "publisher": publisher_for(r, source_page), "sourceKind": r["sourceKind"],
            "status": "Outcome unknown." if r["id"] == "H013" else r.get("status", "Historical complaint; current outcome not independently verified"),
            "context": context, "region": r.get("region") or r.get("location") or r.get("locality") or "Saskatchewan; locality unspecified",
            "counted": counted, "caseId": r.get("caseId") or r["id"],
        })

    additions_path = WORK / "dashboard-metadata.json"
    additions = json.loads(additions_path.read_text()) if additions_path.exists() else {}
    result = {"start": START, "end": END, "observations": observations, "issues": list(issues.values()),
              "routes": additions.get("routes", []), "official": additions.get("official", []),
              "coverage": additions.get("coverage", COVERAGE)}
    OUT.mkdir(exist_ok=True)
    DIST.mkdir(parents=True, exist_ok=True)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    (OUT / "saskatchewan-complaints-data.json").write_text(text + "\n")
    # Escape '<' so this is safe even if later inlined into an HTML script element.
    (DIST / "data.js").write_text("window.RESEARCH = " + text.replace("<", "\\u003c") + ";\n")

    evidence_fields = ["id", "authorId", "authorType", "date", "dateLabel", "datePrecision", "issueId", "summary", "publisher", "sourceKind", "sourceTitle", "url", "sourcePage", "region", "counted", "caseId", "status", "context"]
    with (OUT / "complaint-evidence.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=evidence_fields)
        writer.writeheader()
        writer.writerows(observations)

    issue_fields = ["id", "title", "summary", "ministry", "service", "routeId", "named_people", "public_accounts", "unique_source_identities", "counted_observations", "uncounted_observations", "source_pages", "urls"]
    with (OUT / "complaint-issues.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=issue_fields)
        writer.writeheader()
        for issue in issues.values():
            rows = [r for r in observations if r["issueId"] == issue["id"]]
            counted_rows = [r for r in rows if r["counted"]]
            people = {r["authorId"] for r in counted_rows if r["authorType"] == "person"}
            accounts = {r["authorId"] for r in counted_rows if r["authorType"] == "account"}
            writer.writerow({**issue, "named_people": len(people), "public_accounts": len(accounts), "unique_source_identities": len(people | accounts), "counted_observations": len(counted_rows), "uncounted_observations": len(rows)-len(counted_rows), "source_pages": len({r["sourcePage"] for r in rows}), "urls": " | ".join(sorted({r["sourcePage"] for r in rows}))})

    # Small checks enforce the output contract without exporting attribution keys.
    assert len({r["id"] for r in observations}) == len(observations)
    assert all(r["issueId"] in issues for r in observations)
    assert not any(k in text for k in ("attributionKey", "authorKey", "evidenceNote"))
    known = [r for r in observations if r["counted"]]
    counts = {kind: len({r["authorId"] for r in known if r["authorType"] == kind}) for kind in ("person", "account")}
    print(json.dumps({"observations": len(observations), "countedObservations": len(known), "uniqueNamedPeople": counts["person"], "uniquePublicAccounts": counts["account"], "issues": len(issues), "sourcePages": len({r["sourcePage"] for r in observations}), "datePrecision": dict(Counter(r["datePrecision"] for r in observations))}))


if __name__ == "__main__":
    main()
