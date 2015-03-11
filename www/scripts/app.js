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

var active_user;
var current_page = 1;
var pickup_route_page = 1;
var travel_page = 2;
var delivery_details_begin_tracking_page = 3;
var delivery_details_confirm_delivery_page = 4;
var login_page = 5;
var signature_page = 6;
var user_profile_page = 7;
var open_dispatches_page = 8;
var currentShipment = null;
var isStartMarkerSelected = false;
var isConfirmDeliveryPage = false;
var isDeliveryComplitedClicked = false;
var isBackPressed = false;
var isConfirmBoxOpen = false;
var infobox;
var confirm_infobox;
var current_direction_route = null;
var isNewLogin = false;
var mapCenter = new google.maps.LatLng(40.111689,-96.943359);

function onDeviceReady() {
    console.log("device plat " + device.platform);
    if (device.platform === "iOS") {
        $("#pickup-route-header").addClass("ios");
        $("#user-profile").addClass("ios-full-page-content");
        $("#user-profile-header").addClass("ios");
        $("#delivery-header").addClass("ios");
        $("#map_canvas").addClass("ios-content");
        $("#delivery-details-content").addClass("ios-delivery-content");
        $("#profile-back").addClass("ios-back-arrow");
        $("#signature-back").addClass("ios-back-arrow");
        $("#profile-title").addClass("ios-profile-title");
        $("#profile-edit").addClass("ios-profile-edit");

    } else {
        $("#user-profile").addClass("full-page-content");
    }
    window.location.hash = 'splash';
    $.mobile.initializePage();

    document.addEventListener("backbutton", onBackKeyDown, false);
    createInfoboxes();
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
}

var loadingHide = function () {
    $.mobile.loading("hide");
};

//Android back button listener
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
        case open_dispatches_page:
            $.mobile.back({
                transition: "slide"
            });
            break;
    }
}

//infoboxes initialization
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


//shipment saving function
function saveShipment(shipment, cb) {
    $.mobile.loading("show");

    //Kinvey save shipment starts
    Kinvey.DataStore.save('shipment',
        shipment, {
            relations: {
                'route': 'route'
            },
            success: function (response) {
                cb(response);
            },
            error: function (error) {
                console.log("save shipment with error " + JSON.stringify(error));
            }
        }).then();
}

//Load route
var loadShipment = function() {
    if(getPushStatus() == 'enabled') {
    //if(getDeviceId() == null && getPushStatus() == 'enabled') {
        registerPushNotifications();
    }
    $.mobile.loading("show");
    //TODO modify query
    var user = Kinvey.getActiveUser();
    var query = new Kinvey.Query();
    query.equalTo('user_status', 'open').or().equalTo('user_status', 'in progress').or().equalTo('user_status', 'paused');
    query.equalTo("driver._id", user._id);
    query.exists('route');
    query.descending("_kmd.ect");

    //Kinvey get shipments that have route starts
    Kinvey.DataStore.find('shipment', query, {
        relations: {
            //'checkins': 'shipment-checkins',
            'route': 'route'
        },
        success: function (data) {
            if (data.length == 0) {
                shipments = [];
                currentShipment = {};
                clearMarkers();
                finish_markers = [];
                start_markers = [];
                addresses = [];
                selectedMarkerIndex = 0;
                isStartMarkerSelected = false;
                lastUserPosition = null;
                last_time = [0, 0, 0];
                isConfirmDeliveryPage = false;
                isBackPressed = false;
                isConfirmBoxOpen = false;
                current_avatar_data_uri = null;
                start_avatar_data_uri = null;
                current_direction_route = null;
                navigator.geolocation.getCurrentPosition(onSuccessGetUserPosition, onErrorGetUserPosition);
                $('#green-circle-left').css('visibility', "visible");
                $('#green-circle-central').css('visibility', "hidden");
                $('#green-circle-right').css('visibility', "hidden");
                $('#play-btn').css('visibility', "hidden");
                $('#pause-btn').css('visibility', "hidden");
                clearInterval(my_timer);
                stopTrackingUserPosition();
                $("#timer").css('visibility', "hidden");
                $("#tracking-state").css('visibility', "hidden");
                $("#tracking-state").text("TRACKING ON");
                $("#tracking-state").css("color", "rgb(65,226,65)");
                isNewLogin = false;
                navigator.notification.alert("You do not have any pending dispatches.",function(){},'Empty list of dispatches','OK');
                $.mobile.changePage(pickup);
            } else {
                console.log("shipments " + JSON.stringify(data));
                //reinitialization main pickup screen variables
                shipments = data;
                currentShipment = data[0];
                current_page = pickup_route_page;
                if (isDeliveryComplitedClicked || isNewLogin) {
                    clearMarkers();
                    finish_markers = [];
                    start_markers = [];
                    addresses = [];
                    selectedMarkerIndex = 0;
                    isStartMarkerSelected = false;
                }
                if (isDeliveryComplitedClicked) {
                    addAllStartMarkers(map);
                    map.setCenter(mapCenter);
                    map.setZoom(3);
                    isDeliveryComplitedClicked = false;
                }
                if (isNewLogin) {
                    lastUserPosition = null;
                    directionsDisplay.setMap(null);
                    last_time = [0, 0, 0];
                    isConfirmDeliveryPage = false;
                    isBackPressed = false;
                    isConfirmBoxOpen = false;
                    current_avatar_data_uri = null;
                    start_avatar_data_uri = null;
                    current_direction_route = null;
                    navigator.geolocation.getCurrentPosition(onSuccessGetUserPosition, onErrorGetUserPosition);
                    $('#green-circle-left').css('visibility', "visible");
                    $('#green-circle-central').css('visibility', "hidden");
                    $('#green-circle-right').css('visibility', "hidden");
                    $('#play-btn').css('visibility', "hidden");
                    $('#pause-btn').css('visibility', "hidden");
                    clearInterval(my_timer);
                    stopTrackingUserPosition();
                    $("#timer").css('visibility', "hidden");
                    $("#tracking-state").css('visibility', "hidden");
                    $("#tracking-state").text("TRACKING ON");
                    $("#tracking-state").css("color", "rgb(65,226,65)");
                    isNewLogin = false;
                }
                console.log("changePage pickup 1");
                $.mobile.changePage(pickup);
            }
        }
    }).then(loadingHide, loadingHide);
};


