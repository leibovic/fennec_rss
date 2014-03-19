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

TEST_FEEDS.forEach(function(url) {
  RSS.parseFeed(url, function(feed) {
  	let h1 = document.createElement("h1");
  	h1.textContent = feed.title.plainText();

  	// Only return the first 3 items
    let items = RSS.feedToItems(feed).slice(0, 2);

    let div = document.createElement("div");
    div.textContent = JSON.stringify(items);

    document.body.appendChild(h1);
    document.body.appendChild(div);
  });
});
