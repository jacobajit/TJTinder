var express = require("express");
var request = require("request");
var session = require("express-session");
var simpleoauth2 = require("simple-oauth2");
var firebase = require("firebase-admin");
var bodyParser = require("body-parser");
var redisStore = require("connect-redis")(session);

var release_date = new Date("May 21, 2017 21:00:00");

var app = express();

// client type: confidential
// authorization grant type: authorization-code

var client_id = process.env.CLIENT_ID;
var client_secret = process.env.CLIENT_SECRET;
var firebase_auth = process.env.FIREBASE_AUTH;
var firebase_secret = process.env.FIREBASE_SECRET;
var redis_url = process.env.REDISCLOUD_URL;

if (redis_url) {
    app.use(session({
        store: new redisStore({
            url: redis_url
        }),
        secret: client_secret,
        resave: false,
        saveUninitialized: true
    }));
}
else {
    app.use(session({
        secret: client_secret,
        resave: false,
        saveUninitialized: true
    }));
}

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

function selectUser(userData, prefs) {
    if (userData != null && userData.shown != null) {
        var chosen = Object.keys(userData.shown);
        var chosen_set = new Set(chosen);
        if (userData.otherLikes) {
            var otherLikes = Object.keys(userData.otherLikes);
            var not_other_liked = otherLikes.filter(x => !chosen_set.has(x));
            if (not_other_liked.length && Math.random() < 0.33) {
                return choose(not_other_liked);
            }
        }
        if (chosen.length >= user_list.length) {
            return Math.floor(Math.random() * (33503 - 31416)) + 31416;
        }
        else {
            var not_shown = user_list.filter(x => !chosen_set.has(x));
            return choose(user_list);
        }
    }
    else {
        return choose(user_list);
    }
}

app.get("/random", function(req, res) {
    if (!req.session.access_token) {
        res.type("application/json");
        res.write(JSON.stringify({error: "Not Logged In"}));
        res.end();
        return;
    }
    db.ref("/regUsers/" + req.session.uid).once("value", function(d2) {
        db.ref("/uid/" + req.session.uid).once("value", function(data) {
            var id = selectUser(data.val(), d2.val());
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
                res.write(JSON.stringify({"success": true}));
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

app.get("/stats", function(req, res) {
    res.type("application/json");
    if (!req.session.access_token) {
        res.write(JSON.stringify({error: "Not Logged In"}));
        res.end();
        return;
    }

    db.ref("/admin/" + req.session.uid).once("value", function(data) {
        if (data.val()) {
            getPercentMatches(function(val) {
                res.write(JSON.stringify(val, null, "\t"));
                res.end();
            });
        }
        else {
            res.write(JSON.stringify({error: "Permission Denied"}));
            res.end();
        }
    });
});

app.get("/fix", function(req, res) {
    res.type("application/json");
    if (!req.session.access_token) {
        res.write(JSON.stringify({error: "Not Logged In"}));
        res.end();
        return;
    }

    db.ref("/admin/" + req.session.uid).once("value", function(d2) {
        if (d2.val()) {
            db.ref("/uid").once("value", function(data) {
                var users = data.val();
                var count = 0;
                var other_count = 0;
                for (var user in users) {
                    if (users[user].likes) {
                        var likes = Object.keys(users[user].likes);
                        for (var id in likes) {
                            var like = likes[id];
                            if (!users[like] || !users[like].otherLikes || !(user in users[like].otherLikes)) {
                                db.ref("/uid/" + like + "/otherLikes/" + user).set(true);
                                count++;
                            }
                        }
                    }
                    if (users[user].otherLikes) {
                        var otherLikes = Object.keys(users[user].otherLikes);
                        for (var id in otherLikes) {
                            var otherLike = otherLikes[id];
                            if (!users[otherLike] || !users[otherLike].likes || !(user in users[otherLike].likes)) {
                                db.ref("/uid/" + user + "/otherLikes").child(otherLike).remove();
                                other_count++;
                            }
                        }
                    }
                }
                res.write(JSON.stringify({"fixed_add": count, "fixed_remove": other_count}));
                res.end();
            });
        }
        else {
            res.write(JSON.stringify({error: "Access Denied"}));
            res.end();
        }
    });
});

function getPercentMatches(callback) {
    db.ref("/").once("value", function(data) {
        var users = data.val().uid;
        var matches = 0;
        var total_likes = 0;
        var total_other_likes = 0;
        for (var user in users) {
            var flag = false;
            if (!users[user].likes && !users[user].otherLikes) {
                continue;
            }
            if (users[user].likes) {
                var likes = Object.keys(users[user].likes);
                total_likes += likes.length;
            }
            if (users[user].otherLikes) {
                var otherLikes = Object.keys(users[user].otherLikes);
                total_other_likes += otherLikes.length;
            }
            if (users[user].likes && users[user].otherLikes) {
                var otherSet = new Set(otherLikes);
                for (var item in likes) {
                    if (otherSet.has(likes[item])) {
                        flag = true;
                        break;
                    }
                }
                if (flag) {
                    matches++;
                }
            }
        }
        var total = Object.keys(users).length;
        var registered = Object.keys(data.val().regUsers).length;
        callback({
            "matches": matches,
            "likes": total_likes,
            "other_likes": total_other_likes,
            "total": total,
            "registered": registered,
            "match_percentage": matches/registered*100
        });
    });
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
                    "name": info.display_name,
                    "username": info.ion_username,
                    "grade": info.graduation_year,
                    "sex": info.sex,
                    "preferred_sex": info.sex == "M" ? "F" : "M",
                    "preferred_grade": info.graduation_year
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
        db.ref("/admin/" + req.session.uid).once("value", function(d3) {
            db.ref("/uid/" + req.session.uid + "/likes").once("value", function(data) {
                db.ref("/uid/" + req.session.uid + "/otherLikes").once("value", function(d2) {
                    res.render("matches.html", {
                        userid: req.session.uid,
                        likes: data.val(),
                        otherLikes: d2.val(),
                        is_admin: !!d3.val(),
                        past_release_date: new Date() > release_date
                    });
                });
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
