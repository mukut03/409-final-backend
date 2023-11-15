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
    scope: ['user-read-email', 'user-read-private', 'ugc-image-upload', 'playlist-modify-private', 'playlist-modify-public'],
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

app.get('/playlists', (req, res) => { // user interaction 1
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

app.get('/search-playlists', (req, res) => { // user interaction 2
    const { query } = req.query;  // Extract the search query from the request query string

    if (!query) {
        return res.status(400).send('A search query is required');
    }

    spotifyApi.searchPlaylists(query)
        .then(data => {
            res.json(data.body.playlists.items);  // You can modify the response as needed
        })
        .catch(err => {
            res.status(400).send(`Error searching playlists: ${err}`);
        });
});

app.post('/select-playlist', (req, res) => { // user interaction 3
    const { playlistId } = req.body;

    if (!playlistId) {
        return res.status(400).send('Playlist ID is required');
    }

    // Here, you can handle the playlist selection, e.g., fetching tracks, storing the ID, etc.
    console.log(`Playlist selected: ${playlistId}`);
    // For example, you could store the playlist ID in a variable or a database
    // and then use it to fetch the tracks or for other processing.

    res.send(`Playlist ${playlistId} selected`);
});


app.get('/playlist-tracks/:playlistId', (req, res) => { // user interaction 3
    const playlistId = req.params.playlistId;

    spotifyApi.getPlaylistTracks(playlistId)
        .then(data => {
            // Extracting album art URLs from each track
            const albumArtUrls = data.body.items.map(item => {
                // Some tracks might not have album art, so we check for it
                return item.track.album.images.length > 0 ? item.track.album.images[0].url : null;
            }).filter(url => url !== null); // Filtering out tracks without album art

            res.json(albumArtUrls); // Sending only the album art URLs to the frontend
        })
        .catch(err => {
            res.status(400).send(`Error fetching playlist tracks: ${err}`);
        });
});

app.post('/set-playlist-image/:playlistId', (req, res) => { // user interaction 4
    const playlistId = req.params.playlistId;
    const { imageBase64 } = req.body; // Assuming the image is sent as a base64 encoded string

    if (!playlistId || !imageBase64) {
        return res.status(400).send('Playlist ID and image data are required');
    }

    // Spotify API call to set the playlist image goes here
    // Spotify requires the image to be in JPEG format, encoded in base64
    spotifyApi.uploadCustomPlaylistCoverImage(playlistId, imageBase64)
        .then(data => {
            res.send('Playlist image updated successfully');
        })
        .catch(err => {
            res.status(400).send(`Error setting playlist image: ${err}`);
        });
});

app.post('/follow-playlist', (req, res) => { // user interaction 5
    const { playlistId } = req.body;

    if (!playlistId) {
        return res.status(400).send('Playlist ID is required');
    }

    spotifyApi.followPlaylist(playlistId)
        .then(() => {
            res.send(`Successfully followed playlist with ID: ${playlistId}`);
        })
        .catch(err => {
            res.status(400).send(`Error following playlist: ${err}`);
        });
});


// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
