import { createContext, useContext } from "react";
import { NAMES } from "./names";

export const TableIdentity = createContext<{
  names: readonly string[];
  online: boolean;
  connected: readonly boolean[];
}>({
  names: NAMES,
  online: false,
  connected: [true, true, true, true],
});
export const useTableIdentity = () => useContext(TableIdentity);
