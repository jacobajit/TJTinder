var preload = [];
var preloadImages = [];

function preloadImage(src) {
    var img = new Image();
    img.src = src;
    while (preloadImages.length > 20) {
        preloadImages.shift();
    }
    preloadImages.push(img);
}

function doPreload(num) {
    if (preload.length >= num) {
        return;
    }
    $.get("/random", function(data) {
        if (!data.error) {
            preload.push(data);
            preloadImage("/api/profile/" + data.id + "/picture");
        }
        if (!data.detail) {
            doPreload(num);
        }
    }).fail(function() {
        Messenger().error("Failed to preload match!");
    });
}

function getMatch(callback) {
    if (preload.length) {
        callback(preload.shift());
    }
    else {
        $.get("/random", function(data) {
            callback(data);
        }).fail(function() {
            Messenger().error("Failed to load match!");
        });
    }
    doPreload(5);
}

function loadMatch() {
    $(".card-panel").hide();
    $(".loading").show();
    getMatch(function(data) {
        if (data.detail) {
            Messenger().error(data.detail);
            if (data.detail == "Authentication credentials were not provided.") {
                window.location.href = "/logout";
            }
            return;
        }
        if (data.error) {
            loadMatch();
            return;
        }
        $(".profile-name").text(data.full_name).attr("data-id", data.id);
        $(".profile-picture").off("load").on("load", function() {
            $(".loading").hide();
            $(".card-panel").css("display", "block");
        }).attr("src", "/api/profile/" + data.id + "/picture");
    });
}

$(document).ready(function() {
    $(".button-collapse").sideNav();
    loadMatch();

    $("#like").click(function(e) {
        e.preventDefault();
        $.post("/like", { id: $(".profile-name").attr("data-id") }, function(data) {
            if (data.info) {
                Messenger().success(data.info);
            }
            loadMatch();
        });
    });
    $("#dislike").click(function(e) {
        e.preventDefault();
        $.post("/dislike", { id: $(".profile-name").attr("data-id") }, function(data) {
            if (data.info) {
                Messenger().success(data.info);
            }
            loadMatch();
        });
    });
    $(".profile-picture").error(function() {
        Messenger().error("Failed to load user profile picture!");
    });
});
