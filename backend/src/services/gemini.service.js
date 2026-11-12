import { env } from '../config/environment.js';
import { AppError } from '../utils/errors.js';
import { log } from '../utils/logger.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const isGeminiConfigured = () => Boolean(env.geminiApiKey);

const baseSystem = (prefs) => `You are the AI engine of CreatorPulse AI, an independent YouTube creator tool (not affiliated with Google or YouTube).
Rules:
- Use ONLY the data provided. Never invent analytics, numbers, trends, or facts. If data is missing, say so in the "limitations" field.
- Never promise or guarantee views, CTR, virality, or revenue.
- Never claim to have detected audio, voice or video quality unless actual audio/video media was provided in this request.
- Be specific, practical and honest. Avoid keyword stuffing and misleading or clickbait claims.
- Write all human-readable text in ${prefs?.aiLanguage || 'English'} with a ${prefs?.aiTone || 'friendly'} tone.
- Respond with a single valid JSON object that follows the requested shape exactly. No markdown, no commentary.`;

function parseJson(text) {
  const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(clean.slice(start, end + 1)); } catch { /* fall through */ }
    }
    throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI returned an unreadable response. Please try again.');
  }
}

async function callGemini({ prefs, parts, temperature = 0.7 }) {
  if (!isGeminiConfigured()) {
    throw new AppError(503, 'GEMINI_NOT_CONFIGURED', 'AI features are not configured on this server. The administrator must set GEMINI_API_KEY.');
  }
  let res;
  try {
    res = await fetch(`${BASE}/${env.geminiModel}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: baseSystem(prefs) }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(150000),
    });
  } catch (err) {
    log.error('gemini network error', { message: err.message });
    throw new AppError(504, 'AI_TIMEOUT', 'The AI service did not respond in time. Please try again.');
  }
  if (!res.ok) {
    const body = await res.text();
    log.error('gemini error', { status: res.status, body: body.slice(0, 500) });
    if (res.status === 429) throw new AppError(429, 'AI_RATE_LIMIT', 'The AI service is busy or its quota is used up. Try again later.');
    if (res.status === 400 && /api key/i.test(body)) throw new AppError(503, 'GEMINI_NOT_CONFIGURED', 'The configured Gemini API key was rejected.');
    throw new AppError(502, 'AI_ERROR', 'The AI service returned an error. Check the video input (public YouTube URL, supported format) and try again.');
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) throw new AppError(502, 'AI_EMPTY', 'The AI returned no content (it may have been blocked). Try different input.');
  return parseJson(text);
}

const videoBrief = (v) =>
  v ? `Video title: ${v.title}\nDescription: ${(v.description || '').slice(0, 3000)}\nTags: ${(v.tags || []).join(', ')}\nStats: ${v.viewCount} views, ${v.likeCount} likes, ${v.commentCount} comments\nPublished: ${v.publishedAt?.toISOString?.() || v.publishedAt}` : '';

export function analyzeVideo({ prefs, video, transcript, mediaPart, inputKind }) {
  const parts = [];
  if (mediaPart) parts.push(mediaPart);
  parts.push({
    text: `Analyze this YouTube video.\nInput kind: ${inputKind} (media = actual video provided; transcript = text only; metadata = title/description only).\n${videoBrief(video)}\n${transcript ? `Transcript:\n${transcript}` : ''}
Return JSON:
{"overallScore":0-100,"scoreNote":"explain this is an AI estimate of quality, not a measured metric",
"topic":{"mainTopic":"","summary":"","subtopics":[""]},
"content":{"assessment":"","strengths":[""],"weaknesses":[""]},
"seo":{"assessment":"","issues":[""],"improvements":[""]},
"title":{"assessment":"","score":0-100,"alternatives":[""]},
"description":{"assessment":"","improvements":[""]},
"keywords":{"primary":[""],"secondary":[""],"longTail":[""]},
"thumbnailConcept":{"assessment":"","suggestions":[""]},
"structure":{"assessment":"","hookNotes":"","pacingNotes":"","suggestions":[""]},
"audience":{"primary":"","interests":[""],"suggestions":[""]},
"audioVideoQuality":{"assessed":false,"notes":"Only assess if actual media was provided; otherwise say it was not assessed."},
"limitations":""}`,
  });
  return callGemini({ prefs, parts, temperature: 0.4 });
}

export function generateTitles({ prefs, video, topic, context }) {
  return callGemini({
    prefs,
    parts: [{ text: `Generate 12 SEO-friendly YouTube title options (max 100 characters each), covering these categories: search, curiosity, educational, short (under 45 chars), long (70-100 chars). Titles must honestly reflect the content.\n${videoBrief(video)}\nTopic: ${topic || ''}\nExtra context: ${context || ''}\nReturn JSON: {"titles":[{"title":"","category":"search|curiosity|educational|short|long","reason":"why this is recommended"}],"limitations":""}` }],
  });
}

export function generateDescription({ prefs, video, topic, context }) {
  return callGemini({
    prefs,
    parts: [{ text: `Write an SEO-friendly YouTube description (under 5000 chars). Include a short summary, natural keywords, hashtags (max 5) and a call to action. Only include chapters if real timestamps appear in the provided context; otherwise return an empty chapters array.\n${videoBrief(video)}\nTopic: ${topic || ''}\nExtra context (may contain transcript/timestamps): ${context || ''}\nReturn JSON: {"description":"","summary":"","keywords":[""],"hashtags":["#"],"chapters":[{"time":"00:00","title":""}],"callToAction":"","limitations":""}` }],
  });
}

export function generateTags({ prefs, video, topic, context }) {
  return callGemini({
    prefs,
    parts: [{ text: `Suggest 20-30 relevant YouTube tags (all combined must stay under 450 characters). Include keyword, long-tail, related-search and topic tags. Never include irrelevant or misleading tags.\n${videoBrief(video)}\nTopic: ${topic || ''}\nExtra context: ${context || ''}\nReturn JSON: {"tags":[{"tag":"","type":"keyword|long-tail|related|topic"}],"limitations":""}` }],
  });
}

export function thumbnailSuggestions({ prefs, video, topic, context }) {
  return callGemini({
    prefs,
    parts: [{ text: `Suggest thumbnail ideas. This is guidance only; do not claim it will raise CTR.\n${videoBrief(video)}\nTopic: ${topic || ''}\nExtra context: ${context || ''}\nReturn JSON: {"concepts":[{"name":"","description":"","textOverlay":"max 4 words","colors":["#hex or name"],"layout":""}],"improvements":[""],"note":""}` }],
  });
}

export function channelStrategy({ prefs, data }) {
  return callGemini({
    prefs,
    temperature: 0.6,
    parts: [{ text: `Create a channel strategy from ONLY this real data (JSON):\n${JSON.stringify(data).slice(0, 60000)}\nCompare the channel's history with the public trending videos provided (if any). Never guarantee viral results and state limitations clearly (e.g. small sample, missing demographics).\nReturn JSON:
{"nextVideo":{"topic":"","whyRecommended":"","title":"","description":"","keywords":[""],"format":"","targetAudience":""},
"contentStrategy":{"summary":"","pillars":[""],"doMore":[""],"doLess":[""]},
"trendInsights":[{"trend":"","relevance":""}],
"weeklyPlanner":[{"day":"Monday","idea":"","format":"","notes":""}],
"limitations":""}` }],
  });
}

export function replySuggestions({ prefs, commentText, videoTitle }) {
  return callGemini({
    prefs,
    parts: [{ text: `Draft 3 short, genuine replies a creator could post to this YouTube comment. They will be reviewed by the creator before posting.\nVideo: ${videoTitle || 'unknown'}\nComment: ${commentText}\nReturn JSON: {"suggestions":[{"tone":"","text":""}]}` }],
  });
}

export function diagnosePerformance({ prefs, video, evidence }) {
  return callGemini({
    prefs,
    temperature: 0.3,
    parts: [{ text: `A YouTube video shows an unusual performance change. Diagnose using ONLY the evidence below. CTR and impressions are not available through the API, so do not infer CTR; thumbnail/title issues may only be flagged as hypotheses to test. Do not diagnose audio or video quality from analytics.\n${videoBrief(video)}\nEvidence (JSON):\n${JSON.stringify(evidence)}\nReturn JSON: {"observation":"","possibleReason":"","supportingAnalytics":"","recommendedImprovement":"","priority":"low|medium|high","confidence":"low|medium|high"}` }],
  });
}
