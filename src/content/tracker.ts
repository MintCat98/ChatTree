// Maintains the ordered list of ChatboxNodes and assigns stable IDs.

import type { ChatboxNode } from '@shared/types';

export class Tracker {
  private nodes: ChatboxNode[] = [];

  add(_element: Element): ChatboxNode {
    // TODO: implement — assign ID, extract text, detect branch info
    throw new Error('TODO');
  }

  getNodes(): ChatboxNode[] {
    return [...this.nodes];
  }

  reset(): void {
    this.nodes = [];
  }
}
