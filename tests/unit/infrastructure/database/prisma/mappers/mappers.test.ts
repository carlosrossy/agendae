import { describe, it, expect } from "vitest";

import { TenantMapper } from "@/infrastructure/database/prisma/mappers/tenant.mapper";
import { UserMapper } from "@/infrastructure/database/prisma/mappers/user.mapper";
import { ServiceMapper } from "@/infrastructure/database/prisma/mappers/service.mapper";
import { ProfessionalMapper } from "@/infrastructure/database/prisma/mappers/professional.mapper";
import { CustomerMapper } from "@/infrastructure/database/prisma/mappers/customer.mapper";
import { BookingMapper } from "@/infrastructure/database/prisma/mappers/booking.mapper";

import { Tenant } from "@/domain/entities/tenant";
import { User } from "@/domain/entities/user";
import { Service } from "@/domain/entities/service";
import { Professional } from "@/domain/entities/professional";
import { Customer } from "@/domain/entities/customer";
import { Booking } from "@/domain/entities/booking";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { Money } from "@/domain/value-objects/money";
import { UniqueId } from "@/shared/utils/id";

describe("Mappers — round trip preservation", () => {
  describe("TenantMapper", () => {
    it("round-trip preserves all fields", () => {
      const original = Tenant.create({
        name: "Estúdio Maria",
        slug: "estudio-maria",
        email: "maria@x.com",
        phone: "(11) 99999-9999",
        timezone: "America/Sao_Paulo",
        minimumLeadTimeMinutes: 120,
      });

      const row = TenantMapper.toPersistence(original);
      const rebuilt = TenantMapper.toEntity(row);

      expect(rebuilt.id).toBe(original.id);
      expect(rebuilt.name).toBe(original.name);
      expect(rebuilt.slug).toBe(original.slug);
      expect(rebuilt.email.value).toBe(original.email.value);
      expect(rebuilt.phone?.digits).toBe(original.phone?.digits);
      expect(rebuilt.timezone).toBe(original.timezone);
      expect(rebuilt.minimumLeadTime.inMinutes).toBe(120);
      expect(rebuilt.status).toBe(original.status);
    });

    it("handles null phone", () => {
      const original = Tenant.create({
        name: "Estúdio Sem Telefone",
        slug: "estudio-sem-telefone",
        email: "x@x.com",
        timezone: "America/Sao_Paulo",
      });

      const row = TenantMapper.toPersistence(original);
      const rebuilt = TenantMapper.toEntity(row);

      expect(rebuilt.phone).toBeNull();
    });
  });

  describe("UserMapper", () => {
    it("round-trip preserves all fields", () => {
      const tenantId = UniqueId.generate();
      const original = User.create({
        tenantId,
        name: "Maria",
        email: "maria@x.com",
        passwordHash: "hashed::secret",
        role: "OWNER",
      });

      const row = UserMapper.toPersistence(original);
      const rebuilt = UserMapper.toEntity(row);

      expect(rebuilt.id).toBe(original.id);
      expect(rebuilt.tenantId).toBe(tenantId);
      expect(rebuilt.email.value).toBe(original.email.value);
      expect(rebuilt.role).toBe("OWNER");
      expect(rebuilt.passwordHash).toBe("hashed::secret");
    });

    it("handles null passwordHash (invited user)", () => {
      const original = User.invite({
        tenantId: UniqueId.generate(),
        name: "Bia",
        email: "bia@x.com",
        role: "STAFF",
      });

      const row = UserMapper.toPersistence(original);
      const rebuilt = UserMapper.toEntity(row);

      expect(rebuilt.passwordHash).toBeNull();
      expect(rebuilt.status).toBe("INVITED");
    });
  });

  describe("ServiceMapper", () => {
    it("round-trip preserves all fields", () => {
      const original = Service.create({
        tenantId: UniqueId.generate(),
        name: "Corte",
        description: "Corte masculino completo",
        durationMinutes: 30,
        priceCents: 5000,
        requiresPayment: true,
      });

      const row = ServiceMapper.toPersistence(original);
      const rebuilt = ServiceMapper.toEntity(row);

      expect(rebuilt.id).toBe(original.id);
      expect(rebuilt.name).toBe("Corte");
      expect(rebuilt.description).toBe("Corte masculino completo");
      expect(rebuilt.duration.inMinutes).toBe(30);
      expect(rebuilt.price.cents).toBe(5000);
      expect(rebuilt.requiresPayment).toBe(true);
    });
  });

  describe("ProfessionalMapper", () => {
    it("round-trip preserves businessHours and serviceIds", () => {
      const tenantId = UniqueId.generate();
      const serviceId1 = UniqueId.generate();
      const serviceId2 = UniqueId.generate();

      const original = Professional.create({
        tenantId,
        name: "Maria",
        bio: "Esteticista há 10 anos",
        businessHours: BusinessHours.create([
          { dayOfWeek: 1, start: "09:00", end: "18:00" },
          { dayOfWeek: 6, start: "09:00", end: "13:00" },
        ]),
        serviceIds: [serviceId1, serviceId2],
      });

      const row = ProfessionalMapper.toPersistence(original);
      const rebuilt = ProfessionalMapper.toEntity(
        // Cast porque toPersistence retorna businessHours como objeto,
        // mas Prisma armazena como Json — runtime equivalente.
        { ...row, businessHours: row.businessHours as unknown as never },
        [serviceId1, serviceId2],
      );

      expect(rebuilt.id).toBe(original.id);
      expect(rebuilt.name).toBe("Maria");
      expect(rebuilt.businessHours.isOpenOn(1)).toBe(true);
      expect(rebuilt.businessHours.isOpenOn(6)).toBe(true);
      expect(rebuilt.businessHours.isOpenOn(0)).toBe(false);
      expect(rebuilt.serviceIds).toHaveLength(2);
      expect(rebuilt.serviceIds).toContain(serviceId1);
      expect(rebuilt.serviceIds).toContain(serviceId2);
    });
  });

  describe("CustomerMapper", () => {
    it("round-trip preserves all fields including optional ones", () => {
      const tenantId = UniqueId.generate();
      const original = Customer.create({
        tenantId,
        name: "João",
        email: "joao@x.com",
        phone: "(11) 99999-9999",
        notes: "Alérgico a esmalte",
      });

      const row = CustomerMapper.toPersistence(original);
      const rebuilt = CustomerMapper.toEntity(row);

      expect(rebuilt.id).toBe(original.id);
      expect(rebuilt.name).toBe("João");
      expect(rebuilt.email.value).toBe("joao@x.com");
      expect(rebuilt.phone?.digits).toBe("11999999999");
      expect(rebuilt.notes).toBe("Alérgico a esmalte");
      expect(rebuilt.isRegistered).toBe(false);
    });
  });

  describe("BookingMapper", () => {
    it("round-trip preserves TimeSlot and Money", () => {
      const tenantId = UniqueId.generate();
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const slot = TimeSlot.create(
        future,
        new Date(future.getTime() + 60 * 60 * 1000),
      );

      const original = Booking.create({
        tenantId,
        customerId: UniqueId.generate(),
        professionalId: UniqueId.generate(),
        serviceId: UniqueId.generate(),
        timeSlot: slot,
        price: Money.fromCents(7500),
        notes: "Primeira vez",
      });

      const row = BookingMapper.toPersistence(original);
      const rebuilt = BookingMapper.toEntity(row);

      expect(rebuilt.id).toBe(original.id);
      expect(rebuilt.timeSlot.start.getTime()).toBe(slot.start.getTime());
      expect(rebuilt.timeSlot.end.getTime()).toBe(slot.end.getTime());
      expect(rebuilt.price.cents).toBe(7500);
      expect(rebuilt.status).toBe("SCHEDULED");
      expect(rebuilt.notes).toBe("Primeira vez");
    });

    it("preserves cancelled booking state", () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const slot = TimeSlot.create(
        future,
        new Date(future.getTime() + 60 * 60 * 1000),
      );
      const original = Booking.create({
        tenantId: UniqueId.generate(),
        customerId: UniqueId.generate(),
        professionalId: UniqueId.generate(),
        serviceId: UniqueId.generate(),
        timeSlot: slot,
        price: Money.fromCents(5000),
      });
      original.cancel("Cliente desistiu");

      const row = BookingMapper.toPersistence(original);
      const rebuilt = BookingMapper.toEntity(row);

      expect(rebuilt.status).toBe("CANCELLED");
      expect(rebuilt.cancellationReason).toBe("Cliente desistiu");
    });
  });
});
