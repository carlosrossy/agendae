import type { DomainEvent } from "@/shared/utils/domain-event";
import type { EventHandler } from "../event-dispatcher";

export class RecordingEventHandler<TEvent extends DomainEvent = DomainEvent>
  implements EventHandler<TEvent>
{
  public readonly received: TEvent[] = [];

  constructor(public readonly eventName: string) {}

  async handle(event: TEvent): Promise<void> {
    this.received.push(event);
  }
}

export class FailingEventHandler implements EventHandler {
  constructor(
    public readonly eventName: string,
    public readonly errorMessage = "intentional test failure",
  ) {}

  async handle(): Promise<void> {
    throw new Error(this.errorMessage);
  }
}