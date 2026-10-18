import { supabase } from './supabase';

/**
 * Subscribe to postgres changes. `handlers` maps a table name to a callback; callbacks for the same
 * burst of events are coalesced (one call per table per `wait` ms). When the channel (re)connects
 * after having been down, every handler is called once so events missed while offline are recovered.
 * Returns an unsubscribe function.
 */
export function watchTables(channelName, handlers, wait = 200) {
  const timers = new Map();
  const fire = (table) => {
    clearTimeout(timers.get(table));
    timers.set(table, setTimeout(() => handlers[table](), wait));
  };

  let channel = supabase.channel(channelName);
  for (const table of Object.keys(handlers)) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => fire(table));
  }

  let everSubscribed = false;
  channel.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      if (everSubscribed) Object.keys(handlers).forEach(fire); // reconnected: resync
      everSubscribed = true;
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn(`[realtime] ${channelName}: ${status}`, err?.message || '');
    }
  });

  return () => {
    timers.forEach(clearTimeout);
    supabase.removeChannel(channel);
  };
}
