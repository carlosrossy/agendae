import { ValueObject } from "@/shared/utils/value-object";
import { InvalidBusinessHoursError } from "@/domain/errors/invalid-business-hours.error";
import type { TimeSlot } from "@/domain/value-objects/time-slot";

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeeklyWindow {
  readonly dayOfWeek: DayOfWeek;
  readonly startMinutes: number;
  readonly endMinutes: number;
}

export interface WeeklyWindowInput {
  dayOfWeek: DayOfWeek;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

interface BusinessHoursProps {
  windows: ReadonlyArray<WeeklyWindow>;
}

export class BusinessHours extends ValueObject<BusinessHoursProps> {
  private constructor(props: BusinessHoursProps) {
    super(props);
  }

  public static create(inputs: WeeklyWindowInput[]): BusinessHours {
    if (!Array.isArray(inputs)) {
      throw new InvalidBusinessHoursError(
        "BusinessHours must be created from an array of weekly windows.",
      );
    }

    const windows: WeeklyWindow[] = inputs.map((input) =>
      BusinessHours.parseInput(input),
    );

    BusinessHours.assertNoOverlapsWithinDay(windows);

    const sorted = [...windows].sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinutes - b.startMinutes,
    );

    return new BusinessHours({ windows: Object.freeze(sorted) });
  }

  public static restore(
    windows: Array<{
      dayOfWeek: number;
      startMinutes: number;
      endMinutes: number;
    }>,
  ): BusinessHours {
    // Rebuild via the public factory — converts minutes back to "HH:MM".
    // Re-validation is cheap and keeps invariants enforced even on restore.
    return BusinessHours.create(
      windows.map((w) => ({
        dayOfWeek: w.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        start: BusinessHours.minutesToTimeString(w.startMinutes),
        end: BusinessHours.minutesToTimeString(w.endMinutes),
      })),
    );
  }

  private static minutesToTimeString(minutes: number): string {
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  private static parseInput(input: WeeklyWindowInput): WeeklyWindow {
    if (
      !Number.isInteger(input.dayOfWeek) ||
      input.dayOfWeek < 0 ||
      input.dayOfWeek > 6
    ) {
      throw new InvalidBusinessHoursError(
        `dayOfWeek must be an integer 0..6, received ${input.dayOfWeek}.`,
      );
    }

    const startMinutes = BusinessHours.parseTime(input.start, "start");
    const endMinutes = BusinessHours.parseTime(input.end, "end");

    if (endMinutes <= startMinutes) {
      throw new InvalidBusinessHoursError(
        `End must be strictly after start within the same day, received ${input.start} → ${input.end}.`,
      );
    }

    return {
      dayOfWeek: input.dayOfWeek,
      startMinutes,
      endMinutes,
    };
  }

  private static parseTime(value: string, label: string): number {
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
      throw new InvalidBusinessHoursError(
        `${label} time must be in "HH:MM" format, received "${value}".`,
      );
    }

    const [hoursStr, minutesStr] = value.split(":");
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new InvalidBusinessHoursError(
        `${label} time out of range (00:00..23:59), received "${value}".`,
      );
    }

    return hours * 60 + minutes;
  }

  private static assertNoOverlapsWithinDay(windows: WeeklyWindow[]): void {
    const byDay = new Map<DayOfWeek, WeeklyWindow[]>();
    for (const w of windows) {
      const list = byDay.get(w.dayOfWeek) ?? [];
      list.push(w);
      byDay.set(w.dayOfWeek, list);
    }

    for (const [day, list] of byDay) {
      const sorted = [...list].sort((a, b) => a.startMinutes - b.startMinutes);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!;
        const curr = sorted[i]!;
        if (curr.startMinutes < prev.endMinutes) {
          throw new InvalidBusinessHoursError(
            `Overlapping windows on day ${day}: ${BusinessHours.formatMinutes(prev.startMinutes)}-${BusinessHours.formatMinutes(prev.endMinutes)} and ${BusinessHours.formatMinutes(curr.startMinutes)}-${BusinessHours.formatMinutes(curr.endMinutes)}.`,
          );
        }
      }
    }
  }

  private static formatMinutes(total: number): string {
    const h = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const m = (total % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }

  public isOpenOn(dayOfWeek: DayOfWeek): boolean {
    return this.props.windows.some((w) => w.dayOfWeek === dayOfWeek);
  }

  public containsSlot(slot: TimeSlot): boolean {
    const startDate = slot.start;
    const endDate = slot.end;

    const startDay = startDate.getUTCDay() as DayOfWeek;
    const endDay = endDate.getUTCDay() as DayOfWeek;
    if (startDay !== endDay) return false;

    const startMinutes =
      startDate.getUTCHours() * 60 + startDate.getUTCMinutes();
    const endMinutes = endDate.getUTCHours() * 60 + endDate.getUTCMinutes();

    return this.props.windows.some(
      (w) =>
        w.dayOfWeek === startDay &&
        w.startMinutes <= startMinutes &&
        w.endMinutes >= endMinutes,
    );
  }

  public listWindows(): ReadonlyArray<WeeklyWindow> {
    return [...this.props.windows];
  }
}
