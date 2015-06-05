/**
 * Copyright 2013 Kinvey, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var currentAvatarDataUri = null;
var startAvatarDataUri = null;

//User Profile Page
var userProfilePage = $("#user-profile");
userProfilePage.on({
    pageinit: function () {
        $("#sign-out-btn").text("SIGN OUT");
        userProfilePage.on('click', '#sign-out-btn', function () {
            var user = Kinvey.getActiveUser();
            switch ($('#sign-out-btn').text()) {
                case "SIGN OUT":
                    if (null !== user) {
                        $.mobile.loading("show");
                        //Kinvey user logout starts
                        var promise = Kinvey.User.logout({});
                        promise.then(function (response) {
                            Kinvey.Sync.destruct();
                            isNewLogin = true;
                            $.mobile.changePage(loginPage, {transition: "slide"});
                        }, function (error) {
                            navigator.notification.alert(error.description, function () {
                            }, 'Logout failed', 'OK');
                        }).then(loadingHide, loadingHide);
                    }
                    break;
                case "SAVE":
                    user.mobile_number = $('#user-mobile-number').text();
                    user.first_name = $('#first-name').text();
                    user.last_name = $('#last-name').text();
                    if (currentAvatarDataUri != null) {
                        $.mobile.loading("show");
                        var arrayBuffer = _base64ToArrayBuffer(currentAvatarDataUri)

                        //Kinvey save avatar image file starts
                        var promise = Kinvey.File.upload(arrayBuffer, {
                            mimeType: 'image/jpeg',
                            size: currentAvatarDataUri.length
                        }, {
                            success: function (file) {
                                user.avatar = {
                                    _type: 'KinveyFile',
                                    _id: file._id
                                };
                                updateUserInfo(user);
                            },
                            error: function (error) {
                                navigator.notification.alert(error.description, function () {
                                }, 'Upload avatar failed', 'OK');
                            }
                        }).then(loadingHide, loadingHide);
                    } else {
                        updateUserInfo(user);
                    }
                    break;
            }
        });

        userProfilePage.on('click', '#profile-back', function () {
            userProfileBack();
        });

        userProfilePage.on('click', '#profile-edit', function () {
            console.log("profile edit");
            $("#profile-edit").css("visibility", "hidden");
            $("#sign-out-btn").text("SAVE");
            $("#profile-email-div").css("display", "none");
            $("#profile-password-div").css("display", "none");
        });

        userProfilePage.on('click', '#first-name-div', function () {
            if ($('#sign-out-btn').text() === "SAVE") {
                navigator.notification.prompt("Name editing", function (results) {
                    if (results.input1 != null) {
                        $('#first-name').text(results.input1);
                    }
                }, "Input your name", ["Ok"], $('#first-name').text());

            }
        });

        userProfilePage.on('click', '#last-name-div', function () {
            if ($('#sign-out-btn').text() === "SAVE") {
                navigator.notification.prompt("Surname editing", function (results) {
                    if (results.input1 != null) {
                        $('#last-name').text(results.input1);
                    }
                }, "Input your surname", ["Ok"], $('#last-name').text());
            }
        });

        userProfilePage.on('click', '#profile-mobile-div', function () {
            if ($('#sign-out-btn').text() === "SAVE") {
                navigator.notification.prompt("Mobile number editing", function (results) {
                    if (results.input1 != null) {
                        $('#user-mobile-number').text(results.input1);
                    }
                }, "Input your number", ["Ok"], $('#user-mobile-number').text());
            }
        });

        userProfilePage.on('click', '#user-avatar', function () {
            if ($('#sign-out-btn').text() === "SAVE") {
                console.log("User avatar clicked");
                getPhoto();
            }
        });

        if (getPushStatus() == 'enabled') {
            $('#push-checkbox').attr('checked', true);
        } else {
            $('#push-checkbox').attr('checked', false);
        }

        if (getRestaurantMarkerStatus() == 'enabled') {
            $('#restaurant-checkbox').attr('checked', true);
        } else {
            $('#restaurant-checkbox').attr('checked', false);
        }

        userProfilePage.on('click', "#push-checkbox", function () {
            console.log("checkbox click");
            var status = $('#push-checkbox').prop('checked');
            if (status) {
                registerPushNotifications();
            } else {
                unregisterPushNotifications();
            }
        });

        userProfilePage.on('click', "#restaurant-checkbox", function () {
            var status = $('#restaurant-checkbox').prop('checked');
            if (status) {
                saveRestaurantMarkerStatus("enabled");
                google.maps.event.addListener(map, 'idle', mapIdleListener);
                google.maps.event.addListener(map, 'zoom_changed', mapZoomListener);
                mapIdleListener();

            } else {
                saveRestaurantMarkerStatus("disabled");
                hideRestaurantMarkers();
                google.maps.event.clearListeners(map, 'idle');
                google.maps.event.clearListeners(map, 'zoom_change');
            }
        });
    },
    pagebeforeshow: function () {
        activeUser = Kinvey.getActiveUser();
        $("#first-name").text(activeUser.first_name ? activeUser.first_name : "");
        $("#last-name").text(activeUser.last_name ? activeUser.last_name : "");
        $("#user-mobile-number").text(activeUser.mobile_number ? activeUser.mobile_number : "");
        $("#user-email").text(activeUser.email ? activeUser.email: "");
        var userAvatar = document.getElementById('user-avatar');
        if (activeUser.avatar) {
            //Kinvey stream user avatar starts
            var promise = Kinvey.File.stream(activeUser.avatar._id);
            promise.then(function (response) {
                var url = response._downloadURL;
                userAvatar.setAttribute('src', url);
                startAvatarDataUri = url;
            });
        } else {
            userAvatar.src = "./images/default_avatar.png";
        }

    }
});

function updateUserInfo(user) {
    $.mobile.loading("show");
    //Kinvey update user info starts
    var promise = Kinvey.User.update(user, {
        success: function () {
            $("#profile-edit").css("visibility", "visible");
            $("#sign-out-btn").text("SIGN OUT");
            $("#profile-email-div").css("display", "block");
            $("#profile-password-div").css("display", "block");
        },
        error: function (error) {
            if(navigator.onLine){
                navigator.notification.alert(error.description, function () {
                }, 'Update user failed', 'OK');
            }else {
                navigator.notification.alert("Please check your internet collection", function () {
                }, 'Update user failed', 'OK');
            }
        }
    }).then(loadingHide, loadingHide);
}

//converts base64 to bytes
function _base64ToArrayBuffer(base64) {
    var binaryString = window.atob(base64);
    var len = binaryString.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        var ascii = binaryString.charCodeAt(i);
        bytes[i] = ascii;
    }
    return bytes.buffer;
}

function getPhoto() {
    // Retrieve image file location from specified source
    navigator.camera.getPicture(function (dataURI) {
        setTimeout(function () {
            var userAvatar = document.getElementById('user-avatar');
            userAvatar.src = "data:image/jpeg;base64," + dataURI;
            currentAvatarDataUri = dataURI;
        }, 0);

    }, function (message) {
        setTimeout(function () {
            console.log("get photo error " + JSON.stringify(message));
        }, 0);
    }, { quality: 50,
        destinationType: navigator.camera.DestinationType.DATA_URL,
        sourceType: navigator.camera.PictureSourceType.PHOTOLIBRARY});
}

// back user profile listener
function userProfileBack() {
    switch ($('#sign-out-btn').text()) {
        case "SIGN OUT":
            isBackPressed = true;
            currentAvatarDataUri = null;
            startAvatarDataUri = null;
            $.mobile.back({transition: "slide"});
            break;
        case "SAVE":
            $("#profile-edit").css("visibility", "visible");
            $("#sign-out-btn").text("SIGN OUT");
            $("#profile-email-div").css("display", "block");
            $("#profile-password-div").css("display", "block");
            $("#first-name").text(activeUser.first_name);
            $("#last-name").text(activeUser.last_name);
            $("#user-email").text(activeUser.email);
            $("#user-mobile-number").text(activeUser.mobile_number);
            var userAvatar = document.getElementById('user-avatar');
            if (startAvatarDataUri != null) {
                userAvatar.setAttribute('src', startAvatarDataUri);
            } else {
                console.log("default");
                userAvatar.src = "./images/default_avatar.png";
            }
            break;
    }
}
