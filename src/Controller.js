'use babel';

import { Disposable, CompositeDisposable } from 'event-kit';
import { SnippetsDatabase } from './SnippetsDatabase';

export class Controller extends Disposable {
  constructor(cm) {
    super(() => this.destroy());

    this.cm = cm;
    this.commandListeners = new CompositeDisposable();
    this.database = new SnippetsDatabase();

    this.refresh();
  }

  destroy() {
    this.commandListeners.dispose();
  }

  refresh() {
    this.commandListeners.dispose();
    this.database.refresh();

    this.triggers = this.database.getTriggers();
    this.maxTriggerLength = this.triggers
      .map(trigger => trigger.length)
      .sort((a, b) => b - a)[0];

    this.registerCommands();
  }

  registerCommands() {
    this.registerCommand('trigger', event => this.trigger(event));
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

  trigger() {
    const cursor = this.cm.getCursor();
    const rangeStart = {
      line: cursor.line,
      ch:
        this.maxTriggerLength > cursor.ch
          ? 0
          : cursor.ch - this.maxTriggerLength,
    };

    const possibleTrigger = this.cm.getRange(rangeStart, cursor);

    for (const trigger of this.triggers) {
      if (possibleTrigger.endsWith(trigger)) {
        console.log(`Triggering ${trigger}`);
        return true;
      }
    }

    return false;
  }
}
