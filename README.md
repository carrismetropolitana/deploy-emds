# DeployEMDS API

The DeployEMDS API provides Carris Metropolitana road-link disturbance data.

Official API:

[https://emds.carrismetropolitana.pt/disturbance](https://emds.carrismetropolitana.pt/disturbance)

No account or credentials are required.

## How the API works

The generated CSV files can be very large, so the API creates them in the
background:

1. Open a URL with the required filters.
2. The API reports how many rows match.
3. Add `/download` to start a generation job.
4. Open the returned job URL while the file is being generated.
5. When the job is complete, that same URL downloads the CSV.

The first `/download` response is a job status, not the CSV itself.

## Required filters

| Filter | Meaning | Examples |
| --- | --- | --- |
| `yearmonth` | Month in `YYYYMM` format | `202606` |
| `agency_id` | Carris Metropolitana area | `41`, `42`, `43`, `44` |
| `reference` | Comparison reference | `planned`, `freeflow` |

Optional filters can be combined in any combination:

| Filter | Meaning | Example |
| --- | --- | --- |
| `disturbance_class` | Disturbance category | `high` |
| `route_id` | Route to include | `1002_0` |
| `trip_id` | Specific trip to include | `1002_0_20260615_0800` |

## 1. Check the number of rows

Open the filtered URL without `/download`:

[Check rows for agency 41](https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned)

The response is similar to:

```json
{
  "filters": {
    "yearmonth": "202606",
    "agency_id": "41",
    "reference": "planned"
  },
  "rows": 2207,
  "message": "This download contains 2,207 rows. Add /download to this URL to start generating the CSV file."
}
```

This request only counts matching rows. It does not generate a file.

## 2. Start a download job

Use `/disturbance/download` before the query parameters:

[Start a route download](https://emds.carrismetropolitana.pt/disturbance/download?yearmonth=202606&agency_id=41&reference=planned&route_id=1002_0)

The API returns a job similar to:

```json
{
  "job_id": "8f8d3c3a-4b85-4cf6-9b0d-12c3d4567890",
  "status": "queued",
  "rows": 2207,
  "status_url": "/disturbance/download/8f8d3c3a-4b85-4cf6-9b0d-12c3d4567890"
}
```

`rows` is the expected number of rows in the final CSV. `status_url` is the
URL for this specific job.

This older URL format is also supported:

[Legacy download URL](https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned&route_id=1002_0/download)

The separate `/disturbance/download?...` URL is recommended because it is
clearer.

## 3. Follow the job

Open the `status_url` returned by the API:

[Example job status](https://emds.carrismetropolitana.pt/disturbance/download/[job__id])
[Example job status](https://emds.carrismetropolitana.pt/disturbance/download/8f8d3c3a-4b85-4cf6-9b0d-12c3d4567890)

While the file is being created, the response is similar to:

```json
{
  "job_id": "8f8d3c3a-4b85-4cf6-9b0d-12c3d4567890",
  "status": "processing",
  "rows": 2207,
  "error": null
}
```

| Status | Meaning |
| --- | --- |
| `queued` | The request is waiting for the worker |
| `processing` | The CSV is being generated |
| `completed` | The CSV is ready |
| `failed` | Generation failed; inspect `error` |

Open the status URL again while the status is `queued` or `processing`.

## 4. Download the CSV

When the job status is `completed`, open the same status URL again. It will
return the CSV file instead of JSON.

The CSV response includes:

- `Content-Type: text/csv`
- `Content-Disposition` with the filename
- `X-Row-Count` with the number of rows

Generated filenames follow this pattern:

```text
api_general_<yearmonth>_<agency_id>_<reference>[_route-<route_id>].csv
```

## Complete filter examples

All records for an agency and month:

[Agency and month](https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned)

Using the `freeflow` reference:

[Freeflow reference](https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=freeflow)

Filtering by disturbance class:

[Disturbance class](https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned&disturbance_class=high)

Filtering by route:

[Route](https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned&route_id=1002_0)

Filtering by trip:

[Trip](https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned&trip_id=1002_0_20260615_0800)

Using every optional filter:

[All optional filters](https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned&disturbance_class=high&route_id=1002_0&trip_id=1002_0_20260615_0800)

To generate a file from any of these URLs, use the same filters with
`/disturbance/download?...`.

## CSV columns

The CSV contains these columns, in this order:

`roadlink_id`, `planned_sequence`, `yearmonth`, `agency_id`, `feed_id`,
`route_id`, `route_name`, `direction_id`, `shape_id`, `trip_id`,
`trip_headsign`, `trip_start_time`, `trip_start_hour`, `day_type`,
`stop_pair_id`, `start_stop_id`, `end_stop_id`, `roadlink_geometry_wkt`,
`geometry_quality`, `start_longitude`, `start_latitude`, `end_longitude`,
`end_latitude`, `reference_type`, `n_events`, `disturbance_class`, `distance`,
`reference_duration`, `observed_duration`, `deviation_duration`,
`pct_deviation_duration`, `reference_speed`, `observed_speed`,
`deviation_speed`, `pct_deviation_speed`.

## Discover available values

Use the discovery pages before creating a job if you are unsure which values
are available:

- [Available values](https://emds.carrismetropolitana.pt/disturbance/available)
- [All routes](https://emds.carrismetropolitana.pt/disturbance/available/routes)
- [Routes for agency 41](https://emds.carrismetropolitana.pt/disturbance/available/routes/41)
- [All trips](https://emds.carrismetropolitana.pt/disturbance/available/trips)
- [Trips for agency 41](https://emds.carrismetropolitana.pt/disturbance/available/trips/41)

## Service status

- [Health](https://emds.carrismetropolitana.pt/health) confirms that the API is running.
- [Readiness](https://emds.carrismetropolitana.pt/ready) checks database connectivity.

## Response codes

| Code | Meaning |
| --- | --- |
| `200` | Metadata or completed CSV download |
| `202` | Job accepted, queued, or still processing |
| `400` | Missing or invalid filters |
| `404` | Job does not exist |
| `429` | Rate limit exceeded |
| `500` | Job generation failed |
| `503` | A required database is unavailable |

## Storage

The API stores job information in `jobs_queue.sqlite`. Generated CSV content
is stored separately as files, not inside SQLite. This keeps the queue small
even when generated datasets are several gigabytes in size.
