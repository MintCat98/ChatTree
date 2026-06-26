// React hook that returns the active message catalog for the panel (issue #100).
// Subscribes to settings.language so every component using it re-renders and
// re-translates instantly when the user switches language in the settings panel.

import { usePanelStore } from './store/panel-store';
import { getMessages, type Messages } from '@shared/i18n';

export function useMessages(): Messages {
  const lang = usePanelStore((s) => s.settings.language);
  return getMessages(lang);
}
