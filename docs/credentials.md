# Credentials

Verifiable credentials held by the owner. Consumed by later phases (CV page, About page, Person JSON-LD). This is the single source of truth; do not re-derive names elsewhere.

## monday.com Admin Associate

| Field | Value |
| --- | --- |
| Credential name (as owner states it) | monday.com admin associate certified |
| Official name, as published by monday academy | **monday admin associate** (learning path, awards a *Superbadge*) |
| Related official exam | **monday admin certification** (exam name "Admin Certification", awards a *Diploma*) |
| Issuer | monday.com (monday academy) |
| Level / category | Beginner; Admin; product focus: Work management, Dev, CRM, Service |
| Description (1 line) | Manage users, permissions, and governance to keep an organization's monday.com environment secure and efficient. |
| Issue date | **UNKNOWN. Owner to supply.** |
| Credential ID / verification URL | **UNKNOWN. Owner to supply** (LinkedIn certification URL or monday.com certificate link). |
| Evidence link (official page) | https://monday.com/academy/view/learning%20path/admin-associate-learning-path |
| Related exam page | https://monday.com/academy/view/certification/admin-certification |

### OPEN QUESTION for the owner (resolve before any public copy ships)

monday academy publishes two distinct things that match "admin associate certified":

1. **monday admin associate**, a free learning path (about 1.5 hours) that ends in a **Superbadge**.
2. **monday admin certification**, a paid proctored exam (40 questions, 90 minutes, 80% pass, $95) that ends in a **Diploma**. Its study guide tells candidates to review the "monday admin associate" learning path.

The owner's phrase "admin associate certified" does not say which one was earned. The display name must match the artifact the owner holds:

- Superbadge only: use "monday admin associate (Superbadge)". Do not call it a "certification".
- Diploma from the exam: use "monday admin certification (Diploma)".
- Both: list both, or lead with the certification.

Until confirmed, use the owner's wording, "monday.com Admin Associate", and flag it for review. Do not claim "certified" in public copy without confirmation.

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
| About page chip (optional) | Small "monday.com Admin Associate" chip | Only if it reads as a credential, kept apart from the stack chips |
| Case-study stack chips | Not applicable by default | Use the platform name "monday.com" as a stack chip only where a project used it. Keep that separate from this credential. |

### Sources

- https://monday.com/academy/view/learning%20path/admin-associate-learning-path
- https://monday.com/academy/view/certification/admin-certification
- https://support.monday.com/hc/en-us/articles/18394717181714-Get-certified-by-monday-com
