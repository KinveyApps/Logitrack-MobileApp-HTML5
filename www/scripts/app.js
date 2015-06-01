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

var activeUser;
var currentPage = 1;
var PICKUP_ROUTE_PAGE = 1;
var TRAVEL_PAGE = 2;
var DELIVERY_DETAILS_BEGIN_TRACKING_PAGE = 3;
var DELIVERY_DETAILS_CONFIRM_DELIVERY_PAGE = 4;
var LOGIN_PAGE = 5;
var SIGNATURE_PAGE = 6;
var USER_PROFILE_PAGE = 7;
var OPEN_DISPATCHES_PAGE = 8;
var currentShipment = null;
var isStartMarkerSelected = false;
var isConfirmDeliveryPage = false;
var isDeliveryComplitedClicked = false;
var isBackPressed = false;
var isConfirmBoxOpen = false;
var infobox;
var confirmInfobox;
var currentDirectionRoute = null;
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

    var promise = Kinvey.init({
        appKey: 'MY_APP_KEY',
        appSecret: 'MY_APP_SECRET',
        refresh: navigator.onLine,
        sync: {
            enable: true,
            online: navigator.onLine
        }
    });

    promise.then(function (user) {
            activeUser = user;
            console.log("init active user " + JSON.stringify(user));
            if (null !== activeUser) {
                loadShipment();
            } else {
                console.log("changePage login");
                currentPage = LOGIN_PAGE;
                $.mobile.changePage(loginPage);
            }
        },
        function (error) {
            navigator.notification.alert(error.description, function () {
            }, 'Kinvey initialization failed', 'OK');
        });

    $(window).on({
        offline: Kinvey.Sync.offline,
        online: function () {
            if (navigator.onLine) {
                setTimeout(function () {
                    Kinvey.Sync.online({
                        conflict: Kinvey.Sync.clientAlwaysWins
                    });
                    uploadOfflineSignatures(function () {
                        offlineSignatures = [];
                        setOfflineSignatures();
                    });
                    clearedOfflineSignatures(function () {
                        clearedSignatures = [];
                        setClearedSignatures();
                    });
                }, 2000);
            } else {
                Kinvey.Sync.offline();
            }
        }
    });
}

var loadingHide = function () {
    $.mobile.loading("hide");
};

//Android back button listener
function onBackKeyDown() {
    switch (currentPage) {
        case TRAVEL_PAGE:
            rejectRoute();
            isBackPressed = true;
            break;
        case PICKUP_ROUTE_PAGE:
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
        case LOGIN_PAGE:
            navigator.app.exitApp();
            break;
        case DELIVERY_DETAILS_BEGIN_TRACKING_PAGE:
            $.mobile.back({
                transition: "slide"
            });
            isBackPressed = true;
            break;
        case DELIVERY_DETAILS_CONFIRM_DELIVERY_PAGE:
            $.mobile.back({
                transition: "slide"
            });
            isBackPressed = true;
            break;
        case SIGNATURE_PAGE:
            $.mobile.back({
                transition: "slide"
            });
            break;
        case USER_PROFILE_PAGE:
            userProfileBack();
            break;
        case OPEN_DISPATCHES_PAGE:
            $.mobile.back({
                transition: "slide"
            });
            break;
    }
}

//infoboxes initialization
function createInfoboxes() {
    confirmInfobox = new InfoBox({
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
    google.maps.event.addListener(confirmInfobox, 'domready', function (e) {
        $("#confirm-infobox-arrow-btn").on("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("changePage delivery details 3");
            currentPage = DELIVERY_DETAILS_CONFIRM_DELIVERY_PAGE;
            $.mobile.changePage(deliveryDetailsPage, {
                transition: "slide"
            });
        });
        google.maps.event.clearListeners(confirmInfobox, 'domready');
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
            currentPage = DELIVERY_DETAILS_BEGIN_TRACKING_PAGE;
            $.mobile.changePage(deliveryDetailsPage, {
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
        }).then(loadingHide, loadingHide);
}

//Load route
function loadShipment() {
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
                finishMarkers = [];
                startMarkers = [];
                addresses = [];
                selectedMarkerIndex = 0;
                isStartMarkerSelected = false;
                lastUserPosition = null;
                lastTime = [0, 0, 0];
                isConfirmDeliveryPage = false;
                isBackPressed = false;
                isConfirmBoxOpen = false;
                currentAvatarDataUri = null;
                startAvatarDataUri = null;
                currentDirectionRoute = null;
                navigator.geolocation.getCurrentPosition(onSuccessGetUserPosition, onErrorGetUserPosition);
                $('#green-circle-left').css('visibility', "visible");
                $('#green-circle-central').css('visibility', "hidden");
                $('#green-circle-right').css('visibility', "hidden");
                $('#play-btn').css('visibility', "hidden");
                $('#pause-btn').css('visibility', "hidden");
                clearInterval(timer);
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
                currentPage = PICKUP_ROUTE_PAGE;
                if (isDeliveryComplitedClicked || isNewLogin) {
                    clearMarkers();
                    finishMarkers = [];
                    startMarkers = [];
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
                    lastTime = [0, 0, 0];
                    isConfirmDeliveryPage = false;
                    isBackPressed = false;
                    isConfirmBoxOpen = false;
                    currentAvatarDataUri = null;
                    startAvatarDataUri = null;
                    currentDirectionRoute = null;
                    navigator.geolocation.getCurrentPosition(onSuccessGetUserPosition, onErrorGetUserPosition);
                    $('#green-circle-left').css('visibility', "visible");
                    $('#green-circle-central').css('visibility', "hidden");
                    $('#green-circle-right').css('visibility', "hidden");
                    $('#play-btn').css('visibility', "hidden");
                    $('#pause-btn').css('visibility', "hidden");
                    clearInterval(timer);
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
}


function uploadOfflineSignatures(callback) {
    console.log("offline signatures " + JSON.stringify(offlineSignatures));
    for (var id in offlineSignatures) {
        if (offlineSignatures.hasOwnProperty(id)) {
            (function (id) {
                var offlineSignature = offlineSignatures[id];
                var signatureBase64 = offlineSignature.signatureBase64;
                signatureBase64 = signatureBase64.substr(signatureBase64.indexOf(',') + 1);
                console.log("start update " + signatureBase64);
                var signatureArrayBuffer = _base64ToArrayBuffer(signatureBase64);
                $.mobile.loading("show");
                //Kinvey save avatar image file starts
                var promise = Kinvey.File.upload(signatureArrayBuffer, {
                    mimeType: 'image/png',
                    size: signatureBase64.length,
                    sig: offlineSignature.sig
                }, {
                    success: function (file) {
                        offlineSignature.shipment.signature = {
                            _type: 'KinveyFile',
                            _id: file._id,
                            sig: file.sig
                        };
                        saveShipment(JSON.parse(JSON.stringify(offlineSignature.shipment)), function (data) {
                        });
                    },
                    error: function (error) {
                        console.log("error " + JSON.stringify(error));
                    }
                }).then(loadingHide, loadingHide);
            })(id)
        }
    }
    callback();
}

function clearedOfflineSignatures(callback) {
    for (var id in clearedSignatures) {
        if (clearedSignatures.hasOwnProperty(id)) {
            (function (id) {
                var offlineSignature = clearedSignatures[id];
                $.mobile.loading("show");
                var promise = Kinvey.File.destroy(offlineSignature.signature_id);
                promise.then(function () {
                    delete offlineSignature.shipment.signature;
                    saveShipment(JSON.parse(JSON.stringify(offlineSignature.shipment)), function (data) {
                    });
                }, function (err) {
                    console.log("delete signature error");
                }).then(loadingHide, loadingHide);
            })(id)
        }
    }
    callback();
}
