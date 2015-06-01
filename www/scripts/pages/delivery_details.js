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

//Delivery Details Page
var deliveryDetailsPage = $('#delivery-details');
deliveryDetailsPage.on({
    pagebeforeshow: function (event, data) {
        $("#delivery-start-address").html(addressFormat(addresses[selectedMarkerIndex].start));
        $("#delivery-finish-address").html(addressFormat(addresses[selectedMarkerIndex].finish));
        var user = Kinvey.getActiveUser();
        $("#delivery-agent").html("DELIVERY AGENT: " + user.first_name + " " + user.last_name);
        switch (currentPage) {
            case DELIVERY_DETAILS_CONFIRM_DELIVERY_PAGE:
                $("#delivered-state").removeClass("delivery-icon-empty-circle");
                $("#delivered-state").addClass("delivery-icon-yes-circle");
                $("#signature-arrow-btn").removeClass("delivery-icon-arrow");
                $("#signature-arrow-btn").addClass("delivery-icon-arrow-enable");
                $("#begin-tracking-btn").text("Delivery Complete");
                $("#cancel-pickup-btn").text("Cancel Delivery");
                break;
            case DELIVERY_DETAILS_BEGIN_TRACKING_PAGE:
                $("#delivered-state").removeClass("delivery-icon-yes-circle");
                $("#delivered-state").addClass("delivery-icon-empty-circle");
                $("#begin-tracking-btn").text("Begin Tracking");
                $("#cancel-pickup-btn").text("Cancel Pickup");
                $("#signature-arrow-btn").removeClass("delivery-icon-arrow-enable");
                $("#signature-arrow-btn").addClass("delivery-icon-arrow");
                break;
            case SIGNATURE_PAGE:
                currentPage = DELIVERY_DETAILS_CONFIRM_DELIVERY_PAGE;
                break;
        }
    },
    pageinit: function () {
        deliveryDetailsPage.on('click', '#delivery-details-back', function () {
            isBackPressed = true;
            console.log("changePage pickup 2 ");
            $.mobile.back({
                transition: "slide"
            });
        });

        deliveryDetailsPage.on('click', '#signature-arrow-btn', function () {
            if ($(this).hasClass("delivery-icon-arrow-enable")) {
                console.log("changePage signature");
                currentPage = SIGNATURE_PAGE;
                $.mobile.changePage(signaturePage, {
                    transition: "slide"
                });
            }
        });

        deliveryDetailsPage.on('click', '#cancel-pickup-btn', function () {
            switch (currentPage) {
                case DELIVERY_DETAILS_CONFIRM_DELIVERY_PAGE:
                    rejectRoute();
                    break;
                case DELIVERY_DETAILS_BEGIN_TRACKING_PAGE:
                    currentPage = PICKUP_ROUTE_PAGE;
                    console.log("changePage pickup 4");
                    $.mobile.back({
                        transition: "slide"
                    });
                    break;
            }
        });

        deliveryDetailsPage.on('click', '#begin-tracking-btn', function () {
            switch ($('#begin-tracking-btn').text()) {
                case "Begin Tracking":
                    currentPage = TRAVEL_PAGE;
                    console.log("changePage pickup 5");
                    $.mobile.changePage(pickup);
                    break;
                case "Delivery Complete":
                    if((currentShipment.signature && currentShipment.signature._id) || offlineSignatures[currentShipment._id]) {
                        navigator.notification.confirm("Do you really want to mark route as \"Done\"",
                            function (button) {
                                if (button == 1) {
                                    currentPage = PICKUP_ROUTE_PAGE;
                                    currentShipment.user_status = "done";
                                    setLastShipmentStatus("done");
                                    clearTimer();
                                    clearRestaurantMarkers();
                                    $("#timer").text('00:00:00');
                                    saveShipment(JSON.parse(JSON.stringify(currentShipment)), function (data) {
                                        $("#tracking-state").css("visibility", "hidden");
                                        $("#green-circle-right").css("visibility", "hidden");
                                        $("#green-circle-left").css("visibility", "visible");
                                        clearInterval(timer);
                                        confirmInfobox.close();
                                        confirmInfobox.setMap(null);
                                        isConfirmBoxOpen = false;
                                        isFirstStart = true;
                                        loadShipment();
                                        isDeliveryComplitedClicked = true;
                                    });
                                }
                            },
                            "Change route status", ["OK", "Cancel"]);
                    }else{
                        navigator.notification.alert("Please sign the delivery",function(){},'','OK');
                    }
                    break;
            }

        });
    },
    pageshow: function () {
    }
});

//reject route functionality
function rejectRoute() {
    navigator.notification.confirm("Are you sure you would like to cancel delivery?",
        function (button) {
            if (button == 1) {
                currentShipment.user_status = "open";
                saveShipment(JSON.parse(JSON.stringify(currentShipment)), function (data) {
                    $("#tracking-state").css("visibility", "hidden");
                    $("#green-circle-right").css("visibility", "hidden");
                    $("#green-circle-left").css("visibility", "visible");

                    clearInterval(timer);
                    confirmInfobox.close();
                    confirmInfobox.setMap(null);
                    isConfirmBoxOpen = false;
                    isFirstStart = true;
                    setLastShipmentStatus("open");
                    clearRestaurantMarkers();
                    directionsDisplay.setMap(null);
                    console.log("changePage pickup 3");
                    currentPage = PICKUP_ROUTE_PAGE;
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

