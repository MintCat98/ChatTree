// D3 hierarchy layout canvas — renders nodes and edges from TreeData.

import React, { useRef } from 'react';
import type { TreeData } from '@shared/types';

interface Props {
  tree: TreeData;
  activeNodeId: string | null;
  // TODO: define additional props (direction, onNodeClick)
}

export function TreeMapCanvas(_props: Props): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  // TODO: implement D3 layout + rendering in useEffect
  return <svg ref={svgRef} />;
}
