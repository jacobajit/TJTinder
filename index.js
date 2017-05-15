var express = require("express");
var app = express();

app.use(express.static("static"));

app.get("/", function(req, res) {
    res.sendfile("static/login.html");
});

app.listen(process.env.PORT, function() {
    console.log("TJTinder listening on port " + process.env.PORT + "!");
});
