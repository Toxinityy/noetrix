export interface NewsItem {
  title: string;
  publishedAt: string;
  url?: string;
}

interface CryptoPanicResult {
  title: string;
  published_at: string;
  url?: string;
}

/// Fetch last-24h crypto headlines for the given currencies from the CryptoPanic free API.
/// Requires CRYPTOPANIC_TOKEN; without it (or on error) returns [] and the prompt notes "no news".
export async function fetchNews(
  currencies: string[],
  token: string | undefined,
  maxItems = 12,
): Promise<NewsItem[]> {
  if (!token) return [];

  const params = new URLSearchParams({
    auth_token: token,
    currencies: currencies.join(","),
    public: "true",
  });
  const url = `https://cryptopanic.com/api/v1/posts/?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[news] CryptoPanic ${res.status} — skipping news`);
      return [];
    }
    const json = (await res.json()) as { results?: CryptoPanicResult[] };
    const cutoff = Date.now() - 24 * 3600 * 1000;
    return (json.results ?? [])
      .filter((r) => Date.parse(r.published_at) >= cutoff)
      .slice(0, maxItems)
      .map((r) => ({ title: r.title, publishedAt: r.published_at, url: r.url }));
  } catch (err) {
    console.warn(`[news] fetch failed — skipping news:`, (err as Error).message);
    return [];
  }
}
