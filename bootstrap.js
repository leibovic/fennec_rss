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

const EMPTY_PANEL_ID = "homepagefeeds.emtpy.panel@margaretleibovic.com";
const EMPTY_DATASET_ID = "homepagefeeds.emtpy.dataset@margaretleibovic.com";

// XXX: Using data URIs as a workaround until bug 993698 is fixed.
//const URLBAR_ICON_MDPI = "chrome://feeds/skin/icon_urlbar_mdpi.png";
//const URLBAR_ICON_HDPI = "chrome://feeds/skin/icon_urlbar_hdpi.png";
//const URLBAR_ICON_XHDPI = "chrome://feeds/skin/icon_urlbar_xhdpi.png";
//const URLBAR_ICON_XXHDPI = "chrome://feeds/skin/icon_urlbar_xxhdpi.png";
const URLBAR_ICON_MDPI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAABDUlEQVR42u3VsUpCYRiHcTUNqSEvoEtoCUdbgyCEhraIM0hg4Obi5OLQJegVBCHODuIVZEvRIgUei8ocpAvovD7DO7x80PAdTxDk8BvO/wwP53UwJSK/ah34o4GgUn3CDH00cYBMkgGBK0Qd20kEBvj6IfSKo7gBN7SLAH18m0iE5qoBN7aPO4jRiHuiFzzjGmfI676JnvMlp3ECEcT4xCXSGhk67wq+gQBt3DuhG2yggKnZWz4BN1bEyN5d97LZ5sj5BmxkB48QLLCl+62JHPqc6BgzvOFEtxJEnetWM9uVTyC0P6LZH3Tr6vMeRA2SCHR0C/U5C1Efvid6tyfS/QIRFmYbQzBZ/+H808ASnTUiP4oxmJUAAAAASUVORK5CYII=";
const URLBAR_ICON_HDPI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAABm0lEQVR42u3XPyjEYRjA8TtxHSkL3XAiyWiyGChuUc5A2Q0UubJcyZ8sbBILx05IksFiZZGMZDDJnwzKHYd03Otre3rqzuX3+12Gd/hMz/B8631/73U+Y8y/YoNskA2yQdLA4Mg+3nCBdYyiGSXw/YHjoAwMtEesob3YQaYAZ+iFvxhBdzAFOkKj10Fh9COOTVz9EpXGkAdBeSMbMIWbPGFzXgfpqB8BxJDKETXhxZFFMY0oqmSQUI9jGCWLEbeD0mLBJ04RR7VaFMQBjPKB1mJ89u9YVmEVOIFRLlDmVtAtTB4P6BBR4RyXPeZWUA26MIZtvOQ4loiI6kQWRrhGqeMg6MByDONRLXxCWEStwih9Xn729dCP5IYICiGt5jtev0NNamkGdSJqRQW9IOj0DgWwhCSesYZysXRcLZ0VsxYYJeI0aB5GSYilleqlPhczP/SP84zToHsY5Rk+YUvNQ2K2q2Z7XgSlVFBMzXvEbEHNLr04skUV1K3mcTGbVLNXty91AkEVVCte9C8MiFkbkiLo0P4NskE2yAYp32bgEC3fNWtgAAAAAElFTkSuQmCC";
const URLBAR_ICON_XHDPI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAACK0lEQVR42u3YzUvUURSA4RmRkRBahC0kCcKBwCiEXLRIMLACC9pEtKtQyFVIK5FqYRtByE2IUZAFFQQV6vQPZEUQIrQSWgSZCPaBnyNp4/HdtDncM5chfh/SXTy7A8PL3HuuTkZEdrQQEAJCQAgIASEgBOyIgEud3f1YxzdMYgRXcQRVyPyDWAJ+Qgzf8RTnkEtrQBHiRSiGcTBtAVKhEp7hcLqPkN8WHmBP0gFnUMAnLEIqNI/2+APsoAZcwF3MVnCsricXYMdU4Tge4jfEYyC5ADvir/0YxZYnojf2AD4oVy5AacOs53J3x3mJhyGYxyv04CiyzgBgLz54Is7GFbAOcfiKQeSNiFpPxCIa0vCQlTCGJuOb+AwxvI4joASBzyYGUa0i8liAGDqiDhhyrkjbG9SpiFb8MeankY16C2WxDyfRh7eedTmNWhVxG2I4HV2AHZXHozJHbFQF1GDGmB1P8iE7hR/GqmxVEefL3J+6JF/iZuMPvfcqIIspI+JKcgHARYjDMRVx2TpGUV7iRrzEKooo4JDjJZ6AKI/VzC4sQZQVVEexRg8Ye3zJ8Xi1GC9ujZp7DnFoiSLgCcQwgYzyEaK0qZkuiMO1KALmIIY1R8ANiHJLzTRDHO6nIeCE64Kqmd0Qh3dpOEL1EOWLY24DoswlcomVnON13nTMLUOUYpRr9AVWsIYCmsr8Q3MPv7AKwaRj5iaK6oexO+HH3RAQAkJACAgB/0XANnPCwNEB3RTGAAAAAElFTkSuQmCC";
const URLBAR_ICON_XXHDPI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAElElEQVR42u3cb2jVVRjA8bt719Q5tT9aMQtNsahYoxcRlSRIhWBpCQq1yGgV6020/qD2j5WLorBaQaOYLq3ErFBpBIMILYyMpYGl4ETLmvbH2bTN63XdPX1fBAZJe845v22ce58Xn7cPcr+7u7/7nONSImJGUNG/ABZALICxABbAWAALYCyABTAWwAIYC2ABjAWwAMYCWABjASyAiS3A4tq6MjSiG1nsRjvewlLMwflIRSDKAC9AFA7hEzyFWRhjAZIJsB/iIYt21OMSC+AfoAeSgJ1owOUWIDRAuC9xPyZYgJAA4XrxGqZZgJAA4f7CR6iyAP8NcBwyTPJ4F9MtwKkAJyHDLIcXMdYC1NZtg4yQ/bi52ANchcOQEbQKFfEGCI9wNhbjSTThQ3SgFzJMdqMq/gDhMf4tjWmYj0ZsQQ4yRLK40wL8v3LMQTO6IAkbQIMF0EnjBqxBHyRBb6DEAuidg2UJvyuaUWIB3IzGQ/gVkoDnLYCfCqxAPyTQAxbA3xX4JoEVxj0FHYB//DicidQQGIVXMRC40Lu9EL8Jn4WNyEPQhXY0Yh4mJRhiIXoDd0jXFlqANYrn8h14CTfijMAIV6Mb4uk3VBZSgF8gDg6jBTeh1DNCdeA5xBZk7ECmtu5nPIGJHhFmBn55e9gCnJLFSlzqGGFewG7pOKYXQoA8JCH9aEWlQ4SagKejzwohgAyBY6hHRhlhKcTTrbEH6IMMkc24UBnhPYiHXSgt3MfQcL9jpnLN3QHxcG/MAcaiCX9AhsgJLFBEmIFjEEedSEe/C/pnkzkFs3Af3sT2hD6oc8oD+LsgHhYV8jJuEmqwMfAaSx+qFRE2QRx9XSzb0Eo8HrDv36u4M3oBjkIcXVlM6+hyLEcW4qhFMb/e5wStGM8DLsO3HgfvsweZW4Y9EAdHMbq4AgAV+BjiYAfSg8xdBHF0W/EFAMo8PjxrFLcudkIcrCvOAMAYfAVR+h4lil2ROPgTo4ozAHCe4xnDXMU76yDEZWYhBUh7RLgFotSmmPcMxEFTzAGq8To6kUM/DmAlrneIsB6ikFcs7C5yXFl/F+OtiFK8olg7rMd4RYCpDoctjyjmbXV8zD03puvpGccnmA6UK160ZojCNsWsRyEOFsYU4DmIo3XKL2kDyp/YSsUscbAilnX0VN/rg8o9/xcQhbsVs7ogSltjCfAsxNNqxYv2IEShVTHrA8f/o5yOIcBmiKcfFC/aZOWvoX2KWY9BHFwcQ4C9EE8nlff3d2nmKR5H50IcLIghwI+QABlFgBaIwvyEP4iXxRDgc4inA0gp1EEUnh5kznjXc4cYAjRAPL2tDDAbovC+YtYJiNKnMQSYEnDOe40ywAyIwnbFrB6I0p5Yvogthzh6BymliRCFIwkH6I1pFbHB8QZCuUOAjPJdllPMcnlo6I5tGfeyYhm3FuOQctSmuTGhmLMEorQqxnV0FZrRiTxy2IfVuA4pT5PRhkM4choHcYfy3bQEP0HQc5pZXWjFBPvDrfaHW40FsADGAlgAYwEsgLEAFsBYAAtgLIAFMBbAAhgLYAGMBbAARuNv+dEpcx0Ep3wAAAAASUVORK5CYII=";

// XXX: Using data URI as a workaround until bug 1004517 is fixed.
//const EMPTY_PANEL_ICON = "chrome://feeds/skin/icon_empty_panel.png";
const EMPTY_PANEL_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAAA9zQYyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2tpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDE0IDc5LjE1MTQ4MSwgMjAxMy8wMy8xMy0xMjowOToxNSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo3RTk3MTNFQjY4MjA2ODExODIyQTlEQTQyRkExNzhBNSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpCQzJFRUVFQUI0MkMxMUUzODhFRjkyRDc4QTNFQTBFOSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpCQzJFRUVFOUI0MkMxMUUzODhFRjkyRDc4QTNFQTBFOSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgKE1hY2ludG9zaCkiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpjNzVhYTI5Ny0wYjkyLTQ5NTUtYmU3OS1kNWZkNDM0NjY4OWUiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6N0U5NzEzRUI2ODIwNjgxMTgyMkE5REE0MkZBMTc4QTUiLz4gPC9yZGY6RGVz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";

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
 * Panel options callback for an empty panel added when user installs add-on.
 */
function emptyOptionsCallback() {
  return {
    title: Strings.GetStringFromName("empty.title"),
    views: [{
      type: Home.panels.View.LIST,
      dataset: EMPTY_DATASET_ID,
      empty: {
        text: Strings.GetStringFromName("empty.text"),
        imageUrl: EMPTY_PANEL_ICON
      }
    }]
  }
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
  // Prefix an add-on identifier for UI telemetry purposes.
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
  } else if (window.devicePixelRatio <= 2) {
    gPageActionIcon = URLBAR_ICON_XHDPI;
  } else {
    gPageActionIcon = URLBAR_ICON_XXHDPI;
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

  // Create an empty panel to tell help users with the add-on.
  /*
  Home.panels.register(EMPTY_PANEL_ID, emptyOptionsCallback);
  if (aReason == ADDON_INSTALL) {
    Home.panels.install(EMPTY_PANEL_ID);
  }
  */
}

function shutdown(aData, aReason) {
  // When the application is shutting down we normally don't have to clean any changes made.
  if (aReason == APP_SHUTDOWN) {
    return;
  }

  unloadFromWindow(Services.wm.getMostRecentWindow("navigator:browser"));

  // If the add-on is being uninstalled, also remove all panel data.
  if (aReason == ADDON_UNINSTALL) {
    /*
    Home.panels.uninstall(EMPTY_PANEL_ID);
    Home.panels.unregister(EMPTY_PANEL_ID);
    */
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
