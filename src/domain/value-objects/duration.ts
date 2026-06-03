import { ValueObject } from "@/shared/utils/value-object";
import { InvalidDurationError } from "@/domain/errors/invalid-duration.error";

interface DurationProps {
  minutes: number;
}

export class Duration extends ValueObject<DurationProps> {
  private constructor(props: DurationProps) {
    super(props);
  }

  public static fromMinutes(minutes: number): Duration {
    if (!Number.isInteger(minutes)) {
      throw new InvalidDurationError(
        `Duration must be an integer number of minutes, received ${minutes}.`,
      );
    }
    if (minutes <= 0) {
      throw new InvalidDurationError(
        `Duration must be strictly positive, received ${minutes}.`,
      );
    }

    return new Duration({ minutes });
  }

  public static fromHours(hours: number): Duration {
    if (!Number.isFinite(hours)) {
      throw new InvalidDurationError(
        `Duration in hours must be a finite number, received ${hours}.`,
      );
    }

    const totalMinutes = hours * 60;

    return Duration.fromMinutes(totalMinutes);
  }

  public get inMinutes(): number {
    return this.props.minutes;
  }

  public get inHours(): number {
    return this.props.minutes / 60;
  }

  public plus(other: Duration): Duration {
    return Duration.fromMinutes(this.inMinutes + other.inMinutes);
  }

  public isGreaterThan(other: Duration): boolean {
    return this.inMinutes > other.inMinutes;
  }

  public isLessThan(other: Duration): boolean {
    return this.inMinutes < other.inMinutes;
  }

  public override toString(): string {
    const hours = Math.floor(this.props.minutes / 60);
    const minutes = this.props.minutes % 60;

    if (hours === 0) return `${minutes}min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h${minutes.toString().padStart(2, "0")}`;
  }
}
