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
var startMarkers = [];
var finishMarkers = [];
var restaurantMarkers = [];
var addresses = [];
var selectedMarkerIndex = 0;
var map;
var directionsDisplay;
var directionsService = new google.maps.DirectionsService();
var userMarker;
var timer;
var lastTime = [0, 0, 0];
var bounds = new google.maps.LatLngBounds();
var geocoder = new google.maps.Geocoder();
var rboxer = new RouteBoxer();
var restaurantDistance = 0.5; // km
var searchRadius = 0.5;
var locationCheckTimeInterval = 60000; //1 minute
var isFirstStart;
var zoomLevel = 12;

//Pickup route page
var pickup = $('#pickup-route');
pickup.on({
    pagebeforeshow: function (event, data) {
        console.log("page before show pickup");
        switch (currentPage) {
            case PICKUP_ROUTE_PAGE:
                pickupRoutePagePreload();
                break;
            case TRAVEL_PAGE:
                beginTrackingPagePreload();
                startTrackingUserPosition();
                break;
        }
        if (isBackPressed) {
            switch (currentPage) {
                case DELIVERY_DETAILS_BEGIN_TRACKING_PAGE:
                    currentPage = PICKUP_ROUTE_PAGE;
                    break;
                case DELIVERY_DETAILS_CONFIRM_DELIVERY_PAGE:
                    currentPage = TRAVEL_PAGE;
                    break;
                case USER_PROFILE_PAGE:
                    if ($("#step-number-label").text() == "Step 2" || $("#step-number-label").text() == "Step 3") {
                        currentPage = TRAVEL_PAGE;
                    } else {
                        currentPage = PICKUP_ROUTE_PAGE;
                    }
                    break;
                case OPEN_DISPATCHES_PAGE:
                    currentPage = previousPage;
            }
            isBackPressed = false;
        }
    },
    pageinit: function () {
        console.log("pickup page init");
        isFirstStart = true;
        currentPage = PICKUP_ROUTE_PAGE;
        $('#green-circle-left').css('visibility', "visible");
        $('#map_canvas').gmap({
            'zoom': 10,
            'disableDefaultUI': true,
            'callback': function () {
            }
        });

        pickup.on('click', '#pause-btn', function () {
           pauseTracking();
        });

        pickup.on('click', "#menu-btn", function () {
            currentPage = USER_PROFILE_PAGE;
            console.log("click user profile");
            $.mobile.changePage(userProfilePage, {transition: "slide"});
        });

        pickup.on('click', '#play-btn', function () {
            resumeTracking();
        });

        pickup.on('click', '#next-div', function () {

          
            setTimeout(function(){

                console.log("last time " + getTimer());
            },5000);
            if (isStartMarkerSelected) {
                switch (currentPage) {
                    case TRAVEL_PAGE:
                        if(getLastShipmentStatus() == "paused"){
                            navigator.notification.alert("Please resume delivery before continuing.",function(){},'Warning','OK');
                        }else {
                            if (isConfirmBoxOpen) {
                                console.log("changePage delivery details 3");
                                currentPage = DELIVERY_DETAILS_CONFIRM_DELIVERY_PAGE;
                                $.mobile.changePage(deliveryDetailsPage, {
                                    transition: "slide"
                                });
                            } else {
                                console.log("stop tracking start confirming");
                                stopTrackStartConfirm();
                            }
                        }
                        break;
                    case PICKUP_ROUTE_PAGE:
                        console.log("changePage delivery details 1");
                        currentPage = DELIVERY_DETAILS_BEGIN_TRACKING_PAGE;
                        $.mobile.changePage(deliveryDetailsPage, {
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
            $("#step-name-label").text("Tap to see pending pickups");
            $("#step-number-label").text("Waiting for delivery");
            $("#alertcontainer").css("display", "none");
            $("#message-confirm").css("display", "none");
            showMarkers();
            isStartMarkerSelected = false;
        });

        pickup.on('click', '#confirm-btn', function () {
            if(shipments.length == 1) {
                finishMarkers[0].setMap(map);
            }
            $("#alertcontainer").css("display", "none");
            $("#message-confirm").css("display", "none");
            $("#step-name-label").text("En Route to Pickup");
            $("#next-div").css("visibility", "visible");
            google.maps.event.clearListeners($("#infobox-arrow-btn"), 'click');
            infobox.open(map, startMarkers[selectedMarkerIndex]);
        });

        pickup.on("click", "#circle-central", function () {
            if ($("#green-circle-right").css("visibility") == "visible") {
                stopConfirmStartTrack();
            }
            if ($("#green-circle-left").css("visibility") == "visible") {
                if (isStartMarkerSelected) {
                    currentPage = DELIVERY_DETAILS_BEGIN_TRACKING_PAGE;
                    $.mobile.changePage(deliveryDetailsPage, {
                        transition: "slide"
                    });
                }
            }
        });

        pickup.on("click", "#circle-right", function () {
            if ($("#green-circle-central").css("visibility") == "visible") {
                if(getLastShipmentStatus() == "in progress") {
                    stopTrackStartConfirm();
                }
            }
        });

        pickup.on("click", "#circle-left", function () {
            if ($("#green-circle-left").css("visibility") == "hidden") {
                isBackPressed = true;
                rejectRoute();
            }
        });

        pickup.on("click", "#step-name-label-wrapper", function () {
            if (getLastShipmentStatus() != "paused" && getLastShipmentStatus() != "in progress") {
                $.mobile.changePage(dispatchPage, {
                    transition: "slide"
                });
            }
        });

        if(currentShipment) {
            var userRoute = currentShipment.route;
        }
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

        if (isDispatchFromList) {
            setTripToStartState();
        }

        if ((getLastShipmentStatus() != "paused" && getLastShipmentStatus() != "in progress") && isFirstStart) {
            if(shipments.length > 1) {
                navigator.notification.alert("You have multiple pickups available, please go to the dispatch screen to select one.", function () {
                }, 'Multiple dispatches', 'OK');
            }else if(shipments.length == 1){
                currentShipment = shipments[0];
                selectedMarkerIndex = 0;
                console.log("adresses " + JSON.stringify(addresses));
                $("#confirm-start-address").html(addressFormat(currentShipment.route.start));
                $("#confirm-finish-address").html(addressFormat(currentShipment.route.finish));
                $("#alertcontainer").css("display", "block");
                $("#message-confirm").css("display", "block");
            }
        }
        isFirstStart = false;
    }
});

function setTripToStartState(){
    $("#alertcontainer").css("display", "block");
    $("#message-confirm").css("display", "block");
    $("#step-number-label").text("Step 1");
    $("#step-name-label").text("Pickup");
    $("#next-div").css("visibility","hidden");
    directionsDisplay.setMap(null);
    setConfirmAddressText();
    hideMarkers(map);
    isStartMarkerSelected = true;
    currentPage = PICKUP_ROUTE_PAGE;
    isDispatchFromList = false;
    $("#timer").text('00:00:00');
    $("#tracking-state").css("visibility", "hidden");
    $("#green-circle-right").css("visibility", "hidden");
    $("#green-circle-central").css("visibility", "hidden");
    $("#green-circle-left").css("visibility", "visible");
    $("#timer").css('visibility', "hidden");
    $("#tracking-state").text("TRACKING ON");
    $("#tracking-state").css("color", "rgb(65,226,65)");
    $("#pause-btn").css("visibility", "hidden");
    $("#play-btn").css("visibility", "hidden");
    $("#green-circle-central").css("background", "rgba(69,191,69,0.8)");
    confirmInfobox.close();
    confirmInfobox.setMap(null);
    infobox.close();
    infobox.setMap(null);
    lastTime = [0, 0, 0];
    clearInterval(timer);
    isConfirmBoxOpen = false;
    isDeliveryComplitedClicked = true;
}

function pauseTracking(){
    console.log("pause tracking");
    clearInterval(timer);
    stopTrackingUserPosition();
    $("#tracking-state").text("PAUSED");
    $("#tracking-state").css("color", "red");
    $("#play-btn").css("visibility", "visible");
    $("#pause-btn").css("visibility", "hidden");
    $("#green-circle-central").css("background", "red");
    currentShipment.user_status = "paused";
    setLastShipmentStatus("paused");
    console.log("status " + getLastShipmentStatus());
    saveShipment(JSON.parse(JSON.stringify(currentShipment)), function () {
    });
}

function resumeTracking() {
    startTrackingUserPosition();
    timer = setInterval(function () {
        setTimerValue()
    }, 1000);
    $("#tracking-state").text("TRACKING ON");
    $("#tracking-state").css("color", "rgb(65,226,65)");
    $("#pause-btn").css("visibility", "visible");
    $("#play-btn").css("visibility", "hidden");
    $("#green-circle-central").css("background", "rgba(69,191,69,0.8)");
    currentShipment.user_status = "in progress";
    setLastShipmentStatus("in progress");
    setLastShipmentId(currentShipment._id);
    saveShipment(JSON.parse(JSON.stringify(currentShipment)), function () {
    });
}

//tracking page initialization
function beginTrackingPagePreload() {
    console.log("begin tracking preload");
    lastTime = [0, 0, 0];
    timer = setInterval(function () {
        setTimerValue();
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
    if(getLastShipmentStatus() == "paused"){
        currentShipment.user_status = "paused";
        setLastShipmentStatus("paused");
    }else {
        currentShipment.user_status = "in progress";
        setLastShipmentStatus("in progress");
    }
    setLastShipmentId(currentShipment._id);
    Date.prototype.timeNow = function () {
        return ((this.getHours() < 10) ? "0" : "") + this.getHours() + ":" + ((this.getMinutes() < 10) ? "0" : "") + this.getMinutes() + ":" + ((this.getSeconds() < 10) ? "0" : "") + this.getSeconds();
    };
    currentShipment.start_time = new Date().timeNow();
    if(userMarker) {
        currentShipment.status = "0%";
    }else{
        currentShipment.status = "Not tracked";
    }
    saveShipment(JSON.parse(JSON.stringify(currentShipment)), function () {
    });
    calcRoute();
};

//pickup route page initialization
function pickupRoutePagePreload() {
    console.log("pickup route pleload");
    $("#step-name-label").text("Tap to see pending pickups");
    $("#step-number-label").text("Waiting for Delivery");
    $("#next-div").css("visibility", "hidden");
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
    setupWatch(locationCheckTimeInterval);

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
        if (userMarker) {
            userMarker.setPosition(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
        } else {
            userMarker = new google.maps.Marker({
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
      calcShipmentStatus(position);
    }

    function onLocationError(error) {
        currentShipment.status == "Not tracked";
        saveShipment(JSON.parse(JSON.stringify(currentShipment)), function () {
        });
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
        center: mapCenter,
        zoom: 3,
        disableDefaultUI: true
    };
    map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);
    service = new google.maps.places.PlacesService(map);

    directionsDisplay = new google.maps.DirectionsRenderer();
    directionsDisplay.setMap(map);
    directionsDisplay.setOptions({
        suppressMarkers: true
    });

    //user marker creation
    userMarker = new google.maps.Marker({
        position: user,
        map: map,
        icon: 'images/user_marker.png'
    });
    addAllStartMarkers(map);
    $('#map_canvas').gmap('refresh');
    
    if(getLastShipmentStatus() == "in progress" || getLastShipmentStatus() == "paused"){
        currentPage = TRAVEL_PAGE;
        beginTrackingPagePreload();
        startTrackingUserPosition();
        lastTime = getTimer();
        hideMarkers(map);
        $("#next-div").css("visibility","visible");
        console.log("status " + getLastShipmentStatus());
        if(getLastShipmentStatus() == "paused"){
            pauseTracking();
            var h = lastTime[0];
            var m = lastTime[1];
            var s = lastTime[2];
            if (h < 10) h = "0" + h;
            if (m < 10) m = "0" + m;
            if (s < 10) s = "0" + s;
            $("#timer").text(h + ':' + m + ':' + s);
        }
    }
};

// onError Callback receives a PositionError object
function onErrorGetUserPosition(error) {
    //map creation
    var mapOptions = {
        center: mapCenter,
        zoom: 3,
        disableDefaultUI: true
    };
    map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);
    service = new google.maps.places.PlacesService(map);
    directionsDisplay = new google.maps.DirectionsRenderer();
    directionsDisplay.setMap(map);
    directionsDisplay.setOptions({
        suppressMarkers: true
    });

    addAllStartMarkers(map);
    $('#map_canvas').gmap('refresh');

    if(getLastShipmentStatus() == "in progress" || getLastShipmentStatus() == "paused"){
        currentPage = TRAVEL_PAGE;
        beginTrackingPagePreload();
        startTrackingUserPosition();
        lastTime = getTimer();
        hideMarkers(map);
        $("#next-div").css("visibility","visible");
        console.log("status " + getLastShipmentStatus());
        if(getLastShipmentStatus() == "paused"){
            pauseTracking();
            var h = lastTime[0];
            var m = lastTime[1];
            var s = lastTime[2];
            if (h < 10) h = "0" + h;
            if (m < 10) m = "0" + m;
            if (s < 10) s = "0" + s;
            $("#timer").text(h + ':' + m + ':' + s);
        }
    }
}

var boxes;

//builds route between markers
function calcRoute(updateMarkers) {
    console.log("calc route");
    var request = {
        origin: new google.maps.LatLng(startMarkers[selectedMarkerIndex].getPosition().lat(), startMarkers[selectedMarkerIndex].getPosition().lng()),
        destination: new google.maps.LatLng(finishMarkers[selectedMarkerIndex].getPosition().lat(), finishMarkers[selectedMarkerIndex].getPosition().lng()),
        travelMode: google.maps.DirectionsTravelMode.DRIVING
    };
    directionsService.route(request, function (response, status) {
        if (status == google.maps.DirectionsStatus.OK) {
            if (!updateMarkers) {
                currentDirectionRoute = response;
                directionsDisplay.setDirections(response);
                directionsDisplay.setMap(map);
            }
            // Box the overview path of the first route
            console.log("restaurant status " + getRestaurantMarkerStatus());
            var path = response.routes[0].overview_path;
            boxes = rboxer.box(path, restaurantDistance);
            restaurantMarkers = new Array(boxes.length);
            if (getRestaurantMarkerStatus() == "enabled") {
                google.maps.event.addListener(map, 'idle', mapIdleListener);
                google.maps.event.addListener(map, 'zoom_changed', mapZoomListener);
            }
        }
    });
}

var mapIdleListener = function(){
    var zoom = map.getZoom();

    if(boxes && zoom > zoomLevel) {
        var mapBounds = map.getBounds();
        for (var i = 0; i < boxes.length; i++) {
            var bounds = boxes[i];
            if (mapBounds.intersects(bounds)) {
                if (restaurantMarkers[i]) {
                    showPOIbyIndex(i);
                } else {
                    createPOIMarkers(bounds, i);
                }
            }else{
                if (restaurantMarkers[i] !== undefined) {
                    hidePOIbyIndex(i);
                }
            }
        }
    }
};

var mapZoomListener = function () {
    var zoom = map.getZoom();
    console.log("zoom level " + zoom);
    if (zoom <= zoomLevel) {
        hideRestaurantMarkers();
    }
};

//sets timers value
function setTimerValue() {
    lastTime[2]++;
    if (lastTime[2] == 59) {
        lastTime[2] = 0;
        lastTime[1]++;
        if (lastTime[1] == 59) {
            lastTime[1] = 0;
            lastTime[0]++;
        }
    }
    var h = lastTime[0];
    var m = lastTime[1];
    var s = lastTime[2];
    if (h < 10) h = "0" + h;
    if (m < 10) m = "0" + m;
    if (s < 10) s = "0" + s;
    $("#timer").text(h + ':' + m + ':' + s);
    saveTimer(lastTime,new Date().getTime());
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
    confirmInfobox.open(map, finishMarkers[selectedMarkerIndex]);
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
    directionsDisplay.setDirections(currentDirectionRoute);
    directionsDisplay.setMap(map);
    confirmInfobox.close();
    confirmInfobox.setMap(null);
    isConfirmBoxOpen = false;
}

function setConfirmAddressText() {
    console.log("addresses: " + JSON.stringify(addresses));
    $("#confirm-start-address").html(addressFormat(addresses[selectedMarkerIndex].start));
    $("#confirm-finish-address").html(addressFormat(addresses[selectedMarkerIndex].finish));
}

function setPushNotifiAddressText(index) {
    $("#start-address").html(addressFormat(addresses[index].start));
    $("#finish-address").html(addressFormat(addresses[index].finish));
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


function calcShipmentStatus(position) {

    //gets address by position
    geocoder.geocode({'latLng': new google.maps.LatLng(position.coords.latitude, position.coords.longitude)}, function (results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            $.mobile.loading("show");
            console.log("position " + JSON.stringify(results[0]));
            Kinvey.DataStore.save('shipment-checkins', {
                address: results[0].formatted_address,
                shipment_id: currentShipment._id,
                position: {
                    lat: results[0].geometry.location.A,
                    lon: results[0].geometry.location.F
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
    var origin = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
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
            console.log("response " + JSON.stringify(response));
            var checkin_distance = response.rows[0].elements[0].distance.value;
            console.log("checkin distance " + checkin_distance);
            if (currentShipment.route.distance > checkin_distance) {
                currentShipment.status = ((1 - checkin_distance / currentShipment.route.distance) * 100).toFixed(0) + "%";
            } else {
                currentShipment.status = "0%";
            }
            saveShipment(JSON.parse(JSON.stringify(currentShipment)), function () {
            });
        }
    }
};
