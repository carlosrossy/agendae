import { ValueObject } from "@/shared/utils/value-object";
import { InvalidTimeSlotError } from "@/domain/errors/invalid-time-slot.error";
import { Duration } from "@/domain/value-objects/duration";

interface TimeSlotProps {
  start: Date;
  end: Date;
}

export class TimeSlot extends ValueObject<TimeSlotProps> {
  private constructor(props: TimeSlotProps) {
    super(props);
  }

  public static create(start: Date, end: Date): TimeSlot {
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
      throw new InvalidTimeSlotError("Start date is invalid.");
    }
    if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
      throw new InvalidTimeSlotError("End date is invalid.");
    }
    if (end.getTime() <= start.getTime()) {
      throw new InvalidTimeSlotError(
        `End must be strictly after start. Received start=${start.toISOString()} end=${end.toISOString()}.`,
      );
    }

    return new TimeSlot({
      start: new Date(start.getTime()),
      end: new Date(end.getTime()),
    });
  }

  public static fromDuration(start: Date, duration: Duration): TimeSlot {
    const end = new Date(start.getTime() + duration.inMinutes * 60_000);
    return TimeSlot.create(start, end);
  }

  public get start(): Date {
    return new Date(this.props.start.getTime());
  }

  public get end(): Date {
    return new Date(this.props.end.getTime());
  }

  public get duration(): Duration {
    const diffMs = this.props.end.getTime() - this.props.start.getTime();
    const diffMinutes = Math.round(diffMs / 60_000);
    return Duration.fromMinutes(diffMinutes);
  }

  public overlaps(other: TimeSlot): boolean {
    return (
      this.props.start.getTime() < other.props.end.getTime() &&
      other.props.start.getTime() < this.props.end.getTime()
    );
  }

  public contains(other: TimeSlot): boolean {
    return (
      this.props.start.getTime() <= other.props.start.getTime() &&
      this.props.end.getTime() >= other.props.end.getTime()
    );
  }

  public isAdjacentTo(other: TimeSlot): boolean {
    return (
      this.props.end.getTime() === other.props.start.getTime() ||
      this.props.start.getTime() === other.props.end.getTime()
    );
  }

  public isInThePast(now: Date): boolean {
    return this.props.end.getTime() <= now.getTime();
  }

  public override toString(): string {
    return `[${this.props.start.toISOString()} → ${this.props.end.toISOString()}]`;
  }
}
