// This is my hackish way of injecting plugins into react w/o actually making this thing a cordova app. Instead the cordova app is just an
// empty shell that redirects and I am hacking things together to make it simpler.

// cordova-plugin-cache-clear
export function cacheClear(success, error) {
  window.cordova.exec(success, error, 'CacheClear', 'task', []);
}

// cordova-plugin-dialogs

/**
 * Open a native alert dialog, with a customizable title and button text.
 *
 * @param {String} message              Message to print in the body of the alert
 * @param {Function} completeCallback   The callback that is called when user clicks on a button.
 * @param {String} title                Title of the alert dialog (default: Alert)
 * @param {String} buttonLabel          Label of the close button (default: OK)
 */
export function alert(message, completeCallback, title, buttonLabel) {
  var _message = typeof message === 'string' ? message : JSON.stringify(message);
  var _title = typeof title === 'string' ? title : 'Alert';
  var _buttonLabel = buttonLabel && typeof buttonLabel === 'string' ? buttonLabel : 'OK';
  window.cordova.exec(completeCallback, null, 'Notification', 'alert', [_message, _title, _buttonLabel]);
}

/**
 * Open a native confirm dialog, with a customizable title and button text.
 * The result that the user selects is returned to the result callback.
 *
 * @param {String} message              Message to print in the body of the alert
 * @param {Function} resultCallback     The callback that is called when user clicks on a button.
 * @param {String} title                Title of the alert dialog (default: Confirm)
 * @param {Array} buttonLabels          Array of the labels of the buttons (default: ['OK', 'Cancel'])
 */
export function confirm(message, resultCallback, title, buttonLabels) {
  var _message = typeof message === 'string' ? message : JSON.stringify(message);
  var _title = typeof title === 'string' ? title : 'Confirm';
  var _buttonLabels = buttonLabels || ['OK', 'Cancel'];

  // Strings are deprecated!
  if (typeof _buttonLabels === 'string') {
    console.log(
      'Notification.confirm(string, function, string, string) is deprecated.  Use Notification.confirm(string, function, string, array).'
    );
  }

  _buttonLabels = convertButtonLabels(_buttonLabels);

  window.cordova.exec(resultCallback, null, 'Notification', 'confirm', [_message, _title, _buttonLabels]);
}

/**
 * Open a native prompt dialog, with a customizable title and button text.
 * The following results are returned to the result callback:
 *  buttonIndex     Index number of the button selected.
 *  input1          The text entered in the prompt dialog box.
 *
 * @param {String} message              Dialog message to display (default: "Prompt message")
 * @param {Function} resultCallback     The callback that is called when user clicks on a button.
 * @param {String} title                Title of the dialog (default: "Prompt")
 * @param {Array} buttonLabels          Array of strings for the button labels (default: ["OK","Cancel"])
 * @param {String} defaultText          Textbox input value (default: empty string)
 */
export function prompt(message, resultCallback, title, buttonLabels, defaultText) {
  var _message = typeof message === 'string' ? message : JSON.stringify(message);
  var _title = typeof title === 'string' ? title : 'Prompt';
  var _buttonLabels = buttonLabels || ['OK', 'Cancel'];

  // Strings are deprecated!
  if (typeof _buttonLabels === 'string') {
    console.log(
      'Notification.prompt(string, function, string, string) is deprecated.  Use Notification.confirm(string, function, string, array).'
    );
  }

  _buttonLabels = convertButtonLabels(_buttonLabels);

  var _defaultText = defaultText || '';
  window.cordova.exec(resultCallback, null, 'Notification', 'prompt', [_message, _title, _buttonLabels, _defaultText]);
}

function convertButtonLabels(buttonLabels) {
  // Some platforms take an array of button label names.
  // Other platforms take a comma separated list.
  // For compatibility, we convert to the desired type based on the platform.
  // if (
  //   platform.id === 'amazon-fireos' ||
  //   platform.id === 'android' ||
  //   platform.id === 'ios' ||
  //   platform.id === 'windowsphone' ||
  //   platform.id === 'firefoxos' ||
  //   platform.id === 'ubuntu' ||
  //   platform.id === 'windows8' ||
  //   platform.id === 'windows'
  // ) {
  if (typeof buttonLabels === 'string') {
    buttonLabels = buttonLabels.split(','); // not crazy about changing the var type here
  }
  // } else {
  //   if (Array.isArray(buttonLabels)) {
  //     var buttonLabelArray = buttonLabels;
  //     buttonLabels = buttonLabelArray.toString();
  //   }
  // }

  return buttonLabels;
}
