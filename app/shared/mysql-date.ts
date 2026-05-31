import { Temporal } from "temporal-polyfill";

export type MysqlDate = Date | string;

export function toInstant(value: MysqlDate): Temporal.Instant {
  return value instanceof Date
    ? Temporal.Instant.fromEpochMilliseconds(value.getTime())
    : Temporal.Instant.from(value);
}

export function toMysqlDate(value: Temporal.Instant): Date {
  return new Date(value.epochMilliseconds);
}
