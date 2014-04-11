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

// Pref used to persist feed panel data between app runs.
const FEEDS_PREF = "home.page.feeds";

// XXX: Using data URIs as a workaround until bug 993698 is fixed.
//const URLBAR_ICON_MDPI = "chrome://feeds/skin/icon_urlbar_mdpi.png";
//const URLBAR_ICON_HDPI = "chrome://feeds/skin/icon_urlbar_hdpi.png";
//const URLBAR_ICON_XHDPI = "chrome://feeds/skin/icon_urlbar_xhdpi.png";

const URLBAR_ICON_MDPI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAABDUlEQVR42u3VsUpCYRiHcTUNqSEvoEtoCUdbgyCEhraIM0hg4Obi5OLQJegVBCHODuIVZEvRIgUei8ocpAvovD7DO7x80PAdTxDk8BvO/wwP53UwJSK/ah34o4GgUn3CDH00cYBMkgGBK0Qd20kEBvj6IfSKo7gBN7SLAH18m0iE5qoBN7aPO4jRiHuiFzzjGmfI676JnvMlp3ECEcT4xCXSGhk67wq+gQBt3DuhG2yggKnZWz4BN1bEyN5d97LZ5sj5BmxkB48QLLCl+62JHPqc6BgzvOFEtxJEnetWM9uVTyC0P6LZH3Tr6vMeRA2SCHR0C/U5C1Efvid6tyfS/QIRFmYbQzBZ/+H808ASnTUiP4oxmJUAAAAASUVORK5CYII=";
const URLBAR_ICON_HDPI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAABm0lEQVR42u3XPyjEYRjA8TtxHSkL3XAiyWiyGChuUc5A2Q0UubJcyZ8sbBILx05IksFiZZGMZDDJnwzKHYd03Otre3rqzuX3+12Gd/hMz/B8631/73U+Y8y/YoNskA2yQdLA4Mg+3nCBdYyiGSXw/YHjoAwMtEesob3YQaYAZ+iFvxhBdzAFOkKj10Fh9COOTVz9EpXGkAdBeSMbMIWbPGFzXgfpqB8BxJDKETXhxZFFMY0oqmSQUI9jGCWLEbeD0mLBJ04RR7VaFMQBjPKB1mJ89u9YVmEVOIFRLlDmVtAtTB4P6BBR4RyXPeZWUA26MIZtvOQ4loiI6kQWRrhGqeMg6MByDONRLXxCWEStwih9Xn729dCP5IYICiGt5jtev0NNamkGdSJqRQW9IOj0DgWwhCSesYZysXRcLZ0VsxYYJeI0aB5GSYilleqlPhczP/SP84zToHsY5Rk+YUvNQ2K2q2Z7XgSlVFBMzXvEbEHNLr04skUV1K3mcTGbVLNXty91AkEVVCte9C8MiFkbkiLo0P4NskE2yAYp32bgEC3fNWtgAAAAAElFTkSuQmCC";
const URLBAR_ICON_XHDPI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAACK0lEQVR42u3YzUvUURSA4RmRkRBahC0kCcKBwCiEXLRIMLACC9pEtKtQyFVIK5FqYRtByE2IUZAFFQQV6vQPZEUQIrQSWgSZCPaBnyNp4/HdtDncM5chfh/SXTy7A8PL3HuuTkZEdrQQEAJCQAgIASEgBOyIgEud3f1YxzdMYgRXcQRVyPyDWAJ+Qgzf8RTnkEtrQBHiRSiGcTBtAVKhEp7hcLqPkN8WHmBP0gFnUMAnLEIqNI/2+APsoAZcwF3MVnCsricXYMdU4Tge4jfEYyC5ADvir/0YxZYnojf2AD4oVy5AacOs53J3x3mJhyGYxyv04CiyzgBgLz54Is7GFbAOcfiKQeSNiFpPxCIa0vCQlTCGJuOb+AwxvI4joASBzyYGUa0i8liAGDqiDhhyrkjbG9SpiFb8MeankY16C2WxDyfRh7eedTmNWhVxG2I4HV2AHZXHozJHbFQF1GDGmB1P8iE7hR/GqmxVEefL3J+6JF/iZuMPvfcqIIspI+JKcgHARYjDMRVx2TpGUV7iRrzEKooo4JDjJZ6AKI/VzC4sQZQVVEexRg8Ye3zJ8Xi1GC9ujZp7DnFoiSLgCcQwgYzyEaK0qZkuiMO1KALmIIY1R8ANiHJLzTRDHO6nIeCE64Kqmd0Qh3dpOEL1EOWLY24DoswlcomVnON13nTMLUOUYpRr9AVWsIYCmsr8Q3MPv7AKwaRj5iaK6oexO+HH3RAQAkJACAgB/0XANnPCwNEB3RTGAAAAAElFTkSuQmCC";

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
function getOptionsCallback(panelId, title, datasetId) {
  return function() {
    return {
      title: title,
      views: [{
        type: Home.panels.View.LIST,
        dataset: datasetId
      }],
      onuninstall: function() {
        // Unregister the panel and delete its data if the user
        // chooses to remove it in settings.
        removeFeedPanel(panelId, datasetId);
        unstoreFeed(panelId);
      }
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
    // XXX: In Firefox 31+, we can get this string from browser.properties.
    title: Strings.GetStringFromName("prompt.subscribeWith")
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

    Home.panels.register(panelId, getOptionsCallback(panelId, title, datasetId));
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
 * Uninstalls and unregisters panel, and deletes all feed data.
 */
function removeFeedPanel(panelId, datasetId) {
  Home.panels.uninstall(panelId);
  Home.panels.unregister(panelId);

  HomeProvider.removePeriodicSync(datasetId);
  Task.spawn(function deleteAll() {
    let storage = HomeProvider.getStorage(datasetId);
    yield storage.deleteAll();
  }).then(null, reportErrors);
}

/**
 * @param parsedFeed nsIFeed
 */
function saveFeedItems(parsedFeed, datasetId) {
  let items = FeedHelper.feedToItems(parsedFeed);

  Task.spawn(function () {
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

/**
 * Removes feed from array that persists between app runs.
 */
function unstoreFeed(panelId) {
  try {
    let feeds = JSON.parse(Services.prefs.getCharPref(FEEDS_PREF));
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i].panelId === panelId) {
        feeds.splice(i, 0);
        break;
      }
    }
    Services.prefs.setCharPref(FEEDS_PREF, JSON.stringify(feeds));
  } catch (e) {
    // We should never call unstoreFeed if the FEEDS_PREF doesn't exist.
    Cu.reportError(e);
  }
}

let gPageActionIcon;
let gPageActionId;
let gOriginalLoadFeed;

function onPageShow(event) {
  let window = Services.wm.getMostRecentWindow("navigator:browser");
  if (!window) {
    return;
  }

  let selectedTab = window.BrowserApp.selectedTab;

  // Ignore load events on frames and other documents.
  // selectedTab may be null during startup.
  if (!selectedTab || event.target != selectedTab.browser.contentDocument) {
    return;
  }

  updatePageAction(window, selectedTab);
}

function onTabSelect(event) {
  let window = event.currentTarget.ownerDocument.defaultView;
  updatePageAction(window, window.BrowserApp.selectedTab);
}

function updatePageAction(window, tab) {
  // Remove any current page action item.
  if (gPageActionId) {
    window.NativeWindow.pageactions.remove(gPageActionId);
    gPageActionId = null;
  }

  let feeds = tab.browser.feeds;

  // Bail if there are no feeds for this page.
  if (!feeds || feeds.length == 0) {
    return;
  }

  gPageActionId = window.NativeWindow.pageactions.add({
    icon: gPageActionIcon,
    title: Strings.GetStringFromName("pageAction.subscribeToPage"),
    clickCallback: function onSubscribeClicked() {
      // Follow the regular "Subscribe" menu button action.
      let args = JSON.stringify({ tabId: tab.id });
      Services.obs.notifyObservers(null, "Feeds:Subscribe", args);
    }
  });
}

function loadIntoWindow(window) {
  window.BrowserApp.deck.addEventListener("pageshow", onPageShow, false);
  window.BrowserApp.deck.addEventListener("TabSelect", onTabSelect, false);

  // Monkey-patch FeedHandler to add option to subscribe menu.
  gOriginalLoadFeed = window.FeedHandler.loadFeed;
  window.FeedHandler.loadFeed = loadFeed;

  if (window.devicePixelRatio <= 1) {
    gPageActionIcon = URLBAR_ICON_MDPI;
  } else if (window.devicePixelRatio <= 1.5) {
    gPageActionIcon = URLBAR_ICON_HDPI;
  } else {
    gPageActionIcon = URLBAR_ICON_XHDPI;
  }
}

function unloadFromWindow(window) {
  window.BrowserApp.deck.removeEventListener("pageshow", onPageShow, false);
  window.BrowserApp.deck.removeEventListener("TabSelect", onTabSelect, false);

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
      Home.panels.register(feed.panelId, getOptionsCallback(feed.panelId, feed.title, feed.datasetId));

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
        removeFeedPanel(feed.panelId, feed.datasetId);
      });

      // Clear the stored feeds.
      Services.prefs.clearUserPref(FEEDS_PREF);
    } catch (e) {}
  }
}
