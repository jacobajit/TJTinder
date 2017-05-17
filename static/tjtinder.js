function loadMatch() {
    $(".card-panel").hide();
    $(".loading").show();
    $.get("/random", function(data) {
        $(".profile-name").text(data.full_name).attr("data-id", data.id);
        $(".profile-picture").off("load").on("load", function() {
            $(".loading").hide();
            $(".card-panel").show();
        }).attr("src", "/api/profile/" + data.id + "/picture");
    });
}

$(document).ready(function() {
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
