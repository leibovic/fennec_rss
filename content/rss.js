"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import('resource://gre/modules/Services.jsm');

var RSS = {
  parseFeed: function(feedUrl, onFinish) {
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
  },

  feedToItems: function (feed) {
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
};
