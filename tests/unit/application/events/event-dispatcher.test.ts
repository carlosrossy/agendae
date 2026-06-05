import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryEventDispatcher,
} from "@/application/events/event-dispatcher";
import {
  RecordingEventHandler,
  FailingEventHandler,
} from "@/application/events/handlers/in-memory-logging-handler";

import { BookingCancelled, BookingCreated } from "@/domain/events/booking-events";
import { UniqueId } from "@/shared/utils/id";

const makeEvent = (eventName: "created" | "cancelled" = "created") => {
  const aggregateId = UniqueId.generate();
  const tenantId = UniqueId.generate();
  if (eventName === "cancelled") {
    return new BookingCancelled(aggregateId, tenantId, null);
  }
  return new BookingCreated(
    aggregateId,
    tenantId,
    UniqueId.generate(),
    UniqueId.generate(),
    UniqueId.generate(),
  );
};

describe("InMemoryEventDispatcher", () => {
  let dispatcher: InMemoryEventDispatcher;

  beforeEach(() => {
    dispatcher = new InMemoryEventDispatcher();
  });

  describe("register + dispatch", () => {
    it("delivers event to the handler matching the event name", async () => {
      const handler = new RecordingEventHandler<BookingCreated>("booking.created");
      dispatcher.register(handler);

      const event = makeEvent("created");
      await dispatcher.dispatchAll([event]);

      expect(handler.received).toHaveLength(1);
      expect(handler.received[0]).toBe(event);
    });

    it("does NOT deliver to handlers of unrelated event names", async () => {
      const cancelledHandler = new RecordingEventHandler("booking.cancelled");
      dispatcher.register(cancelledHandler);

      await dispatcher.dispatchAll([makeEvent("created")]);

      expect(cancelledHandler.received).toHaveLength(0);
    });

    it("delivers ONE event to MULTIPLE handlers of the same name", async () => {
      const a = new RecordingEventHandler("booking.created");
      const b = new RecordingEventHandler("booking.created");
      dispatcher.register(a);
      dispatcher.register(b);

      await dispatcher.dispatchAll([makeEvent("created")]);

      expect(a.received).toHaveLength(1);
      expect(b.received).toHaveLength(1);
    });

    it("delivers in registration order", async () => {
      const order: string[] = [];
      const createHandler = (name: string): RecordingEventHandler => {
        const h = new RecordingEventHandler("booking.created");
        const orig = h.handle.bind(h);
        h.handle = async (event) => {
          order.push(name);
          await orig(event);
        };
        return h;
      };
      dispatcher.register(createHandler("first"));
      dispatcher.register(createHandler("second"));
      dispatcher.register(createHandler("third"));

      await dispatcher.dispatchAll([makeEvent("created")]);

      expect(order).toEqual(["first", "second", "third"]);
    });

    it("delivers MULTIPLE events in given order", async () => {
      const handler = new RecordingEventHandler("booking.created");
      dispatcher.register(handler);

      const e1 = makeEvent("created");
      const e2 = makeEvent("created");
      await dispatcher.dispatchAll([e1, e2]);

      expect(handler.received).toEqual([e1, e2]);
    });

    it("does NOTHING when no handlers registered", async () => {
      const errors = await dispatcher.dispatchAll([makeEvent("created")]);
      expect(errors).toHaveLength(0);
    });

    it("does NOTHING when events array is empty", async () => {
      const handler = new RecordingEventHandler("booking.created");
      dispatcher.register(handler);

      const errors = await dispatcher.dispatchAll([]);

      expect(errors).toHaveLength(0);
      expect(handler.received).toHaveLength(0);
    });
  });

  describe("failure isolation", () => {
    it("does not stop the loop when one handler throws", async () => {
      const failing = new FailingEventHandler("booking.created", "boom");
      const ok = new RecordingEventHandler("booking.created");
      dispatcher.register(failing);
      dispatcher.register(ok);

      const errors = await dispatcher.dispatchAll([makeEvent("created")]);

      // ok handler still ran
      expect(ok.received).toHaveLength(1);
      // failure was recorded, not thrown
      expect(errors).toHaveLength(1);
      expect(errors[0]?.handlerName).toBe("FailingEventHandler");
      expect(errors[0]?.error.message).toBe("boom");
    });

    it("records errors from multiple failing handlers", async () => {
      dispatcher.register(new FailingEventHandler("booking.created", "first"));
      dispatcher.register(new FailingEventHandler("booking.created", "second"));

      const errors = await dispatcher.dispatchAll([makeEvent("created")]);

      expect(errors).toHaveLength(2);
      expect(errors.map((e) => e.error.message)).toEqual(["first", "second"]);
    });
  });

  describe("clear", () => {
    it("removes all registered handlers", async () => {
      const handler = new RecordingEventHandler("booking.created");
      dispatcher.register(handler);

      dispatcher.clear();

      await dispatcher.dispatchAll([makeEvent("created")]);

      expect(handler.received).toHaveLength(0);
    });
  });

  describe("routes by exact name", () => {
    it("delivers BookingCancelled only to its handler, not BookingCreated handler", async () => {
      const createdHandler = new RecordingEventHandler("booking.created");
      const cancelledHandler = new RecordingEventHandler("booking.cancelled");
      dispatcher.register(createdHandler);
      dispatcher.register(cancelledHandler);

      const events = [makeEvent("created"), makeEvent("cancelled")];
      await dispatcher.dispatchAll(events);

      expect(createdHandler.received).toHaveLength(1);
      expect(createdHandler.received[0]).toBeInstanceOf(BookingCreated);
      expect(cancelledHandler.received).toHaveLength(1);
      expect(cancelledHandler.received[0]).toBeInstanceOf(BookingCancelled);
    });
  });
});