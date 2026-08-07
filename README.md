# DeployEMDS disturbance data API

The deployEMDS disturbance API provides Carris Metropolitana road-link disturbance data,
for Lisbon metropolitan area.

To know more about the project and TML use case, please visit 
``` https://go.tmlmobilidade.pt/reference/projects/deployEMDS ```


## Disturbance API

``` https://emds.carrismetropolitana.pt/disturbance ```



## How the API works

The generated CSV files can be very large, so the API creates them in the
background and returns them inside a ZIP archive:

1. Open a URL with the required filters.
2. The API reports how many rows match.
3. Add `/download` to start a generation job.
4. Open the returned job URL while the file is being generated.
5. When the job is complete, that same URL downloads a ZIP containing the CSV.

The first `/download` response is a job status, not the ZIP itself.

## Required filters

| Filter | Meaning | Examples |
| --- | --- | --- |
| `yearmonth` | Month in `YYYYMM` format | `202606` |
| `agency_id` | Carris Metropolitana area | `41`, `42`, `43`, `44` |
| `reference` | Comparison reference | `planned`, `freeflow` |

Optional filters can be combined in any combination:

| Filter | Meaning | Example |
| --- | --- | --- |
| `disturbance_class` | Disturbance category | `e - severe_late` |
| `route_id` | Route to include | `1002_0` |
| `trip_id` | Specific trip to include | `1002_0_20260615_0800` |

## 1. Check the number of rows

Open the filtered URL without `/download`:

``` https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned ```

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

``` https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned&route_id=1002_0/download ```

The API returns a job similar to:

```json
{
  "job_id": "8f8d3c3a-4b85-4cf6-9b0d-12c3d4567890",
  "status": "queued",
  "rows": 2207,
  "processed_rows": 0,
  "remaining_rows": 2207,
  "status_url": "/disturbance/download/8f8d3c3a-4b85-4cf6-9b0d-12c3d4567890"
}
```

`rows` is the expected number of rows in the final CSV. `status_url` is the
URL for this specific job.

## 3. Follow the job

Open the `status_url` returned by the API:

``` https://emds.carrismetropolitana.pt/disturbance/download/8f8d3c3a-4b85-4cf6-9b0d-12c3d4567890 ```

While the file is being created, the response is similar to:

```json
{
  "job_id": "8f8d3c3a-4b85-4cf6-9b0d-12c3d4567890",
  "status": "processing",
  "rows": 2207,
  "processed_rows": 1000,
  "remaining_rows": 1207,
  "error": null
}
```

`rows` is the expected total, `processed_rows` is the number already written,
and `remaining_rows` is the number still to generate. Poll/refresh `status_url` again
to see these values update. `status` changes from `queued` (the request is waiting
for the worker) to `processing` (the CSV is being generated internally). 


## 4. Download the ZIP

When the system completes the process
the same URL automatically downloads a ZIP archive containing one CSV file.

The ZIP response includes:

- `Content-Type: application/zip`
- `Content-Disposition` with the ZIP filename
- `X-Row-Count` with the number of rows

Generated filenames follow this pattern:

```text
api_general_<yearmonth>_<agency_id>_<reference>[_route-<route_id>].zip
```

The CSV inside the ZIP keeps the matching `.csv` filename.

## Complete filter examples

All records for an agency, month and a reference (the mandatory filters):

``` https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned ```

Using the `freeflow` reference:

``` https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=freeflow ```

Filtering including disturbance class:

``` https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned&disturbance_class=e - severe_late ```

Filtering including route:

``` https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned&route_id=1002_0 ```

Filtering including trip:

``` https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned&trip_id=1002_0_20260615_0800 ```

Using every optional filter:

``` https://emds.carrismetropolitana.pt/disturbance?yearmonth=202606&agency_id=41&reference=planned&route_id=1002_0&trip_id=1002_0_3_1030_1059_0_1&disturbance_class=e - severe_late ```

To generate a file from any of these URLs, use the same filters adding at the end
`/download`.


## Discover available values

Use the discovery pages before creating a job if you are unsure which values
are available:

``` https://emds.carrismetropolitana.pt/disturbance/available ```

``` https://emds.carrismetropolitana.pt/disturbance/available/routes ```

``` https://emds.carrismetropolitana.pt/disturbance/available/routes/41 ```

``` https://emds.carrismetropolitana.pt/disturbance/available/trips ```

``` https://emds.carrismetropolitana.pt/disturbance/available/trips/41 ```


## Response codes

| Code | Meaning |
| --- | --- |
| `200` | Metadata or completed CSV download |
| `202` | Job accepted, queued, or still processing |
| `400` | Missing or invalid filters |
| `404` | Job does not exist |

## Storage

The API stores job information in `jobs_queue.sqlite`. Generated CSV content
is stored separately as files, not inside SQLite. This keeps the queue small
even when generated datasets are several gigabytes in size.

Generated files are retained for seven days.


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
