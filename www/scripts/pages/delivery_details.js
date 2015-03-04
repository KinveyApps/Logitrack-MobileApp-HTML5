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
                                setLastShipmentStatus("done");
                                clearTimer();
                                clearRestaurantMarkers();
                                $("#timer").text('00:00:00');
                                saveShipment(JSON.parse(JSON.stringify(currentShipment)), function (data) {
                                    $("#tracking-state").css("visibility", "hidden");
                                    $("#green-circle-right").css("visibility", "hidden");
                                    $("#green-circle-left").css("visibility", "visible");
                                    clearInterval(my_timer);
                                    confirm_infobox.close();
                                    confirm_infobox.setMap(null);
                                    isConfirmBoxOpen = false;
                                    isFirstStart = true;
                                    loadShipment();
                                    isDeliveryComplitedClicked = true;
                                });
                            }
                        },
                        "Change route status", ["OK", "Cancel"]);
                    break;
            }

        });
    },
    pageshow: function () {
    }
});

//reject route functionality
function rejectRoute() {
    navigator.notification.confirm("Do you really want to reject route",
        function (button) {
            if (button == 1) {
                currentShipment.user_status = "rejected";
                saveShipment(JSON.parse(JSON.stringify(currentShipment)), function (data) {
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

