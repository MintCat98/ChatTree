// "AI is working" strip across the top of the Interactive Map (issue #165).
//
// The summary queue runs in the background service worker and a single turn can
// take 30s, so without this a slow run is indistinguishable from a broken one.
// The status itself is published to chrome.storage by the queue and lands in
// the store via App.tsx — this component only renders it.
//
// Regular React (not d3) even though it sits on the map: it is a plain HTML
// overlay in .nav-im-container, outside the SVG, so it neither pans nor zooms
// with the graph and does not force a d3 rebuild every second.

import { useEffect, useState } from 'react';
import { usePanelStore } from '../store/panel-store';
import { useMessages } from '../i18n';

// mm:ss — the counter answers "should I still be waiting?", so seconds matter
// early and minutes matter later. Hours would mean something is very wrong.
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function SummaryActivity() {
  const t = useMessages();
  const { active, startedAt, pending } = usePanelStore((s) => s.summaryStatus);
  const [now, setNow] = useState(() => Date.now());

  // Tick only while visible. An idle interval would wake the panel once a
  // second for the whole life of the tab.
  useEffect(() => {
    if (!active) return;
    setNow(Date.now()); // no wait for the first tick
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, startedAt]);

  if (!active) return null;

  // startedAt comes from the SW's clock; both run on the same machine, but a
  // clock adjustment mid-run could still make this negative — formatElapsed
  // floors at zero rather than rendering "-1:-3".
  const elapsed = formatElapsed(now - startedAt);

  return (
    <div className="nav-im-activity" role="status" aria-live="polite">
      <span className="nav-im-activity-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="nav-im-activity-label">{t.summaryRunning}</span>
      <span className="nav-im-activity-elapsed">{elapsed}</span>
      {pending > 0 && (
        <span className="nav-im-activity-pending">{t.summaryQueued(pending)}</span>
      )}
    </div>
  );
}
