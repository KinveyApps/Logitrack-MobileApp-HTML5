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
var registrationPage = $('#registration');
registrationPage.on({
    pageinit: function () {
            registrationPage.on('click', '#register-label', function () {

                var username = $('#registration-username').val();
                var password = $('#registration-password').val();
                var email = $('#registration-email').val();
                var firstName = $('#registration-first-name').val();
                var lastName = $('#registration-last-name').val();
                var mobileNumber = $('#registration-mobile-number').val();

                if (isEmpty(username) || isEmpty(password) || isEmpty(email) || isEmpty(firstName) || isEmpty(lastName) || isEmpty(mobileNumber)) {
                    navigator.notification.alert("Please fill all fields", function () {
                    }, 'Invalid form', 'OK');
                } else {

                    //Kinvey user login starts
                    var promise = Kinvey.User.signup({
                        username: username,
                        password: password,
                        email: email,
                        first_name: firstName,
                        last_name: lastName,
                        mobile_number: mobileNumber,
                        status: "driver"
                    });
                    promise.then(function (response) {
                        map = null;
                        loadShipment();
                    }, function (error) {
                        if (navigator.onLine) {
                            navigator.notification.alert(error.description, function () {
                            }, 'Registration failed', 'OK');
                        } else {
                            navigator.notification.alert("Please check your internet collection", function () {
                            }, 'Registration failed', 'OK');
                        }
                    }).then(loadingHide, loadingHide);
                }
            });
        registrationPage.on('click', '#registration-back', function () {
            $.mobile.back({
                transition: "slide"
            });
        });
    },
    pagebeforeshow: function () {
        $("#registration-username").val("");
        $("#registration-password").val("");
        $('#registration-email').val("");
        $('#registration-first-name').val("");
        $('#registration-last-name').val("");
        $('#registration-mobile-number').val("");
    }
});

function isEmpty(str) {
    return (!str || 0 === str.length);
}