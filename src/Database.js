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

    this.registerCommand('snippets:toggle-config', () => {
      const { noteListBar } = inkdrop.store.getState();

      for (const noteId of noteListBar.actionTargetNoteIds) {
        this.toggleConfigNote(noteId);
      }
    });

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
      let note = null;

      try {
        const jsRegex = /```js\n([\s\S]*?)\n```/g;

        note = await db.notes.get(noteId);
        const body = note.body.trim();

        if (body === '') {
          continue;
        }

        if (body.search(jsRegex) === -1) {
          notify(
            'Error',
            `Note '${note.title}' is not a valid snippets configuration`,
          );

          continue;
        }

        const matches = body.matchAll(jsRegex);

        for (const jsCode of matches) {
          const context = { ...dateFns };
          const script = new vm.Script(`snippets = ${jsCode[1]};`);
          script.runInNewContext(context);

          for (const snippet of context.snippets) {
            this.snippets[snippet.trigger.toLowerCase()] = snippet.content;
          }
        }
      } catch (err) {
        const name = note === null ? noteId : note.title;
        notify('Error', `Could not load snippets from note '${name}'`);
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

  getContent(trigger, selection) {
    const content = this.snippets[trigger];

    return new Promise((resolve, reject) => {
      try {
        const result =
          typeof content === 'function' ? content(selection) : content;

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

          const noteIds = await this.getConfigNoteIds();
          noteIds.push(editingNote._id);
          this.setConfigNoteIds(noteIds);
        } catch (err) {
          notify('Error', 'Could not create new snippets configuration');
          console.error(err);
        }
      },
    });

    inkdrop.commands.dispatch(document.body, 'core:new-note');
  }

  async toggleConfigNote(noteId) {
    let noteIds = await this.getConfigNoteIds();
    let status;

    if (noteIds.includes(noteId)) {
      noteIds = noteIds.filter(id => id !== noteId);
      status = 'unregistered';
    } else {
      noteIds.push(noteId);
      status = 'registered';
    }

    const db = inkdrop.main.dataStore.getLocalDB();
    const note = await db.notes.get(noteId);

    this.setConfigNoteIds(noteIds);
    notify(
      'Success',
      `Successfully ${status} note '${note.title}' as snippets configuration`,
    );

    this.refresh();
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

  setConfigNoteIds(noteIds) {
    inkdrop.config.set(CONFIG_NOTES_KEY, noteIds.join(','));
  }
}
