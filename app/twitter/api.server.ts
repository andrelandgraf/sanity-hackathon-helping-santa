export type Tweet = {
  tweet_created_at: string;
  id_str: string;
  text: null | string;
  full_text: string;
  source: string;
  truncated: boolean;
  in_reply_to_status_id_str: string | null;
  in_reply_to_user_id_str: string;
  in_reply_to_screen_name: string;
  user: TwitterUser;
  quoted_status_id_str: string | null;
  is_quote_status: boolean;
  quoted_status: null;
  retweeted_status: null;
  quote_count: number;
  reply_count: number;
  retweet_count: number;
  favorite_count: number;
  lang: string;
  views_count: number;
  bookmark_count: number;
};

export type TwitterUser = {
  id_str: string;
  name: string;
  screen_name: string;
  location: string;
  url: null;
  description: string;
  protected: boolean;
  verified: boolean;
  followers_count: number;
  friends_count: number;
  listed_count: number;
  favourites_count: number;
  statuses_count: number;
  created_at: string;
  profile_banner_url: string;
  profile_image_url_https: string;
  can_dm: boolean;
};

export type PartialTweet = {
  id: string;
  full_text: string;
  text: string | null;
  created_at: string;
  retweet_count: number;
  favorite_count: number;
  bookmark_count: number;
  reply_count: number;
  view_count: number;
};

export async function fetchTwitterProfile(name: string) {
  const userInfo = await fetch(`https://api.socialdata.tools/twitter/user/${name}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.SOCIAL_DATA_API_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!userInfo.ok) {
    if (userInfo.status == 429) {
      throw new Error(`Rate limit exceeded fetching ${name} ${userInfo.status}`);
    }
    if (userInfo.status == 404) {
      return null;
    }
  }
  const data = (await userInfo.json()) as Promise<TwitterUser>;
  return data;
}

export async function fetchTweetsFromUser(name: string) {
  return fetchFromSocialData({
    username: name,
  });
}

// sorted by ID in descending order
async function fetchFromSocialData(input: { username: string }) {
  let query = `from:${input.username}`;
  const queryParams = new URLSearchParams({
    query,
    type: 'Latest',
  });
  const apiUrl = `https://api.socialdata.tools/twitter/search?${queryParams.toString()}`;
  const res = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.SOCIAL_DATA_API_KEY}`,
      Accept: 'application/json',
    },
  });
  console.log(`Fetching tweets from ${apiUrl} with status ${res.status}`);
  const json = (await res.json()) as { next_cursor: string; tweets: Tweet[] } | { status: string; message: string };
  if ('status' in json) {
    throw new Error(json.message);
  }
  if (!('tweets' in json) || json.tweets === undefined) {
    console.error('No tweets found in response', json);
    throw new Error(`No tweets found in response ${res.status}`);
  }
  return json.tweets.map((tweet) => ({
    id: tweet.id_str,
    full_text: tweet.full_text,
    text: tweet.text,
    created_at: tweet.tweet_created_at,
    retweet_count: tweet.retweet_count,
    favorite_count: tweet.favorite_count,
    bookmark_count: tweet.bookmark_count,
    reply_count: tweet.reply_count,
    view_count: tweet.views_count,
  }));
}
