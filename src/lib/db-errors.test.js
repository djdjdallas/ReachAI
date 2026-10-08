import { describe, it, expect } from "vitest";
import { isUndefinedColumn } from "./db-errors";

describe("isUndefinedColumn", () => {
  it("only Postgres 42703", () => {
    expect(isUndefinedColumn({ code: "42703" })).toBe(true);
    expect(isUndefinedColumn({ code: "42P01" })).toBe(false);
    expect(isUndefinedColumn(null)).toBe(false);
  });
});
