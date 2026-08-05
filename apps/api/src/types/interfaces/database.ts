import type { QueryResultRow } from "pg";
import type { AvailableRow } from "./available.js";

export interface DatabaseAvailableRow extends QueryResultRow, AvailableRow {}

export interface DatabaseAvailableValueRow extends QueryResultRow {
  readonly value: string;
}

export interface DatabaseCountRow extends QueryResultRow {
  readonly count: string;
}
