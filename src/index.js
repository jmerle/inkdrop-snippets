'use babel';

import { CompositeDisposable } from 'event-kit';
import { Controller } from './Controller';

let subscriptions = null;
let controller = null;

export function activate() {
  subscriptions = new CompositeDisposable();

  const activeEditor = inkdrop.getActiveEditor();
  if (activeEditor !== undefined) {
    controller = new Controller(activeEditor.cm);
  } else {
    subscriptions.add(
      inkdrop.onEditorLoad(e => {
        controller = new Controller(e.cm);
      }),
    );
  }

  subscriptions.add(
    inkdrop.onEditorUnload(() => {
      controller.dispose();
    }),
  );
}

export function deactivate() {
  subscriptions.dispose();
  controller.dispose();
}
