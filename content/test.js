"use strict";

let TEST_FEEDS = [
  "http://rss.cnn.com/rss/cnn_topstories.rss",
  "http://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  "https://news.layervault.com/?format=rss",
  "http://feeds.feedburner.com/yewknee",
  "http://feeds.feedburner.com/ucllc/quipsologies",
  "http://www.reddit.com/.rss",
  "http://feeds.kottke.org/main",
  "http://www.polygon.com/rss/index.xml",
  "http://www.theverge.com/rss/index.xml",
  "http://feeds.feedburner.com/CoudalFreshSignals",
  "http://feeds2.feedburner.com/Swissmiss",
  "http://feeds.apartmenttherapy.com/apartmenttherapy/main",
  "http://www.engadget.com/rss.xml",
  "http://torontoist.com/feed/",
  "http://www.thestar.com/feeds.topstories.rss"
];

// Appends the first raw entry data from the feed to the DOM
function appendRawEntry(feed) {
  let h1 = document.createElement("h1");
  h1.textContent = "Raw entry for " + feed.title.plainText();
  h1.style.backgroundColor = "#ddd";

  let div = document.createElement("div");
  let entry = feed.items.queryElementAt(0, Ci.nsIFeedEntry);
  div.textContent = JSON.stringify(entry);
  div.style.backgroundColor = "#ddd";

  document.body.appendChild(h1);
  document.body.appendChild(div);
}

// Appends the raw feed data to the DOM
function appendRawFeed(feed) {
  let div = document.createElement("div");
  div.textContent = JSON.stringify(feed);
  document.body.appendChild(div);
}

TEST_FEEDS.forEach(function(url) {
  FeedHelper.parseFeed(url, function(feed) {
    let h1 = document.createElement("h1");
    h1.textContent = feed.title.plainText();

    // Only return the first 3 items
    let items = FeedHelper.feedToItems(feed).slice(0, 3);

    let div = document.createElement("div");
    div.textContent = JSON.stringify(items);

    document.body.appendChild(h1);
    document.body.appendChild(div);

    appendRawEntry(feed);
  });
});
