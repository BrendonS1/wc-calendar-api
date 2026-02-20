import http from "http";
import { OAuth2Client } from "google-auth-library";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const REDIRECT_URI = "http://localhost:8787/oauth2callback";
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.");
  process.exit(1);
}

const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

console.log("Open this URL in your browser:\n\n" + authUrl + "\n");

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/oauth2callback")) return;

  const url = new URL(req.url, "http://localhost:8787");
  const code = url.searchParams.get("code");

  if (!code) {
    res.end("No code found.");
    return;
  }

  const { tokens } = await oAuth2Client.getToken(code);
  res.end("OK. You can close this tab.");
  server.close();

  console.log("\nCOPY THIS refresh_token (keep it secret):\n");
  console.log(tokens.refresh_token);
  console.log("\n(Do NOT paste it into chat.)\n");
});

server.listen(8787, () => console.log("Listening on http://localhost:8787 ..."));
