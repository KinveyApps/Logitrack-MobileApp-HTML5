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

//add all start markers on map
function addAllStartMarkers(map) {
    console.log("add all markers");
    var start_marker;
    var finish_marker;
    var route_addresses;
    for (var i in shipments) {
        if((getLastShipmentStatus() == "in progress"||getLastShipmentStatus() == "paused") && shipments[i]._id == getLastShipmentId()){
            currentShipment = shipments[i];
            selectedMarkerIndex = i;
            isStartMarkerSelected = true;
        }
        if (!!shipments[i].route) {
            route_addresses = {
                start: shipments[i].route.start,
                finish: shipments[i].route.finish
            };
            addresses.push(route_addresses);

            //creates start marker
            start_marker = new google.maps.Marker({
                position: new google.maps.LatLng(shipments[i].route.start_lat, shipments[i].route.start_long),
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

            //if (shipments[i]._id == notificationShipmentId) {
            //    $("#alertcontainer").css("display", "block");
            //    $("#messagefg").css("display", "block");
            //    setPushNotifiAddressText(i);
            //    isFirstStart = false;
            //}
            showMarkers();

            //creates finish marker
            finish_marker = new google.maps.Marker({
                position: new google.maps.LatLng(shipments[i].route.finish_lat, shipments[i].route.finish_long),
                map: map,
                icon: 'images/finish_marker.png'
            });
            finish_marker.setMap(null);
            finish_markers.push(finish_marker);
        }
    }
}

//hides all markers on map except selected
function hideMarkers(map) {
    clearMarkers();
    start_markers[selectedMarkerIndex].setMap(map);
    finish_markers[selectedMarkerIndex].setMap(map);
}

//hides all markers
function clearMarkers() {
    setAllMap(null);
    clearFinishMarkers();
}

//hides finish markers
function clearFinishMarkers() {
    for (var i = 0; i < finish_markers.length; i++) {
        if (!!finish_markers[i]) {
            finish_markers[i].setMap(null);
        }
    }
}

//shows start markers and hides finish markers
function showMarkers() {
    if (!!map) {
        setAllMap(map);
        clearFinishMarkers();
    }
}

//set visibility of start markers
function setAllMap(map) {
    console.log("markers count " + start_markers.length);
    for (var i = 0; i < start_markers.length; i++) {
        if (!!start_markers[i]) {
            start_markers[i].setMap(map);
        }
    }
}

function clearRestaurantMarkers(){
    for (var i = 0; i < restaurantMarkers.length; i++) {
        if (!!restaurantMarkers[i]) {
            restaurantMarkers[i].setMap(null);
        }
    }
}


function createRestaurantMarker(place){
    var placeLoc = place.fullResults.geometry.location;
    if (place.icon) {
        var image = new google.maps.MarkerImage(
            place.icon, new google.maps.Size(71, 71),
            new google.maps.Point(0, 0), new google.maps.Point(17, 34),
            new google.maps.Size(25, 25));
    } else var image = null;

    var marker=new google.maps.Marker({
        map:map,
        icon: image,
        position: placeLoc
    });

    restaurantMarkers.push(marker);
}