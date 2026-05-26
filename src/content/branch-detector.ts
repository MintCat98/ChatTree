// Detects branch changes by diffing DOM snapshots.

import type { ChatboxNode } from '@shared/types';

type Snapshot = string[];

let lastSnapshot: Snapshot = [];

export function takeSnapshot(): Snapshot {
  // TODO: implement — capture current chatbox DOM state
  throw new Error('TODO');
}

export function detectBranch(_nodes: ChatboxNode[]): string | null {
  // TODO: implement — diff lastSnapshot vs current, return navId of branch point or null
  throw new Error('TODO');
}
