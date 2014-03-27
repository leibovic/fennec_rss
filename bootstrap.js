const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Home.jsm");
Cu.import("resource://gre/modules/HomeProvider.jsm");
Cu.import("resource://gre/modules/Prompt.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const PAGE_ACTION_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNui8sowAAAAWdEVYdENyZWF0aW9uIFRpbWUAMDEvMjEvMTP6xLgqAAACR0lEQVRYhcWXvZGbQBiGH2TnVqzEuALLwwbOTq7g6OB0HeAOzh3gCsx1IGUOUf4GugqMOtBVIAcsY/SxEkinwe+MZlj4WD37/S0bHQ4HnHP3QA7EjKMKyCStoyRJ7oHVSH9slb6bzWa/gel/Avg64djte6AEtiMBxO/Nja2kb83AOfcBmAMLIPXXN5UFOJKkV2Djfz+ccx89SMaNEnZyibGknaSfkj4BS+psHg/AwDx7kCfq3LlKUZIkh9Z4z78ELP24lPRybhLn3Geg4IocsQCnVHmg/BSMT9icOjQ3B2irBJ4kbU6A/LoE4hqARrkHeX0LhE3CLXXNL6hLreB0gmXA1sf/SJIe/bu9sh4o242okd+sMg9mtQdSGxKfEyU9iTmoDCWtPdiCbpueAqX1hA/Nsm/uSxvRRtIXwu4NQbxQ94nBAFPn3J1z7q4H5JHu6qZA4V3fVs6ZjtlXBStgJek59NA590DXG7mk7wPsBgE0qqgTrdOETpRcLGln7P4Q2MCG5kBMXXIP9oEPR2Vu54E5itDEl25GRQiCrgdSv3XfHKCBsNm+oa75tjJjsyPwpRUC2ANLSZGkiHp1thsWgfes29OAjYUMAqTtrPfXmbGZ21BIWhvQOBCGXoAqtMudKMMhK7RtuOoDOCcbhhCAjfERQKiMLUAc6oL+XufsELAt7XwByLMAAKv2xP762pNTCKBsD851wi31qkOTtG3aoZly7Pb2N2ajOS1vRkmSBFvkSKomdEtsTGUTX78pNzhkXKCKut+s/wLJlvCmkQE1rgAAAABJRU5ErkJggg==";

const PANELS_PREF = "home.subscribe.panels";
const DATASET_IDS_PREF = "home.subscribe.datasetIds";

XPCOMUtils.defineLazyGetter(this, "Strings", function() {
  return Services.strings.createBundle("chrome://subscribe/locale/subscribe.properties");
});

XPCOMUtils.defineLazyGetter(this, "FeedHelper", function() {
  let sandbox = {};
  Services.scriptloader.loadSubScript("chrome://subscribe/content/FeedHelper.js", sandbox);
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
 * Adds id to an array of ids stored in a pref.
 */
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

/**
 * Monkey-patched version of FeedHandler.loadFeed
 */
function loadFeed(feed, browser) {
  let chromeWin = Services.wm.getMostRecentWindow("navigator:browser");
  let BrowserApp = chromeWin.BrowserApp;

  // Get the default feed handlers from FeedHander
  let handlers = chromeWin.FeedHandler.getContentHandlers(this.TYPE_MAYBE_FEED);

  handlers = handlers.map(function(handler) {
    return {
      name: handler.name,
      action: function defaultHandlerAction(feed) {
        // Merge the handler URL and the feed URL
        let readerURL = handler.uri;
        readerURL = readerURL.replace(/%s/gi, encodeURIComponent(feed.href));

        // Open the resultant URL in a new tab
        BrowserApp.addTab(readerURL, { parentId: BrowserApp.selectedTab.id });
      }
    }
  });

  // Add our own custom handler.
  handlers.push({
    name: Strings.GetStringFromName("prompt.firefoxHomepage"),
    action: addFeedPanel
  });

  // JSON for Prompt
  let p = new Prompt({
    window: chromeWin,
    title: Strings.GetStringFromName("prompt.subscribeToPage")
  }).setSingleChoiceItems(handlers.map(function(handler) {
    return { label: handler.name };
  })).show(function(data) {
    if (data.button == -1) {
      return;
    }
    // Call the action callback for the feed handler.
    handlers[data.button].action(feed);
  });
}

function addFeedPanel(feed) {
  let uuidgen = Cc["@mozilla.org/uuid-generator;1"].getService(Ci.nsIUUIDGenerator);
  let panelId = uuidgen.generateUUID().toString();
  let datasetId = uuidgen.generateUUID().toString();

  // Store panelId and datasetId in prefs so that we can remove them in the future.
  storeId(panelId, PANEL_IDS_PREF);
  storeId(datasetId, DATASET_IDS_PREF);

  // Store the feed URL so that we can update the feed in the future.
  Services.prefs.setCharPref(datasetId, feed.href);

  // Immediately fetch and parse the feed to get title for panel
  FeedHelper.parseFeed(feed.href, function(parsedFeed) {

    function optionsCallback() {
      return {
        title: parsedFeed.title.plainText(),
        views: [{
          type: Home.panels.View.LIST,
          dataset: datasetId
        }]
      };
    }

    Home.panels.register(panelId, optionsCallback);
    Home.panels.install(panelId);

    let chromeWin = Services.wm.getMostRecentWindow("navigator:browser");
    chromeWin.NativeWindow.toast.show(Strings.GetStringFromName("toast.addedToFirefoxHomepage"), "short");

    saveFeedItems(parsedFeed, datasetId);
  });


  // Add periodic sync to update feed once per hour.
  HomeProvider.addPeriodicSync(datasetId, 3600, function() {
    FeedHelper.parseFeed(feed.href, function(parsedFeed) {
      saveFeedItems(parsedFeed, datasetId);
    });
  });
}

var gPageActionId;
var gOriginalLoadFeed;

function onPageShow(event) {
  let chromeWin = Services.wm.getMostRecentWindow("navigator:browser");
  let selectedTab = chromeWin.BrowserApp.selectedTab;

  // Ignore load events on frames and other documents.
  if (event.target != selectedTab.browser.contentDocument) {
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
    clickCallback: function() {
      // Follow the regular "Subsribe" menu button action
      let args = JSON.stringify({ tabId: selectedTab.id });
      Services.obs.notifyObservers(null, "Feeds:Subscribe", args);
    }
  });
}

function loadIntoWindow(window) {
  window.BrowserApp.deck.addEventListener("pageshow", onPageShow, false);

  // Monkey-patch FeedHandler to add option to subscribe menu
  gOriginalLoadFeed = window.FeedHandler.loadFeed;
  window.FeedHandler.loadFeed = loadFeed;
}

function unloadFromWindow(window) {
  window.BrowserApp.deck.removeEventListener("pageshow", onPageShow);
  window.FeedHandler.loadFeed = gOriginalLoadFeed;
}

function install(aData, aReason) {}

function uninstall(aData, aReason) {}

var gWindowListener = {
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
    Serivces.wm.addListener(gWindowListener);
  }

  // Register any existing panels.
  try {
    let panelIds = JSON.parse(Services.prefs.getCharPref(PANEL_IDS_PREF));
    panelIds.forEach(function(panelId) {
      // XXX: We need to pass an optionsCallback as well, which means we probably
      // need to keep track of the feed (or just the title) and datasetId with the panelId.
      Home.panels.register(panelId);
    });
  } catch (e) {}

  // Add periodic sync for existing feeds.
  try {
    let datasetIds = JSON.parse(Services.prefs.getCharPref(DATASET_IDS_PREF));
    datasetIds.forEach(function(datasetId) {
      HomeProvider.addPeriodicSync(datasetId, 3600, function() {
        let feedUrl = Services.prefs.getCharPref(datasetId);
        FeedHelper.parseFeed(feedUrl, function(parsedFeed) {
          saveFeedItems(parsedFeed, datasetId);
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
  // XXX: Would we ever want to do this if the add-on was only being disabled?
  if (aReason == ADDON_UNINSTALL) {
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
}
