var express = require("express");
var request = require("request");
var session = require("express-session");
var simpleoauth2 = require("simple-oauth2");
var firebase = require("firebase-admin");
var bodyParser = require("body-parser");

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

firebase.initializeApp({
    credential: firebase.credential.cert(JSON.parse(firebase_auth)),
    databaseURL: "https://tjtinder.firebaseio.com"
});

var db = firebase.database();
var user_list = [];

db.ref("/regUsers").once("value", function(data) {
    user_list = Object.keys(data.val());
});

app.use(express.static("static"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
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
        res.render("tjtinder.html", { userid: req.session.uid });
    }
});

function choose(choices) {
    var index = Math.floor(Math.random() * choices.length);
    return choices[index];
}

app.get("/random", function(req, res) {
    if (!req.session.access_token) {
        res.type("application/json");
        res.write(JSON.stringify({error: "Not Logged In"}));
        res.end();
        return;
    }
    db.ref("/uid/" + req.session.uid + "/shown").once("value", function(data) {
        var chosen = Object.keys(data.val());
        if (chosen.length >= user_list.length) {
            var id = Math.floor(Math.random() * (33503 - 31416)) + 31416;
        }
        else {
            var id = choose(user_list);
        }
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
});

app.post("/like", function(req, res) {
    doNext(req, res, true);
});

app.post("/dislike", function(req, res) {
    doNext(req, res, false);
});

function doNext(req, res, liked) {
    res.type("application/json");
    if (!req.session.access_token) {
        res.write(JSON.stringify({error: "Not Logged In"}));
        res.end();
        return;
    }
    if (!req.body.id) {
        res.write(JSON.stringify({error: "No ID Given"}));
        res.end();
        return;
    }

    if (/\D/.test(req.body.id)) {
        res.write(JSON.stringify({error: "Invalid ID!"}));
        res.end();
        return;
    }

    res.type("application/json");
    db.ref("/uid/" + req.session.uid + "/shown/" + req.body.id).set(true);

    if (liked) {
        db.ref("/uid/" + req.session.uid + "/likes/" + req.body.id).set(true);
        db.ref("/uid/" + req.body.id + "/otherLikes/" + req.session.uid).set(true);
        db.ref("/uid/" + req.body.id + "/likes/" + req.session.uid).once("value", function(data) {
            if (data.val()) {
                res.write(JSON.stringify({"success": true, "info": "This person has also liked you!"}));
                res.end();
            }
            else {
                res.write(JSON.stringify({"success": true}));
                res.end();
            }
        });
    }
    else {
        res.write(JSON.stringify({"success": true}));
        res.end();
    }
}

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

                db.ref("/regUsers/" + info.id).set({
                    "grade": info.graduation_year,
                    "sex": info.sex
                });

                console.log("Auth successful! User: " + req.session.username);

                res.redirect("/");
            });
        });
    }
});

app.get("/matches", function(req, res) {
    if (!req.session.access_token) {
        res.redirect("/");
    }
    else {
        db.ref("/uid/" + req.session.uid + "/likes").once("value", function(data) {
            db.ref("/uid/" + req.session.uid + "/otherLikes").once("value", function(d2) {
                res.render("matches.html", { userid: req.session.uid, likes: data.val(), otherLikes: d2.val() });
            });
        });
    }
});

app.get("/faq", function(req, res) {
    res.render("faq.html");
});

app.get("/terms", function(req, res) {
    res.render("terms-and-conditions.html");
});

var port = process.env.PORT;

app.listen(port, function() {
    console.log("TJTinder listening on port " + port + "!");
});
