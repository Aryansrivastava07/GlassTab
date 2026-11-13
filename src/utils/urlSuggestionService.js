/**
 * URL Suggestion Service
 * Automatically suggests website URLs and domain variants based on user-entered names.
 */

// Curated list of popular websites, aliases, and direct canonical URLs
export const POPULAR_SITES = [
  // Search & AI
  { name: 'Google', url: 'https://google.com', aliases: ['google', 'goog', 'google search'], subdomains: ['https://mail.google.com', 'https://drive.google.com', 'https://calendar.google.com'] },
  { name: 'ChatGPT', url: 'https://chatgpt.com', aliases: ['chatgpt', 'chat gpt', 'openai', 'gpt'], subdomains: ['https://platform.openai.com'] },
  { name: 'Claude', url: 'https://claude.ai', aliases: ['claude', 'anthropic', 'claude ai'] },
  { name: 'Gemini', url: 'https://gemini.google.com', aliases: ['gemini', 'bard', 'google gemini', 'google bard'] },
  { name: 'Perplexity', url: 'https://perplexity.ai', aliases: ['perplexity', 'pplx'] },
  { name: 'DeepSeek', url: 'https://chat.deepseek.com', aliases: ['deepseek', 'deep seek'] },
  { name: 'Microsoft Copilot', url: 'https://copilot.microsoft.com', aliases: ['copilot', 'bing ai'] },
  { name: 'Bing', url: 'https://bing.com', aliases: ['bing', 'bing search'] },
  { name: 'DuckDuckGo', url: 'https://duckduckgo.com', aliases: ['duckduckgo', 'ddg'] },

  // Coding & Developer
  { name: 'GitHub', url: 'https://github.com', aliases: ['github', 'gh', 'git hub'], subdomains: ['https://gist.github.com'] },
  { name: 'GitLab', url: 'https://gitlab.com', aliases: ['gitlab'] },
  { name: 'Stack Overflow', url: 'https://stackoverflow.com', aliases: ['stackoverflow', 'so', 'stack overflow'] },
  { name: 'LeetCode', url: 'https://leetcode.com', aliases: ['leetcode', 'lc', 'leet code'] },
  { name: 'GeeksforGeeks', url: 'https://geeksforgeeks.org', aliases: ['geeksforgeeks', 'gfg'] },
  { name: 'HackerRank', url: 'https://hackerrank.com', aliases: ['hackerrank', 'hr'] },
  { name: 'Codeforces', url: 'https://codeforces.com', aliases: ['codeforces', 'cf'] },
  { name: 'CodeChef', url: 'https://codechef.com', aliases: ['codechef'] },
  { name: 'Vercel', url: 'https://vercel.com', aliases: ['vercel'] },
  { name: 'Netlify', url: 'https://netlify.com', aliases: ['netlify'] },
  { name: 'Cloudflare', url: 'https://cloudflare.com', aliases: ['cloudflare'] },
  { name: 'Firebase', url: 'https://console.firebase.google.com', aliases: ['firebase'] },
  { name: 'Supabase', url: 'https://supabase.com', aliases: ['supabase'] },
  { name: 'npm', url: 'https://npmjs.com', aliases: ['npm', 'npmjs'] },
  { name: 'MDN Web Docs', url: 'https://developer.mozilla.org', aliases: ['mdn', 'mozilla', 'mdn web docs'] },
  { name: 'W3Schools', url: 'https://w3schools.com', aliases: ['w3schools', 'w3s'] },
  { name: 'Docker Hub', url: 'https://hub.docker.com', aliases: ['docker', 'docker hub'] },
  { name: 'Hugging Face', url: 'https://huggingface.co', aliases: ['huggingface', 'hf', 'hugging face'] },
  { name: 'Kaggle', url: 'https://kaggle.com', aliases: ['kaggle'] },
  { name: 'Replit', url: 'https://replit.com', aliases: ['replit'] },
  { name: 'CodePen', url: 'https://codepen.io', aliases: ['codepen'] },
  { name: 'AWS Console', url: 'https://aws.amazon.com', aliases: ['aws', 'amazon web services'] },

  // Social & Media
  { name: 'YouTube', url: 'https://youtube.com', aliases: ['youtube', 'yt', 'you tube'], subdomains: ['https://music.youtube.com', 'https://studio.youtube.com'] },
  { name: 'X / Twitter', url: 'https://x.com', aliases: ['twitter', 'x', 'tweet', 'x.com'] },
  { name: 'Reddit', url: 'https://reddit.com', aliases: ['reddit'] },
  { name: 'LinkedIn', url: 'https://linkedin.com', aliases: ['linkedin', 'li'] },
  { name: 'Instagram', url: 'https://instagram.com', aliases: ['instagram', 'insta', 'ig'] },
  { name: 'Facebook', url: 'https://facebook.com', aliases: ['facebook', 'fb'] },
  { name: 'WhatsApp Web', url: 'https://web.whatsapp.com', aliases: ['whatsapp', 'wa', 'whatsapp web'] },
  { name: 'Telegram Web', url: 'https://web.telegram.org', aliases: ['telegram', 'tg', 'telegram web'] },
  { name: 'Discord', url: 'https://discord.com', aliases: ['discord'] },
  { name: 'Twitch', url: 'https://twitch.tv', aliases: ['twitch'] },
  { name: 'TikTok', url: 'https://tiktok.com', aliases: ['tiktok'] },
  { name: 'Pinterest', url: 'https://pinterest.com', aliases: ['pinterest', 'pin'] },
  { name: 'Threads', url: 'https://threads.net', aliases: ['threads'] },

  // Streaming & Audio
  { name: 'Spotify', url: 'https://spotify.com', aliases: ['spotify'] },
  { name: 'YouTube Music', url: 'https://music.youtube.com', aliases: ['yt music', 'youtube music'] },
  { name: 'Netflix', url: 'https://netflix.com', aliases: ['netflix'] },
  { name: 'Prime Video', url: 'https://primevideo.com', aliases: ['prime video', 'amazon prime video', 'prime'] },
  { name: 'Disney+', url: 'https://disneyplus.com', aliases: ['disney', 'disney+', 'hotstar', 'disney hotstar'] },
  { name: 'SoundCloud', url: 'https://soundcloud.com', aliases: ['soundcloud'] },
  { name: 'Crunchyroll', url: 'https://crunchyroll.com', aliases: ['crunchyroll'] },
  { name: 'IMDb', url: 'https://imdb.com', aliases: ['imdb'] },

  // Productivity & Work
  { name: 'Gmail', url: 'https://mail.google.com', aliases: ['gmail', 'google mail', 'mail'] },
  { name: 'Google Drive', url: 'https://drive.google.com', aliases: ['drive', 'gdrive', 'google drive'] },
  { name: 'Google Docs', url: 'https://docs.google.com', aliases: ['docs', 'google docs'] },
  { name: 'Google Sheets', url: 'https://sheets.google.com', aliases: ['sheets', 'google sheets'] },
  { name: 'Google Calendar', url: 'https://calendar.google.com', aliases: ['calendar', 'gcal', 'google calendar'] },
  { name: 'Google Meet', url: 'https://meet.google.com', aliases: ['meet', 'google meet'] },
  { name: 'Google Maps', url: 'https://maps.google.com', aliases: ['maps', 'google maps'] },
  { name: 'Google Translate', url: 'https://translate.google.com', aliases: ['translate', 'google translate'] },
  { name: 'Notion', url: 'https://notion.so', aliases: ['notion'] },
  { name: 'Figma', url: 'https://figma.com', aliases: ['figma'] },
  { name: 'Canva', url: 'https://canva.com', aliases: ['canva'] },
  { name: 'Trello', url: 'https://trello.com', aliases: ['trello'] },
  { name: 'Slack', url: 'https://slack.com', aliases: ['slack'] },
  { name: 'Outlook', url: 'https://outlook.live.com', aliases: ['outlook', 'hotmail', 'msn'] },
  { name: 'Office 365', url: 'https://office.com', aliases: ['office', 'office 365', 'm365'] },
  { name: 'Zoom', url: 'https://zoom.us', aliases: ['zoom'] },
  { name: 'Dropbox', url: 'https://dropbox.com', aliases: ['dropbox'] },
  { name: 'Linear', url: 'https://linear.app', aliases: ['linear'] },
  { name: 'Asana', url: 'https://asana.com', aliases: ['asana'] },
  { name: 'Jira', url: 'https://atlassian.net', aliases: ['jira', 'atlassian'] },

  // Shopping & Finance
  { name: 'Amazon', url: 'https://amazon.com', aliases: ['amazon', 'amzn'] },
  { name: 'Flipkart', url: 'https://flipkart.com', aliases: ['flipkart'] },
  { name: 'eBay', url: 'https://ebay.com', aliases: ['ebay'] },
  { name: 'PayPal', url: 'https://paypal.com', aliases: ['paypal'] },
  { name: 'Stripe', url: 'https://stripe.com', aliases: ['stripe'] },
  { name: 'Zerodha Kite', url: 'https://kite.zerodha.com', aliases: ['zerodha', 'kite'] },
  { name: 'Groww', url: 'https://groww.in', aliases: ['groww'] },

  // Reading & Knowledge
  { name: 'Wikipedia', url: 'https://wikipedia.org', aliases: ['wikipedia', 'wiki'] },
  { name: 'Medium', url: 'https://medium.com', aliases: ['medium'] },
  { name: 'Substack', url: 'https://substack.com', aliases: ['substack'] },
  { name: 'Quora', url: 'https://quora.com', aliases: ['quora'] },
  { name: 'Dev.to', url: 'https://dev.to', aliases: ['devto', 'dev.to'] },
  { name: 'Hashnode', url: 'https://hashnode.com', aliases: ['hashnode'] },
  { name: 'Hacker News', url: 'https://news.ycombinator.com', aliases: ['hacker news', 'hn', 'ycombinator'] },
  { name: 'Coursera', url: 'https://coursera.org', aliases: ['coursera'] },
  { name: 'Udemy', url: 'https://udemy.com', aliases: ['udemy'] }
];

const COMMON_TLDS = ['.com', '.org', '.io', '.dev', '.net', '.in', '.app', '.ai', '.co'];

/**
 * Clean and format a URL string for display label
 */
export const formatDisplayDomain = (url) => {
  try {
    return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  } catch {
    return url;
  }
};

/**
 * Suggest URLs based on user-typed website name.
 * Returns an object with:
 * - primaryUrl: the best single URL to auto-fill
 * - suggestions: array of { url, label, name } for interactive chips
 */
export const getUrlSuggestionsForName = (nameInput) => {
  if (!nameInput || typeof nameInput !== 'string') {
    return { primaryUrl: '', suggestions: [] };
  }

  const query = nameInput.trim().toLowerCase();
  if (query.length === 0) {
    return { primaryUrl: '', suggestions: [] };
  }

  // 1. If user typed an actual URL or full domain (e.g. "github.com", "sub.domain.org", "http://...")
  if (/^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(query)) {
    const fullUrl = /^https?:\/\//i.test(query) ? query : `https://${query}`;
    return {
      primaryUrl: fullUrl,
      suggestions: [
        { url: fullUrl, label: formatDisplayDomain(fullUrl), name: nameInput.trim() }
      ]
    };
  }

  // 2. Score matches against curated popular sites
  const matches = [];

  for (const site of POPULAR_SITES) {
    const siteName = site.name.toLowerCase();
    let score = 0;

    // Exact matches
    if (siteName === query) {
      score = 100;
    } else if (site.aliases.some((a) => a.toLowerCase() === query)) {
      score = 90;
    } else if (siteName.startsWith(query)) {
      score = 70;
    } else if (site.aliases.some((a) => a.toLowerCase().startsWith(query))) {
      score = 60;
    } else if (siteName.includes(query) || site.aliases.some((a) => a.toLowerCase().includes(query))) {
      score = 40;
    }

    if (score > 0) {
      matches.push({
        score,
        site,
        url: site.url,
        label: formatDisplayDomain(site.url),
        name: site.name
      });

      // Also include subdomains if score is high
      if (score >= 60 && Array.isArray(site.subdomains)) {
        for (const subUrl of site.subdomains) {
          matches.push({
            score: score - 5,
            site,
            url: subUrl,
            label: formatDisplayDomain(subUrl),
            name: `${site.name} (${formatDisplayDomain(subUrl).split('.')[0]})`
          });
        }
      }
    }
  }

  // Sort matched sites by score descending
  matches.sort((a, b) => b.score - a.score);

  // 3. Fallback / generic domain suggestions from alphanumeric query
  const slug = query.replace(/[^a-z0-9]/g, '');
  const genericSuggestions = [];

  if (slug.length > 0) {
    // Top TLD suggestions
    const primaryGeneric = `https://${slug}.com`;
    genericSuggestions.push({
      url: primaryGeneric,
      label: `${slug}.com`,
      name: nameInput.trim()
    });

    if (slug.length >= 3) {
      ['.io', '.org', '.dev', '.app', '.net'].forEach((tld) => {
        genericSuggestions.push({
          url: `https://${slug}${tld}`,
          label: `${slug}${tld}`,
          name: nameInput.trim()
        });
      });
    }
  }

  // 4. Combine and deduplicate
  const combined = [];
  const seenUrls = new Set();

  for (const item of matches) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      combined.push({
        url: item.url,
        label: item.label,
        name: item.name
      });
    }
  }

  for (const item of genericSuggestions) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      combined.push(item);
    }
  }

  const suggestions = combined.slice(0, 5);
  const primaryUrl = suggestions[0]?.url || (slug ? `https://${slug}.com` : '');

  return { primaryUrl, suggestions };
};
