"use strict";

var FeedHelper = {
  parseFeed: function(feedUrl, onFinish, onError) {
    let listener = {
      handleResult: function handleResult(feedResult) {
        let feedDoc = feedResult.doc;
        let parsedFeed = feedDoc.QueryInterface(Ci.nsIFeed);
        onFinish(parsedFeed);
      }
    };

    let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
    try {
      xhr.open("GET", feedUrl, true);
    } catch (e) {
      Cu.reportError("Error opening request to " + feedUrl + ": " + e);
      if (onError) {
        onError();
      }
      return;
    }
    xhr.overrideMimeType("text/xml");

    xhr.onerror = function onerror(e) {
      Cu.reportError("Error making request to " + feedUrl + ": " + e.error);
      if (onError) {
        onError();
      }
    };

    xhr.onload = function onload(event) {
      if (xhr.status !== 200) {
        Cu.reportError("Request to " + feedUrl + " returned status " + xhr.status);
        if (onError) {
          onError();
        }
        return;
      }

      let processor = Cc["@mozilla.org/feed-processor;1"].createInstance(Ci.nsIFeedProcessor);
      processor.listener = listener;

      let uri = Services.io.newURI(feedUrl, null, null);
      processor.parseFromString(xhr.responseText, uri);
    };

    xhr.send(null);
  },

  feedToItems: function(parsedFeed) {
    let items = [];

    // Create a browser element to create HTML from summary text
    let browser = document.createElement("browser");
    browser.setAttribute("type", "content");
    browser.setAttribute("collapsed", "true");
    browser.setAttribute("disablehistory", "true");
    document.documentElement.appendChild(browser);

    for (let i = 0; i < parsedFeed.items.length; i++) {
      let entry = parsedFeed.items.queryElementAt(i, Ci.nsIFeedEntry);
      entry.QueryInterface(Ci.nsIFeedContainer);
      entry.link.QueryInterface(Ci.nsIURI);

      let item = {
        url: entry.link.spec,
        title: entry.title.plainText()
      };

      if (entry.summary) {
        item.description = entry.summary.plainText();
      } else if (entry.content) {
        item.description = entry.content.plainText();
      } else {
        Cu.reportError("No description found for " + entry.link.spec);
      }

      // Look for an image in the entry
      if (entry.enclosures) {
        for (let j = 0; j < entry.enclosures.length; j++) {
          let enc = entry.enclosures.queryElementAt(j, Ci.nsIWritablePropertyBag2);
          if (enc.hasKey("url") && enc.hasKey("type") && enc.get("type").startsWith("image/")) {
            item.image_url = enc.get("url");
            break;
          }
        }
      }

      // Try to find an image in the summary
      if (!item.image_url && entry.summary) {
        let doc = browser.contentDocument;
        let div = doc.createElement("div");
        div.innerHTML = entry.summary.text;
        let img = div.querySelector("img");
        // Ignore wordpress pixel images
        if (img && !img.src.startsWith("http://pixel.wp.com/")) {
          item.image_url = img.src;
        }
      }
      items.push(item);
    }

    // Clean up the browser element
    browser.parentNode.removeChild(browser);

    return items;
  }
};
