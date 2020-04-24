'use babel';

import { CompositeDisposable } from 'event-kit';
import { Controller } from './Controller';
import { SnippetsDatabase } from './SnippetsDatabase';

let subscriptions = null;
let controller = null;
let database = null;

export const config = {
  configNotes: {
    title: 'Configuration notes',
    description:
      'Comma-separated list of note ids of notes containing snippet configurations',
    type: 'string',
    default: '',
  },
};

export function activate() {
  database = new SnippetsDatabase();
  subscriptions = new CompositeDisposable();

  const activeEditor = inkdrop.getActiveEditor();
  if (activeEditor !== undefined) {
    controller = new Controller(activeEditor.cm, database);
  } else {
    subscriptions.add(
      inkdrop.onEditorLoad(e => {
        controller = new Controller(e.cm, database);
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
  database.dispose();
}
