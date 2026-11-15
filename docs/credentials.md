# Credentials

Verifiable credentials held by the owner. Consumed by later phases (CV page, About page, Person JSON-LD). This is the single source of truth; do not re-derive names elsewhere.

## monday.com Credential — RESOLVED 2026-11-14 (owner)

**The owner holds the paid proctored exam: `monday admin certification` (Diploma) — NOT the free
"admin associate" learning path / Superbadge.** The owner's earlier phrase "admin associate
certified" conflated the two; public copy must reflect only what was actually earned.

| Field | --- |
| --- | --- |
| Credential name (official) | **monday admin certification** (awards a *Diploma*) — exam "Admin Certification" |
| Issuer | monday.com (monday academy) |
| Exam format | 40 questions, 90 minutes, 80% to pass, $95 |
| Display wording allowed | "monday Admin Certified" / "holds the monday Admin Certification" |
| Display wording forbidden | "Admin Associate certified" (that is a different, unearned Superbadge) |
| Issue date | **UNKNOWN. Owner to supply.** |
| Credential ID / verification URL | **None available** (owner-confirmed 2026-11-15): monday.com offers no public verification link for this credential — only diploma download and LinkedIn sharing. The "monday academy 2026 edition" evidence page below is the best official reference. Owner will verify via LinkedIn; do not embed the diploma on the site. |
| Evidence link (official page) | https://monday.com/academy/view/certification/admin-certification |
| Evidence artifact | Owner-supplied certificate PDF (`Christopher_Tapia_Monday_New Admin Certificate.pdf`, untracked, never committed): renders "Christopher Tapia has successfully completed the requirements to become monday.com Admin Certified" — `monday academy 2026 edition`. OCR-verified 2026-11-14. Issue year: 2026. |

### Status and handling rules

- This is a **verifiable credential**, not a skill chip. Show it in a credentials list with issuer and date. Link it to its evidence URL once the owner supplies one.
- It must **not** be grouped with the UI-hidden stack items (NestJS / Payload / MySQL) from decision **D-C**. Those are hidden from the UI. This credential is displayed.
- Never invent the date or credential ID. Omit the field from rendered output and from JSON-LD until supplied.

### Intended placements

| Surface | Source / mechanism | Notes |
| --- | --- | --- |
| `/cv` route | `src/data/cv.ts` credentials/certifications entry | Name, issuer, date once known |
| About page | Credentials list | Same data entry as the CV |
| Person JSON-LD | `hasCredential` (`EducationalOccupationalCredential`) | Set `name`, `recognizedBy` (Organization: monday.com). Omit `dateCreated` and `url` until supplied. |
| About page chip (optional) | Small "monday Certified" chip | Only if it reads as a credential, kept apart from the stack chips |
| Case-study stack chips | Not applicable by default | Use the platform name "monday.com" as a stack chip only where a project used it. Keep that separate from this credential. |

### Sources

- https://monday.com/academy/view/learning%20path/admin-associate-learning-path
- https://monday.com/academy/view/certification/admin-certification
- https://support.monday.com/hc/en-us/articles/18394717181714-Get-certified-by-monday-com
