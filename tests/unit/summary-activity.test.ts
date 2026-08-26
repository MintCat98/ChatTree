// Elapsed-time formatting for the summary activity strip (issue #165).
//
// The counter's whole job is to let the user judge "is this stuck?", so the
// cases that matter are the boundaries and the defensive ones — a clock
// adjustment mid-run can hand it a negative delta.

import { formatElapsed } from '@content/panel/components/SummaryActivity';

describe('formatElapsed', () => {
  it('renders sub-minute durations with a zero minute field', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(7_000)).toBe('0:07');
    expect(formatElapsed(59_000)).toBe('0:59');
  });

  it('rolls over to minutes', () => {
    expect(formatElapsed(60_000)).toBe('1:00');
    expect(formatElapsed(83_000)).toBe('1:23');
    expect(formatElapsed(600_000)).toBe('10:00');
  });

  it('truncates rather than rounds, so the counter never shows a second early', () => {
    expect(formatElapsed(1_999)).toBe('0:01');
  });

  it('floors at zero instead of rendering a negative clock', () => {
    // startedAt comes from the SW's clock; a backwards adjustment mid-run would
    // otherwise produce "-1:-3".
    expect(formatElapsed(-5_000)).toBe('0:00');
  });

  it('always pads seconds to two digits', () => {
    expect(formatElapsed(61_000)).toBe('1:01');
  });
});
