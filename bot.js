const Parser = require('rss-parser');
const axios = require('axios');
const fs = require('fs');
const parser = new Parser({
  customFields: {
    item: ['content:encoded', ['category', 'category', { keepArray: true, attributes: ['domain'] }]]
  }
});
const webhookUrl = "https://discord.com/api/webhooks/1351615179078500473/MqIn1CFGDinXu6pp0ac_QZgIXTmG6KxkVTPE7mg6eykkIUbfx2pAjdePrJjWg_h02SrN";

const supremeCourtForumIds = ["1040"];

function htmlToText(html) {
  return html.replace(/<\/?[^>]+(>|$)/g, "").trim();
}

async function sendDiscordNotification() {
  try {
    let sentGuids = [];
    const historyPath = 'e://discord-rss-bot//history.json';
    if (fs.existsSync(historyPath)) {
      try {
        sentGuids = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      } catch (e) {
        sentGuids = [];
      }
    }

    const feed = await parser.parseURL('https://forum.gta5rp.com/forums/-/index.rss');
    console.log('Всего элементов в RSS:', feed.items.length);
    if (feed.items.length > 0) {
      console.log('Пример item:', JSON.stringify(feed.items[0], null, 2));
    }

    const allPosts = feed.items
      .filter(item => {
        if (item.category) {
          console.log('item.category:', item.category);
        }
        if (item.categories && Array.isArray(item.categories)) {
          if (item.categories.some(cat => {
            if (typeof cat === 'object' && cat !== null && cat.domain) {
              return cat.domain.includes('verxovnyi-sud.1040');
            }
            if (typeof cat === 'string') {
              return cat.includes('Верховный суд') || cat.includes('verxovnyi-sud.1040');
            }
            return false;
          })) return true;
        }
        if (typeof item.category === 'string') {
          return item.category.includes('Верховный суд') || item.category.includes('verxovnyi-sud.1040');
        }
        if (Array.isArray(item.category)) {
          return item.category.some(cat => {
            if (cat && cat.$ && typeof cat.$.domain === 'string') {
              return cat.$.domain.includes('verxovnyi-sud.1040');
            }
            if (cat && typeof cat._ === 'string') {
              return cat._.includes('Верховный суд');
            }
            if (typeof cat === 'object' && cat !== null && cat.domain) {
              return cat.domain.includes('verxovnyi-sud.1040');
            }
            if (typeof cat === 'string') {
              return cat.includes('Верховный суд') || cat.includes('verxovnyi-sud.1040');
            }
            return false;
          });
        }
        if (typeof item.category === 'object' && item.category !== null && item.category.domain) {
          return item.category.domain.includes('verxovnyi-sud.1040');
        }
        return false;
      })
      .filter(item => !sentGuids.includes(item.guid))
      .map(item => {
        let rawHtmlContent = item['content:encoded'] || "";
        rawHtmlContent = rawHtmlContent.replace(/<a[^>]*>\s*читать далее\s*<\/a>/gi, "");
        const textContent = htmlToText(rawHtmlContent).substring(0, 3900);
        return {
          title: item.title,
          excerpt: textContent,
          url: item.link,
          timestamp: item.pubDate,
          author: item.creator || "Неизвестный автор",
          guid: item.guid
        };
      });

    console.log(`Найдено постов Верховного суда: ${allPosts.length}`);

    if (allPosts.length === 0) {
      console.log("Нет постов Верховного суда");
      return;
    }

    for (const post of allPosts) {
      const embeds = [{
        title: post.title,
        url: post.url,
        timestamp: new Date(post.timestamp).toISOString(),
        color: 0xFFA500,
        author: { name: post.author },
        footer: { text: "Новое заявление в верховный суд" }
      }];

      const content = "<@&1160297485034590260>, вам пришло новое заявление!\n\n";

      await axios.post(webhookUrl, { content, embeds }, {
        headers: { "Content-Type": "application/json" }
      });
      sentGuids.push(post.guid);
    }

    fs.writeFileSync(historyPath, JSON.stringify(sentGuids.slice(-100), null, 2));

    console.log(`✅ Отправлено уведомление для ${allPosts.length} постов`);
  } catch (error) {
    console.error("❌ Ошибка при проверке RSS или отправке уведомления:", error.message);
  }
}

setInterval(sendDiscordNotification, 30 * 1000);

sendDiscordNotification();
