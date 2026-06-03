import { describe, it, expect } from "vitest";
import { Entity, type EntityProps } from "@/shared/utils/entity";
import { UniqueId } from "@/shared/utils/id";

interface FakeProps extends EntityProps {
  name: string;
}

class Fake extends Entity<FakeProps> {
  public static create(name: string): Fake {
    const now = new Date();
    return new Fake({
      id: UniqueId.generate(),
      name,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static restore(props: FakeProps): Fake {
    return new Fake(props);
  }

  public rename(name: string): void {
    this.props = { ...this.props, name };
    this.touch();
  }

  public get name(): string {
    return this.props.name;
  }
}

class Other extends Entity<FakeProps> {
  public static withId(id: UniqueId): Other {
    const now = new Date();
    return new Other({ id, name: "x", createdAt: now, updatedAt: now });
  }
}

describe("Entity (base class)", () => {
  describe("creation", () => {
    it("assigns a generated id on create", () => {
      const a = Fake.create("Alice");

      expect(a.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it("two created entities have different ids", () => {
      const a = Fake.create("Alice");
      const b = Fake.create("Bob");

      expect(a.id).not.toBe(b.id);
    });

    it("sets createdAt and updatedAt on create", () => {
      const before = new Date();
      const a = Fake.create("Alice");
      const after = new Date();

      expect(a.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(a.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(a.updatedAt.getTime()).toBe(a.createdAt.getTime());
    });
  });

  describe("immutability of exposed dates", () => {
    it("mutating the returned createdAt does not affect the entity", () => {
      const a = Fake.create("Alice");
      const exposed = a.createdAt;
      exposed.setFullYear(1999);

      expect(a.createdAt.getFullYear()).not.toBe(1999);
    });
  });

  describe("equality", () => {
    it("two entities with the same id are equal", () => {
      const a = Fake.create("Alice");
      const b = Fake.restore({
        id: a.id,
        name: "Different name but same id",
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      });

      expect(a.equals(b)).toBe(true);
    });

    it("two entities with different ids are not equal", () => {
      const a = Fake.create("Alice");
      const b = Fake.create("Alice");

      expect(a.equals(b)).toBe(false);
    });

    it("entities of DIFFERENT classes with the SAME id are not equal", () => {
      const a = Fake.create("Alice");
      const b = Other.withId(a.id);

      expect(a.equals(b)).toBe(false);
    });

    it("returns false when compared to null or undefined", () => {
      const a = Fake.create("Alice");

      expect(a.equals(null)).toBe(false);
      expect(a.equals(undefined)).toBe(false);
    });
  });

  describe("touch / updatedAt", () => {
    it("calling a mutator updates updatedAt", async () => {
      const a = Fake.create("Alice");
      const before = a.updatedAt.getTime();

      await new Promise((r) => setTimeout(r, 2));
      a.rename("Bob");

      expect(a.updatedAt.getTime()).toBeGreaterThan(before);
    });

    it("createdAt does not change after a mutation", async () => {
      const a = Fake.create("Alice");
      const created = a.createdAt.getTime();

      await new Promise((r) => setTimeout(r, 2));
      a.rename("Bob");

      expect(a.createdAt.getTime()).toBe(created);
    });
  });
});

describe("UniqueId", () => {
  describe("generate", () => {
    it("produces a 26-char ULID", () => {
      const id = UniqueId.generate();
      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it("two calls produce different ids", () => {
      expect(UniqueId.generate()).not.toBe(UniqueId.generate());
    });
  });

  describe("from", () => {
    it("accepts a valid ULID string", () => {
      const generated = UniqueId.generate();
      const restored = UniqueId.from(generated);
      expect(restored).toBe(generated);
    });

    it.each([
      "",
      "abc",
      "not-a-ulid",
      "01HQXT8KMVG7P3R9SXJZQ8N5K",   // 25 chars
      "01HQXT8KMVG7P3R9SXJZQ8N5KFF", // 27 chars
      "01hqxt8kmvg7p3r9sxjzq8n5kf",  // lowercase
    ])("rejects invalid input: %s", (bad) => {
      expect(() => UniqueId.from(bad)).toThrow();
    });
  });
});