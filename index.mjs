import "dotenv/config";
import express from "express";
import { google } from "googleapis";

const {
  WEBHOOK_SECRET,
  CALENDAR_ID,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  PORT = 3000,
} = process.env;

if (!WEBHOOK_SECRET || !CALENDAR_ID || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  throw new Error("Missing env vars: WEBHOOK_SECRET, CALENDAR_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN");
}

const app = express();
app.use(express.json({ limit: "1mb" }));

function auth(req, res, next) {
  const secret = req.header("X-WC-SECRET");
  if (!secret || secret !== WEBHOOK_SECRET) return res.status(401).json({ ok: false, error: "unauthorized" });
  next();
}

function calendarClient() {
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth: oauth2 });
}

function nextDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/calendar", auth, async (req, res) => {
  try {
    const { op = "create" } = req.body;
    const cal = calendarClient();

    if (op === "create") {
      const { title, allDay, date, endDate, start, end, description, location, tags } = req.body;
      if (!title) throw new Error("missing title");

      const resource = {
        summary: title,
        description: description || "",
        location: location || "",
        transparency: "transparent",
        extendedProperties: { private: tags || {} },
      };

      if (allDay) {
        if (!date) throw new Error("missing date");
        resource.start = { date };
        resource.end = { date: endDate || nextDate(date) };
      } else {
        if (!start || !end) throw new Error("missing start/end");
        resource.start = { dateTime: start };
        resource.end = { dateTime: end };
      }

      const out = await cal.events.insert({ calendarId: CALENDAR_ID, requestBody: resource });
      return res.json({ ok: true, eventId: out.data.id, htmlLink: out.data.htmlLink });
    }

    if (op === "update") {
      const { eventId, patch } = req.body;
      if (!eventId) throw new Error("missing eventId");
      const out = await cal.events.patch({ calendarId: CALENDAR_ID, eventId, requestBody: patch });
      return res.json({ ok: true, eventId: out.data.id, htmlLink: out.data.htmlLink });
    }

    if (op === "delete") {
      const { eventId } = req.body;
      if (!eventId) throw new Error("missing eventId");
      await cal.events.delete({ calendarId: CALENDAR_ID, eventId });
      return res.json({ ok: true, deleted: true });
    }

    return res.status(400).json({ ok: false, error: "unknown op" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(PORT, () => console.log(`listening on ${PORT}`));
