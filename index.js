var express = require("express");
var request = require("request");
var session = require("express-session");
var simpleoauth2 = require("simple-oauth2");

var app = express();

// client type: confidential
// authorization grant type: authorization-code

var client_id = process.env.CLIENT_ID;
var client_secret = process.env.CLIENT_SECRET;

app.use(session({
    secret: client_secret,
    resave: false,
    saveUninitialized: true
}));

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

if (!client_id || !client_secret) {
    console.warning("No client ID or client secret set!");
}

app.get("/", function(req, res) {
    if (!req.session.access_token) {
        res.render("login.html", { login_url: login_url });
    }
    else {
        res.render("tjtinder.html");
    }
});

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
            console.log("Auth successful! Token: " + JSON.stringify(token));
            res.redirect("/");
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
