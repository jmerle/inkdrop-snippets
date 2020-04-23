'use babel';

import { Disposable } from 'event-kit';

export class Editor extends Disposable {
  constructor(cm) {
    super(() => this.destroy());

    this.cm = cm;

    console.log('CodeMirror instance retrieved', this.cm);
  }

  destroy() {
    // TODO(jmerle): Implement if needed, remove otherwise
  }
}
