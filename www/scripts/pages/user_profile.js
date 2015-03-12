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

var current_avatar_data_uri = null;
var start_avatar_data_uri = null;

//User Profile Page
var user_profile = $("#user-profile");
user_profile.on({
    pageinit: function () {
        $("#sign-out-btn").text("SIGN OUT");
        user_profile.on('click', '#sign-out-btn', function () {
            switch ($('#sign-out-btn').text()) {
                case "SIGN OUT":
                    var user = Kinvey.getActiveUser();
                    console.log("active user " + JSON.stringify(user));
                    if (null !== user) {
                        $.mobile.loading("show");
                        //Kinvey user logout starts
                        var promise = Kinvey.User.logout({});
                        promise.then(function (response) {
                            console.log("logout with success");
                            isNewLogin = true;
                            $.mobile.changePage(login, {transition: "slide"});
                        }, function (error) {
                            console.log("logout with error " + JSON.stringify(error));
                        }).then(loadingHide, loadingHide);
                    }
                    break;
                case "SAVE":
                    var user = Kinvey.getActiveUser();
                    user.mobile_number = $('#user-mobile-number').text();
                    user.first_name = $('#first-name').text();
                    user.last_name = $('#last-name').text();
                    if (current_avatar_data_uri != null) {
                        $.mobile.loading("show");
                        var array_buffer = _base64ToArrayBuffer(current_avatar_data_uri)

                        //Kinvey save avatar image file starts
                        var promise = Kinvey.File.upload(array_buffer, {
                            mimeType: 'image/jpeg',
                            size: current_avatar_data_uri.length
                        }, {
                            success: function (file) {
                                console.log("success " + JSON.stringify(file));
                                user.avatar = {
                                    _type: 'KinveyFile',
                                    _id: file._id
                                }
                                updateUserInfo(user);
                            },
                            error: function (error) {
                                console.log("error " + JSON.stringify(error));
                            }
                        }).then(loadingHide, loadingHide);
                    } else {
                        updateUserInfo(user);
                    }
                    break;
            }
        });

        user_profile.on('click', '#profile-back', function () {
            userProfileBack();
        });

        user_profile.on('click', '#profile-edit', function () {
            console.log("profile edit");
            $("#profile-edit").css("visibility", "hidden");
            $("#sign-out-btn").text("SAVE");
            $("#profile-email-div").css("display", "none");
            $("#profile-password-div").css("display", "none");
        });

        user_profile.on('click', '#first-name-div', function () {
            if ($('#sign-out-btn').text() === "SAVE") {
                navigator.notification.prompt("Name editing", function (results) {
                    if (results.input1 != null) {
                        $('#first-name').text(results.input1);
                    }
                }, "Input your name", ["Ok"], $('#first-name').text());

            }
        });

        user_profile.on('click', '#last-name-div', function () {
            if ($('#sign-out-btn').text() === "SAVE") {
                navigator.notification.prompt("Surname editing", function (results) {
                    if (results.input1 != null) {
                        $('#last-name').text(results.input1);
                    }
                }, "Input your surname", ["Ok"], $('#last-name').text());
            }
        });

        user_profile.on('click', '#profile-mobile-div', function () {
            if ($('#sign-out-btn').text() === "SAVE") {
                navigator.notification.prompt("Mobile number editing", function (results) {
                    if (results.input1 != null) {
                        $('#user-mobile-number').text(results.input1);
                    }
                }, "Input your number", ["Ok"], $('#user-mobile-number').text());
            }
        });

        user_profile.on('click', '#user-avatar', function () {
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

        user_profile.on('click', "#push-checkbox", function () {
            console.log("checkbox click");
            var status = $('#push-checkbox').prop('checked');
            if (status) {
                registerPushNotifications();
            } else {
                unregisterPushNotifications();
            }
        });

        user_profile.on('click', "#restaurant-checkbox", function () {
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
        active_user = Kinvey.getActiveUser();
        console.log("active user " + JSON.stringify(active_user));
        $("#first-name").text(active_user.first_name);
        $("#last-name").text(active_user.last_name);
        $("#user-email").text(active_user.email);
        $("#user-mobile-number").text(active_user.mobile_number);
        var user_avatar = document.getElementById('user-avatar');
        console.log("avatar id " + JSON.stringify(active_user.avatar));
        if (active_user.avatar) {
            //Kinvey stream user avatar starts
            var promise = Kinvey.File.stream(active_user.avatar._id);
            promise.then(function (response) {
                console.log("photo url " + JSON.stringify(response));
                var url = response._downloadURL;
                user_avatar.setAttribute('src', url);
                start_avatar_data_uri = url;
            });
        } else {
            user_avatar.src = "./images/default_avatar.png";
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
            console.log("user info update error " + JSON.stringify(error.description));
        }
    }).then(loadingHide, loadingHide);
}

//converts base64 to bytes
function _base64ToArrayBuffer(base64) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        var ascii = binary_string.charCodeAt(i);
        bytes[i] = ascii;
    }
    return bytes.buffer;
}

function getPhoto() {
    // Retrieve image file location from specified source
    navigator.camera.getPicture(function (dataURI) {
        setTimeout(function () {
            console.log("get photo success " + dataURI);
            var user_avatar = document.getElementById('user-avatar');
            user_avatar.src = "data:image/jpeg;base64," + dataURI;
            current_avatar_data_uri = dataURI;
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
            console.log("profile back");
            isBackPressed = true;
            current_avatar_data_uri = null;
            start_avatar_data_uri = null;
            $.mobile.back({transition: "slide"});
            break;
        case "SAVE":
            $("#profile-edit").css("visibility", "visible");
            $("#sign-out-btn").text("SIGN OUT");
            $("#profile-email-div").css("display", "block");
            $("#profile-password-div").css("display", "block");
            $("#first-name").text(active_user.first_name);
            $("#last-name").text(active_user.last_name);
            $("#user-email").text(active_user.email);
            $("#user-mobile-number").text(active_user.mobile_number);
            var user_avatar = document.getElementById('user-avatar');
            if (start_avatar_data_uri != null) {
                user_avatar.setAttribute('src', start_avatar_data_uri);
            } else {
                console.log("default");
                user_avatar.src = "./images/default_avatar.png";
            }
            break;
    }
}
