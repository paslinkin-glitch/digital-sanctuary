const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const ALLOWED_ORIGIN = 'https://yoursanctuary.vercel.app';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === ALLOWED_ORIGIN) return true;

  try {
    const parsed = new URL(origin);
    return LOCAL_HOSTS.has(parsed.hostname)
      && (parsed.protocol === 'http:' || parsed.protocol === 'https:');
  } catch (_) {
    return false;
  }
}

function hostnameOf(hostHeader) {
  const host = String(hostHeader || '').split(',')[0].trim().toLowerCase();
  if (!host) return '';
  return host.replace(/:\d+$/, '');
}

function isAllowedHost(hostHeader) {
  const hostname = hostnameOf(hostHeader);
  return hostname === 'yoursanctuary.vercel.app' || LOCAL_HOSTS.has(hostname);
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (_) {
      return {};
    }
  }
  return body;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');

  const origin = req.headers.origin;
  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;
  const originAllowed = origin ? isAllowedOrigin(origin) : isAllowedHost(forwardedHost);

  if (!originAllowed) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = parseBody(req.body);
  const messages = Array.isArray(body.messages)
    ? body.messages
      .slice(-20)
      .map((message) => ({
        role: ['system', 'user', 'assistant'].includes(message && message.role)
          ? message.role
          : 'user',
        content: String((message && message.content) || '').slice(0, 12000),
      }))
      .filter((message) => message.content.length > 0)
    : [];

  if (!messages.length) {
    return res.status(400).json({ error: 'messages is required' });
  }

  const requestedTemperature = Number(body.temperature);
  const temperature = Number.isFinite(requestedTemperature)
    ? Math.min(1.5, Math.max(0, requestedTemperature))
    : 0.9;
  const requestedMaxTokens = Number(body.max_tokens);
  const maxTokens = Number.isFinite(requestedMaxTokens)
    ? Math.min(400, Math.max(1, Math.round(requestedMaxTokens)))
    : 160;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DeepSeek is not configured' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const upstream = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    const text = await upstream.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch (_) {
      payload = null;
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: 'DeepSeek request failed',
      });
    }

    if (!payload) {
      return res.status(502).json({ error: 'Invalid DeepSeek response' });
    }

    return res.status(200).json(payload);
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return res.status(504).json({ error: 'DeepSeek timeout' });
    }
    return res.status(502).json({ error: 'DeepSeek request failed' });
  } finally {
    clearTimeout(timer);
  }
};
