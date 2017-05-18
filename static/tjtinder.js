function loadMatch() {
    $(".card-panel").hide();
    $(".loading").show();
    $.get("/random", function(data) {
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
});
