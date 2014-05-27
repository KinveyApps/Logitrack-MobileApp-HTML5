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
/* global $: true, Kinvey: true */
function onDeviceReady() {


    (function () {
        'use strict';
        var active_user;
        // Setup.
        // ------
        var loadingHide = function () {
            $.mobile.loading("hide");
        }
        var current_page = 1;
        var pickup_route_page = 1;
        var travel_page = 2;
        var delivery_details_begin_tracking_page = 3;
        var delivery_details_confirm_delivery_page = 4;
        var login_page = 5;
        var signature_page = 6;
        var user_profile_page = 7;
        var locationWatchId = null;
        var currentShipment = null;
        var shipments = null;
        var start_markers = [];
        var finish_markers = [];
        var addresses = [];
        var selectedMarkerIndex = 0;
        var lastUserPosition = null;
        var map;
        var directionsDisplay;
        var directionsService = new google.maps.DirectionsService();
        var user_marker;
        var my_timer;
        var last_time = [0, 0, 0];
        var geocoder = new google.maps.Geocoder();
        var bounds = new google.maps.LatLngBounds();
        var isStartMarkerSelected = false;
        var isConfirmDeliveryPage = false;
        var isDeliveryComplitedClicked = false;
        var isBackPressed = false;
        var isConfirmBoxOpen = false;
        var infobox;
        var confirm_infobox;
        var current_avatar_data_uri = null;
        var start_avatar_data_uri = null;
        var isFirstStart = true;
        var current_direction_route = null;
        createInfoboxes();

        //shipment saving function
        function saveShipment(shipment, cb) {

            $.mobile.loading("show");
            Kinvey.DataStore.save('shipment',
                shipment, {
                    relations: {
                        'checkins': 'shipment-checkins',
                        'route': 'route'
                    },
                    success: function (response) {
                        cb(response);
                    },
                    error: function (error) {
                        console.log("sava shipment error " + JSON.stringify(error));
                    }
                }).then(loadingHide, loadingHide);
        }

        // Initialize Kinvey.
        var promise = Kinvey.init({
            appKey: 'kid_VTpS9qbe7q',
            appSecret: '5ae17c3bd8414d7f917c59a1c14a8fcd',
            sync: {
                enable: true,
                online: navigator.onLine
            }
        });
        promise.then(function (activeUser) {
            active_user = activeUser;

        }).then(function () {
            $.mobile.initializePage();
        }, function () {
            alert('cant connect to server');
        });

        // On/offline hooks.
        $(window).on({
            offline: Kinvey.Sync.offline,
            online: function () {
                // Some browsers fire the online event before the connection is available
                // again, so set a timeout here.
                setTimeout(function () {
                    Kinvey.Sync.online();
                }, 10000);
            }
        });

        //Load route
        function loadShipment() {
            $.mobile.loading("show");
            //TODO modify query
            var query = new Kinvey.Query();
            //            query.notEqualTo('user_status', 'done');
            query.exists('route');
            Kinvey.DataStore.find('shipment', query, {
                relations: {
                    'checkins': 'shipment-checkins',
                    'route': 'route'
                },
                success: function (data) {
                    if (data.length == 0) {
                        alert("No route found");
                    } else {
                        console.log("success shipment " + JSON.stringify(data));

                        shipments = data;
                        currentShipment = data[0];
                        if (isDeliveryComplitedClicked) {
                            clearMarkers();
                            finish_markers = [];
                            start_markers = [];
                            addresses = [];
                            selectedMarkerIndex = 0;
                            isStartMarkerSelected = false;
                            isDeliveryComplitedClicked = false;
                            addAllStartMarkers(map);
                            map.setCenter(user_marker.getPosition());
                        }
                        current_page = pickup_route_page;
                        console.log("changePage pickup 1");
                        $.mobile.changePage(pickup);
                    }

                }
            }).then(loadingHide, loadingHide);
        }

        var splash = $('#splash');
        splash.on({
            pageinit: function () {
                if (null !== active_user) {
                    loadShipment();
                } else {
                    console.log("changePage login");
                    current_page = login_page;
                    $.mobile.changePage(login);
                }
            }
        });

        var signature = $('#signature');
        signature.on({
            pageinit: function () {
                signature.on('click', '#signature-back', function () {
                    $.mobile.back({
                        transition: "slide"
                    });
                });
            }
        });

        // Login.
        // -----
        var login = $('#login');
        login.on({
            pageinit: function () {
                login.on('click', '#login-label', function () {
                    console.log("user creds : " + $('#username-input').val() + "   " + $('#password-input').val());
                    $.mobile.loading("show");
                    var promise = Kinvey.User.login({
                        username: $('#username-input').val(),
                        password: $('#password-input').val()
                    });

                    promise.then(function (response) {
                        map = null;
                        finish_markers = [];
                        start_markers = [];
                        addresses = [];
                        selectedMarkerIndex = 0;
                        isStartMarkerSelected = false;
                        isDeliveryComplitedClicked = false;
                        loadShipment();
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


        function myTimer() {
            last_time[2]++;
            if (last_time[2] == 59) {
                last_time[2] = 0;
                last_time[1]++;
                if (last_time[1] == 59) {
                    last_time[1] = 0;
                    last_time[0]++;
                }
            }
            var h = last_time[0];
            var m = last_time[1];
            var s = last_time[2];
            if (h < 10) h = "0" + h;
            if (m < 10) m = "0" + m;
            if (s < 10) s = "0" + s;
            $("#timer").text(h + ':' + m + ':' + s);
        }

        function calcRoute() {
            console.log("calc route");
            var request = {
                origin: new google.maps.LatLng(start_markers[selectedMarkerIndex].getPosition().k, start_markers[selectedMarkerIndex].getPosition().A),
                destination: new google.maps.LatLng(finish_markers[selectedMarkerIndex].getPosition().k, finish_markers[selectedMarkerIndex].getPosition().A),
                // Note that Javascript allows us to access the constant
                // using square brackets and a string value as its
                // "property."
                travelMode: google.maps.DirectionsTravelMode.DRIVING
            };
            directionsService.route(request, function (response, status) {
                if (status == google.maps.DirectionsStatus.OK) {
                    current_direction_route = response;
                    directionsDisplay.setDirections(response);
                    directionsDisplay.setMap(map);
                }
            });
        }

        function createInfoboxes() {
            confirm_infobox = new InfoBox({
                content: document.getElementById("confirm-infobox"),
                maxWidth: 200,
                pane: "floatPane",
                disableAutoPan: false,

                pixelOffset: new google.maps.Size(-100, -85),
                zIndex: null,
                boxStyle: {
                    background: "url('http://google-maps-utility-library-v3.googlecode.com/svn/trunk/infobox/examples/tipbox.gif') no-repeat",
                    width: "200px"
                },
                closeBoxURL: "",
                infoBoxClearance: new google.maps.Size(1, 1)
            });
            google.maps.event.addListener(confirm_infobox, 'domready', function (e) {
                $("#confirm-infobox-arrow-btn").on("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("changePage delivery details 3");
                    current_page = delivery_details_confirm_delivery_page;
                    $.mobile.changePage(delivery_details, {
                        transition: "slide"
                    });
                });
                google.maps.event.clearListeners(confirm_infobox, 'domready');
            });

            infobox = new InfoBox({
                content: document.getElementById("infobox"),
                pane: "floatPane",
                disableAutoPan: false,
                maxWidth: 150,
                pixelOffset: new google.maps.Size(-70, -85),
                zIndex: null,
                boxStyle: {
                    background: "url('http://google-maps-utility-library-v3.googlecode.com/svn/trunk/infobox/examples/tipbox.gif') no-repeat",
                    width: "140px"
                },
                closeBoxURL: "",
                infoBoxClearance: new google.maps.Size(1, 1)
            });
            google.maps.event.addListener(infobox, 'domready', function (e) {
                $("#infobox-arrow-btn").on("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("changePage delivery details 2");
                    current_page = delivery_details_begin_tracking_page;
                    $.mobile.changePage(delivery_details, {
                        transition: "slide"
                    });
                });
                google.maps.event.clearListeners(infobox, 'domready');
            });
        }

        function beginTrackingPagePreload() {
            console.log("begin tracking preload");
            last_time = [0, 0, 0];
            my_timer = setInterval(function () {
                myTimer()
            }, 1000);
            $('#tracking-state').css('visibility', "visible");
            $('#timer').css('visibility', "visible");
            $('#green-circle-left').css('visibility', "hidden");
            $('#green-circle-central').css('visibility', "visible");
            $('#pause-btn').css('visibility', "visible");
            if (infobox) {
                infobox.close();
                infobox.setMap(null);
            }
            isStartMarkerSelected = true;
            $("#step-name-label").text("Travel to Delivery Location");
            $("#step-number-label").text("Step 2");
            currentShipment.user_status = "in progress";
            saveShipment(currentShipment, function () {
            });
            calcRoute();
        };

        function pickupRoutePagePreload() {
            console.log("pickup route pleload");
            $("#step-name-label").text("Tap to Browse Different Pickups");
            $("#step-number-label").text("Waiting for Delivery");
            $("#next-label").css("visibility", "hidden");
            console.log("show markers in preload");
            showMarkers();
            isStartMarkerSelected = false;
            if (!isConfirmDeliveryPage) {
                if (infobox) {
                    infobox.close();
                    infobox.setMap(null);
                }
            }
            isConfirmDeliveryPage = false;

        };

        function startTrackingUserPosition() {
            if (locationWatchId) {
                navigator.geolocation.clearWatch(locationWatchId);
            }
            locationWatchId = navigator.geolocation.watchPosition(function (position) {
                lastUserPosition = position;
                console.log("last user positon " + JSON.stringify(position));
                if (user_marker) {
                    user_marker.setPosition(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
                } else {
                    user_marker = new google.maps.Marker({
                        position: new google.maps.LatLng(position.coords.latitude, position.coords.longitude),
                        map: map,
                        icon: 'images/user_marker.png'
                    });
                }
//                if (route.followUser) {
//                    $('#map_canvas').gmap('option', {
//                        'center': new google.maps.LatLng(position.coords.latitude, position.coords.longitude)
//                    });
//                }
            }, function (error) {
                console.log('code: ' + error.code + '\n' +
                    'message: ' + error.message + '\n');
            }, {
                timeout: 30000,
                frequency: 5000
            });

        }

        function stopTrackingUserPosition() {
            if (locationWatchId) {
                navigator.geolocation.clearWatch(locationWatchId);
            }
        }

        var onSuccessGetUserPosition = function (position) {
            console.log("success");
            var user = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
            bounds.extend(user);
            var mapOptions = {
                center: user,
                zoom: 15,
                disableDefaultUI: true
            };
            map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);
            directionsDisplay = new google.maps.DirectionsRenderer();
            directionsDisplay.setMap(map);
            directionsDisplay.setOptions({
                suppressMarkers: true
            });
            user_marker = new google.maps.Marker({
                position: user,
                map: map,
                icon: 'images/user_marker.png'
            });
            addAllStartMarkers(map);
            $('#map_canvas').gmap('refresh');

        };

        // onError Callback receives a PositionError object
        //
        function onErrorGetUserPosition(error) {
            console.log("on error getUser position " + error.message);
        }

        document.addEventListener("backbutton", onBackKeyDown, false);

        function onBackKeyDown() {
            switch (current_page) {
                case travel_page:
                    rejectRoute();
                    isBackPressed = true;
                    break;
                case pickup_route_page:
                    if ($('#alertcontainer').css('display') == 'block') {
                        $('#alertcontainer').css('display', "none");
                        if ($("#messagefg").css("display") == "block") {
                            $("#messagefg").css("display", "none");
                        } else {
                            $("#message-confirm").css("display", "none");
                            showMarkers();
                            isStartMarkerSelected = false;
                        }
                    } else {
                        navigator.app.exitApp();
                    }
                    break;
                case login_page:
                    navigator.app.exitApp();
                    break;
                case delivery_details_begin_tracking_page:
                    $.mobile.back({
                        transition: "slide"
                    });
                    isBackPressed = true;
                    break;
                case delivery_details_confirm_delivery_page:
                    $.mobile.back({
                        transition: "slide"
                    });
                    isBackPressed = true;
                    break;
                case signature_page:
                    $.mobile.back({
                        transition: "slide"
                    });
                    break;
                case user_profile_page:
                    userProfileBack();
                    break;
            }
        }

        function addAllStartMarkers(map) {
            console.log("add all markers" + map);
            var start_marker;
            var finish_marker;
            var route_addresses;
            var k = 0;
            for (var i in shipments) {
                console.log("ship " + i);
                if (!!shipments[i].route) {
                    console.log("shipments " + JSON.stringify(shipments[i].route));
                    route_addresses = {
                        start: shipments[i].route.start,
                        finish: shipments[i].route.finish
                    };
                    addresses.push(route_addresses);
                    !function outer(ii) {
                        geocoder.geocode({
                            'address': shipments[ii].route.start
                        }, function (results, status) {
                            if (status == google.maps.GeocoderStatus.OK) {
                                var start_marker = new google.maps.Marker({
                                    position: new google.maps.LatLng(results[0].geometry.location.k, results[0].geometry.location.A),
                                    map: map,
                                    icon: 'images/start_marker.png'
                                });
                                console.log("push start marker " + ii);
                                start_markers[ii] = start_marker;
                                google.maps.event.addListener(start_marker, 'click', function () {
                                    if (!isStartMarkerSelected) {
                                        $("#alertcontainer").css("display", "block");
                                        $("#message-confirm").css("display", "block");
                                        $("#step-number-label").text("Step 1");
                                        $("#step-name-label").text("Pickup");
                                        selectedMarkerIndex = start_markers.indexOf(this);
                                        currentShipment = shipments[selectedMarkerIndex];
                                        setConfirmAddressText();
                                        hideMarkers(map);
                                        isStartMarkerSelected = true;
                                    }
                                });
                                if (ii == 0 && isFirstStart) {
                                    $("#alertcontainer").css("display", "block");
                                    $("#messagefg").css("display", "block");
                                    setPushNotifiAddressText();
                                    isFirstStart = false;
                                }
                                showMarkers();
                            } else {
                                console.log("Geocode was not successful for the following reason: " + status);
                            }
                        });

                        geocoder.geocode({
                            'address': shipments[ii].route.finish
                        }, function (results, status) {
                            if (status == google.maps.GeocoderStatus.OK) {
                                finish_marker = new google.maps.Marker({
                                    position: new google.maps.LatLng(results[0].geometry.location.k, results[0].geometry.location.A),
                                    map: map,
                                    icon: 'images/finish_marker.png'
                                });
                                finish_marker.setMap(null);
                                finish_markers[ii] = finish_marker;
                                console.log("push finish marker " + ii);
                            } else {
                                console.log("Geocode was not successful for the following reason: " + status);
                            }
                        });
                    }(k);
                    k++;
                }
            }
        }


        var pickup = $('#pickup-route');
        pickup.on({
            pagebeforeshow: function (event, data) {
                console.log("page before show pickup");
                switch (current_page) {
                    case pickup_route_page:
                        pickupRoutePagePreload();
                        break;
                    case travel_page:
                        beginTrackingPagePreload();
                        startTrackingUserPosition();
                        break;
                }
                if (isBackPressed) {
                    switch (current_page) {
                        case delivery_details_begin_tracking_page:
                            current_page = pickup_route_page;
                            break;
                        case delivery_details_confirm_delivery_page:
                            current_page = travel_page;
                            break;
                        case user_profile_page:
                            if ($("#step-number-label").text() == "Step 2" || $("#step-number-label").text() == "Step 3") {
                                current_page = travel_page;
                            } else {
                                current_page = pickup_route_page;
                            }
                            break;
                    }
                    isBackPressed = false;
                }
            },
            pageinit: function () {
                console.log("pickup page init");
                current_page = pickup_route_page;
                $('#green-circle-left').css('visibility', "visible");
                $('#map_canvas').gmap({
                    'zoom': 10,
                    'disableDefaultUI': true,
                    'callback': function () {
                    }
                });

                pickup.on('click', '#pause-btn', function () {
                    clearInterval(my_timer);
                    stopTrackingUserPosition();
                    $("#tracking-state").text("PAUSED");
                    $("#tracking-state").css("color", "red");
                    $("#play-btn").css("visibility", "visible");
                    $("#pause-btn").css("visibility", "hidden");
                    $("#green-circle-central").css("background", "red");
                    currentShipment.user_status = "paused";
                    saveShipment(currentShipment, function () {
                    });

                });

                pickup.on('click', "#menu-btn", function () {
                    current_page = user_profile_page;
                    console.log("click user profile");
                    $.mobile.changePage(user_profile, {transition: "slide"});
                });

                pickup.on('click', '#play-btn', function () {
                    stopTrackingUserPosition();
                    my_timer = setInterval(function () {
                        myTimer()
                    }, 1000);
                    $("#tracking-state").text("TRACKING ON");
                    $("#tracking-state").css("color", "rgb(65,226,65)");
                    $("#pause-btn").css("visibility", "visible");
                    $("#play-btn").css("visibility", "hidden");
                    $("#green-circle-central").css("background", "rgba(69,191,69,0.8)");
                    currentShipment.user_status = "in progress";
                    saveShipment(currentShipment, function () {
                    });
                });
                pickup.on('click', '#next-btn', function () {
                    console.log("click next button " + current_page);
                    if (isStartMarkerSelected) {
                        switch (current_page) {
                            case travel_page:
                                if (isConfirmBoxOpen) {
                                    console.log("changePage delivery details 3");
                                    current_page = delivery_details_confirm_delivery_page;
                                    $.mobile.changePage(delivery_details, {
                                        transition: "slide"
                                    });
                                } else {
                                    console.log("stop tracking start confirming");
                                    stopTrackingStartConfiming();
                                }
                                break;
                            case pickup_route_page:
                                console.log("changePage delivery details 1");
                                current_page = delivery_details_begin_tracking_page;
                                $.mobile.changePage(delivery_details, {
                                    transition: "slide"
                                });
                                break;
                        }
                    }
                });
                pickup.on('click', '#dismiss-btn', function () {
                    $("#alertcontainer").css("display", "none");
                    $("#messagefg").css("display", "none");
                });
                pickup.on('click', '#view-btn', function () {
                    $("#messagefg").css("display", "none");
                    $("#message-confirm").css("display", "block");
                    $("#step-number-label").text("Step 1");
                    $("#step-name-label").text("Pickup");
                    selectedMarkerIndex = 0;
                    currentShipment = shipments[0];
                    setConfirmAddressText();
                    hideMarkers(map);
                    isStartMarkerSelected = true;
                });
                pickup.on('click', '#cancel-btn', function () {
                    $("#alertcontainer").css("display", "none");
                    $("#message-confirm").css("display", "none");
                    showMarkers();
                    isStartMarkerSelected = false;
                });
                pickup.on('click', '#confirm-btn', function () {
                    $("#alertcontainer").css("display", "none");
                    $("#message-confirm").css("display", "none");
                    $("#step-name-label").text("En Route to Pickup");
                    $("#next-label").css("visibility", "visible");
                    google.maps.event.clearListeners($("#infobox-arrow-btn"), 'click');
                    infobox.open(map, start_markers[selectedMarkerIndex]);
                });
                pickup.on("click", "#circle-central", function () {
                    if ($("#green-circle-right").css("visibility") == "visible") {
                        stopConfirmingStartTracking();
                    }
                    if ($("#green-circle-left").css("visibility") == "visible") {
                        if (isStartMarkerSelected) {
                            current_page = delivery_details_begin_tracking_page;
                            $.mobile.changePage(delivery_details, {
                                transition: "slide"
                            });
                        }
                    }
                });
                pickup.on("click", "#circle-right", function () {
                    if ($("#green-circle-central").css("visibility") == "visible") {
                        stopTrackingStartConfiming();
                    }
                });

                pickup.on("click", "#circle-left", function () {
                    if ($("#green-circle-left").css("visibility") == "hidden") {
                        isBackPressed = true;
                        rejectRoute();
                    }
                });

                var userRoute = currentShipment.route;
                console.log("get user position");
                navigator.geolocation.getCurrentPosition(onSuccessGetUserPosition, onErrorGetUserPosition);
            },
            pageshow: function () {
                var the_height = ($(window).height() - $(this).find('[data-role="header"]').height() - $(this).find('[data-role="footer"]').height()) - 36;
                pickup.contentHeight = the_height;
                $(this).find('[data-role="content"]').height(the_height);
                $(this).find('#map_canvas').height(the_height + 32);
            }
        });


        //    User Profile

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
                                var promise = Kinvey.User.logout({
                                });

                                promise.then(function (response) {
                                    console.log("logout with success");
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
                //TODO uncomment
                if (active_user.avatar) {
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

        function _base64ToArrayBuffer(base64) {
            var binary_string =  window.atob(base64);
            var len = binary_string.length;
            var bytes = new Uint8Array( len );
            for (var i = 0; i < len; i++)        {
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

        function stopTrackingStartConfiming() {
            console.log("stop user posit");
            isConfirmDeliveryPage = true;
            $("#step-name-label").text("Travel to Delivery Location");
            $("#step-number-label").text("Step 2");
            $("#green-circle-right").css("visibility", "visible");
            stopTrackingUserPosition();
            $("#green-circle-central").css("visibility", "hidden");
            $("#pause-btn").css("visibility", "hidden");
            $("#play-btn").css("visibility", "hidden");
            $("#timer").css("visibility", "hidden");
            directionsDisplay.setMap(null);
            console.log("confirm infobox " + selectedMarkerIndex);
            google.maps.event.clearListeners($("#confirm-infobox-arrow-btn"), 'click');
            confirm_infobox.open(map, finish_markers[selectedMarkerIndex]);
            isConfirmBoxOpen = true;
        };

        function stopConfirmingStartTracking() {
            isConfirmDeliveryPage = false;
            $("#step-name-label").text("Travel to Delivery Location");
            $("#step-number-label").text("Step 3");
            $("#green-circle-right").css("visibility", "hidden");
            startTrackingUserPosition();
            if ($("#green-circle-central").css("background") == "red") {
                $("#play-btn").css("visibility", "visible");
            } else {
                $("#pause-btn").css("visibility", "visible");
            }
            $("#green-circle-central").css("visibility", "visible");
            $("#timer").css("visibility", "visible");
            directionsDisplay.setDirections(current_direction_route);
            directionsDisplay.setMap(map);
            confirm_infobox.close();
            confirm_infobox.setMap(null);
            isConfirmBoxOpen = false;
        }


        function setConfirmAddressText() {
            console.log("addresses: " + JSON.stringify(addresses));
            $("#confirm-start-address").html(addressFormat(addresses[selectedMarkerIndex].start));
            $("#confirm-finish-address").html(addressFormat(addresses[selectedMarkerIndex].finish));
        }

        function setPushNotifiAddressText() {
            $("#start-address").html(addressFormat(addresses[0].start));
            $("#finish-address").html(addressFormat(addresses[0].finish));
        }

        function addressFormat(address) {
            var ad = address.split(',');
            return ad[0] + " " + ad[1] + " </br>" + ad[2].trim();
            +", " + ad[3] + ad[4];
        }

        function hideMarkers(map) {
            clearMarkers();
            start_markers[selectedMarkerIndex].setMap(map);
            finish_markers[selectedMarkerIndex].setMap(map);
        }

        function clearMarkers() {
            setAllMap(null);
            clearFinishMarkers();
        }

        function clearFinishMarkers() {
            for (var i = 0; i < finish_markers.length; i++) {
                if (!!finish_markers[i]) {
                    finish_markers[i].setMap(null);
                }
            }
        }

        function showMarkers() {
            console.log("check 2 " + map);
            if (!!map) {
                setAllMap(map);
                clearFinishMarkers();
            }
        }

        function setAllMap(map) {
            console.log("markers count " + start_markers.length);
            for (var i = 0; i < start_markers.length; i++) {
                if (!!start_markers[i]) {
                    start_markers[i].setMap(map);
                }
            }
        }

        function rejectRoute() {
            navigator.notification.confirm("Do you really want to reject route",
                function (button) {
                    if (button == 1) {
                        currentShipment.user_status = "rejected";
                        saveShipment(currentShipment, function (data) {
                            $("#tracking-state").css("visibility", "hidden");
                            $("#green-circle-right").css("visibility", "hidden");
                            $("#green-circle-left").css("visibility", "visible");

                            clearInterval(my_timer);
                            confirm_infobox.close();
                            confirm_infobox.setMap(null);
                            isConfirmBoxOpen = false;
                            directionsDisplay.setMap(null);
                            console.log("changePage pickup 3");
                            current_page = pickup_route_page;
                            if (isBackPressed) {
                                $("#green-circle-central").css("visibility", "hidden");
                                $("#pause-btn").css("visibility", "hidden");
                                $("#play-btn").css("visibility", "hidden");
                                $("#timer").css("visibility", "hidden");
                                pickupRoutePagePreload();
                                isBackPressed = false;
                            } else {
                                $.mobile.changePage(pickup, {
                                    transition: "slide"
                                });
                                isConfirmDeliveryPage = false;
                            }
                        });
                    }
                },
                "Change route status", ["OK", "Cancel"])

        }

        var delivery_details = $('#delivery-details');
        delivery_details.on({
            pagebeforeshow: function (event, data) {
                $("#delivery-start-address").html(addressFormat(addresses[selectedMarkerIndex].start));
                $("#delivery-finish-address").html(addressFormat(addresses[selectedMarkerIndex].finish));
                var user = Kinvey.getActiveUser();
                $("#delivery-agent").html("DELIVERY AGENT: " + user.first_name + " " + user.last_name);
                switch (current_page) {
                    case delivery_details_confirm_delivery_page:
                        $("#delivered-state").removeClass("delivery-icon-empty-circle");
                        $("#delivered-state").addClass("delivery-icon-yes-circle");
                        $("#signature-arrow-btn").removeClass("delivery-icon-arrow");
                        $("#signature-arrow-btn").addClass("delivery-icon-arrow-enable");
                        $("#begin-tracking-btn").text("Delivery Complete");
                        break;
                    case delivery_details_begin_tracking_page:
                        $("#delivered-state").removeClass("delivery-icon-yes-circle");
                        $("#delivered-state").addClass("delivery-icon-empty-circle");
                        $("#begin-tracking-btn").text("Begin Tracking");
                        $("#signature-arrow-btn").removeClass("delivery-icon-arrow-enable");
                        $("#signature-arrow-btn").addClass("delivery-icon-arrow");
                        break;
                    case signature_page:
                        current_page = delivery_details_confirm_delivery_page;
                        break;
                }
            },
            pageinit: function () {
                delivery_details.on('click', '#delivery-details-back', function () {
                    isBackPressed = true;
                    console.log("changePage pickup 2 ");
                    $.mobile.back({
                        transition: "slide"
                    });
                });
                delivery_details.on('click', '#signature-arrow-btn', function () {
                    if ($(this).hasClass("delivery-icon-arrow-enable")) {
                        console.log("changePage signature");
                        current_page = signature_page;
                        $.mobile.changePage(signature, {
                            transition: "slide"
                        });
                    }
                });
                delivery_details.on('click', '#cancel-pickup-btn', function () {
                    switch (current_page) {
                        case delivery_details_confirm_delivery_page:
                            rejectRoute();
                            break;
                        case delivery_details_begin_tracking_page:
                            current_page = pickup_route_page;
                            console.log("changePage pickup 4");
                            $.mobile.back({
                                transition: "slide"
                            });
                            break;
                    }
                });
                delivery_details.on('click', '#begin-tracking-btn', function () {
                    switch ($('#begin-tracking-btn').text()) {
                        case "Begin Tracking":
                            current_page = travel_page;
                            console.log("changePage pickup 5");
                            $.mobile.changePage(pickup);
                            break;
                        case "Delivery Complete":
                            navigator.notification.confirm("Do you really want to mark route as \"Done\"",
                                function (button) {
                                    if (button == 1) {
                                        current_page = pickup_route_page;
                                        currentShipment.user_status = "done";
                                        saveShipment(currentShipment, function (data) {
                                            $("#tracking-state").css("visibility", "hidden");
                                            $("#green-circle-right").css("visibility", "hidden");
                                            $("#green-circle-left").css("visibility", "visible");
                                            clearInterval(my_timer);
                                            confirm_infobox.close();
                                            confirm_infobox.setMap(null);
                                            isConfirmBoxOpen = false;
                                            loadShipment();
                                            isDeliveryComplitedClicked = true;
                                        });
                                    }
                                },
                                "Change route status", ["OK", "Cancel"])
                            break;
                    }

                });
            },
            pageshow: function () {
            }
        });

        $(document).delegate("#route", "scrollstart", false);


    }.call(this));

}
