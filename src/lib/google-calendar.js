import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events.readonly"];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-calendar/callback`
  );
}

/**
 * Generate the Google OAuth consent URL.
 * @param {string} state - CSRF state token
 * @returns {string}
 */
export function getGoogleOAuthUrl(state) {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * @param {string} code
 * @returns {Promise<{access_token: string, refresh_token: string, expiry_date: number}>}
 */
export async function exchangeGoogleCode(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  };
}

/**
 * Refresh an expired access token using the refresh token.
 * @param {string} refreshToken
 * @returns {Promise<{access_token: string, expiry_date: number}>}
 */
export async function refreshGoogleToken(refreshToken) {
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return {
    access_token: credentials.access_token,
    expiry_date: credentials.expiry_date,
  };
}

/**
 * Fetch events from the user's primary Google Calendar.
 * @param {string} accessToken
 * @param {string} timeMin - ISO date string (start of range)
 * @param {string} timeMax - ISO date string (end of range)
 * @returns {Promise<Array<{id, title, start, end, source}>>}
 */
export async function fetchCalendarEvents(accessToken, timeMin, timeMax) {
  const client = getOAuth2Client();
  client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth: client });

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  const events = response.data.items || [];

  return events.map((event) => ({
    id: event.id,
    title: event.summary || "Untitled Event",
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    source: "google_calendar",
  }));
}
