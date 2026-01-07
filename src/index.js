// =======================
// ORASYN Backend – ES Modules
// =======================

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import cors from "cors";
import { google } from "googleapis";

// =======================
// Basic Logs (Debug)
// =======================

console.log("🔥 CALLBACK URL BEIM START:", process.env.GOOGLE_CALLBACK_URL);
console.log("CLIENT ID:", process.env.GOOGLE_CLIENT_ID ? "✅ vorhanden" : "❌ fehlt");

// =======================
// App Setup
// =======================

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
      secure: false, // Railway handled TLS
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// =======================
// Passport Session Handling
// =======================

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// =======================
// Google OAuth Strategy
// =======================

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

      try {
        // Google Auth Client
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: "v3", auth });

        // =======================
        // MVP Fokuszeit (fest)
        // =======================

        const focusStart = new Date();
        focusStart.setHours(9, 0, 0, 0);

        const focusEnd = new Date();
        focusEnd.setHours(11, 0, 0, 0);

        // =======================
        // Kalender lesen
        // =======================

        const res = await calendar.events.list({
          calendarId: "primary",
          timeMin: new Date().toISOString(),
          timeMax: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = res.data.items || [];
        console.log(`📅 Termine heute: ${events.length}`);

        events.forEach((event) => {
          if (!event.start?.dateTime || !event.end?.dateTime) return;

          const eventStart = new Date(event.start.dateTime);
          const eventEnd = new Date(event.end.dateTime);

          const overlap = eventStart < focusEnd && eventEnd > focusStart;

          if (overlap) {
            console.log(
              `⚠️ KONFLIKT: "${event.summary}" (${eventStart.toLocaleTimeString()}–${eventEnd.toLocaleTimeString()})`
            );
          }
        });

        done(null, profile);
      } catch (err) {
        console.error("❌ Fehler beim Lesen des Kalenders:", err);
        done(err, null);
      }
    }
  )
);

// =======================
// Routes
// =======================

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

// =======================
// Server Start
// =======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 ORASYN listening on port ${PORT}`);
});
