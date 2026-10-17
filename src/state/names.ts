import type { Seat } from "../game/engine";

export const NAMES = ["You", "Kavya", "Aniruddha", "Rohan"] as const;
export const PARTNER: Seat = 2;
export const nameOf = (seat: Seat) => NAMES[seat];
