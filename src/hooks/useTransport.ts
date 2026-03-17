import { useMemo } from "react";
import { createTransport } from "../transport";
import type { MyCodexTransport } from "../transport/types";

export function useTransport(): MyCodexTransport {
  return useMemo(() => createTransport(), []);
}
