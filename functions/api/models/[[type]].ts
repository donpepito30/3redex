interface Env {
  // Add any environment variables if needed
}

// In-memory rate limiting map with high-capacity limits for multi-user mobile IPs
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120;

function rateLimiter(ip: string): boolean {
  const now = Date.now();
  const userData = rateLimitMap.get(ip) || { count: 0, lastReset: now };

  if (now - userData.lastReset > RATE_LIMIT_WINDOW) {
    userData.count = 0;
    userData.lastReset = now;
  }

  userData.count++;
  rateLimitMap.set(ip, userData);

  return userData.count <= MAX_REQUESTS_PER_WINDOW;
}

// Fast Timeout-Bound Fetcher
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Resilient Retry Logic with Rapid Failover
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 400): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 1.5);
  }
}

export const onRequest = async (context: any) => {
  const { request, params } = context;
  
  // Only allow GET requests
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Get client IP safely in Cloudflare
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  // Apply Rate Limiting
  if (!rateLimiter(ip)) {
    console.log(`[Cloudflare Pages - Rate Limit] Throttled IP: ${ip}`);
    return new Response(JSON.stringify({ error: "Too many requests. Data access throttled." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-App-Engine": "REDEX-Central-Core-Edge",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      }
    });
  }

  try {
    // Type parameter validation (e.g. models/online)
    const type = params.type;
    const typeStr = Array.isArray(type) ? type[0] : type;

    if (typeStr && typeStr !== "online") {
      return new Response(JSON.stringify({ error: "Invalid resource type requested" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const baseUrl = typeStr === "online"
      ? "https://go.whitetrafsa.com/api/models/online"
      : "https://go.whitetrafsa.com/api/models";

    // URL parsing & query param sanitization
    const url = new URL(request.url);
    const queryParams = new URLSearchParams();
    const safeKeyRegex = /^[a-zA-Z0-9_\-]+$/;

    url.searchParams.forEach((value, key) => {
      if (!safeKeyRegex.test(key)) {
        return;
      }
      const sanitizedValue = value.replace(/[\langle\rangle"';\\]/g, "");
      queryParams.append(key, sanitizedValue);
    });

    const targetUrl = `${baseUrl}?${queryParams.toString()}`;

    // Cloudflare Edge Cache check
    const cacheKey = new Request(targetUrl, { headers: request.headers });
    let cache: any = null;
    try {
      if (typeof caches !== "undefined" && (caches as any).default) {
        cache = (caches as any).default;
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          return cachedResponse;
        }
      }
    } catch (cacheErr) {
      // Cache match error ignored, continue to fetch
    }

    // Fetch from target with fast failover
    const data = await withRetry(async () => {
      // Strategy 1: Optimized browser headers with 5s timeout
      try {
        const response = await fetchWithTimeout(targetUrl, {
          headers: {
            "Accept": "application/json, text/plain, */*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": "https://go.whitetrafsa.com/",
            "Origin": "https://go.whitetrafsa.com"
          }
        }, 5000);
        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        // Fallback to strategy 2
      }

      // Strategy 2: Plain direct fetch with 5s timeout
      const directResponse = await fetchWithTimeout(targetUrl, {}, 5000);
      if (!directResponse.ok) {
        throw new Error(`API Status ${directResponse.status}`);
      }
      return await directResponse.json();
    });

    // Build standard secure response with high-performance edge caching
    const edgeResponse = new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-App-Engine": "REDEX-Central-Core-Edge",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=45, s-maxage=90, stale-while-revalidate=180"
      }
    });

    // Store in Cloudflare Edge Cache in background
    if (cache) {
      try {
        context.waitUntil(cache.put(cacheKey, edgeResponse.clone()));
      } catch (e) {}
    }

    return edgeResponse;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Network failure";
    console.log(`[Cloudflare Pages - Error] Reason: ${errorMsg}`);
    return new Response(JSON.stringify({ 
      error: "Discovery link unstable. Retrying synchronization.",
      details: errorMsg
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "X-App-Engine": "REDEX-Central-Core-Edge",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
