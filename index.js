const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require("express-session");
const pgPromise = require("pg-promise");

// Database connection configuration
const pgp = pgPromise();
const dbConfig = {
  host: "localhost",
  port: 5432,
  database: "",
  user: "",
  password: "",
};
const db = pgp(dbConfig);

// Create the users table if it doesn't exist
db.none(
  `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    googleId TEXT,
    name TEXT
  )
`
)
  .then(() => console.log("PostgreSQL table created"))
  .catch((err) => console.log(err));

// Passport configuration
passport.use(
  new GoogleStrategy(
    {
      clientID: "yourClientId",
      clientSecret: "yourClientSecret",
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if the user exists in the database
        const existingUser = await db.oneOrNone(
          "SELECT * FROM users WHERE googleId = $1",
          profile.id
        );
        if (existingUser) {
          // If the user exists, return it
          done(null, existingUser);
        } else {
          // If the user is new, create it and return
          const newUser = await db.one(
            "INSERT INTO users (googleId, name) VALUES ($1, $2) RETURNING *",
            [profile.id, profile.displayName]
          );
          done(null, newUser);
        }
      } catch (error) {
        done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.oneOrNone("SELECT * FROM users WHERE id = $1", id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

const app = express();

// Middleware setup
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: "yourSecretKey",
    resave: true,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.get("/", (req, res) => {
  res.send("Home page");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    // Successful authentication
    res.redirect("/profile");
  }
);

app.get("/profile", (req, res) => {
  res.send(`Welcome ${req.user.name}`);
});

// Start the server
app.listen(3000, () => console.log("Server started"));
