export type YouTubeStats = {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  title: string;
  thumbnailUrl: string | null;
};

/**
 * Fetches public statistics for a YouTube video via the Data API v3, using a
 * plain API key (no OAuth needed: statistics/snippet are public read data).
 * Returns null if the video doesn't exist / was deleted / is private.
 */
export async function fetchYouTubeStats(youtubeId: string): Promise<YouTubeStats | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not set in .env');
  }

  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${encodeURIComponent(youtubeId)}&key=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`YouTube Data API request failed: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) {
    return null;
  }

  return {
    viewCount: Number(item.statistics?.viewCount ?? 0),
    likeCount: Number(item.statistics?.likeCount ?? 0),
    commentCount: Number(item.statistics?.commentCount ?? 0),
    title: item.snippet?.title ?? '',
    thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? null,
  };
}
