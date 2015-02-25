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

var lastUserPosition = null;
var shipments = null;
var start_markers = [];
var finish_markers = [];
var addresses = [];
var selectedMarkerIndex = 0;
var map;
var directionsDisplay;
var directionsService = new google.maps.DirectionsService();
var user_marker;
var my_timer;
var last_time = [0, 0, 0];
var bounds = new google.maps.LatLngBounds();
var geocoder = new google.maps.Geocoder();

//Pickup route page
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
            saveShipment(JSON.parse(JSON.stringify(currentShipment)), function () {
            });

        });

        pickup.on('click', "#menu-btn", function () {
            current_page = user_profile_page;
            console.log("click user profile");
            $.mobile.changePage(user_profile, {transition: "slide"});
        });

        pickup.on('click', '#play-btn', function () {
            startTrackingUserPosition();
            my_timer = setInterval(function () {
                setTimerValue()
            }, 1000);
            $("#tracking-state").text("TRACKING ON");
            $("#tracking-state").css("color", "rgb(65,226,65)");
            $("#pause-btn").css("visibility", "visible");
            $("#play-btn").css("visibility", "hidden");
            $("#green-circle-central").css("background", "rgba(69,191,69,0.8)");
            currentShipment.user_status = "in progress";
            saveShipment(JSON.parse(JSON.stringify(currentShipment)), function () {
            });
        });

        pickup.on('click', '#next-btn', function () {
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
                            stopTrackStartConfirm();
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
                stopConfirmStartTrack();
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
                stopTrackStartConfirm();
            }
        });

        pickup.on("click", "#circle-left", function () {
            if ($("#green-circle-left").css("visibility") == "hidden") {
                isBackPressed = true;
                rejectRoute();
            }
        });

        var userRoute = currentShipment.route;
        navigator.geolocation.getCurrentPosition(onSuccessGetUserPosition, onErrorGetUserPosition);
    },
    pageshow: function () {
        var the_height = ($(window).height() - $(this).find('[data-role="header"]').height() - $(this).find('[data-role="footer"]').height()) - 36;
        if (device.platform === "iOS") {
            the_height -= 20;
        }
        pickup.contentHeight = the_height;
        $(this).find('[data-role="content"]').height(the_height);
        $(this).find('#map_canvas').height(the_height + 32);
    }
});

//tracking page initialization
function beginTrackingPagePreload() {
    console.log("begin tracking preload");
    $('#checkin-tap-div').text("Tap map to send check-in update");
    last_time = [0, 0, 0];
    my_timer = setInterval(function () {
        setTimerValue()
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
    Date.prototype.timeNow = function () {
        return ((this.getHours() < 10) ? "0" : "") + this.getHours() + ":" + ((this.getMinutes() < 10) ? "0" : "") + this.getMinutes() + ":" + ((this.getSeconds() < 10) ? "0" : "") + this.getSeconds();
    };
    currentShipment.start_time = new Date().timeNow();
    saveShipment(JSON.parse(JSON.stringify(currentShipment)), function () {
    });
    calcRoute();
};

//pickup route page initialization
function pickupRoutePagePreload() {
    console.log("pickup route pleload");
    $('#checkin-tap-div').text("");
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


var activeWatch;
//sets update driver position timer
function startTrackingUserPosition() {
    setupWatch(5000);

    function setupWatch(freq) {
        activeWatch = setInterval(watchLocation, freq);
    }

    function watchLocation() {
        navigator.geolocation.getCurrentPosition(
            updateUserLoc, onLocationError, {
                enableHighAccuracy: true
            });
    }

    //updates driver location
    function updateUserLoc(position) {
        lastUserPosition = position;
        console.log("last user position " + JSON.stringify(position));

        //updates user marker location
        if (user_marker) {
            user_marker.setPosition(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
        } else {
            user_marker = new google.maps.Marker({
                position: new google.maps.LatLng(position.coords.latitude, position.coords.longitude),
                map: map,
                icon: 'images/user_marker.png'
            });
        }
        var user = Kinvey.getActiveUser();
        //console.log("user " + JSON.);
        user.position = {};
        user.position.lat = position.coords.latitude;
        user.position.lon = position.coords.longitude;

        //Kinvey user update position starts
        var promise = Kinvey.User.update(user, {
            success: function () {
                console.log("update driver position with success");
            },
            error: function (error) {
                console.log("update driver position with error " + JSON.stringify(error.description));
            }
        });
    }

    function onLocationError(error) {
        console.log('code: ' + error.code + '\n' +
            'message: ' + error.message + '\n');
    }
}

//drops update user location timer
function stopTrackingUserPosition() {
    clearInterval(activeWatch);
}


//creates map when user login in app
var onSuccessGetUserPosition = function (position) {
    var user = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
    bounds.extend(user);

    //map creation
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

    //user marker creation
    user_marker = new google.maps.Marker({
        position: user,
        map: map,
        icon: 'images/user_marker.png'
    });
    addAllStartMarkers(map);
    $('#map_canvas').gmap('refresh');
    google.maps.event.addListener(map, 'click', function () {
        updateCheckin();
    });
};

//creates checkin each time when user click on map on travel page
function updateCheckin() {
    if (current_page == travel_page) {
        navigator.geolocation.getCurrentPosition(function (position) {

            //gets address by position
            geocoder.geocode({'latLng': new google.maps.LatLng(position.coords.latitude, position.coords.longitude)}, function (results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    $.mobile.loading("show");
                    console.log("position " + JSON.stringify(results[0]));
                    Kinvey.DataStore.save('shipment-checkins', {
                        address: results[0].formatted_address,
                        shipment_id: currentShipment._id,
                        position: {
                            lat: results[0].geometry.location.k,
                            lon: results[0].geometry.location.D
                        }
                    }, {
                        success: function (response) {
                            console.log("save shipment checkin success");
                        },
                        error: function (error) {
                            console.log("sava shipment checkin error " + JSON.stringify(error));
                        }
                    }).then(loadingHide, loadingHide);
                } else {
                    console.log('Geocoder failed due to: ' + status);
                }
            });

            //updates shipment percentage complete, calculates distance between last checkin and finish point
            var origin = new google.maps.LatLng(currentShipment.route.start_lat, currentShipment.route.start_long);
            var destination = new google.maps.LatLng(currentShipment.route.finish_lat, currentShipment.route.finish_long);
            var service = new google.maps.DistanceMatrixService();
            service.getDistanceMatrix(
                {
                    origins: [origin],
                    destinations: [destination],
                    travelMode: google.maps.TravelMode.DRIVING,
                    avoidHighways: false,
                    avoidTolls: false
                }, callback);

            function callback(response, status) {
                if (status == google.maps.DistanceMatrixStatus.OK) {
                    var checkin_distance = response.rows[0].elements[0].distance.value;
                    if (currentShipment.route.distance > checkin_distance) {
                        currentShipment.status = ((1 - checkin_distance / currentShipment.route.distance) * 100).toFixed(0) + "%";
                        saveShipment(JSON.parse(JSON.stringify(currentShipment)), function () {
                        });
                    }
                }
            }
        });
    }
};

// onError Callback receives a PositionError object
function onErrorGetUserPosition(error) {
    console.log("on error getUser position " + error.message);
}

//builds route between markers
function calcRoute() {
    console.log("calc route");
    var request = {
        origin: new google.maps.LatLng(start_markers[selectedMarkerIndex].getPosition().lat(), start_markers[selectedMarkerIndex].getPosition().lng()),
        destination: new google.maps.LatLng(finish_markers[selectedMarkerIndex].getPosition().lat(), finish_markers[selectedMarkerIndex].getPosition().lng()),
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

//sets timers value
function setTimerValue() {
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

function stopTrackStartConfirm() {
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
    google.maps.event.clearListeners($("#confirm-infobox-arrow-btn"), 'click');
    confirm_infobox.open(map, finish_markers[selectedMarkerIndex]);
    isConfirmBoxOpen = true;
};

function stopConfirmStartTrack() {
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
    console.log("addresses: " + JSON.stringify(addresses));
    $("#start-address").html(addressFormat(addresses[0].start));
    $("#finish-address").html(addressFormat(addresses[0].finish));
}

//converts address string to right format
function addressFormat(address) {
    var ad = address.split(',');
    var result = "";
    for (var i = 0; i < ad.length; i++) {
        if (i == 2) {
            result += " </br>" + ad[i].trim();
        } else {
            result += ad[i];
        }
    }
    return result;
}