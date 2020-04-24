'use babel';

import { Disposable, CompositeDisposable } from 'event-kit';

export class Controller extends Disposable {
  constructor(cm, database) {
    super(() => this.destroy());

    this.cm = cm;
    this.database = database;
    this.commandListeners = new CompositeDisposable();

    this.refresh();
  }

  destroy() {
    this.commandListeners.dispose();
  }

  setCodeMirror(cm) {
    this.cm = cm;
    this.refresh();
  }

  refresh() {
    this.commandListeners.dispose();
    this.database.refresh();

    this.triggers = this.database.getTriggers();
    this.maxTriggerLength = this.triggers
      .map(trigger => trigger.length)
      .sort((a, b) => b - a)[0];

    // Ensure enough characters are checked when Space is used as trigger key
    this.maxTriggerLength += 1;

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
      ch:
        this.maxTriggerLength > cursor.ch
          ? 0
          : cursor.ch - this.maxTriggerLength,
    };

    const possibleTrigger = this.cm.getRange(rangeStart, cursor).trim();

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
    // TODO(jmerle): Implement
    console.log(`Running snippet with trigger '${trigger}'`);
  }
}
