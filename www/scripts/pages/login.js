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

// Login Page
var login = $('#login');
login.on({
    pageinit: function () {
        login.on('click', '#login-label', function () {

            //Kinvey user login starts
            var promise = Kinvey.User.login({
                username: $('#username-input').val(),
                password: $('#password-input').val()
            });
            promise.then(function (response) {
                if (response.status === "driver") {
                    map = null;
                    loadShipment();
                } else {
                    alert("You don't have required permissions");

                    //Kinvey user logout starts
                    var promise = Kinvey.User.logout({
                    });
                    promise.then(function (response) {
                        console.log("logout with success");
                    }, function (error) {
                        console.log("logout with error " + JSON.stringify(error));
                    });
                }
            }, function (error) {
                console.log("login error " + JSON.stringify(error));
                alert(error.description);
            }).then(loadingHide, loadingHide);
        });
    },
    pagebeforeshow: function () {
        $("#username-input").val("");
        $("#password-input").val("");
    }
});