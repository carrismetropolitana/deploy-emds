# DeployEMDS Public Data API

Public API for downloading DeployEMDS road-link data. No credentials are required.

Data is updated monthly and covers the three most recently completed months.

## Available datasets

### Disturbance data (`roadlinks_disturbance`)

Results of road-link disturbance analysis. This is the largest dataset (about 12 million rows per month).

Main fields:

| Field | Description |
| --- | --- |
| `yearmonth` | Month of the data (`YYYYMM`) |
| `agency_id` | Operator area (`41`, `42`, `43`, or `44`) |
| `trip_id` | Trip identifier |
| `roadlink_id` | Road-link identifier |
| `disturbance_value` | Disturbance value |
| `disturbance_class` | Disturbance class |
| `reference` | Reference type (`planned` or `freeflow`) |
| `route_id` | Route identifier (optional filter) |

### Geometry data (`roadlinks_geometry`)

Geometry of each road link (polyline), for mapping and spatial analysis.

Main fields:

| Field | Description |
| --- | --- |
| `yearmonth` | Month of the data (`YYYYMM`) |
| `roadlink_id` | Road-link identifier |
| `stop_id_start` | Start stop |
| `stop_id_end` | End stop |
| `geometry` | Road-link shape (polyline) |

## How to query

Because of the data volume, every download request must include these filters:

| Filter | Required | Values |
| --- | --- | --- |
| `yearmonth` | Yes | `YYYYMM` (e.g. `202505`) |
| `agency_id` | Yes | `41`, `42`, `43`, or `44` |
| `reference` | Yes | `planned` or `freeflow` |
| `route_id` | No | e.g. `1001_0` |

Large responses may be paginated.

## Discovery (optional)

An endpoint may be available to list which months and agency IDs are currently in the database, so you can check what you can download before requesting data.
