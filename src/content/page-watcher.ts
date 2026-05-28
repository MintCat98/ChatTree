// Detects SPA navigation on claude.ai and fires a callback on new chat URLs.

import { CHAT_URL_PATTERN } from '@shared/constants';

export function watchPageChanges(onEnter: (url: string) => void): void {
  // TODO: implement — intercept history.pushState / popstate, match CHAT_URL_PATTERN
  void CHAT_URL_PATTERN;
  void onEnter;
  throw new Error('TODO');
}
