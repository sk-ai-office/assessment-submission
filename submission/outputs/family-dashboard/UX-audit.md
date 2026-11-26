# Family childcare dashboard experience audit

The local pilot removes several observed barriers in Parent Central: unreliable geographic discovery, repeated information entry, unclear waitlist status and a lack of family control over shared profiles. The complete family-to-provider workflow passed browser testing using fictional accounts. This is an expert task-based audit, not a measured usability study with Saskatchewan families; a quantified improvement in completion time or placement rates has not yet been established.

## Current experience and implemented change

The baseline is the earlier read-only Parent Central audit in `baseline/parent-central-family-experience-audit.md`. Its screenshots document the observed results; they do not establish every user’s experience.

| Family task | Observed baseline | New experience and evidence |
|---|---|---|
| Find genuinely nearby care | A 5 km search around S7N 5A3 returned distant cities, including Regina and Prince Albert, even after optional filters were removed. | Distances are calculated from a visible area centre. Browser test: 1 km produced one provider and one matching map marker. Distance math also excludes Regina in an automated test. |
| Find a known provider | A name search for Brighton returned no results although a YMCA Brighton record existed in the directory. Aspen facilities were discoverable through other routes. | Name, alias and neighbourhood search run on the same catalogue. Aspen search found New Leaf and YMCA together; corresponding map markers opened the correct details. |
| Understand information quality | Some availability records were years old or displayed “Never.” | Each listing shows source links, a review date, known conflicts and explicit unknown information. “Accepting applications” does not mean a care space is available. |
| Compare realistic options | Families had to reconcile provider details and separate application routes themselves. | Comparison shows care type, age, hours, fees, intake and application route. Age matching uses the child’s age on the requested start date. Unknown fields are retained unless deliberately excluded. |
| Apply without repeated typing | Providers used separate forms or contact processes. A waitlist action could initiate contact without confirmed waitlist acceptance. | For connected examples, one saved profile produces a selected-child application after review and consent. Initial status is “Sent to provider”; only the receiving provider can confirm receipt or waitlist acceptance. Real providers retain their external routes. |
| Track who needs to act | The observed account/waiting-list experience offered limited guidance. | Applications show a status, next step, dated history and local messages. The UI distinguishes sent, received, information needed, waitlisted, offered, enrolled, declined and withdrawn. |
| Update schedules safely | No shared, reviewed update workflow was established in the baseline audit. | Edits remain private until the family reviews an update for that specific application. Optional care notes require separate inclusion. |
| Stop sharing | A provider-specific revocation journey was not established in the baseline audit. | Withdrawal removes the receiving provider’s access to the child snapshot and history in this app. The family retains its own record. Previously viewed information cannot be recalled. |
| Use a phone | Existing mobile behavior was not fully verified in the baseline. | At 390 × 844 CSS pixels, search, filters, saved results, List/Map switching, a marker-to-detail journey and profile fields were checked without horizontal overflow. |

## Browser task results

All actions below used the actual rendered app and its local HTTP backend through the in-app browser. No production provider applications were submitted.

| Check | Result |
|---|---|
| Real map | OpenStreetMap street tiles loaded; 11 catalogue records produced 11 markers. Zoom loaded the next tile level; keyboard panning changed the map position; Fit results restored the result extent. |
| Search and distance | Aspen returned two matching real facilities; 1 km returned one provider/marker; no-match search showed a useful recovery action. |
| Advanced filters | Home care + English + hide unknown details reduced results to the matching fictional provider. The filter dialog reflected the live result count. |
| Save and compare | YMCA Aspen saved successfully, survived reload/account switching, appeared alone under Saved and compared with New Leaf. |
| Source evidence and route | YMCA Aspen showed source links and its current Lillio application URL. New Leaf Aspen offered a call action because the reviewed registration URL failed. No external application was sent. |
| Profile editing | Text, date and time inputs, a second child, validation and save were exercised. Reversed hours produced a clear error. Navigating away from an edited profile showed stay/discard choices. |
| Consent and selected child | Send was disabled before consent. A two-child family applied for Rowan only; care notes remained private by default. |
| Recipient isolation | Prairie Sprouts received Rowan’s application; Little Willow’s inbox stayed empty. Morgan’s family account did not see Taylor’s application. |
| Provider response | Receipt and waitlist confirmation appeared in the family account with the provider’s message and history. |
| Explicit profile refresh | Changing drop-off from 08:00 to 09:00 did not change the existing application copy. Reviewed sharing then changed that application and optionally included the care note. |
| Withdrawal | The receiving provider subsequently saw “Profile access ended” with no child details or history. |
| Provider listing update | Changing Prairie Sprouts to closed appeared in family search. It was restored to accepting after the test. |
| Mobile | 390 × 844: search, filtered list, map, correct marker details, saved filter and profile fields fit the viewport. Details could be dismissed and the underlying view continued working. |
| Keyboard | Escape closed the comparison dialog and returned focus to Compare providers. Map controls and markers have descriptive names; keyboard panning worked. |
| Runtime | No browser console errors or warnings were reported in the checked session. Production build completed successfully. |

Automated verification: **11 tests passed**. Tests cover recipient/family isolation, consent, stale versions, optional notes, private edits, withdrawal, valid provider-only status transitions, application duplication, unconnected-provider rejection, intake changes, persistence, date/time validation, age/week boundaries, infant hours, geography and HTTP session/origin checks. The local HTTP test needed permission to bind a temporary loopback port; it then passed.

## Problems found and corrected

- Time/date edits in the tested browser did not reliably update controlled form state. Input handling was adjusted and the invalid-time/save/reload journey was rechecked.
- Periodic provider refreshes could reset the map zoom. Bounds now change only when result locations or the selected area change, or when Fit results is chosen.
- The original mobile header pushed all results below the first screen. Redundant introductory copy was removed on mobile, search controls were compacted and Saved moved into Filters. The results toolbar moved from about 790 px to 670 px from the page top at the tested size.
- Map marker buttons initially announced numbers alone. They now identify the provider. The mobile sort control also retains an explicit accessible name.
- Application history status headings and singular result-count wording were corrected.

## Visual comparison

The generated design reference is `design/search-concept.png` (1487 × 1058). The implementation was inspected against it using `view_image` on both the reference and rendered browser captures in the same QA pass. `concept-size-search.jpg` records the final layout at the reference-size viewport; `desktop-search.jpg` records the 1280 px desktop layout; `mobile-search.jpg` and `mobile-provider.jpg` record the mobile states.

| Comparison | Reference | Render and decision |
|---|---|---|
| Task and navigation | Find care, My applications, Family profile; one prominent finding-care task. | Preserved in the same order. Provider accounts have their own application/profile navigation. |
| Palette | White canvas, forest-green text and buttons, pale sage search surface. | Preserved. No unrelated decorative imagery or competing statistics were introduced. |
| Composition | Care-needs band above a list/map split; provider rows rather than a card grid. | Preserved on desktop. Narrow screens use explicit List/Map controls. |
| Typography and spacing | Bold sans-serif heading, clear field labels, quiet secondary information and restrained borders. | The system sans-serif stack preserves the visual tone. A deliberate smaller 36 px desktop heading and 16 px inputs leave room for comparison controls and accurate provider details; primary controls are 44 px tall with 8–12 px radii. Mobile controls remain legible. |
| Actions and icons | View details, Save, Filters, Edit needs and Fit results. | Preserved. Centre/home icons distinguish provider types; accessible marker labels identify the facility. |
| Map treatment | Illustrated geographic backdrop with example pins. | Replaced intentionally with real OSM tiles, approximate sourced coordinates, matching numbered markers and visible attribution. Circular markers improve number readability. |
| Copy and sample content | Eight illustrative providers and approximate example distances. | Deliberately updated to 9 researched records + 2 fictional connected examples, correct computed distances and explicit unknown fields. Added comparison controls and catalogue scope. |
| Responsive behavior | Desktop reference only. | Added phone layouts, a compact header, full-width detail view and single-column forms; no page-width overflow observed at 390 px. |

Above-the-fold copy retains the brand, main task, navigation and action labels. Intentional differences are the accurate catalogue count, reviewed provider names/ages, computed distances, comparison controls and mobile removal of the redundant subtitle. Native date formatting follows the browser. These differences serve data accuracy or interaction requirements.

The 1487 × 1058 CSS viewport was checked against the reference. An initially clipped screenshot was replaced with a complete browser capture (1472 × 1047 content pixels after window/scrollbar trimming). The final capture and concept were both inspected with view_image. The 1280 px desktop and 390 px mobile views were also reviewed, and the temporary viewport override was reset. The implementation was faithfully verified against the design structure and palette, with the explicit data, type-scale and interaction differences above. No unresolved clipping or page-width overflow was observed in the completed checks. This is not a claim of pixel-identical output or formal accessibility certification.

## Remaining work before a real pilot

1. **Complete, trusted catalogue:** use the ministry’s provider/licensing identifiers and confirmed coordinates; reconcile provider business names with home-operator names. The unresolved Blossoms and Brighton Family Childcare identity/coverage questions remain open. Publish coverage and update freshness.
2. **Actual provider connectivity:** verify each organization and staff member, connect intake/status updates and agree on what acknowledgement, waitlist acceptance and an offer mean. Avoid promising live vacancies without a reliable source.
3. **Real identity and privacy:** replace the demo switcher; assess family consent, child-data minimization, access revocation, retention, auditability and hosting with the responsible government teams. Production administrative access must be explicit and auditable.
4. **Scheduling and offers:** represent capacity by age group, start date and requested schedule; include holidays, exceptions, flexible starts, offer expiry, sibling preferences and family acceptance. A provider-confirmed placement needs its own real process.
5. **Notifications and inclusion:** add opt-in email/SMS, accessible alternative service channels, approved translations and non-digital assistance. The current messages stay in the app.
6. **Independent validation:** run moderated tasks with families and providers, including mobile and assistive-technology users. Measure successful provider discovery, application completion, time per task, status comprehension and recovery from errors. Conduct a formal accessibility assessment before launch.

The strongest demonstrated improvement is an understandable, consent-based journey from finding a provider to receiving an explicit response. A complete directory and verified provider participation are still necessary for that improvement to reach families outside this local pilot.
