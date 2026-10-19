/** Daily reports written without a connection wait here (localStorage) and are sent when the browser is back online. */
const KEY = 'selora-dpr-queue';

export function readQueue() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function writeQueue(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
}
/** One pending report per project and date: a newer save replaces the older one. */
export function enqueue(report) {
  const rest = readQueue().filter((r) => !(r.project_id === report.project_id && r.report_date === report.report_date));
  writeQueue([...rest, { ...report, queuedAt: new Date().toISOString() }]);
}
export const queueSize = () => readQueue().length;

/** Calls `send(report)` for each queued report; keeps the ones that still fail. Returns how many were sent. */
export async function flushQueue(send) {
  const items = readQueue();
  const keep = [];
  let sent = 0;
  for (const item of items) {
    try { if (await send(item)) sent += 1; else keep.push(item); } catch { keep.push(item); }
  }
  writeQueue(keep);
  return sent;
}
export const isOfflineError = (error) => !navigator.onLine || /failed to fetch|networkerror|load failed/i.test(error?.message || '');
