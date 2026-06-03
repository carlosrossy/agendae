import { ulid } from "ulid";

export type UniqueId = string & { readonly __brand: "UniqueId" };

export const UniqueId = {
  generate(): UniqueId {
    return ulid() as UniqueId;
  },

  from(value: string): UniqueId {
    if (typeof value !== "string" || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(value)) {
      throw new Error(`Invalid UniqueId: "${value}"`);
    }
    return value as UniqueId;
  },
};
