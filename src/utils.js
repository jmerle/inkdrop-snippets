'use babel';

export function notify(level, message, details) {
  const options = {
    dismissable: true,
  };

  if (typeof details === 'string') {
    options.detail = details;
  }

  inkdrop.notifications[`add${level}`](message, options);
}
