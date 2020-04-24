'use babel';

import * as fs from 'fs';
import * as path from 'path';
import { Disposable, CompositeDisposable } from 'event-kit';
import { actions } from 'inkdrop';
import { notify } from './utils';

const CONFIG_NOTES_KEY = 'snippets.configNotes';

export class SnippetsDatabase extends Disposable {
  constructor() {
    super(() => this.destroy());

    const configTemplatePath = '../assets/snippets-configuration.md';
    this.configTemplate = fs
      .readFileSync(path.resolve(__dirname, configTemplatePath))
      .toString()
      .trim();

    this.commandListeners = new CompositeDisposable();
    this.registerCommand('new-config', () => this.createConfigNote());

    this.refresh();
  }

  destroy() {
    this.commandListeners.dispose();
  }

  registerCommand(command, cb) {
    this.commandListeners.add(
      inkdrop.commands.add(document.body, {
        [`snippets:${command}`]: event => cb(event),
      }),
    );
  }

  refresh() {
    // TODO(jmerle): Implement, should refresh all snippet configs
  }

  getTriggers() {
    // TODO(jmerle): Implement, should return the triggers in order of priority
    return ['todo'];
  }

  createConfigNote() {
    const indentation = inkdrop.config.get('editor.indentUnit');

    const note = {
      title: 'Snippets',
      body: this.configTemplate.replace(/( ){4}/g, ' '.repeat(indentation)),
    };

    const commandListener = inkdrop.commands.add(document.body, {
      'editor:title:focus': async () => {
        commandListener.dispose();

        try {
          await inkdrop.store.dispatch(actions.editingNote.update(note));
          await inkdrop.store.dispatch(actions.editor.change(true));
          inkdrop.commands.dispatch(document.body, 'core:save-note');

          const { editingNote } = inkdrop.store.getState();
          this.registerConfigNote(editingNote._id);
        } catch (err) {
          notify('Error', 'Could not create new snippets configuration');
          console.error(err);
        }
      },
    });

    inkdrop.commands.dispatch(document.body, 'core:new-note');
  }

  registerConfigNote(noteId) {
    const configNotes = inkdrop.config.get(CONFIG_NOTES_KEY);

    const noteIds = (configNotes || '').split(',').filter(x => x !== '');
    noteIds.push(noteId);

    inkdrop.config.set(CONFIG_NOTES_KEY, noteIds.join(','));
  }
}
