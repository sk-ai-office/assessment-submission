# Family dashboard design specification

Primary reference: search-concept.png, generated with the built-in image tool on November 25, 2026. Selected for implementation by the assistant; user did not request a design approval gate.

White canvas; forest text #173c2d; green #1d6236; sage #f1f6ee; lines #d5dfd7. System sans 16px body, 14px secondary text, 36px desktop heading, 28px narrow heading. Buttons 44px minimum, 8px corners, outline icons from Lucide at 18–20px with 2px stroke. No imagery or decorative metrics. Header, sage search band, unframed result rows, adjacent map. At narrow widths collapse map into List/Map choice; all details remain accessible in list form.

Allowed primary copy: Child Care Saskatchewan; Find care; My applications; Family profile; Demo account; Local pilot; Example family; No applications sent to real providers; Find care that fits your family; Compare nearby options, then apply with your family profile.; Child; Start date; Search near; Distance; Search by name or neighbourhood; Filters; Saved; Edit needs; providers in this pilot; Closest first; View details; Fit results.

Required functional extensions in the same visual system: provider detail drawer with source/freshness information, comparison dialog, filters, application review and consent, family profile and weekly schedule editor, application timeline and messages, isolated provider inbox, provider availability update, demo-account switcher, empty/error/loading feedback.

Intentional accuracy deviations from generated mockup: actual geographic tiles and verified or explicitly approximate positions replace the illustrative map; distance/order/result totals are calculated, not copied from concept; public providers show unconfirmed availability; example providers are labelled; source conflicts are visible. Data-date and scope notices are necessary for informed use.

Application privacy: shared snapshots contain the chosen child and parent contact details only. Optional support notes require separate consent. Updates are reviewed per application. Withdrawal revokes provider visibility. All identities are local test identities, not production authentication.
