# Meetup location fields (canon)

Prod `city_runs` and `run_series` use the same meetup shape.

## Fields

| Column | Meaning |
|--------|---------|
| `meetUpPoint` | Place **name** — what runners see (e.g. Green Street Cafe, National Mall). Not the full formatted address. |
| `meetUpStreetAddress` | Street line from Google `address_components` or manual entry. |
| `meetUpCity`, `meetUpState`, `meetUpZip` | City / state / zip. |
| `meetUpPlaceId` | Google Place ID when staff picked from Places Autocomplete. |
| `meetUpLat`, `meetUpLng` | Coordinates from the same selection. |

There is no separate `meetUpName` column. `meetUpPoint` is the name.

## Google Places (Run Manage)

Choosing a place **aligns** the form to that Google place record:

- `meetUpPoint` ← `place.name`, or the formatted address when Google has no separate establishment name for that record.
- Street, city, state, zip, place id, and lat/lng ← the same selection.

The place id is stored beside the name. Nothing reloads the id later and clears `meetUpPoint`.

## Bulk / CSV (Race Manage shakeouts)

Race Manage bulk import writes the same columns without Places. `meetupPlaceName` → `meetUpPoint`, `meetupStreet` → `meetUpStreetAddress`, `meetUpPlaceId` null. See **gf-racemanage** `docs/SHAKEOUT_BULK_CSV.md`.
