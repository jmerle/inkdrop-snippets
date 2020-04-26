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

    this.markers = [];
    this.currentMarker = -1;
    this.clearMarkersOnChange = false;

    this.cm.on('change', () => this.onChange());
    this.cm.on('beforeChange', (_, changeObj) => {
      this.onBeforeChange(changeObj);
    });

    this.refresh();
  }

  destroy() {
    this.commandListeners.dispose();
  }

  refresh() {
    this.commandListeners.dispose();
    this.commandListeners = new CompositeDisposable();

    this.triggers = this.database.getTriggers();
    this.maxTriggerLength = this.triggers
      .map(trigger => trigger.length)
      .sort((a, b) => b - a)[0];

    this.registerCommands();
  }

  registerCommands() {
    this.registerCommand('run', () => this.run());

    this.registerCommand('next-placeholder', () => {
      return this.moveToNextPlaceholder();
    });

    this.registerCommand('previous-placeholder', () => {
      return this.moveToPreviousPlaceholder();
    });

    for (const trigger of this.triggers) {
      this.registerCommand(`run-${trigger}`, () => {
        this.runTrigger(trigger, false);
        return true;
      });
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

  run() {
    const cursor = this.cm.getCursor();
    const rangeStart = {
      line: cursor.line,
      ch: cursor.ch - this.maxTriggerLength,
    };

    const possibleTrigger = this.cm.getRange(rangeStart, cursor).toLowerCase();

    for (const trigger of this.triggers) {
      if (possibleTrigger.endsWith(trigger)) {
        this.runTrigger(trigger, true);
        return true;
      }
    }

    return this.moveToNextPlaceholder();
  }

  runTrigger(trigger, replace) {
    this.cm.setOption('readOnly', true);

    this.database
      .getContent(trigger, this.cm.getSelection())
      .then(content => {
        this.placeContent(content, trigger, replace);
      })
      .catch(err => {
        notify('Error', `Snippet '${trigger}' failed: ${err.message}`);
        console.error(err);
      })
      .finally(() => {
        this.cm.setOption('readOnly', false);
      });
  }

  placeContent(content, trigger, replace) {
    this.clearMarkers();
    const { processedContent, placeholders } = this.processContent(content);

    let startPosition;

    if (replace) {
      const cursor = this.cm.getCursor();
      startPosition = {
        line: cursor.line,
        ch: trigger.length > cursor.ch ? 0 : cursor.ch - trigger.length,
      };

      this.cm.replaceRange(processedContent, startPosition, cursor);
    } else {
      startPosition = this.cm.listSelections()[0].head;
      this.cm.replaceSelection(processedContent);
    }

    const startIndex = this.cm.indexFromPos(startPosition);

    for (const placeholder of placeholders) {
      const start = this.cm.posFromIndex(startIndex + placeholder.start);
      const end = this.cm.posFromIndex(startIndex + placeholder.end);

      const marker = this.cm.markText(start, end, {
        className: 'snippets-placeholder',
        inclusiveLeft: true,
        inclusiveRight: true,
      });

      this.markers.push(marker);
    }

    this.moveToNextPlaceholder();
  }

  processContent(content) {
    const placeholders = [];
    const placeholderPattern = /((?<!\\)\$(\d+)(:[^$]*)?\$)/;

    while (true) {
      const match = content.match(placeholderPattern);

      if (match === null) {
        break;
      }

      const index = parseInt(match[2], 10);

      let placeholderValue = match[3];
      if (placeholderValue === undefined || placeholderValue === ':') {
        placeholderValue = `$${index}`;
      } else {
        placeholderValue = placeholderValue.substr(1);
      }

      const start = match.index;
      const end = start + placeholderValue.length;

      placeholders.push({ index, start, end });

      const prefix = content.substr(0, start);
      const suffix = content.substr(start + match[0].length);
      content = prefix + placeholderValue + suffix;
    }

    const orderedPlaceholders = placeholders
      .sort((a, b) => a.index - b.index)
      .map(placeholder => ({ start: placeholder.start, end: placeholder.end }));

    return {
      processedContent: content,
      placeholders: orderedPlaceholders,
    };
  }

  onBeforeChange(changeObj) {
    this.clearMarkersOnChange = false;

    if (this.markers.length === 0) {
      return;
    }

    let modifiedMarker = false;
    const changeFrom = this.cm.indexFromPos(changeObj.from);

    for (const marker of this.markers) {
      const range = marker.find();

      if (range === undefined) {
        continue;
      }

      const rangeFrom = this.cm.indexFromPos(range.from);
      const rangeTo = this.cm.indexFromPos(range.to);

      if (changeFrom >= rangeFrom && changeFrom <= rangeTo) {
        marker.className = '';
        marker.modified = true;
        modifiedMarker = true;
        break;
      }
    }

    if (!modifiedMarker) {
      this.clearMarkersOnChange = true;
    }
  }

  onChange() {
    if (this.clearMarkersOnChange) {
      this.clearMarkersOnChange = false;
      this.clearMarkers();
    }
  }

  moveToNextPlaceholder() {
    for (let i = this.currentMarker + 1; i < this.markers.length; i++) {
      if (this.moveToPlaceholder(i)) {
        return true;
      }
    }

    return false;
  }

  moveToPreviousPlaceholder() {
    for (let i = this.currentMarker - 1; i >= 0; i--) {
      if (this.moveToPlaceholder(i)) {
        return true;
      }
    }

    return false;
  }

  moveToPlaceholder(markerIndex) {
    const marker = this.markers[markerIndex];

    if (marker.modified) {
      return false;
    }

    const range = marker.find();

    if (range === undefined) {
      return false;
    }

    this.cm.setSelection(range.to, range.from);
    this.currentMarker = markerIndex;

    return true;
  }

  clearMarkers() {
    for (const marker of this.markers) {
      marker.clear();
    }

    this.markers = [];
    this.currentMarker = -1;
  }
}
