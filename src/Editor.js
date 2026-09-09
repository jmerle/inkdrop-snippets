'use babel';

import {
  StateField,
  StateEffect,
  Compartment,
  EditorSelection,
  EditorState,
} from '@codemirror/state';
import { EditorView, Decoration } from '@codemirror/view';
import { Disposable, CompositeDisposable } from 'event-kit';
import { notify } from './utils';
import { processContent } from './snippetContent';

// Carries a fresh set of placeholder ranges (relative to the document at the time of
// dispatch) into placeholderField whenever a snippet is inserted.
const setPlaceholders = StateEffect.define();

// The single source of truth for the current snippet's placeholder ranges. CodeMirror
// 6 automatically re-maps range positions through document changes for us (via
// `.map(tr.changes)`), which is what CodeMirror 5's `TextMarker`/`indexFromPos`/
// `posFromIndex` dance did by hand. We also use the same pass to detect edits landing
// inside a placeholder (mark it "modified", i.e. no longer navigable/highlighted) or
// outside all of them (clear everything), replacing CM5's `onBeforeChange` handler.
const placeholderField = StateField.define({
  create() {
    return [];
  },
  update(ranges, tr) {
    const effect = tr.effects.find(e => e.is(setPlaceholders));
    if (effect) {
      return effect.value;
    }

    if (!tr.docChanged || ranges.length === 0) {
      return ranges;
    }

    // Mirrors CM5's onBeforeChange/onChange pair: an edit landing inside a placeholder
    // just demotes that one (clears its highlight, makes it non-navigable) while every
    // other placeholder is left alone; an edit landing outside all of them clears the
    // whole set, rather than leaving stale placeholders around.
    let touchedAny = false;

    const mapped = ranges.map(range => {
      const overlapsChange = tr.changes.touchesRange(range.from, range.to);

      if (overlapsChange) {
        touchedAny = true;
      }

      return {
        from: tr.changes.mapPos(range.from),
        to: tr.changes.mapPos(range.to),
        modified: range.modified || overlapsChange,
      };
    });

    return touchedAny ? mapped : [];
  },
  provide: field =>
    EditorView.decorations.from(field, ranges =>
      Decoration.set(
        ranges
          .filter(range => !range.modified && range.from !== range.to)
          .map(range =>
            Decoration.mark({ class: 'snippets-placeholder' }).range(
              range.from,
              range.to,
            ),
          ),
        true,
      ),
    ),
});

// A Compartment holding EditorState.readOnly rather than EditorView.editable: the
// latter is wired straight to the `contenteditable` DOM attribute, so toggling it
// (even briefly, while `getContent()` resolves) drops DOM focus and the caret in the
// browser with no way back short of an explicit re-focus. `readOnly` blocks typing/
// paste/cut/drag-drop the same way without touching `contenteditable`, so focus and
// the caret survive the round trip.
const readOnlyCompartment = new Compartment();

export class Editor extends Disposable {
  constructor(view, database) {
    super(() => this.destroy());

    this._view = view;
    this.database = database;
    this.commandListeners = new CompositeDisposable();

    this.database.editor = this;

    this.currentMarker = -1;

    this.refresh();
  }

  destroy() {
    this.commandListeners.dispose();
  }

  // The underlying EditorView is a single, long-lived instance reused across notes
  // rather than being torn down and recreated per note - Inkdrop loads each note's
  // content into it by replacing its EditorState outright rather than deriving the new
  // state from the previous one via a transaction. Extensions appended with
  // `StateEffect.appendConfig` only survive transaction-derived state updates, so a note
  // switch silently drops `placeholderField`/`readOnlyCompartment` again. We can't hook
  // "note changed" directly (v6 exposes no such event), so this getter re-installs them
  // on every access instead, which is cheap and a no-op when they're already present -
  // every method just reads `this.view` normally, with no risk of one forgetting to
  // check first.
  get view() {
    if (this._view.state.field(placeholderField, false) === undefined) {
      this._view.dispatch({
        effects: StateEffect.appendConfig.of([
          placeholderField,
          readOnlyCompartment.of(EditorState.readOnly.of(false)),
        ]),
      });
    }

    return this._view;
  }

  refresh() {
    this.commandListeners.dispose();
    this.commandListeners = new CompositeDisposable();

    this.triggers = this.database.getTriggers();
    // `?? 0` guards the no-triggers-configured case (e.g. before any config note is
    // set up): without it this is `undefined`, and `run()`'s `cursor - maxTriggerLength`
    // becomes NaN, which CM6's `sliceDoc` throws on (unlike CM5's more lenient `getRange`).
    this.maxTriggerLength =
      this.triggers.map(trigger => trigger.length).sort((a, b) => b - a)[0] ??
      0;

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
    const targetElem = this.view.dom;

    this.commandListeners.add(
      inkdrop.commands.add(targetElem, {
        [command]: event => {
          if (cb(event)) {
            return;
          }

          // If the callback returns false (e.g. there's no snippet trigger or
          // placeholder to act on), abort this binding so the keymap's own cascade
          // takes over and dispatches whatever other binding exists for this
          // keystroke on this target (e.g. `editor:indent`), instead of swallowing
          // the keypress.
          event.abortKeyBinding();
        },
      }),
    );
  }

  run() {
    const { view } = this;
    const cursor = view.state.selection.main.head;
    const rangeStart = Math.max(0, cursor - this.maxTriggerLength);

    const possibleTrigger = view.state
      .sliceDoc(rangeStart, cursor)
      .toLowerCase();

    for (const trigger of this.triggers) {
      if (possibleTrigger.endsWith(trigger)) {
        this.runTrigger(trigger, true);
        return true;
      }
    }

    return this.moveToNextPlaceholder();
  }

  setReadOnly(readOnly) {
    this.view.dispatch({
      effects: readOnlyCompartment.reconfigure(
        EditorState.readOnly.of(readOnly),
      ),
    });
  }

  runTrigger(trigger, replace) {
    const { view } = this;
    const selection = view.state.sliceDoc(
      view.state.selection.main.from,
      view.state.selection.main.to,
    );

    this.setReadOnly(true);

    this.database
      .getContent(trigger, selection)
      .then(content => {
        this.placeContent(content, trigger, replace);
      })
      .catch(err => {
        notify('Error', `Snippet '${trigger}' failed: ${err.message}`);
        console.error(err);
      })
      .finally(() => {
        this.setReadOnly(false);
      });
  }

  placeContent(content, trigger, replace) {
    const { view } = this;
    const { processedContent, placeholders } = processContent(content);

    let from;
    let to;

    if (replace) {
      const cursor = view.state.selection.main.head;
      from = trigger.length > cursor ? 0 : cursor - trigger.length;
      to = cursor;
    } else {
      from = view.state.selection.main.from;
      to = view.state.selection.main.to;
    }

    const startIndex = from;

    const ranges = placeholders.map(placeholder => ({
      from: startIndex + placeholder.start,
      to: startIndex + placeholder.end,
      modified: false,
    }));

    view.dispatch({
      changes: { from, to, insert: processedContent },
      effects: setPlaceholders.of(ranges),
    });

    this.currentMarker = -1;
    this.moveToNextPlaceholder();
  }

  moveToNextPlaceholder() {
    const ranges = this.view.state.field(placeholderField);

    for (let i = this.currentMarker + 1; i < ranges.length; i++) {
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
    const ranges = this.view.state.field(placeholderField);
    const range = ranges[markerIndex];

    if (range === undefined || range.modified) {
      return false;
    }

    this.view.dispatch({
      selection: EditorSelection.single(range.to, range.from),
    });
    this.view.focus();
    this.currentMarker = markerIndex;

    return true;
  }
}
