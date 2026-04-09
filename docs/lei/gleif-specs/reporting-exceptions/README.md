# GLEIF Reporting Exceptions

Local copies of the Level 2 Reporting Exceptions specification artifacts used to understand how
`lei_raw.lei_reporting_exceptions` is structured and interpreted.

## Why these are here

Reporting Exceptions are a separate Level 2 format from the RR-CDF relationship records. They
capture cases where parent relationship data cannot be fully reported, for example:

- there is no parent entity
- the parent does not have an LEI
- the child opts out of disclosure for permitted policy reasons

Keeping these files locally gives us an authoritative reference for:

- `ExceptionCategory`
- `ExceptionReason`
- allowed structural changes between versions
- state-transition and validation behavior

## Included files

| File | Purpose |
| ---- | ------- |
| [`2021-07-20_reporting-exceptions-format-v2-1.xsd`](./2021-07-20_reporting-exceptions-format-v2-1.xsd) | Authoritative XML schema for Reporting Exceptions v2.1 |
| [`reporting_exceptions_format_version_2.1-documentation.html`](./reporting_exceptions_format_version_2.1-documentation.html) | GLEIF release notes / format documentation |
| [`2025-07-03_state-transition-validation-rules_2.8.5_final.pdf`](./2025-07-03_state-transition-validation-rules_2.8.5_final.pdf) | State Transition and Validation Rules used across current CDF formats |

## Canonical source page

<https://www.gleif.org/en/lei-data/access-and-use-lei-data/level-2-data-reporting-exceptions-2-1-format>

## What the format covers

At a high level, each exception record contains:

- the child entity LEI
- an `ExceptionCategory`
- one or more `ExceptionReason` values
- optional `ExceptionReference` values

GLEIF notes that v2.1 introduced the `NON_PUBLIC` exception reason category and aligns the format
with the updated ROC policy for parent relationship opt-outs.

## Related policy context

GLEIF explicitly links this format to ROC policy on parent relationship reporting, especially the
policy paper on PNI data collection and opt-outs. Use the local HTML and PDF artifacts here for
implementation/debugging first, then consult the linked ROC policy if the business meaning of an
exception reason is disputed.

## How to update

1. Download the latest XSD and release notes from the canonical source page.
2. Replace the files in this folder while preserving the upstream filenames.
3. If the version changes, update the folder references in [README.md](../README.md).
4. If enum values or validation rules change, review the Reporting Exceptions ingest code and
   database comments before merging.
