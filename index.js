var express = require("express");
var app = express();

app.use(express.static("static"));
app.engine("html", require("ejs").renderFile);

var login_url = "https://ion.tjhsst.edu/oauth/authorize?client_id=ySHTIuQ6Hmn2oyJXY8nHtJTRU6unUdny00N3nZAL&response_type=token";

app.get("/", function(req, res) {
    res.render("login.html", { login_url: login_url });
});

app.get("/faq", function(req, res) {
    res.render("faq.html");
});

var port = process.env.PORT;

app.listen(port, function() {
    console.log("TJTinder listening on port " + port + "!");
});
