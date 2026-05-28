// Settings bar — controls for panel position, direction, opacity, and sort order.

import React from 'react';
import type { UserSettings } from '@shared/types';

interface Props {
  settings: UserSettings;
  onSettingsChange: (patch: Partial<UserSettings>) => void;
}

export function ControlBar(_props: Props): React.ReactElement {
  // TODO: implement
  return <div />;
}
