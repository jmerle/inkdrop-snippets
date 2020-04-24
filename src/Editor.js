'use babel';

import { Disposable, CompositeDisposable } from 'event-kit';
import { notify } from './utils';

export class Editor extends Disposable {
  constructor(cm, database) {
    super(() => this.destroy());

    this.cm = cm;
    this.database = database;
    this.commandListeners = new CompositeDisposable();

    this.database.editor = this;

    this.refresh();
  }

  destroy() {
    this.commandListeners.dispose();
  }

  refresh() {
    this.commandListeners.dispose();

    this.triggers = this.database.getTriggers();
    this.maxTriggerLength = this.triggers
      .map(trigger => trigger.length)
      .sort((a, b) => b - a)[0];

    this.registerCommands();
  }

  registerCommands() {
    this.registerCommand('trigger', () => this.run());

    for (const trigger of this.triggers) {
      this.registerCommand(`trigger-${trigger}`, () => this.run(trigger));
    }
  }

  registerCommand(command, cb) {
    command = `snippets:${command}`;
    const targetElem = this.cm.display.wrapper.querySelector('textarea');

    this.commandListeners.add(
      inkdrop.commands.add(targetElem, {
        [command]: event => {
          if (cb(event)) {
            return;
          }

          // In case the callback returns false, we check if there is another
          // keybinding on the same target. In case there is, we trigger it.
          // This makes it possible to use keys like Tab to trigger commands,
          // without making it impossible to trigger other commands with it
          // it as well. This is important because the Tab key is also used by
          // several other rather important commands like `editor:indent`.

          if (!(event.originalEvent instanceof KeyboardEvent)) {
            return;
          }

          const { keymaps } = inkdrop;
          const keyboardEvent = event.originalEvent;

          const disabledBindings = keymaps.findKeyBindings({ command });
          const keystroke = keymaps.keystrokeForKeyboardEvent(keyboardEvent);

          const { exactMatchCandidates } = keymaps.findMatchCandidates(
            [keystroke],
            disabledBindings,
          );

          const exactMatches = keymaps.findExactMatches(
            exactMatchCandidates,
            keyboardEvent.target,
          );

          if (exactMatches.length === 1) {
            const binding = exactMatches[0];
            const elem = document.querySelector(binding.selector);
            inkdrop.commands.dispatch(elem, binding.command);
          }
        },
      }),
    );
  }

  run(triggerToCheck) {
    const cursor = this.cm.getCursor();
    const rangeStart = {
      line: cursor.line,
      ch: cursor.ch - this.maxTriggerLength,
    };

    const possibleTrigger = this.cm.getRange(rangeStart, cursor).toLowerCase();

    if (triggerToCheck !== undefined) {
      if (possibleTrigger.endsWith(triggerToCheck)) {
        this.runTrigger(triggerToCheck);
        return true;
      }

      return false;
    }

    for (const trigger of this.triggers) {
      if (possibleTrigger.endsWith(trigger)) {
        this.runTrigger(trigger);
        return true;
      }
    }

    return false;
  }

  runTrigger(trigger) {
    this.cm.setOption('readOnly', true);

    this.database
      .getContent(trigger)
      .then(content => {
        const cursor = this.cm.getCursor();
        const rangeStart = {
          line: cursor.line,
          ch: cursor.ch - trigger.length,
        };

        this.cm.replaceRange(content, rangeStart, cursor);
      })
      .catch(err => {
        notify('Error', `Snippet '${trigger}' failed: ${err.message}`);
        console.error(err);
      })
      .finally(() => {
        this.cm.setOption('readOnly', false);
      });
  }
}
