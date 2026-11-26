# Saskatchewan family childcare dashboard

A local working pilot for finding care, maintaining a family profile and sharing a selected child’s details with a chosen provider. Nothing is published and no applications, messages or family profiles are sent to real providers.

## Open the app

Double-click `Start dashboard.command` on macOS, then open **http://127.0.0.1:4180**. Keep the Terminal window open while using the app; press Control-C to stop it. The launcher uses an installed Node version with SQLite support (Node 24 recommended). The compiled app is included; no dependency installation is needed to run it.

From a terminal: `node server/index.js`. To choose a different port: `CHILDCARE_PORT=4181 node server/index.js`.

The family database is created in `data/families.sqlite` on first launch. It persists across restarts. The app binds only to this computer’s loopback address. Browser map tiles load from OpenStreetMap; the dashboard does not attach family information to tile requests.

## Try the complete journey

1. Use the Morgan family account. Search, filter, compare and save providers. Edit the family profile and care schedule.
2. Open **Prairie Sprouts · Example provider**, choose **Review application**, review the exact information and give sharing consent.
3. Use **Demo account** to switch to Prairie Sprouts. Its inbox contains the chosen child and parent contact details. Little Willow cannot see that application.
4. Confirm receipt, ask for information or confirm a waitlist place. Switch back to the family to see the response and history.
5. Edit the family schedule. Existing applications keep their previous copy until **Review and share profile update** is completed.
6. Withdraw the application to revoke the provider’s access to the shared profile and history.

The account switcher deliberately permits anyone using this local pilot to select an example account. It is not production authentication. Use invented information only.

## What works

- Search by provider name, aliases and neighbourhood; select a search area and straight-line distance.
- Filter by care type, age at the requested start date, schedule, application availability, language and monthly fee. Unknown fields stay visible unless explicitly excluded.
- Interactive Leaflet/OpenStreetMap map, matching numbered results, zoom, keyboard panning, provider markers and Fit results.
- Saved providers, three-provider comparison, source links, address conflicts, current external application links and clear unknown availability.
- Multiple children, dates, schedules, contact preferences, optional private care notes, validation and unsaved-change protection.
- Consent-based per-child applications, persistent database, status history, local messages, reviewed profile updates and withdrawal.
- Provider inboxes restricted to applications addressed to their facility; provider application-availability updates reflected in family search.
- Responsive desktop/mobile layouts, labelled controls, keyboard-accessible dialogs and focus restoration.

## Data and integration boundaries

The catalogue contains **9 public-source real listings and 2 fictional connected providers** around northeast Saskatoon. It is not a complete provincial directory. Public sources were reviewed on November 25, 2026. Source details and unresolved conflicts are in `research/providers.json`; normalized app records are in `server/providers.json`.

Real providers use their verified external application link or telephone contact. They do not receive this pilot’s family data, and external applications do not appear as confirmed applications in the pilot. Demonstration fees and intake states belong only to the fictional providers. No vacancy counts or queue positions are invented.

Search uses six neighbourhood centres. Map pins use approximate government map locations and straight-line distances; there is no address geocoder, journey-time calculation or live licensing feed.

Before real family/provider use, connect verified identities and staff memberships, a complete licensed-provider registry, provider software or verified update workflows, and real application/status integrations. Establish hosting, privacy, consent, retention, notification and operational controls with the responsible service owners. Date-specific capacity, schedule exceptions, real enrolment agreements, provincial reporting, multilingual content and formal accessibility/user testing remain future work. The pilot demonstrates the workflow; it is not a deployment-ready government service.

## Development and verification

Source code and compiled files are included. `npm ci` installs the pinned development dependencies. `npm run build` rebuilds the frontend. `npm test` runs 11 meaningful database/domain/API tests; its HTTP integration test needs permission to bind a temporary local port. `npm run dev` serves the frontend on port 5173 and proxies the backend on port 4180.

See `UX-audit.md` for the comparison with the current Parent Central experience, browser task results, design comparison, known limits and the next validation steps.
