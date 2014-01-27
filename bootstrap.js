const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Home.jsm");
Cu.import('resource://gre/modules/Services.jsm');

const PANEL_ID = 'me.mcomella.rss';
const DATASET_ID = 'me.mcomella.rss.dataset';

const PANEL_CONFIG = {
   id: PANEL_ID,
   title: 'RSS',
   layout: Home.panels.Layout.FRAME,
   views: [{
     type: Home.panels.View.LIST,
     dataset: DATASET_ID
   }]
};

const EXAMPLE_URI = 'http://rss.cnn.com/rss/cnn_topstories.rss';

var menuID;

// TODO: Not this.
function log(s) { Services.console.logStringMessage(s); }

function replaceDocWithFeed(window, feedURI) {
  feedURI = feedURI || EXAMPLE_URI;

  // TODO: Get results well.
  parseFeed(feedURI, function (title, entryText) {
    let doc = window.BrowserApp.selectedBrowser.contentDocument;
    doc.body.innerHTML = '<html><body><h1>' + title + '</h1>' + entryText + '</body></html>';
  });
}

function parseFeed(rssURL, onFinish) {
  // via mfinkle.
  let listener = {
    handleResult: function handleResult(feedResult) {
      //Services.console.logStringMessage('VERSION: ' + feedResult.version);
      let feedDoc = feedResult.doc;
      let feed = feedDoc.QueryInterface(Ci.nsIFeed);
      if (feed.items.length == 0)
        return;
      //Services.console.logStringMessage('FEED TITLE: ' + feed.title.plainText());
      log('Feed received with ' + feed.items.length + ' items.');
      let entries = [];
      for (let i = 0; i < feed.items.length; ++i) {
        let entry = feed.items.queryElementAt(i, Ci.nsIFeedEntry);
        entry.QueryInterface(Ci.nsIFeedContainer);
        entries.push(entry.summary.plainText());
        //Services.console.logStringMessage('SUMMARY: ' + entry.summary.plainText());
      }

      onFinish(feed.title.plainText(), entries.join('\n\n'));
    }
  };

  let xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);
  xhr.open('GET', rssURL, true);
  xhr.overrideMimeType('text/xml');

  xhr.addEventListener('load', (function () {
    if (xhr.status == 200) {
      let processor = Cc['@mozilla.org/feed-processor;1'].createInstance(Ci.nsIFeedProcessor);
      processor.listener = listener;
      let uri = Services.io.newURI(rssURL, null, null);
      processor.parseFromString(xhr.responseText, uri);
    }
  }), false);
  xhr.send(null);
}

function loadIntoWindow(window) {
  if (!window) { return; }
  // When button clicked, read for feeds, "subscribe", open HTML page?

  Home.panels.add(PANEL_CONFIG);

    // TODO: Get feeds from page.
  menuID = window.NativeWindow.menu.add({
    name: 'Replace doc w/ feed contents',
    icon: null,
    callback: function () { replaceDocWithFeed(window); }
  });
}

function unloadFromWindow(window) {
  if (!window) { return; }

  Home.panels.remove(PANEL_ID);

  window.NativeWindow.menu.remove(menuID);
  menuID = null;
}

function install(aData, aReason) {}

function uninstall(aData, aReason) {}

// via https://developer.mozilla.org/en-US/Add-ons/Firefox_for_Android/Initialization_and_Cleanup:
var windowListener = {
  onOpenWindow: function (aWindow) {
    // Wait for the window to finish loading
    let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    domWindow.addEventListener('load', function onLoad() {
      domWindow.removeEventListener('load', onLoad, false);
      loadIntoWindow(domWindow);
    }, false);
  },

  onCloseWindow: function (aWindow) {},
  onWindowTitleChange: function (aWindow, aTitle) {}
};

function startup(aData, aReason) {
  let wm = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);

  // Load into any existing windows
  let windows = wm.getEnumerator('navigator:browser');
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    loadIntoWindow(domWindow);
  }

  // Load into any new windows
  wm.addListener(windowListener);
}

function shutdown(aData, aReason) {
  // When the application is shutting down we normally don't have to clean
  // up any UI changes made
  if (aReason == APP_SHUTDOWN)
    return;

  let wm = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);

  // Stop listening for new windows
  wm.removeListener(windowListener);

  // Unload from any existing windows
  let windows = wm.getEnumerator('navigator:browser');
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  }
}
