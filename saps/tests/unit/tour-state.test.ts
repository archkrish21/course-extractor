import { describe, it, expect } from "vitest";
import { readTourValue } from "@/lib/hooks/tour-state";

describe("readTourValue", () => {
  it("treats undefined as neither completed nor declined", () => {
    expect(readTourValue(undefined)).toEqual({ completed: false, declined: false });
  });

  it("treats legacy boolean true as completed", () => {
    expect(readTourValue(true)).toEqual({ completed: true, declined: false });
  });

  it("treats legacy boolean false as not completed", () => {
    expect(readTourValue(false)).toEqual({ completed: false, declined: false });
  });

  it("reads object completed flag", () => {
    expect(readTourValue({ completed: true })).toEqual({ completed: true, declined: false });
  });

  it("reads object declined flag", () => {
    expect(readTourValue({ declined: true })).toEqual({ completed: false, declined: true });
  });

  it("supports both flags simultaneously", () => {
    expect(readTourValue({ completed: true, declined: true })).toEqual({ completed: true, declined: true });
  });

  it("treats empty object as neither", () => {
    expect(readTourValue({})).toEqual({ completed: false, declined: false });
  });
});
