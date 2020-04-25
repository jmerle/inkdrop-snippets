'use babel';

import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import * as dateFns from 'date-fns';
import { Disposable, CompositeDisposable } from 'event-kit';
import { actions } from 'inkdrop';
import { notify } from './utils';

const CONFIG_NOTES_KEY = 'snippets.configNotes';

export class Database extends Disposable {
  constructor() {
    super(() => this.destroy());

    this.editor = null;

    const configTemplatePath = '../assets/snippets-configuration.md';
    this.configTemplate = fs
      .readFileSync(path.resolve(__dirname, configTemplatePath))
      .toString()
      .trim();

    this.commandListeners = new CompositeDisposable();

    this.registerCommand('snippets:new-config', () => this.createConfigNote());

    this.registerCommand('core:save-note', () => {
      // Wait a bit so the actual save is done before calling refresh
      this.refreshAfter(250);
    });

    this.registerCommand('core:delete-note', () => {
      // Wait a bit so the note is actually deleted before calling refresh
      this.refreshAfter(250);
    });

    this.refresh();
  }

  destroy() {
    this.commandListeners.dispose();
  }

  registerCommand(command, cb) {
    this.commandListeners.add(
      inkdrop.commands.add(document.body, {
        [command]: event => cb(event),
      }),
    );
  }

  async refresh() {
    this.snippets = {};

    const db = inkdrop.main.dataStore.getLocalDB();
    const noteIds = await this.getConfigNoteIds();

    for (const noteId of noteIds) {
      try {
        const note = await db.notes.get(noteId);
        const body = note.body.trim();

        if (body === '') {
          continue;
        }

        if (!body.startsWith('```js') || !body.endsWith('```')) {
          notify('Error', `Note '${noteId}' is not a valid snippets config`);
          continue;
        }

        const jsCode = body.substring(
          '```js'.length,
          body.length - '```'.length - 1,
        );

        const context = { ...dateFns };
        const script = new vm.Script(`snippets = ${jsCode};`);
        script.runInNewContext(context);

        for (const snippet of context.snippets) {
          this.snippets[snippet.trigger.toLowerCase()] = snippet.content;
        }
      } catch (err) {
        notify('Error', `Could not load snippets from note '${noteId}'`);
        console.error(err);
      }
    }

    if (this.editor !== null) {
      this.editor.refresh();
    }
  }

  refreshAfter(ms) {
    setTimeout(() => this.refresh(), ms);
  }

  getTriggers() {
    return Object.keys(this.snippets);
  }

  getContent(trigger) {
    const content = this.snippets[trigger];

    return new Promise((resolve, reject) => {
      try {
        const result = typeof content === 'function' ? content() : content;

        Promise.resolve(result)
          .then(actualContent => resolve(`${actualContent}`))
          .catch(err => {
            if (err instanceof Error) {
              reject(err);
            } else {
              reject(new Error(err));
            }
          });
      } catch (err) {
        if (err instanceof Error) {
          reject(err);
        } else {
          reject(new Error(err));
        }
      }
    });
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

  async registerConfigNote(noteId) {
    const noteIds = await this.getConfigNoteIds();
    noteIds.push(noteId);
    inkdrop.config.set(CONFIG_NOTES_KEY, noteIds.join(','));
  }

  async getConfigNoteIds() {
    const db = inkdrop.main.dataStore.getLocalDB();

    const configNotes = inkdrop.config.get(CONFIG_NOTES_KEY);
    const noteIds = (configNotes || '').split(',').filter(x => x !== '');

    const existingNoteIds = [];

    for (const noteId of noteIds) {
      try {
        const note = await db.notes.get(noteId);
        if (note.bookId !== 'trash') {
          existingNoteIds.push(noteId);
        }
      } catch (err) {
        // Do nothing, note with given id does not exist
      }
    }

    inkdrop.config.set(CONFIG_NOTES_KEY, existingNoteIds.join(','));
    return existingNoteIds;
  }
}
