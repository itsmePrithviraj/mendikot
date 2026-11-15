import type { Seat } from "../game/engine";

export const NAMES = ["You", "Kavya", "Aniruddha", "Rohan"] as const;
export const PARTNER: Seat = 2;
export const nameOf = (seat: Seat) => NAMES[seat];
/** At this table a trick is called a sheep: "1 sheep", "4 sheeps". */
export const sheep = (n: number) => `${n} ${n === 1 ? "sheep" : "sheeps"}`;
