import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 稳定的设备 ID(localStorage，防刷第二维度) */
export function deviceId(): string {
  const KEY = "w2s-device-id";
  try {
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = `dev-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return `dev-anon-${Math.random().toString(36).slice(2, 12)}`;
  }
}
