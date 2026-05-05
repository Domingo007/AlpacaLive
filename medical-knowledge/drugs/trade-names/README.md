# Trade Names Database

Mappings between brand/trade names and International Nonproprietary Names (INN)
for medications relevant to breast cancer care and psychiatric support for
oncology patients.

## Purpose

When patients describe medications they take, they typically use local brand
names (e.g., "Trittico" in Poland, "Herceptin" globally, "Enhertu" for T-DXd)
rather than INN. AlpacaLive uses this database to:

1. Recognize patient input regardless of which name they use
2. Map to canonical drug record for interaction checking
3. Flag truly unknown drugs for community contribution

## Structure

See `index.json` for the schema. Each drug entry includes:

- `inn`: International Nonproprietary Name (canonical)
- `inn_aliases`: Alternative INN spellings per language (e.g., PL "wenlafaksyna" → venlafaxine)
- `trade_names`: Brand names grouped by region: `pl`, `de`, `eu`, `uk`, `us`, `global`, optionally `biosimilars`
- `drug_class`: Pharmacological class
- `route`: Primary route of administration (`oral` | `iv` | `sc` | `im`)
- `common_dosing_oncology`: Reference dosing for breast cancer (NOT prescriptive)
- `breast_cancer_indication`: Subtype/line of treatment
- `key_warnings`: Critical safety information
- `ref_urls`: Source URLs for verification

## Verification

All 44 entries verified 2026-04-23 against:

- FDA approval letters and prescribing information
- drugs.com international database
- Wikipedia medical articles
- NCI FDA-approved drug list
- Peer-reviewed oncology publications (OncLive, TargetedOncology, Pharmacy Times)

Includes 2024-2025 approvals: inavolisib (Itovebi, Oct 2024), T-DXd HER2-ultralow
(Jan 2025), T-DXd + pertuzumab first-line (Dec 2025), imlunestrant (Inluriyo, 2025),
datopotamab deruxtecan (Datroway, 2025).

## Dual-branded drugs

Two drugs have separate brand names for oncology vs. osteoporosis indications
(same molecule, different dose):

| INN              | Oncology brand | Osteoporosis brand     |
|------------------|----------------|------------------------|
| denosumab        | Xgeva (120 mg) | Prolia (60 mg)         |
| zoledronic acid  | Zometa (4 mg)  | Reclast / Aclasta (5 mg) |

The resolver returns the same INN for both — context (dose, indication) is
preserved in `common_dosing_oncology` for downstream logic.

## Combination products

`Phesgo` is intentionally listed under both `trastuzumab` and `pertuzumab` —
it is a fixed-dose subcutaneous combination of both antibodies plus hyaluronidase.

## Contributing

If you notice an incorrect or missing entry, please open a GitHub Issue with
the `medical-knowledge` label. Include:

- Your correction/addition
- Source URL (preferably FDA, drugs.com, or peer-reviewed journal)
- Your role if relevant (patient, caregiver, healthcare professional)

Do not submit entries based on personal experience alone without verifiable
source — this database drives medication recognition for real patients.

## Limitations

This is NOT a substitute for professional medical advice. AlpacaLive uses
this data to recognize what patients describe, not to make treatment
decisions. Always consult your oncologist.
