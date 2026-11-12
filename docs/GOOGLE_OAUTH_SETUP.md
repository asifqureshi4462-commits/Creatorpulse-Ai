# Google Cloud Console setup

1. Create a project at https://console.cloud.google.com.
2. **APIs & Services > Library**: enable **YouTube Data API v3**, **YouTube Analytics API**. (Gemini keys come from https://aistudio.google.com/apikey.)
3. **OAuth consent screen**: External, app name "CreatorPulse AI", add your email. Add scopes:
   `youtube.readonly`, `youtube.force-ssl`, `yt-analytics.readonly`, `yt-analytics-monetary.readonly`, `userinfo.email`, `userinfo.profile`, `openid`.
   Keep it in *Testing* and add test users, or submit for verification before public launch (YouTube scopes are sensitive).
4. **Credentials > Create OAuth client ID > Web application**. Authorized redirect URIs:
   - `http://localhost:4000/api/auth/callback`
   - `https://YOUR-API.onrender.com/api/auth/callback`
5. Copy the Client ID / Secret into the backend environment variables. Never put them in the frontend.
6. The default YouTube Data API quota is 10,000 units/day. Editing a video costs 50 units; listing costs 1. Monitoring stops for the run if quota is exhausted.

If a user selects a Google account without a YouTube channel, the app explains this on the sign-in screen.
