// Content Script entry point — initialises all modules on claude.ai.

import { startObserving } from './observer';
import { watchPageChanges } from './page-watcher';
import { injectPanel } from './ui-injector';

function init(): void {
  // TODO: implement initialisation sequence
  watchPageChanges((_url) => {
    // TODO: handle new chat session
  });
  injectPanel();
  startObserving();
}

init();
