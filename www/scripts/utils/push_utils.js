var notificationShipmentId;


function registerPushNotifications() {
    if ('android' === device.platform.toLowerCase()) {
        window.plugins.pushNotification.register(function () {
            console.log("register with success ");
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
        saveDeviceId(e.regid);
        registrationHandler(e.regid);// Register with Kinvey.
    }
    else if ('message' === e.event) {
        console.log("message format " + JSON.stringify(e));
        var user = Kinvey.getActiveUser();
        var query = new Kinvey.Query();
        query.equalTo('user_status', 'open');
        query.equalTo("driver._id", user._id);
        query.exists('route');
        query.descending("_kmd.ect");
        query.limit(1);

        //Kinvey get shipments that have route starts
        Kinvey.DataStore.find('shipment', query, {
            relations: {
                'checkins': 'shipment-checkins',
                'route': 'route'
            }, success: function (data) {
                var newShipment = data[0];

                shipments.unshift(newShipment);
                if (newShipment.route) {
                    var route_addresses = {
                        start: newShipment.route.start,
                        finish: newShipment.route.finish
                    };
                    addresses.unshift(route_addresses);

                    //creates start marker
                    var start_marker = new google.maps.Marker({
                        position: new google.maps.LatLng(newShipment.route.start_lat, newShipment.route.start_long),
                        map: map,
                        icon: 'images/start_marker.png'
                    });
                    start_markers.unshift(start_marker);

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

                    navigator.notification.alert("You have a new pickup. Please go to your dispatch list to accept.",function(){},'New pickup','OK');
                    showMarkers();

                    //creates finish marker
                    var finish_marker = new google.maps.Marker({
                        position: new google.maps.LatLng(newShipment.route.finish_lat, newShipment.route.finish_long),
                        map: map,
                        icon: 'images/finish_marker.png'
                    });
                    finish_marker.setMap(null);
                    finish_markers.unshift(finish_marker);
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
    saveDeviceId(deviceId);
    savePushStatus("enabled");
    if (null === Kinvey.getActiveUser()) {
        // Error: there must be a logged-in user.
    }
    else {
        Kinvey.Push.register(deviceId).then(function () {
        }, function (error) {
            // Error registering device with Kinvey.
        })
    }
};
function unregisterPushNotifications() {

    window.plugins.pushNotification.unregister(function () {
        console.log("unregister with success");
    });
    console.log("device Id " + getDeviceId());
    var deviceId = getDeviceId();
    Kinvey.Push.unregister(deviceId).then(function() {
        console.log("unregister with success ");
        savePushStatus('disabled');
        saveDeviceId(null);
    },function(error){
        console.log("unregistered with error " + JSON.stringify(error));
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
