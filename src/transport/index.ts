import { IpcTransport } from "./ipc-transport";
import { HttpTransport } from "./http-transport";
import type { MyCodexTransport } from "./types";

/**
 * 自动检测运行环境，返回对应的 Transport 实现：
 * - Electron 环境（window.mycodex 存在）→ IpcTransport
 * - 浏览器/Web 环境 → HttpTransport
 */
export function createTransport(): MyCodexTransport {
  if (typeof window !== "undefined" && "mycodex" in window) {
    return new IpcTransport();
  }
  return new HttpTransport();
}

export { IpcTransport } from "./ipc-transport";
export { HttpTransport } from "./http-transport";
export type { MyCodexTransport } from "./types";
