# Statuses & States

This page defines all status and state values used in Axiom.

## LEI entity status

| Status | Meaning |
| --- | --- |
| `ACTIVE` | The entity is currently active and operating |
| `INACTIVE` | The entity is no longer active |
| `ANNULLED` | The LEI was annulled (issued in error or cancelled) |
| `DUPLICATE` | A duplicate LEI has been identified; the record will be merged |
| `LAPSED` | The LEI registration has lapsed due to non-renewal |
| `MERGED` | The entity has merged with another entity |
| `RETIRED` | The entity has retired its LEI |
| `TRANSFERRED` | The entity has transferred its LEI to a new LOU |

## LEI relationship status

| Status | Meaning |
| --- | --- |
| `ISSUED` | The LEI has been issued and is active |
| `LAPSED` | The relationship has lapsed |
| `PENDING_TRANSFER` | A transfer of the LEI to a new LOU is in progress |
| `PENDING_ARCHIVAL` | The LEI is queued for archival |

## LEI validation status

| Status | Meaning |
| --- | --- |
| `FULLY_CORROBORATED` | All entity data has been corroborated against authoritative sources |
| `PARTIALLY_CORROBORATED` | Some entity data has been corroborated |
| `PENDING` | Corroboration is in progress |
| `ENTITY_SUPPLIED_ONLY` | Data was provided by the entity itself without third-party corroboration |

## SSI status

| Status | Meaning |
| --- | --- |
| `ACTIVE` | The instruction is current and valid |
| `INACTIVE` | The instruction has been deactivated |
| `PENDING` | The instruction is awaiting approval or activation |

## User account status

| Status | Meaning |
| --- | --- |
| `ACTIVE` | The user can sign in and use Axiom |
| `PENDING` | The user has registered but is awaiting admin approval |
| `REJECTED` | The user's registration was rejected |

## Related pages

- [Data Dictionary](./data-dictionary)
- [Permissions & Roles](./permissions-and-roles)

> **Note:** This page is a stub. Full documentation will be added in Phase 3.
