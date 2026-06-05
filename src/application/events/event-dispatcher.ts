import type { DomainEvent } from "@/shared/utils/domain-event";

export interface EventHandler<TEvent extends DomainEvent = DomainEvent> {
  readonly eventName: string;
  handle(event: TEvent): Promise<void>;
}

export interface EventDispatcher {
  register(handler: EventHandler): void;
  clear(): void;
  dispatchAll(events: DomainEvent[]): Promise<DispatchError[]>;
}

export interface DispatchError {
  eventName: string;
  handlerName: string;
  error: Error;
}

export class InMemoryEventDispatcher implements EventDispatcher {
  private handlers = new Map<string, EventHandler[]>();

  register(handler: EventHandler): void {
    const list = this.handlers.get(handler.eventName) ?? [];
    list.push(handler);
    this.handlers.set(handler.eventName, list);
  }

  clear(): void {
    this.handlers.clear();
  }

  async dispatchAll(events: DomainEvent[]): Promise<DispatchError[]> {
    const errors: DispatchError[] = [];

    for (const event of events) {
      const handlers = this.handlers.get(event.eventName) ?? [];
      for (const handler of handlers) {
        try {
          await handler.handle(event);
        } catch (err) {
          errors.push({
            eventName: event.eventName,
            handlerName: handler.constructor.name,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    }

    return errors;
  }
}