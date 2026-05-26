// Renders a single node in the tree map.

import React from 'react';
import type { ChatboxNode } from '@shared/types';

interface Props {
  node: ChatboxNode;
  isActive: boolean;
  // TODO: define additional props (x, y, onClick)
}

export function TreeNode(_props: Props): React.ReactElement {
  // TODO: implement
  return <g />;
}
