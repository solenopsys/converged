// date-support.test.ts
import { describe, test, expect } from "bun:test";

// The service is called directly. Date handling is a property of the
// implementation, not of a transport, so exercising it does not need a socket,
// a port or a client — those only decide how the call arrives.
class DateTestService {
  echoDate(date: Date): Date {
    return date;
  }

  echoDates(dates: Date[]): Date[] {
    return dates;
  }

  echoObject(obj: { name: string; createdAt: Date }): {
    name: string;
    createdAt: Date;
  } {
    return obj;
  }

  getCurrentDate(): Date {
    return new Date();
  }

  getDateRange(
    start: Date,
    end: Date,
  ): { start: Date; end: Date; days: number } {
    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    return { start, end, days };
  }

  async *streamDates(
    count: number,
  ): AsyncIterable<{ index: number; date: Date }> {
    for (let i = 0; i < count; i++) {
      yield { index: i, date: new Date(Date.now() + i * 1000) };
    }
  }
}

describe("Date Type Support", () => {
  const service = new DateTestService();

  test("returns a Date parameter unchanged", () => {
    const testDate = new Date("2024-01-15T10:30:00.000Z");
    const result = service.echoDate(testDate);

    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(testDate.toISOString());
  });

  test("handles an array of Dates", () => {
    const dates = [
      new Date("2024-01-01T00:00:00.000Z"),
      new Date("2024-06-15T12:30:00.000Z"),
      new Date("2024-12-31T23:59:59.999Z"),
    ];

    const result = service.echoDates(dates);

    expect(result).toHaveLength(3);
    result.forEach((date, index) => {
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe(dates[index]!.toISOString());
    });
  });

  test("handles a Date nested in an object", () => {
    const createdAt = new Date("2024-03-20T08:15:30.000Z");
    const result = service.echoObject({ name: "Test Object", createdAt });

    expect(result.name).toBe("Test Object");
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  test("returns a Date the service creates itself", () => {
    const before = Date.now();
    const result = service.getCurrentDate();

    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test("computes over multiple Date parameters", () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const end = new Date("2024-01-31T00:00:00.000Z");

    const result = service.getDateRange(start, end);

    expect(result.start.toISOString()).toBe(start.toISOString());
    expect(result.end.toISOString()).toBe(end.toISOString());
    expect(result.days).toBe(30);
  });

  test("yields Dates from a stream", async () => {
    const received: { index: number; date: Date }[] = [];
    for await (const item of service.streamDates(3)) received.push(item);

    expect(received).toHaveLength(3);
    received.forEach((item, index) => {
      expect(item.index).toBe(index);
      expect(item.date).toBeInstanceOf(Date);
    });
  });

  test("preserves millisecond precision", () => {
    const precise = new Date("2024-07-04T12:34:56.789Z");
    expect(service.echoDate(precise).getMilliseconds()).toBe(789);
  });
});
