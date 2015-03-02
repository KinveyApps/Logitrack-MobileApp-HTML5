var notificationShipmentId;


function registerPushNotifications() {
    if ('android' === device.platform.toLowerCase()) {
        window.plugins.pushNotification.register(function (deviceId) {
            console.log("register with success " + deviceId);
        }, function (error) {
            console.log("push register error " + JSON.stringify(error));
        }, {
            ecb: 'onNotificationGCM',
            senderID: '<YOUR GOOGLE PROJECT NUMBER>'// Google Project Number.
        });
    }
    else {// iOS.
        window.plugins.pushNotification.register(registrationHandler, function (error) {
            // Failed to register device.
        }, {
            alert: 'true',
            badge: 'true',
            sound: 'true',
            ecb: 'onNotificationAPN'
        });
    }
}

// Method to handle device registration for Android.
var onNotificationGCM = function (e) {
    console.log("register push " + JSON.stringify(e));
    if ('registered' === e.event) {
        registrationHandler(e.regid);// Register with Kinvey.
    }
    else if ('message' === e.event) {
        console.log("message format " + JSON.stringify(e));
        console.log("shipments push " + JSON.stringify(shipments));
        var shipmentId = e.message;
        console.log("shipment id " + shipmentId);


        var user = Kinvey.getActiveUser();
        var query = new Kinvey.Query();
        query.equalTo("_id", shipmentId);
        query.equalTo('user_status', 'open');
        query.equalTo("driver._id", user._id);
        query.exists('route');
        query.descending("_kmd.ect");

        //Kinvey get shipments that have route starts
        Kinvey.DataStore.find('shipment', query, {
            relations: {
                'checkins': 'shipment-checkins',
                'route': 'route'
            }, success: function (data) {
                currentShipment = data[0];

                shipments.push(currentShipment);
                if (currentShipment.route) {
                    var route_addresses = {
                        start: currentShipment.route.start,
                        finish: currentShipment.route.finish
                    };
                    addresses.push(route_addresses);

                    //creates start marker
                    var start_marker = new google.maps.Marker({
                        position: new google.maps.LatLng(currentShipment.route.start_lat, currentShipment.route.start_long),
                        map: map,
                        icon: 'images/start_marker.png'
                    });
                    start_markers.push(start_marker);

                    //add start marker click listener
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
                    $("#alertcontainer").css("display", "block");
                    $("#messagefg").css("display", "block");
                    selectedMarkerIndex = shipments.length - 1;
                    $("#start-address").html(addressFormat(addresses[selectedMarkerIndex].start));
                    $("#finish-address").html(addressFormat(addresses[selectedMarkerIndex].finish));
                    showMarkers();

                    //creates finish marker
                    var finish_marker = new google.maps.Marker({
                        position: new google.maps.LatLng(currentShipment.route.finish_lat, currentShipment.route.finish_long),
                        map: map,
                        icon: 'images/finish_marker.png'
                    });
                    finish_marker.setMap(null);
                    finish_markers.push(finish_marker);
                }
            }

        });
    }
    else if ('error' === e.event) {
        // Failed to register device.
    }
    else {
        // Unknown event.
    }
};
// Method to handle notifications on iOS.
var onNotificationAPN = function () {
};
// Method to register device with Kinvey.
var registrationHandler = function (deviceId) {
    console.log("registration handler " + deviceId);
    if (null === Kinvey.getActiveUser()) {
        // Error: there must be a logged-in user.
    }
    else {
        Kinvey.Push.register(deviceId).then(function () {
            // Successfully registered device with Kinvey.
        }, function (error) {
            // Error registering device with Kinvey.
        })
    }
};
function unregisterPushNotifications() {

    window.plugins.pushNotification.unregister(function () {
        // Success.
        console.log("unregister with success");
    });
}

function shipmentExist(shipmentId) {
    for (var i = 0; i < shipments.length; i++) {
        if (shipments[i]._id == shipmentId) {
            return i;
        }
    }
    return -1;
}
