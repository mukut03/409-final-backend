require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const SpotifyStrategy = require('passport-spotify').Strategy;
const SpotifyWebApi = require('spotify-web-api-node');


const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_session_secret', // Use a secure and unique secret
    resave: false,
    saveUninitialized: false
}));

// Initialize Passport and restore authentication state, if any, from the session
app.use(passport.initialize());
app.use(passport.session());

let spotifyApi = new SpotifyWebApi();

// Passport Spotify strategy configuration
passport.use(new SpotifyStrategy({
    clientID: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
  },
  (accessToken, refreshToken, expires_in, profile, done) => {
    // Here you can save the accessToken, refreshToken, and profile to your database
    // For this example, we'll just pass the profile to the done callback
    spotifyApi.setAccessToken(accessToken);
    return done(null, profile);
  }
));

// Serialize and deserialize user (for session handling)
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    // Here, find the user by ID from your database
    // For now, we'll just pass the id to the done callback
    done(null, id);
});

// Authentication routes
app.get('/login', passport.authenticate('spotify', {
    scope: ['user-read-email', 'user-read-private'],
    showDialog: true
}));


app.get('/callback', passport.authenticate('spotify', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication, redirect home or to another page
        console.log('Succesful authentication')
        res.redirect('/'); // Redirect to the frontend URL where you handle post-login
    }
);


app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/playlists', (req, res) => {
    spotifyApi.getUserPlaylists()
        .then(data => {
            // Extracting playlist names
            const playlistNames = data.body.items.map(playlist => playlist.name);

            // Logging playlist names to the console
            console.log("User's Playlists:", playlistNames);

            // Sending back the full data to the frontend (or you can just send the names)
            res.json(data.body);
        })
        .catch(err => {
            res.status(400).send(`Error fetching playlists: ${err}`);
        });
});


// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
