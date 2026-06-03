import { describe, it, expect } from "vitest";
import { User } from "@/domain/entities/user";
import { UniqueId } from "@/shared/utils/id";
import { Email } from "@/domain/value-objects/email";
import { InvalidUserError } from "@/domain/errors/invalid-user.error";
import { InvalidEmailError } from "@/domain/errors/invalid-email.error";

const tenantId = UniqueId.generate();

const validCreate = () => ({
  tenantId,
  name: "Maria Silva",
  email: "maria@estudio.com.br",
  passwordHash: "fake-bcrypt-hash-value",
  role: "OWNER" as const,
});

const validInvite = () => ({
  tenantId,
  name: "Bia Souza",
  email: "bia@estudio.com.br",
  role: "STAFF" as const,
});

describe("User", () => {
  describe("create — happy path", () => {
    it("creates an ACTIVE user with all fields", () => {
      const user = User.create(validCreate());

      expect(user.name).toBe("Maria Silva");
      expect(user.email).toBeInstanceOf(Email);
      expect(user.email.value).toBe("maria@estudio.com.br");
      expect(user.passwordHash).toBe("fake-bcrypt-hash-value");
      expect(user.role).toBe("OWNER");
      expect(user.status).toBe("ACTIVE");
      expect(user.isActive).toBe(true);
      expect(user.isOwner).toBe(true);
      expect(user.tenantId).toBe(tenantId);
    });

    it("trims the name", () => {
      const user = User.create({ ...validCreate(), name: "  Maria Silva  " });
      expect(user.name).toBe("Maria Silva");
    });

    it("rejects empty password hash", () => {
      expect(() =>
        User.create({ ...validCreate(), passwordHash: "" }),
      ).toThrow(InvalidUserError);
    });

    it("rejects invalid email", () => {
      expect(() =>
        User.create({ ...validCreate(), email: "not-an-email" }),
      ).toThrow(InvalidEmailError);
    });

    it.each(["", " ", "a"])("rejects name too short: %s", (name) => {
      expect(() => User.create({ ...validCreate(), name })).toThrow(InvalidUserError);
    });
  });

  describe("invite — happy path", () => {
    it("creates an INVITED user without password", () => {
      const user = User.invite(validInvite());

      expect(user.status).toBe("INVITED");
      expect(user.passwordHash).toBeNull();
      expect(user.role).toBe("STAFF");
      expect(user.isActive).toBe(false);
    });

    it("validates email on invite", () => {
      expect(() =>
        User.invite({ ...validInvite(), email: "not-an-email" }),
      ).toThrow(InvalidEmailError);
    });
  });

  describe("setPasswordHash", () => {
    it("activates an INVITED user when password is set", () => {
      const user = User.invite(validInvite());
      expect(user.status).toBe("INVITED");

      user.setPasswordHash("new-bcrypt-hash");

      expect(user.status).toBe("ACTIVE");
      expect(user.passwordHash).toBe("new-bcrypt-hash");
    });

    it("just updates the hash for an already-ACTIVE user", () => {
      const user = User.create(validCreate());
      user.setPasswordHash("a-new-hash");

      expect(user.status).toBe("ACTIVE");
      expect(user.passwordHash).toBe("a-new-hash");
    });

    it("rejects empty hash", () => {
      const user = User.create(validCreate());
      expect(() => user.setPasswordHash("")).toThrow(InvalidUserError);
    });

    it("bumps updatedAt", async () => {
      const user = User.create(validCreate());
      const before = user.updatedAt.getTime();

      await new Promise((r) => setTimeout(r, 2));
      user.setPasswordHash("another-hash");

      expect(user.updatedAt.getTime()).toBeGreaterThan(before);
    });
  });

  describe("disable / reactivate", () => {
    it("disable changes status to DISABLED", () => {
      const user = User.create(validCreate());
      user.disable();

      expect(user.status).toBe("DISABLED");
      expect(user.isActive).toBe(false);
    });

    it("reactivate restores DISABLED to ACTIVE", () => {
      const user = User.create(validCreate());
      user.disable();
      user.reactivate();

      expect(user.status).toBe("ACTIVE");
    });

    it("disable on already-DISABLED is no-op", async () => {
      const user = User.create(validCreate());
      user.disable();
      const t = user.updatedAt.getTime();

      await new Promise((r) => setTimeout(r, 2));
      user.disable();
      expect(user.updatedAt.getTime()).toBe(t);
    });

    it("cannot reactivate a user without password", () => {
      const user = User.invite(validInvite()); // no password
      user.disable(); // now DISABLED without password

      expect(() => user.reactivate()).toThrow(InvalidUserError);
    });
  });

  describe("role transitions", () => {
    it("promoteToOwner upgrades STAFF to OWNER", () => {
      const user = User.create({ ...validCreate(), role: "STAFF" });
      user.promoteToOwner();
      expect(user.role).toBe("OWNER");
    });

    it("promoteToOwner on already-OWNER is no-op", async () => {
      const user = User.create(validCreate()); // OWNER
      const t = user.updatedAt.getTime();
      await new Promise((r) => setTimeout(r, 2));
      user.promoteToOwner();
      expect(user.updatedAt.getTime()).toBe(t);
    });

    it("demoteToStaff downgrades OWNER to STAFF", () => {
      const user = User.create(validCreate()); // OWNER
      user.demoteToStaff();
      expect(user.role).toBe("STAFF");
    });

    it("demoteToStaff refuses CUSTOMER", () => {
      const user = User.create({ ...validCreate(), role: "CUSTOMER" });
      expect(() => user.demoteToStaff()).toThrow(InvalidUserError);
    });
  });

  describe("rename and changeEmail", () => {
    it("rename validates name", () => {
      const user = User.create(validCreate());
      user.rename("Outro Nome");
      expect(user.name).toBe("Outro Nome");

      expect(() => user.rename("a")).toThrow(InvalidUserError);
    });

    it("changeEmail validates via Email VO", () => {
      const user = User.create(validCreate());
      user.changeEmail("novo@email.com");
      expect(user.email.value).toBe("novo@email.com");

      expect(() => user.changeEmail("bad-email")).toThrow(InvalidEmailError);
    });
  });

  describe("equality (inherited)", () => {
    it("two users with same id are equal", () => {
      const a = User.create(validCreate());
      const b = User.restore({
        id: a.id,
        tenantId: a.tenantId,
        name: "Different",
        email: Email.create("other@x.com"),
        passwordHash: "h",
        role: "CUSTOMER",
        status: "ACTIVE",
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      });

      expect(a.equals(b)).toBe(true);
    });

    it("two users with different ids are not equal", () => {
      const a = User.create(validCreate());
      const b = User.create(validCreate());
      expect(a.equals(b)).toBe(false);
    });
  });
});