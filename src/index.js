'use babel';

import { CompositeDisposable } from 'event-kit';
import { Editor } from './Editor';
import { SnippetsDatabase } from './SnippetsDatabase';

let database = null;
let editor = null;
let subscriptions = null;

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
    editor = new Editor(activeEditor.cm, database);
  } else {
    subscriptions.add(
      inkdrop.onEditorLoad(e => {
        editor = new Editor(e.cm, database);
      }),
    );
  }

  subscriptions.add(
    inkdrop.onEditorUnload(() => {
      editor.dispose();
    }),
  );
}

export function deactivate() {
  database.dispose();
  editor.dispose();
  subscriptions.dispose();
}
