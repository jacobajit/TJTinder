var express = require("express");
var request = require("request");
var session = require("express-session");
var simpleoauth2 = require("simple-oauth2");
var FirebaseTokenGenerator = require("firebase-token-generator");

var app = express();

// client type: confidential
// authorization grant type: authorization-code

var client_id = process.env.CLIENT_ID;
var client_secret = process.env.CLIENT_SECRET;
var firebase_auth = process.env.FIREBASE_AUTH;
var firebase_secret = process.env.FIREBASE_SECRET;

app.use(session({
    secret: client_secret,
    resave: false,
    saveUninitialized: true
}));

if (!client_id || !client_secret) {
    console.warn("No client ID or client secret set!");
}

if (!firebase_auth && !firebase_secret) {
    console.warn("No firebase authentication set!");
}


var tokenGenerator = new FirebaseTokenGenerator(firebase_secret);

app.use(express.static("static"));
app.engine("html", require("ejs").renderFile);

var oauth = simpleoauth2.create({
    client: {
        id: client_id,
        secret: client_secret
    },
    auth: {
        tokenHost: 'https://ion.tjhsst.edu/oauth'
    }
});

var ion_redirect_uri = process.env.REDIRECT_URI;

var login_url = oauth.authorizationCode.authorizeURL({
    scope: "read",
    redirect_uri: ion_redirect_uri
});

app.get("/", function(req, res) {
    if (!req.session.access_token) {
        res.render("login.html", { login_url: login_url });
    }
    else {
        res.render("tjtinder.html", { firebase_token: req.session.firebase_token, userid: req.session.uid });
    }
});

app.get("/matches", function(req, res) {
    if (!req.session.access_token) {
        res.redirect("/");
    }
    else {
        // TODO: get matches and display to user
        res.render("matches.html", { firebase_token: req.session.firebase_token, userid: req.session.uid });
    }
});

function choose(choices) {
    var index = Math.floor(Math.random() * choices.length);
    return choices[index];
}

app.get("/random", function(req, res) {
    // TODO: get a random id not chosen before
    var id = choose([32164, 32327, 32215]);
    if (!req.session.access_token) {
        res.type("application/json");
        res.write(JSON.stringify({error: "Not Logged In"}));
        res.end();
        return;
    }
    checkTokenExpire(req);
    apiRequest("/api/profile/" + id, req.method, req.session.access_token, function(out, type) {
        res.type(type || "application/json");
        res.write(out);
        res.end();
    });
});

app.post("/like", function(req, res) {
    res.type("application/json");
    // TODO: process like
    res.write(JSON.stringify({"info": "You liked this person!"}));
    res.end();
});

app.post("/dislike", function(req, res) {
    res.type("application/json");
    // TODO: process dislike
    res.write(JSON.stringify({"info": "You passed on this person!"}));
    res.end();
});

function checkTokenExpire(req) {
    var token = oauth.accessToken.create({
        "access_token": req.session.access_token,
        "refresh_token": req.session.refresh_token,
        "expires_in": req.session.expires_in
    });
    if (token.expired()) {
        token.refresh((err, result) => {
            token = result;
            req.session.access_token = token.token.access_token;
        });
    }
}

app.all("/api/*", function(req, res) {
    console.log("API Request: " + req.path + " (" + req.method + ")");
    if (!req.session.access_token) {
        res.type("application/json");
        res.write(JSON.stringify({error: "Not Logged In"}));
        res.end();
        return;
    }
    checkTokenExpire(req);
    if (!req.path.startsWith("/api/profile")) {
        res.type("application/json");
        res.write(JSON.stringify({error: "Method Not Allowed"}));
        res.end();
        return;
    }
    apiRequest(req.path, req.method, req.session.access_token, function(out, type) {
        res.type(type || "application/json");
        res.write(out);
        res.end();
    });
});

function apiRequest(path, method, token, callback) {
    request({
        uri: path,
        baseUrl: "https://ion.tjhsst.edu",
        method: method,
        encoding: null,
        form: {
            "format": "json",
            "access_token": token
        }
    }, function(err, resp, body) {
        if (err) {
            console.error("API Error: " + err);
            callback(JSON.stringify({error: "Server Error"}));
            return;
        }
        callback(body, resp.headers["content-type"]);
        return;
    });
}

app.get("/logout", function(req, res) {
    req.session.destroy();
    res.redirect("/");
});

app.get("/login", function(req, res) {
    var code = req.query["code"];
    if (!code) {
        console.log("No code passed to login endpoint!");
        res.redirect("/");
    }
    else {
        oauth.authorizationCode.getToken({code: code, redirect_uri: ion_redirect_uri}, (error, result) => {
            if (error) {
                console.error("Ion OAuth Error: " + error);
                res.redirect("/");
                return;
            }

            const token = oauth.accessToken.create(result);
            req.session.refresh_token = token.token.refresh_token;
            req.session.access_token = token.token.access_token;
            req.session.expires_in = token.token.expires_in;
            apiRequest("/api/profile", "GET", token.token.access_token, function(body, type) {
                var info = JSON.parse(body);
                req.session.uid = info.id;
                req.session.username = info.ion_username;
                req.session.name = info.display_name;

                console.log("Auth successful! User: " + req.session.username);

                var token = tokenGenerator.createToken({ uid: ""+info.id, username: info.ion_username, sex: info.sex });

                req.session.firebase_token = token;
                res.redirect("/");
            });
        });
    }
});

app.get("/faq", function(req, res) {
    res.render("faq.html");
});

var port = process.env.PORT;

app.listen(port, function() {
    console.log("TJTinder listening on port " + port + "!");
});
