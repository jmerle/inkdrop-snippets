'use babel';

import { CompositeDisposable } from 'event-kit';
import { Database } from './Database';
import { Editor } from './Editor';

let database = null;
let editor = null;
let subscriptions = null;

export const config = {
  configNotes: {
    title: 'Configuration notes',
    description: 'Comma-separated list of note ids of configuration notes',
    type: 'string',
    default: '',
  },
};

export function activate() {
  database = new Database();
  subscriptions = new CompositeDisposable();

  const activeEditor = inkdrop.getActiveEditor();
  if (activeEditor != null) {
    editor = new Editor(activeEditor, database);
  }

  // Always subscribe, even if an editor is already active: onEditorLoad only fires for
  // editors that load *after* this point, never retroactively for one already active,
  // so there's no risk of double-instantiating the one just handled above. Without
  // this, an editor that unloads and later reloads (e.g. after every note is closed
  // and one is reopened) would leave `editor` pointing at the disposed instance.
  subscriptions.add(
    inkdrop.onEditorLoad(e => {
      editor = new Editor(e, database);
    }),
  );

  subscriptions.add(
    inkdrop.onEditorUnload(() => {
      if (editor !== null) {
        editor.dispose();
        editor = null;
      }
    }),
  );
}

export function deactivate() {
  database.dispose();
  // `editor` is only assigned once an editor is actually loaded/active; if the plugin
  // is deactivated before that happens (e.g. no note was ever opened), it's still null.
  if (editor !== null) {
    editor.dispose();
  }
  subscriptions.dispose();
}
