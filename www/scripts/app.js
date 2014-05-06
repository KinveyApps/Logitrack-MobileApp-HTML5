-
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
(function () {
    'use strict';

    var active_user;
    // Setup.
    // ------
    var loadingHide = function () {
        $.mobile.loading("hide");
    }
    var date = new Date();
    var last_call_time_function = date.getTime();
    var current_call_time;
    var current_page = 1;
    var pickup_route_page = 1;
    var travel_page = 2;
    var delivery_details_begin_tracking_page = 3;
    var delivery_details_confirm_delivery_page = 4;
    var locationWatchId = null;
    var currentShipment = null;
    var shipments = null;
    var start_markers = [];
    var finish_markers = [];
    var addresses = [];
    var selectedMarkerIndex = 0;
    var lastUserPosition = null;
    var map;
    var user_marker;
    var infobox;
    var confirm_infobox;
    var my_timer;
    var last_time = [0, 0, 0];
    var geocoder = new google.maps.Geocoder();
    var bounds = new google.maps.LatLngBounds();
    var isStartMarkerSelected = false;
    var isConfirmDeliveryPage = false;
    var isDeliveryComplitedClicked = false;
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
                    alert(JSON.stringify(error));
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
        // Preload templates.
        active_user = activeUser;
        //        if (null !== activeUser) {
        //                 loadShipment();
        //                    $.mobile.loading("show");
        //                 $.mobile.changePage(pickup);
        //        }

    }).then(function () {
        $.when([
            $.Mustache.load('templates/search.html'),
            $.Mustache.load('templates/checkins.html')

        ]).then(function () {
            $.mobile.initializePage(); // Render page.
        });
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


    // Default mustache data filters.
    var mustacheData = {
        self: function () {
            return this.author._id === Kinvey.getActiveUser()._id ||
                (null != this.recipient && this.recipient._id === Kinvey.getActiveUser()._id);
        },
        date: function () {
            return new Date(this._kmd.lmt).toUTCString();
        },
        isSelect: function () {
            return this.type == "select";
        },
        isCheckbox: function () {
            return this.type == 'checkbox';
        }
    };

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
                $.mobile.changePage(login);
            }
        }
    });

    var signature = $('#signature');
    signature.on({
        pageinit: function () {
            signature.on('click', '#signature-back', function () {
                $.mobile.back();
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
                    loadShipment();
                }, function (error) {
                    console.log("login error " + JSON.stringify(error));
                    alert(error.description);
                }).then(loadingHide, loadingHide);
            });
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


    var directionsDisplay;
    var directionsService = new google.maps.DirectionsService();

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
                directionsDisplay.setDirections(response);
                directionsDisplay.setMap(map);
            }
        });
    }


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
        $('.confirm-infobox-arrow-btn').click(function (e) {
            console.log("changePage delivery details 3");
            current_call_time = (new Date()).getTime();

            if (current_call_time - last_call_time_function > 500) {
                current_page = delivery_details_confirm_delivery_page;
                $.mobile.changePage(delivery_details, {
                    transition: "slide"
                });
            }
        });
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
        $('.infobox-arrow-btn').click(function (e) {
            current_call_time = (new Date()).getTime();

            if (current_call_time - last_call_time_function > 500) {
                console.log("changePage delivery details 2");
                current_page = delivery_details_begin_tracking_page;
                $.mobile.changePage(delivery_details, {
                    transition: "slide"
                });
            }
            last_call_time_function = current_call_time;
        });
    });

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
        infobox.close();
        isStartMarkerSelected = true;
        $("#step-name-label").text("Travel to Delivery Location");
        $("#step-number-label").text("Step 2");
        currentShipment.user_status = "in progress";
        saveShipment(currentShipment, function () {});
        calcRoute();
    };

    function pickupRoutePagePreload() {
        console.log("pickup route pleload");
        $("#step-name-label").text("Tap to Browse Different Pickups");
        $("#step-number-label").text("Waiting for Delivery");
        $("#next-label").css("visibility", "hidden");
        showMarkers();
        isStartMarkerSelected = false;
        if (!isConfirmDeliveryPage) {
            infobox.close();
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
            if (route.followUser) {
                $('#map_canvas').gmap('option', {
                    'center': new google.maps.LatLng(position.coords.latitude, position.coords.longitude)
                });
            }
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
        //
        // alert('Latitude: '          + position.coords.latitude          + '\n' +
        //       'Longitude: '         + position.coords.longitude         + '\n' +
        //       'Altitude: '          + position.coords.altitude          + '\n' +
        //       'Accuracy: '          + position.coords.accuracy          + '\n' +
        //       'Altitude Accuracy: ' + position.coords.altitudeAccuracy  + '\n' +
        //       'Heading: '           + position.coords.heading           + '\n' +
        //       'Speed: '             + position.coords.speed             + '\n' +
        //       'Timestamp: '         + new Date(position.timestamp)      + '\n');
    };

    // onError Callback receives a PositionError object
    //
    function onErrorGetUserPosition(error) {
        console.log("on error getUser position " + error.message);
    }

    function addAllStartMarkers(map) {
        var start_marker;
        var finish_marker;
        var coordinates;
        var route_addresses;
        for (var i in shipments) {
            if (!!shipments[i].route) {
                route_addresses = {
                    start: shipments[i].route.start,
                    finish: shipments[i].route.finish
                };
                addresses.push(route_addresses);
                geocoder.geocode({
                    'address': shipments[i].route.start
                }, function (results, status) {
                    if (status == google.maps.GeocoderStatus.OK) {
                        start_marker = new google.maps.Marker({
                            position: new google.maps.LatLng(results[0].geometry.location.k, results[0].geometry.location.A),
                            map: map,
                            icon: 'images/start_marker.png'
                        });
                        start_markers.push(start_marker);
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
                        showMarkers();
                    } else {
                        alert("Geocode was not successful for the following reason: " + status);
                    }
                });

                geocoder.geocode({
                    'address': shipments[i].route.finish
                }, function (results, status) {
                    if (status == google.maps.GeocoderStatus.OK) {
                        finish_marker = new google.maps.Marker({
                            position: new google.maps.LatLng(results[0].geometry.location.k, results[0].geometry.location.A),
                            map: map,
                            icon: 'images/finish_marker.png'
                        });
                        finish_marker.setMap(null);
                        finish_markers.push(finish_marker);
                    } else {
                        alert("Geocode was not successful for the following reason: " + status);
                    }
                });
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
        },
        pageinit: function () {
            current_page = pickup_route_page;
            $('#green-circle-left').css('visibility', "visible");
            $('#map_canvas').gmap({
                'zoom': 10,
                'disableDefaultUI': true,
                'callback': function () {}
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
                saveShipment(currentShipment, function () {});

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
                saveShipment(currentShipment, function () {});
            });
            var isTrackingEnd = false;
            pickup.on('click', '#next-btn', function () {
                console.log("click next button");
                if (isStartMarkerSelected) {
                    switch (current_page) {
                    case travel_page:
                        if(isTrackingEnd) {
                            console.log("changePage delivery details 3");
                            current_page = delivery_details_confirm_delivery_page;
                            $.mobile.changePage(delivery_details, {
                                transition: "slide"
                            });
                            isTrackingEnd = false;
                        }else{
                            stopTrackingStartConfiming();
                            isTrackingEnd = true;
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
                infobox.open(map, start_markers[selectedMarkerIndex]);
            });
            //              $("#alertcontainer").css("display", "block");
            //              $("#messagefg").css("display", "block");


            var userRoute = currentShipment.route;
            navigator.geolocation.getCurrentPosition(onSuccessGetUserPosition, onErrorGetUserPosition);
        },
        pageshow: function () {
            var the_height = ($(window).height() - $(this).find('[data-role="header"]').height() - $(this).find('[data-role="footer"]').height()) - 36;
            pickup.contentHeight = the_height;
            $(this).find('[data-role="content"]').height(the_height);
            $(this).find('#map_canvas').height(the_height + 32);
        }
    });

    function stopTrackingStartConfiming() {
        stopTrackingUserPosition();
        isConfirmDeliveryPage = true;
        $("#step-name-label").text("Travel to Delivery Location");
        $("#step-number-label").text("Step 3");
        $("#green-circle-central").css("visibility", "hidden");
        $("#green-circle-right").css("visibility", "visible");
        $("#pause-btn").css("visibility", "hidden");
        $("#play-btn").css("visibility", "hidden");
        $("#timer").css("visibility", "hidden");
        directionsDisplay.setMap(null);
        console.log("confirm infobox " + selectedMarkerIndex + "   " + JSON.stringify(selectedMarkerIndex));
        confirm_infobox.open(map, finish_markers[selectedMarkerIndex]);
    };


    function setConfirmAddressText() {
        console.log("addresses: " + JSON.stringify(addresses));
        $("#confirm-start-address").html(addressFormat(addresses[selectedMarkerIndex].start));
        $("#confirm-finish-address").html(addressFormat(addresses[selectedMarkerIndex].finish));
    }

    function addressFormat(address) {
        var ad = address.split(',');
        return ad[0] + " " + ad[1] + " </br>" + ad[2] + ", " + ad[3] + ad[4];
    }

    function nth_ocurrence(str, needle, nth) {
        for (var i = 0; i < str.length; i++) {
            if (str.charAt(i) == needle) {
                if (!--nth) {
                    return i;
                }
            }
        }
        return false;
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
            finish_markers[i].setMap(null);
        }
    }

    function showMarkers() {
        console.log("check 2");
        setAllMap(map);
        clearFinishMarkers();
    }

    function setAllMap(map) {
        console.log("markers count " + start_markers.length);
        for (var i = 0; i < start_markers.length; i++) {
            start_markers[i].setMap(map);
        }
    }


    var delivery_details = $('#delivery-details');
    delivery_details.on({
        pagebeforeshow: function (event, data) {
            $("#delivery-start-address").html(addressFormat(addresses[selectedMarkerIndex].start));
            $("#delivery-finish-address").html(addressFormat(addresses[selectedMarkerIndex].finish));
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
                break
            }
        },
        pageinit: function () {
            delivery_details.on('click', '#delivery-details-back', function () {
                console.log("changePage pickup 2 ");
                history.back();
                //                    $.mobile.changePage(pickup, {
                //                        transition: "slide"
                //                    });
            });
            delivery_details.on('click', '#signature-arrow-btn', function () {
                if ($(this).hasClass("delivery-icon-arrow-enable")) {
                    console.log("changePage signature");
                    $.mobile.changePage(signature, {
                        transition: "slide"
                    });
                }
            });
            delivery_details.on('click', '#cancel-pickup-btn', function () {
                switch (current_page) {
                case delivery_details_confirm_delivery_page:
                    //                                navigator.notification.confirm("Do you really want to reject route",
                    //                                                               function (button) {
                    //                                                               if (button == 1) {
                    //                                                               currentShipment.user_status = "rejected";
                    //                                                               saveShipment(currentShipment, function (data) {
                    //                                                                            currentShipment = data;
                    //                                                                            history.back();
                    //                                                                            });
                    //                                                               }
                    //                                                               },
                    //                                                               "Change route status", ["OK", "Cancel"])
                    if (confirm("Do you really want to reject route")) {
                        currentShipment.user_status = "rejected";
                        saveShipment(currentShipment, function (data) {
                            $("#tracking-state").css("visibility", "hidden");
                            $("#green-circle-right").css("visibility", "hidden");
                            $("#green-circle-left").css("visibility", "visible");
                            clearInterval(my_timer);
                            confirm_infobox.close();
                            console.log("changePage pickup 3");
                            current_page = pickup_route_page;
                            $.mobile.back({
                                transition: "slide"
                            });
                            isConfirmDeliveryPage = false;
                        });
                    }

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
                    if (confirm("Do you really want to mark route as \"Done\"")) {
                        current_page = pickup_route_page;
                        currentShipment.user_status = "done";
                        saveShipment(currentShipment, function (data) {
                            $("#tracking-state").css("visibility", "hidden");
                            $("#green-circle-right").css("visibility", "hidden");
                            $("#green-circle-left").css("visibility", "visible");
                            clearInterval(my_timer);
                            confirm_infobox.close();
                            loadShipment();
                            isDeliveryComplitedClicked = true;
                        });

                    }
                    //                                navigator.notification.confirm("Do you really want to mark route as \"Done\"",
                    //                                                               function (button) {
                    //                                                               if (button == 1) {
                    //                                                               currentShipment.user_status = "done";
                    //                                                               saveShipment(currentShipment, function (data) {
                    //                                                                            currentShipment = data;
                    //                                                                            $.mobile.back();
                    //                                                                            });
                    //                                                               }
                    //                                                               },
                    //                                                               "Change route status", ["OK", "Cancel"])
                    break;
                }

            });
        },
        pageshow: function () {}
    });


    // Home.
    // -----
    var home = $('#home');
    home.on({
        /**
         * Init hook.
         */
        pageinit: function () {
            console.log("home pageinit");

            home.on('click', '#save', function () {
                var button = $(this).addClass('ui-disabled');
                //TODO: data search
                $.mobile.loading("show");
                Kinvey.DataStore.find('shipment', null, {
                    relations: {
                        'checkins': 'shipment-checkins',
                        'route': 'route'
                    },
                    success: function (data) {
                        if (data.length == 0) {
                            alert("No route found");
                        } else {
                            currentShipment = data[0];
                            button.removeClass('ui-disabled');
                            console.log("changePage route");
                            $.mobile.changePage(routeSettings);

                        }
                    }
                }).then(loadingHide, loadingHide);


            });
        },

        /**
         * Before show hook.
         */
        pagebeforeshow: function () {
            console.log("home pagebeforeshow");
            $.mobile.loading("show");
            Kinvey.DataStore.find('search-options', null, {
                success: function (response) {
                    window.searchOptions = response;
                    for (var i in response) {
                        if (response[i].values) {
                            var values = response[i].values;
                            var array = [];
                            for (var j in values) {
                                array[array.length] = {
                                    'name': j,
                                    'value': values[j]
                                };
                            }
                            response[i].values = array;
                        }
                    }
                    home.find('.search_form').mustache('search', $.extend({
                        searchOptions: window.searchOptions
                    }, mustacheData), {
                        method: 'html'
                    }).listview('refresh');
                    home.find("select").each(function () {
                        if ($(this).data('role') == 'slider') {
                            $(this).slider().slider('refresh');
                        } else {
                            $(this).selectmenu().selectmenu('refresh');
                        }
                    });

                }
            }).then(loadingHide, loadingHide);

        }
    });

    // maps.
    // --------
    var route = $('#route');
    route.on({
        pageinit: function () {
            console.log("route page init");
            /*debugger;
                 Kinvey.DataStore.save('shipment', {
                 'on-desk' : true,
                 "pulped" : "yes",
                 "status" : 'in_progress',
                 'user_status' : null,
                 'checkins' : [],
                 'route' : {start:{
                 lat:30.265146,
                 lon: -97.747185
                 }, finish:{
                 lat: 30.246359,
                 lon: -97.76918
                 }}

                 },{
                 relations : {'checkins' : 'checkins', 'route' : 'route'},

                 success : function(response){
                 debugger;
                 }
                 });*/


            route.on("click", "#my_loc", function () {
                $(this).toggleClass("enabled");
                route.followUser = $(this).hasClass("enabled");

                //$(this).css("background-image", route.followUser ? "url:(../images/myl_normal.png)": "url:(../images/myl_disabled.png)")

            });

            route.on("click", ".ui-icon-ok", function () {
                navigator.notification.confirm("Do you really want to mark route as \"Done\"",
                    function (button) {
                        if (button == 1) {
                            currentShipment.user_status = "done";
                            saveShipment(currentShipment, function (data) {
                                currentShipment = data;
                                $.mobile.back();
                            });
                        }
                    },
                    "Change route status", ["OK", "Cancel"])
            });

            route.on("click", ".ui-icon-remove", function () {
                navigator.notification.confirm("Do you really want to reject route",
                    function (button) {
                        if (button == 1) {
                            currentShipment.user_status = "rejected";
                            saveShipment(currentShipment, function (data) {
                                currentShipment = data;
                                history.back();
                            });
                        }
                    },
                    "Change route status", ["OK", "Cancel"])
            });
            $('#map_canvas').gmap({
                'zoom': 10,
                'disableDefaultUI': true,
                'callback': function () {}
            })
        },
        pageshow: function () {
            console.log("route pageshow");
            var the_height = ($(window).height() - $(this).find('[data-role="header"]').height() - $(this).find('[data-role="footer"]').height()) - 36;
            route.contentHeight = the_height;

            $(this).find('[data-role="content"]').height(the_height);
            $(this).find('#map_canvas').height(the_height + 32);

            var userRoute = currentShipment.route;

            var bounds = new google.maps.LatLngBounds();

            var start = new google.maps.LatLng(userRoute.start.lat, userRoute.start.lon);
            var finish = new google.maps.LatLng(userRoute.finish.lat, userRoute.finish.lon);

            bounds.extend(start);
            bounds.extend(finish);

            $('#map_canvas').gmap('displayDirections', {
                    'origin': start,
                    'destination': finish,
                    'travelMode': google.maps.DirectionsTravelMode.DRIVING
                }, {},
                function (result, status) {
                    if (status === 'OK') {
                        var center = result.routes[0].bounds.getCenter();
                        $('#map_canvas').gmap('option', 'center', center);
                        $('#map_canvas').gmap('refresh');
                    } else {
                        alert('Unable to get route');
                    }
                }
            );


            //display checkins
            var checkins = currentShipment.checkins;
            for (var i = 0; i < checkins.length; i++) {
                if (checkins[i].position) {
                    var position = checkins[i].position;
                    $('#map_canvas').gmap('addMarker', {
                        position: new google.maps.LatLng(position.lat, position.lon),
                        'icon': 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
                    });
                }
            }

            $('#map_canvas').gmap('refresh');

            //tracking user position
            //tracking user position
            if (locationWatchId) {
                navigator.geolocation.clearWatch(locationWatchId);
            }
            locationWatchId = navigator.geolocation.watchPosition(function (position) {
                lastUserPosition = position;
                var marker = $('#map_canvas').gmap('get', 'markers > current');
                if (marker) {
                    marker.setPosition(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
                } else {
                    $('#map_canvas').gmap('addMarker', {
                        'id': 'current',
                        'position': new google.maps.LatLng(position.coords.latitude, position.coords.longitude),
                        'icon': 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                    });
                }
                if (route.followUser) {
                    $('#map_canvas').gmap('option', {
                        'center': new google.maps.LatLng(position.coords.latitude, position.coords.longitude)
                    });
                }
            }, function (error) {
                console.log('code: ' + error.code + '\n' +
                    'message: ' + error.message + '\n');
            }, {
                timeout: 30000
            });

        }
    });

    var checkins = $('#checkins');
    checkins.on({
        pageinit: function () {
            checkins.find("#ok").click(function () {
                if (checkins.find('.data li.selected').length > 0) {
                    var id = checkins.find('.data li.selected').data('id');
                    var checkin;
                    for (var i = 0; i < checkins.kinveyData.length; i++) {
                        if (checkins.kinveyData[i]._id == id) {
                            checkin = checkins.kinveyData[i];
                            break;
                        }
                    }
                    currentShipment.checkins.push({
                        position: {
                            lat: checkins.checkinPosition.coords.latitude,
                            lon: checkins.checkinPosition.coords.longitude
                        },
                        checkin: checkin
                    });
                    saveShipment(currentShipment, function (data) {
                        currentShipment = data;
                        window.history.go(-1);
                    });
                } else {
                    history.back();
                }
            });
        },
        pageshow: function () {
            checkins.find('.data').mustache('checkins', $.extend({
                checkins: checkins.kinveyData
            }, mustacheData), {
                method: 'html'
            }).listview('refresh');
            checkins.find('.data li').click(function () {
                if (!$(this).hasClass("selected")) {
                    checkins.find('.data li').removeClass("selected");
                    $(this).addClass("selected");
                }
            });


        }
    });

    var routeSettings = $('#route_settings');
    routeSettings.on({
        pageinit: function () {
            debugger;
            routeSettings.on("click", "#control i", function () {
                debugger;
                if ($(this).hasClass("fa-play")) {
                    $(this).removeClass("fa-play").addClass("fa-pause");
                } else {
                    $(this).removeClass("fa-pause").addClass("fa-play");
                }

                currentShipment.user_status = $(this).hasClass("fa-play") ? "in progress" : "paused";
                saveShipment(currentShipment, function () {});

            });

            routeSettings.on("click", "#checkin_btn", function () {
                var button = $(this).addClass('ui-disabled');
                if (!checkins.kinveyData) {
                    $.mobile.loading("show");
                    Kinvey.DataStore.find('checkins', null, {
                        success: function (response) {
                            if (lastUserPosition) {
                                checkins.kinveyData = response;
                                checkins.checkinPosition = lastUserPosition;
                                console.log("changePage checkins");
                                $.mobile.changePage(checkins);
                            } else {
                                navigator.notification.alert("Can't get your location. Please make sure that location services are enabled on your device.",
                                    function () {}, "Location missing", "OK");
                            }
                        }
                    }).then(loadingHide, loadingHide);
                } else {
                    checkins.checkinPosition = lastUserPosition;
                    console.log("changePage checkins");
                    $.mobile.changePage(checkins);

                }

                var button = $(this).removeClass('ui-disabled');
            });

            routeSettings.on("click", "#map_btn", function () {
                $.mobile.changePage(route);
            })
        },
        pageshow: function () {
            var the_height = ($(window).height() - $(this).find('[data-role="header"]').height() - $(this).find('[data-role="footer"]').height()) - 36;

            $("#control").css({
                'margin-top': (the_height - $("#control").height()) / 2 + 'px'
            });

            //tracking user position
            if (locationWatchId) {
                navigator.geolocation.clearWatch(locationWatchId);
            }
            locationWatchId = navigator.geolocation.watchPosition(function (position) {
                lastUserPosition = position;
            }, function (error) {
                console.log('code: ' + error.code + '\n' +
                    'message: ' + error.message + '\n');
            }, {
                timeout: 30000
            });
        }
    });

    $(document).delegate("#route", "scrollstart", false);


}.call(this));