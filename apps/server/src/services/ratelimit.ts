/** 内存滑动窗口限流（IP + deviceId 双维度，活动级规模足够） */

const windows = new Map<string, number[]>();

/**
 * @returns true = 放行；false = 超限
 */
export function allow(key: string, max: number, windowMs = 3600_000): boolean {
  const now = Date.now();
  const arr = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    windows.set(key, arr);
    return false;
  }
  arr.push(now);
  windows.set(key, arr);
  return true;
}

/** 定期清理，防内存缓慢增长 */
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of windows) {
    const kept = arr.filter((t) => now - t < 3600_000);
    if (kept.length === 0) windows.delete(k);
    else windows.set(k, kept);
  }
}, 10 * 60_000).unref();
