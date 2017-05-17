console.log("Current User ID: " + userid);

function createFirebase(path) {
    var fb = new Firebase(path);
    fb.authWithCustomToken(firebaseToken, function(err, data) {
        if (err) {
            console.error(err);
        }
    });
    return fb;
}

window.addEventListener('WebComponentsReady', function(e) {
    Polymer({
        is: 'app-main',

        properties: {
            id: {
                type: Number,
                notify: true

            },
            iddefined: {
                type: Boolean,
                value: false,
                notify: true
            },
            picturedefined: {
                type: Boolean,
                value: false,
                notify: true
            },
            profileurl: {
                type: String,
                notify: true
            },
            imgurl: {
                type: String,
                notify: true
            },
            imgObjectUrl: {
                type: String,
                notify: true
            },
            loginauth: {
                type: Object,
                notify: true
            },
            shownURL: {
                type: String,
                notify: true
            },
            readyForShownAjax: {
                type: Boolean,
                value: false,
                notify: true
            },
            readyForProf: {
                type: Boolean,
                value: false,
                notify: false
            }

        },

        attached: function() {
            var url = window.location.href;
            console.log(url);
            access_token = url.match(/([^=]*)$/)[1];
            console.log(access_token);


            var loginauthattr = {};
            loginauthattr["Authorization"] = "Bearer " + access_token;


            this.loginauth = {};
            this.loginauth["Authorization"] = "Bearer " + access_token;

            console.log(this.loginauth);

            this.readyForProf = true;
        },


        loadAppMatches: function(e) {
            //regUsers.add(yourid)



            var regUsers = createFirebase("https://tjtinder.firebaseio.com/regUsers");
            var updateObjRegUser = {};
            updateObjRegUser[this.yourJSON.id] = true;
            regUsers.update(updateObjRegUser);


            this.shownURL = "https://tjtinder.firebaseio.com/uid/" + this.yourJSON.id + "/shown.json";
            console.log(this.shownURL);
            this.readyForShownAjax = true;


            document.getElementById("matchdiv").innerHTML = "<app-matches id='" + this.yourJSON.id + "'></app-matches>";



        },
        handleImgResponse: function(e) {
            var urlCreator = window.URL || window.webkitURL;
            var imageUrl = urlCreator.createObjectURL(this.imgret);
            var image = document.createElement("img");
            image.src = imageUrl;

            this.imgObjectUrl = imageUrl;
            console.log(this.imgObjectUrl);
            // document.getElementById("imgdiv").appendChild(image);
            this.picturedefined = true;
            var spinners = event.target.parentElement.querySelectorAll('paper-spinner, paper-spinner-lite');
            Array.prototype.forEach.call(spinners, function(spinner) {
                spinner.active = !spinner.active;
            });
        },
        shownreceived: function(e) {//implement shown checking
            var yourid = this.yourJSON.id;
            var _this = this;
            if (this.shownJSON != null) {
                var shownKeys = Object.keys(this.shownJSON);
                console.log(shownKeys);
            }//if ends here for now
            else {
                console.log("No users shown");
            }

            var ref = createFirebase("https://tjtinder.firebaseio.com/uid/" + yourid);


            // Attach an asynchronous callback to read the data at our posts reference
            ref.once("value", function(snapshot) {

                console.log("Checking if regUsersShown<regUsers");
                // var alljson=snapshot.val();
                // if(Object.keys(alljson["uid"][yourid]["regUsersShown"])!==null)
                if (snapshot.hasChild("regUsersShown"))
                {
                    // var regUsersShown=Object.keys(alljson["uid"][yourid]["regUsersShown"]).length//number of registered users shown
                    var regUsersShown = snapshot.child("regUsersShown").numChildren();//number of registered users shown
                }
                else {
                    var regUsersShown = 0;
                }
                createFirebase("https://tjtinder.firebaseio.com/regUsers").once("value", function(s2) {
                    var regUsersTotal = s2.numChildren();//number of registered users

                    if ((regUsersShown) < regUsersTotal)
                    {
                        _this.pickIdFromRegUsers();

                    }
                    else {
                        _this.pickIdFromAll();
                    }
                    console.log("Shown count:");
                    console.log(regUsersShown);
                    console.log("Total count:");
                    console.log(regUsersTotal);
                }, function(errorObject) {
                    console.error("regUsers read failed: " + JSON.stringify(errorObject));
                });



            }, function(errorObject) {
                console.log("The read failed: " + JSON.stringify(errorObject));
            });
            //} used to end here


    },
    pickIdFromRegUsers: function(e) {
        console.log("picking from reg users");

        var _this = this;

        var ref = createFirebase("https://tjtinder.firebaseio.com/regUsers");
        // Attach an asynchronous callback to read the data at our posts reference
        ref.once("value", function(snapshot) {//CHANGING EVERY TIME IT CHANGES
            var alljson = snapshot.val();
            console.log("regUsers -> " + JSON.stringify(alljson));
            var regUsers = Object.keys(alljson);
            createFirebase("https://tjtinder.firebaseio.com/uid/" + _this.yourJSON.id).once("value", function(s2) {
                console.log("uid/" + _this.yourJSON.id + " -> " + JSON.stringify(s2.val()));
                if (s2.val() != null) {
                    var regUsersShown = Object.keys(s2.val()["regUsersShown"]);
                }
                else {
                    var regUsersShown = [];
                }
                console.log("Registed users:");
                console.log(regUsers);

                go = false;
                while (go == false) {
                    _this.id = regUsers[Math.floor(Math.random() * regUsers.length)];
                    k = regUsersShown.indexOf(_this.id);
                    if (k == -1) {
                        go = true;
                    }
                }

                _this.profileurl = "/api/profile/" + _this.id;
                _this.imgurl = "/api/profile/" + _this.id + "/picture";
                _this.iddefined = true;
                console.log("Selected id from regUsers:");
                console.log(_this.id);


                //add to registered users shown
                var regUsersShown = createFirebase("https://tjtinder.firebaseio.com/uid/" + _this.yourJSON.id + "/regUsersShown");


                var updateObjRegUser = {};
                updateObjRegUser[_this.id] = true;
                console.log("");
                console.log("Update INFO: ");
                console.log(updateObjRegUser);
                console.log("");
                regUsersShown.update(updateObjRegUser);


                //add to shown users
                updatedShown = {};
                updatedShown[_this.id] = true;
                createFirebase("https://tjtinder.firebaseio.com/uid/" + _this.yourJSON.id + "/shown").update(updatedShown);

            }, function(err) {
                console.log("regUsersShown failed: " + err);
            });
        }, function(errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
    },
    pickIdFromAll: function(e) {
        console.log("Picking from all all users");
        var yourGrade = this.yourJSON.grade.number;
        if (yourGrade == 12) {
            this.id = Math.floor(Math.random() * (32533 - 31957)) + 31957;
        }
        else if (yourGrade == 11) {
            this.id = Math.floor(Math.random() * (33018 - 32535)) + 32535;
        }
        else if (yourGrade == 10) {
            this.id = Math.floor(Math.random() * (33504 - 33018)) + 33018;
        }
        else if (yourGrade == 9) {
            this.id = Math.floor(Math.random() * (33974 - 33504)) + 33504;
        }
        else {
            this.id = Math.floor(Math.random() * (33503 - 31416)) + 31416;
        }
        this.profileurl = "/api/profile/" + this.id;
        this.imgurl = "/api/profile/" + this.id + "/picture";
        this.iddefined = true;



    },
    like: function(e) {
        console.log("Like function called");
        var you = this.yourJSON.id;
        var them = this.theirJSON.id;
        var yourname = this.yourJSON.display_name;
        var theirname = this.theirJSON.display_name;


        var yourLikesUrl = "uid/" + you + "/likes";
        var theirLikesUrl = "uid/" + them + "/likes";
        var yourMatchesUrl = "uid/" + you + "/matches";
        var theirMatchesUrl = "uid/" + them + "/matches";
        var ref = createFirebase("https://tjtinder.firebaseio.com/");
        var yourMatchesRef = ref.child(yourMatchesUrl);
        var theirMatchesRef = ref.child(theirMatchesUrl);
        var yourLikesRef = ref.child(yourLikesUrl);
        var theirLikesRef = ref.child(theirLikesUrl);
        theirLikesRef.once("value", function(snapshot) {

            console.log("You: " + you);
            console.log("They: " + them);

            var existInTheirLikes = snapshot.child(you).exists();
            console.log(existInTheirLikes);
            if (existInTheirLikes == true) {
                var updatedObjLike = {};
                updatedObjLike[them] = true;

                var updatedObjYourMatch = {};

                updatedObjYourMatch[theirname] = true;

                var updatedObjThemMatch = {};
                updatedObjThemMatch[yourname] = true;

                yourLikesRef.update(updatedObjLike);
                yourMatchesRef.update(updatedObjYourMatch);
                theirMatchesRef.update(updatedObjThemMatch);
                // console.log("You exist in their likes")
            }
            else {
                var updatedObj = {};
                updatedObj[them] = true;
                yourLikesRef.update(updatedObj);
                // console.log("You do not exist in their likes")
            }

        });



        //present new person
        var parent = document.getElementById("main");
        var child = document.getElementById("mainid");
        var main = document.createElement("app-main");
        main.setAttribute("loginauth", JSON.stringify(this.loginauth));
        main.setAttribute("id", "mainid");
        parent.replaceChild(main, child);
    },

    dislike: function(e) {
        //present new person
        var parent = document.getElementById("main");
        var child = document.getElementById("mainid");
        var main = document.createElement("app-main");
        main.setAttribute("loginauth", JSON.stringify(this.loginauth));
        main.setAttribute("id", "mainid");
        parent.replaceChild(main, child);
    }
});
});
