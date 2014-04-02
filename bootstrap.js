/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Home.jsm");
Cu.import("resource://gre/modules/HomeProvider.jsm");
Cu.import("resource://gre/modules/Prompt.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const PAGE_ACTION_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNui8sowAAAAWdEVYdENyZWF0aW9uIFRpbWUAMDEvMjEvMTP6xLgqAAACR0lEQVRYhcWXvZGbQBiGH2TnVqzEuALLwwbOTq7g6OB0HeAOzh3gCsx1IGUOUf4GugqMOtBVIAcsY/SxEkinwe+MZlj4WD37/S0bHQ4HnHP3QA7EjKMKyCStoyRJ7oHVSH9slb6bzWa/gel/Avg64djte6AEtiMBxO/Nja2kb83AOfcBmAMLIPXXN5UFOJKkV2Djfz+ccx89SMaNEnZyibGknaSfkj4BS+psHg/AwDx7kCfq3LlKUZIkh9Z4z78ELP24lPRybhLn3Geg4IocsQCnVHmg/BSMT9icOjQ3B2irBJ4kbU6A/LoE4hqARrkHeX0LhE3CLXXNL6hLreB0gmXA1sf/SJIe/bu9sh4o242okd+sMg9mtQdSGxKfEyU9iTmoDCWtPdiCbpueAqX1hA/Nsm/uSxvRRtIXwu4NQbxQ94nBAFPn3J1z7q4H5JHu6qZA4V3fVs6ZjtlXBStgJek59NA590DXG7mk7wPsBgE0qqgTrdOETpRcLGln7P4Q2MCG5kBMXXIP9oEPR2Vu54E5itDEl25GRQiCrgdSv3XfHKCBsNm+oa75tjJjsyPwpRUC2ANLSZGkiHp1thsWgfes29OAjYUMAqTtrPfXmbGZ21BIWhvQOBCGXoAqtMudKMMhK7RtuOoDOCcbhhCAjfERQKiMLUAc6oL+XufsELAt7XwByLMAAKv2xP762pNTCKBsD851wi31qkOTtG3aoZly7Pb2N2ajOS1vRkmSBFvkSKomdEtsTGUTX78pNzhkXKCKut+s/wLJlvCmkQE1rgAAAABJRU5ErkJggg==";

// Pref used to persist feed panel data between app runs.
const FEEDS_PREF = "home.page.feeds";

XPCOMUtils.defineLazyGetter(this, "Strings", function() {
  return Services.strings.createBundle("chrome://feeds/locale/feeds.properties");
});

XPCOMUtils.defineLazyGetter(this, "FeedHelper", function() {
  let sandbox = {};
  Services.scriptloader.loadSubScript("chrome://feeds/content/FeedHelper.js", sandbox);
  return sandbox["FeedHelper"];
});

function reportErrors(e) {
  if (!e.errors) {
    return;
  }
  if (e.message) {
    Cu.reportError(e.message);
  }
  e.errors.forEach(error => Cu.reportError(error.message));
}

/**
 * @return optionsCallback function for a basic list panel.
 */
function getOptionsCallback(title, datasetId) {
  return function() {
    return {
      title: title,
      views: [{
        type: Home.panels.View.LIST,
        dataset: datasetId
      }]
    };
  };
}

/**
 * Monkey-patched version of FeedHandler.loadFeed.
 *
 * @param feed object created by DOMLinkAdded handler in browser.js
 */
function loadFeed(feed) {
  let chromeWin = Services.wm.getMostRecentWindow("navigator:browser");
  let BrowserApp = chromeWin.BrowserApp;

  // Get the default feed handlers from FeedHandler.
  let handlers = chromeWin.FeedHandler.getContentHandlers(this.TYPE_MAYBE_FEED);

  handlers = handlers.map(function(handler) {
    return {
      name: handler.name,
      action: function defaultHandlerAction(feed) {
        // Merge the handler URL and the feed URL.
        let readerURL = handler.uri;
        readerURL = readerURL.replace(/%s/gi, encodeURIComponent(feed.href));

        // Open the resultant URL in a new tab.
        BrowserApp.addTab(readerURL, { parentId: BrowserApp.selectedTab.id });
      }
    }
  });

  // Add our own custom handler.
  handlers.push({
    name: Strings.GetStringFromName("prompt.firefoxHomepage"),
    action: addFeedPanel
  });

  // JSON for Prompt.
  let p = new Prompt({
    window: chromeWin,
    title: Strings.GetStringFromName("prompt.subscribeToPage")
  });
  p.setSingleChoiceItems(handlers.map(function (handler) {
    return { label: handler.name };
  }));
  p.show(function (data) {
    if (data.button == -1) {
      return;
    }
    // Call the action callback for the feed handler.
    handlers[data.button].action(feed);
  });
}

/**
 * @param feed object created by DOMLinkAdded handler in browser.js
 */
function addFeedPanel(feed) {
  let uuidgen = Cc["@mozilla.org/uuid-generator;1"].getService(Ci.nsIUUIDGenerator);
  let panelId = uuidgen.generateUUID().toString();
  let datasetId = uuidgen.generateUUID().toString();

  // Immediately fetch and parse the feed to get title for panel.
  FeedHelper.parseFeed(feed.href, function (parsedFeed) {
    let title = parsedFeed.title.plainText();

    Home.panels.register(panelId, getOptionsCallback(title, datasetId));
    Home.panels.install(panelId);

    saveFeedItems(parsedFeed, datasetId);
    storeFeed(feed.href, title, panelId, datasetId);

    let chromeWin = Services.wm.getMostRecentWindow("navigator:browser");
    chromeWin.NativeWindow.toast.show(Strings.GetStringFromName("toast.addedToFirefoxHomepage"), "short");
  });

  // Add periodic sync to update feed once per hour.
  HomeProvider.addPeriodicSync(datasetId, 3600, function () {
    FeedHelper.parseFeed(feed.href, function(parsedFeed) {
      saveFeedItems(parsedFeed, datasetId);
    });
  });
}

/**
 * @param parsedFeed nsIFeed
 */
function saveFeedItems(parsedFeed, datasetId) {
  let items = FeedHelper.feedToItems(parsedFeed);

  Task.spawn(function() {
    let storage = HomeProvider.getStorage(datasetId);
    yield storage.deleteAll();
    yield storage.save(items);
  }).then(null, reportErrors);
}

/**
 * Stores feed panel data that we need to persist between app runs.
 */
function storeFeed(url, title, panelId, datasetId) {
  let feeds;
  try {
    feeds = JSON.parse(Services.prefs.getCharPref(FEEDS_PREF));
  } catch (e) {
    feeds = [];
  }

  feeds.push({
    url: url,
    title: title,
    panelId: panelId,
    datasetId: datasetId
  });

  Services.prefs.setCharPref(FEEDS_PREF, JSON.stringify(feeds));
}

let gPageActionId;
let gOriginalLoadFeed;

function onPageShow(event) {
  let chromeWin = Services.wm.getMostRecentWindow("navigator:browser");
  if (!chromeWin) {
    return;
  }

  let selectedTab = chromeWin.BrowserApp.selectedTab;

  // Ignore load events on frames and other documents.
  // selectedTab may be null during startup.
  if (!selectedTab || event.target != selectedTab.browser.contentDocument) {
    return;
  }

  // Remove any current page action item.
  if (gPageActionId) {
    chromeWin.NativeWindow.pageactions.remove(gPageActionId);
    gPageActionId = null;
  }

  let feeds = selectedTab.browser.feeds;

  // Bail if there are no feeds for this page.
  if (!feeds || feeds.length == 0) {
    return;
  }

  gPageActionId = chromeWin.NativeWindow.pageactions.add({
    icon: PAGE_ACTION_ICON,
    title: Strings.GetStringFromName("pageAction.subscribeToPage"),
    clickCallback: function onSubscribeClicked() {
      // Follow the regular "Subscribe" menu button action.
      let args = JSON.stringify({ tabId: selectedTab.id });
      Services.obs.notifyObservers(null, "Feeds:Subscribe", args);
    }
  });
}

function loadIntoWindow(window) {
  window.BrowserApp.deck.addEventListener("pageshow", onPageShow, false);

  // Monkey-patch FeedHandler to add option to subscribe menu.
  gOriginalLoadFeed = window.FeedHandler.loadFeed;
  window.FeedHandler.loadFeed = loadFeed;
}

function unloadFromWindow(window) {
  window.BrowserApp.deck.removeEventListener("pageshow", onPageShow);
  window.FeedHandler.loadFeed = gOriginalLoadFeed;
}

/**
 * bootstrap.js API
 */
function install(aData, aReason) {}

function uninstall(aData, aReason) {}

let gWindowListener = {
  onOpenWindow: function(aWindow) {
    // Stop listening after the window has been opened.
    Services.wm.removeListener(gWindowListener);

    // Wait for startup to finish before interacting with the UI.
    let win = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    win.addEventListener("UIReady", function onLoad() {
      win.removeEventListener("UIReady", onLoad, false);
      loadIntoWindow(win);
    }, false);
  },
  onCloseWindow: function(aWindow) {},
  onWindowTitleChange: function(aWindow, aTitle) {}
};

function startup(aData, aReason) {
  let win = Services.wm.getMostRecentWindow("navigator:browser");
  if (win) {
    // Load into the browser window if it already exists.
    loadIntoWindow(win);
  } else {
    // Otherwise, listen for it to open.
    Services.wm.addListener(gWindowListener);
  }

  try {
    let feeds = JSON.parse(Services.prefs.getCharPref(FEEDS_PREF));
    feeds.forEach(function(feed) {
      // Register any existing panels.
      Home.panels.register(feed.panelId, getOptionsCallback(feed.title, feed.datasetId));

      // Add periodic sync for existing feeds.
      HomeProvider.addPeriodicSync(feed.datasetId, 3600, function() {
        FeedHelper.parseFeed(feed.url, function(parsedFeed) {
          saveFeedItems(parsedFeed, feed.datasetId);
        });
      });
    });
  } catch (e) {}
}

function shutdown(aData, aReason) {
  // When the application is shutting down we normally don't have to clean any changes made.
  if (aReason == APP_SHUTDOWN) {
    return;
  }

  unloadFromWindow(Services.wm.getMostRecentWindow("navigator:browser"));

  // If the add-on is being uninstalled, also remove all panel data.
  if (aReason == ADDON_UNINSTALL) {
    try {
      let feeds = JSON.parse(Services.prefs.getCharPref(FEEDS_PREF));
      feeds.forEach(function (feed) {
        // Uninstall and unregister all panels.
        Home.panels.uninstall(feed.panelId);
        Home.panels.unregister(feed.panelId);

        // Delete all data.
        HomeProvider.removePeriodicSync(feed.datasetId);
        Task.spawn(function() {
          let storage = HomeProvider.getStorage(feed.datasetId);
          yield storage.deleteAll();
        }).then(null, reportErrors);

        // Clear the stored feeds.
        Services.prefs.clearUserPref(FEEDS_PREF);
      });
    } catch (e) {}
  }
}
