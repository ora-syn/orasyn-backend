console.log("🚨🚨🚨 ORASYN STARTET AUS DATEI:", __filename);
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const cors = require("cors");
require("dotenv").config();
console.log("CLIENT ID:", process.env.GOOGLE_CLIENT_ID);
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: "lax",
      secure: false, // localhost
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
console.log("🚨🚨🚨 ORASYN CALLBACK WIRD AUSGEFÜHRT 🚨🚨🚨");
console.log("✅ GOOGLE LOGIN ERFOLGREICH");

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth });

  // Fokuszeit (fest fürs MVP)
  const focusStart = new Date();
  focusStart.setHours(9, 0, 0, 0);

  const focusEnd = new Date();
  focusEnd.setHours(11, 0, 0, 0);

  try {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      timeMax: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });
console.log("🧪 Calendar API raw response:", JSON.stringify(res.data, null, 2));


    const events = res.data.items || [];
console.log("🧠 Rohdaten Events:", events);


    console.log(`📅 Termine heute: ${events.length}`);

    events.forEach((event) => {
      if (!event.start?.dateTime || !event.end?.dateTime) return;

      const startTime = event.start.dateTime || event.start.date;
const endTime = event.end.dateTime || event.end.date;

if (!startTime || !endTime) return;

const eventStart = new Date(startTime);
const eventEnd = new Date(endTime);

      const overlap =
        eventStart < focusEnd && eventEnd > focusStart;

      if (overlap) {
        console.log(
          `⚠️ KONFLIKT: "${event.summary}" (${eventStart.toLocaleTimeString()}–${eventEnd.toLocaleTimeString()}) kollidiert mit Fokuszeit`
        );
      }
    });
  } catch (err) {
    console.error("❌ Fehler beim Lesen des Kalenders:", err);
  }

  done(null, profile);
}

  )
);

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.send("✅ Google Login erfolgreich – ORASYN verbunden.");
  }
);

app.get("/", (req, res) => {
  res.send("ORASYN backend running 🚀");
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`ORASYN listening on http://localhost:${PORT}`);
});
