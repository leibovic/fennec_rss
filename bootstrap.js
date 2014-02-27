const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Home.jsm");
Cu.import("resource://gre/modules/HomeProvider.jsm");
Cu.import("resource://gre/modules/Prompt.jsm");
Cu.import('resource://gre/modules/Services.jsm');
Cu.import("resource://gre/modules/Task.jsm");

const RSS_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNui8sowAAAAWdEVYdENyZWF0aW9uIFRpbWUAMDEvMjEvMTP6xLgqAAACR0lEQVRYhcWXvZGbQBiGH2TnVqzEuALLwwbOTq7g6OB0HeAOzh3gCsx1IGUOUf4GugqMOtBVIAcsY/SxEkinwe+MZlj4WD37/S0bHQ4HnHP3QA7EjKMKyCStoyRJ7oHVSH9slb6bzWa/gel/Avg64djte6AEtiMBxO/Nja2kb83AOfcBmAMLIPXXN5UFOJKkV2Djfz+ccx89SMaNEnZyibGknaSfkj4BS+psHg/AwDx7kCfq3LlKUZIkh9Z4z78ELP24lPRybhLn3Geg4IocsQCnVHmg/BSMT9icOjQ3B2irBJ4kbU6A/LoE4hqARrkHeX0LhE3CLXXNL6hLreB0gmXA1sf/SJIe/bu9sh4o242okd+sMg9mtQdSGxKfEyU9iTmoDCWtPdiCbpueAqX1hA/Nsm/uSxvRRtIXwu4NQbxQ94nBAFPn3J1z7q4H5JHu6qZA4V3fVs6ZjtlXBStgJek59NA590DXG7mk7wPsBgE0qqgTrdOETpRcLGln7P4Q2MCG5kBMXXIP9oEPR2Vu54E5itDEl25GRQiCrgdSv3XfHKCBsNm+oa75tjJjsyPwpRUC2ANLSZGkiHp1thsWgfes29OAjYUMAqTtrPfXmbGZ21BIWhvQOBCGXoAqtMudKMMhK7RtuOoDOCcbhhCAjfERQKiMLUAc6oL+XufsELAt7XwByLMAAKv2xP762pNTCKBsD851wi31qkOTtG3aoZly7Pb2N2ajOS1vRkmSBFvkSKomdEtsTGUTX78pNzhkXKCKut+s/wLJlvCmkQE1rgAAAABJRU5ErkJggg==";

const PANEL_IDS_PREF = "home.rss.panelIds";
const DATASET_IDS_PREF = "home.rss.datasetIds";

function reportErrors(e) {
  if (!e.errors) {
    return;
  }
  if (e.message) {
    Cu.reportError(e.message);
  }
  e.errors.forEach(error => Cu.reportError(error.message));
}

function openPanel(panelId) {
  Services.wm.getMostRecentWindow("navigator:browser").BrowserApp.loadURI("about:home?page=" + panelId);
}

function getAndSaveFeed(feedUrl, datasetId, callback) {
  parseFeed(feedUrl, function (feed) {
    Task.spawn(function() {
      let storage = HomeProvider.getStorage(datasetId);
      yield storage.deleteAll();
      yield storage.save(feedToItems(feed));
    }).then(callback, reportErrors);
  });
}

function feedToItems(feed) {
  // TODO: Can use map?
  let items = [];
  for (let i = 0; i < feed.items.length; i++) {
    let entry = feed.items.queryElementAt(i, Ci.nsIFeedEntry);
    entry.QueryInterface(Ci.nsIFeedContainer);
    entry.link.QueryInterface(Ci.nsIURI); // TODO: necessary?

    items.push({
      url: entry.link.spec,
      title: entry.title.plainText(),
      description: entry.summary.plainText()
    });

    // Get the image URL.
    if (entry.enclosures && entry.enclosures.length > 0) {
      for (let j = 0; j < entry.enclosures.length; j++) {
        let enc = entry.enclosures.queryElementAt(j, Ci.nsIWritablePropertyBag2);

        // Ignore ambiguous enclosures.
        if (!(enc.hasKey('url') && enc.hasKey('type'))) {
          continue;
        }

        if (enc.get('type').startsWith('image/')) {
          items[i].image_url = enc.get('url');
          // I'm fine with the first one.
          break;
        }
      }
    }
  }
  return items;
}

function parseFeed(feedUrl, onFinish) {
  let listener = {
    handleResult: function handleResult(feedResult) {
      let feedDoc = feedResult.doc;
      let feed = feedDoc.QueryInterface(Ci.nsIFeed);
      if (feed.items.length == 0) {
        return;
      }
      onFinish(feed);
    }
  };

  let xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);
  xhr.open('GET', feedUrl, true);
  xhr.overrideMimeType('text/xml');

  xhr.addEventListener('load', (function () {
    if (xhr.status == 200) {
      let processor = Cc['@mozilla.org/feed-processor;1'].createInstance(Ci.nsIFeedProcessor);
      processor.listener = listener;
      let uri = Services.io.newURI(feedUrl, null, null);
      processor.parseFromString(xhr.responseText, uri);
    }
  }), false);
  xhr.send(null);
}

// Adds id to an array of ids stored in a pref.
function storeId(id, pref) {
  let ids;
  try {
    ids = JSON.parse(Services.prefs.getCharPref(pref));
  } catch (e) {
    ids = [];
  }
  ids.push(id);
  Services.prefs.setCharPref(pref, JSON.stringify(ids));
}

function addFeed(feed) {
  let uuidgen = Cc["@mozilla.org/uuid-generator;1"].getService(Ci.nsIUUIDGenerator);
  let panelId = uuidgen.generateUUID().toString();
  let datasetId = uuidgen.generateUUID().toString();

  // Store panelId and datasetId in prefs so that we can remove them in the future.
  storeId(panelId, PANEL_IDS_PREF);
  storeId(datasetId, DATASET_IDS_PREF);

  // Store the feed URL so that we can update the feed in the future.
  Services.prefs.setCharPref(datasetId, feed.href);

  function optionsCallback() {
    return {
      title: feed.title || feed.href,
      layout: Home.panels.Layout.FRAME,
      views: [{
        type: Home.panels.View.LIST,
        dataset: datasetId
      }]
    };
  }

  Home.panels.register(panelId, optionsCallback);
  Home.panels.install(panelId);

  // Immediately fetch items on install.
  getAndSaveFeed(feed.href, datasetId, function() {
    openPanel(panelId);
  });

  // Add periodic sync to update feed once per hour.
  HomeProvider.addPeriodicSync(datasetId, 3600, function() {
    getAndSaveFeed(feed.href, datasetId);
  });
}

// Show the user a promt to choose a feed to subscribe to.
function chooseFeed(window, feeds) {
  let p = new Prompt({
    window: window
  }).setSingleChoiceItems(feeds.map(function(feed) {
    return { label: feed.title || feed.href }
  })).show(function(data) {
    let feedIndex = data.button;
    if (feedIndex > -1) {
      addFeed(feeds[feedIndex]);
    }
  });
}

let pageActionId = null;

function pageShow(event) {
  let chromeWin = Services.wm.getMostRecentWindow("navigator:browser");
  let selectedTab = chromeWin.BrowserApp.selectedTab;

  // Ignore load events on frames and other documents.
  if (event.target != selectedTab.browser.contentDocument) {
    return;
  }

  // Remove any current page action item.
  if (pageActionId) {
    chromeWin.NativeWindow.pageactions.remove(pageActionId);
    pageActionId = null;
  }

  let feeds = selectedTab.browser.feeds;

  // Bail if there are no feeds for this page.
  if (!feeds || feeds.length == 0) {
    return;
  }

  pageActionId = chromeWin.NativeWindow.pageactions.add({
    icon: RSS_ICON,
    title: "Add RSS feed to home page",
    clickCallback: function() {
      if (feeds.length == 1) {
        addFeed(feeds[0]);
      } else {
        chooseFeed(selectedTab.browser.contentWindow, feeds);
      }
    }
  });
}

function loadIntoWindow(window) {
  window.BrowserApp.deck.addEventListener("pageshow", pageShow, false);
}

function unloadFromWindow(window) {
  window.BrowserApp.deck.removeEventListener("pageshow", pageShow);
}

function install(aData, aReason) {}

function uninstall(aData, aReason) {
  // Uninstall and unregister all panels.
  try {
    let panelIds = JSON.parse(Services.prefs.getCharPref(PANEL_IDS_PREF));
    panelIds.forEach(function(panelId) {
      Home.panels.uninstall(panelId);
      Home.panels.unregister(panelId);
    });
  } catch (e) {}

  // Delete all data.
  try {
    let datasetIds = JSON.parse(Services.prefs.getCharPref(DATASET_IDS_PREF));
    datasetIds.forEach(function(datasetId) {
      Services.prefs.removePeriodicSync(datasetId);
      Services.prefs.clearUserPref(datasetId);

      Task.spawn(function() {
        let storage = HomeProvider.getStorage(datasetId);
        yield storage.deleteAll();
      }).then(null, reportErrors);
    });
  } catch (e) {}
}

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

  // Register any existing panels.
  try {
    let panelIds = JSON.parse(Services.prefs.getCharPref(PANEL_IDS_PREF));
    panelIds.forEach(function(panelId) {
      Home.panels.register(panelId);
    });
  } catch (e) {}

  // Add periodic sync for existing feeds.
  try {
    let datasetIds = JSON.parse(Services.prefs.getCharPref(DATASET_IDS_PREF));
    datasetIds.forEach(function(datasetId) {
      HomeProvider.addPeriodicSync(datasetId, 3600, function() {
        let feedUrl = Services.prefs.getCharPref(datasetId);
        getAndSaveFeed(feedUrl, datasetId);
      });
    });
  } catch (e) {}
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
