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
var activeInfoWindow;

function addAllStartMarkers(map) {
    console.log("add all markers");
    var startMarker;
    var finishMarker;
    var routeAddresses;
    for (var i in shipments) {
        if((getLastShipmentStatus() == "in progress"||getLastShipmentStatus() == "paused") && shipments[i]._id == getLastShipmentId()){
            currentShipment = shipments[i];
            selectedMarkerIndex = i;
            isStartMarkerSelected = true;
        }
        if (!!shipments[i].route) {
            routeAddresses = {
                start: shipments[i].route.start,
                finish: shipments[i].route.finish
            };
            addresses.push(routeAddresses);

            //creates start marker
            startMarker = new google.maps.Marker({
                position: new google.maps.LatLng(shipments[i].route.start_lat, shipments[i].route.start_long),
                map: map,
                icon: 'images/start_marker.png'
            });
            startMarkers.push(startMarker);

            //add start marker click listener
            google.maps.event.addListener(startMarker, 'click', function () {
                if (!isStartMarkerSelected) {
                    $("#alertcontainer").css("display", "block");
                    $("#message-confirm").css("display", "block");
                    $("#step-number-label").text("Step 1");
                    $("#step-name-label").text("Pickup");
                    selectedMarkerIndex = startMarkers.indexOf(this);
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
            finishMarker = new google.maps.Marker({
                position: new google.maps.LatLng(shipments[i].route.finish_lat, shipments[i].route.finish_long),
                map: map,
                icon: 'images/finish_marker.png'
            });
            finishMarker.setMap(null);
            finishMarkers.push(finishMarker);
        }
    }
}

//hides all markers on map except selected
function hideMarkers(map) {
    clearMarkers();
    startMarkers[selectedMarkerIndex].setMap(map);
    finishMarkers[selectedMarkerIndex].setMap(map);
}

//hides all markers
function clearMarkers() {
    setAllMap(null);
    clearFinishMarkers();
}

//hides finish markers
function clearFinishMarkers() {
    for (var i = 0; i < finishMarkers.length; i++) {
        if (!!finishMarkers[i]) {
            finishMarkers[i].setMap(null);
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
    console.log("markers count " + startMarkers.length);
    for (var i = 0; i < startMarkers.length; i++) {
        if (!!startMarkers[i]) {
            startMarkers[i].setMap(map);
        }
    }
}

function clearRestaurantMarkers() {
    hideRestaurantMarkers();
    google.maps.event.clearListeners(map, 'idle');
    google.maps.event.clearListeners(map, 'zoom_change');
    restaurantMarkers = [];
}

function createRestaurantMarker(place, index){
    var placeLoc = place.geometry.location;
    var marker=new google.maps.Marker({
        map: map,
        position: placeLoc,
        clickable: true
    });

    var name = "";
    var address = "";
    var phoneNumber = "";

    if(place.name){
        name = place.name;
    }

    if(place.vicinity){
        address = place.vicinity;
    }

    if(place.international_phone_number){
        phoneNumber = place.international_phone_number;
    }

    marker.info = new google.maps.InfoWindow({
        content:  '<p>' + name + '<br/> ' +address+'<br/>' + phoneNumber + '</p>'
    });

    google.maps.event.addListener(marker, 'click', function() {
        if(activeInfoWindow){
            activeInfoWindow.close();
        }
        activeInfoWindow = marker.info;
        marker.info.open(map, marker);
    });


    if(map.getZoom() < zoomLevel){
        marker.setVisible(false);
    }
    restaurantMarkers[index].push(marker);
    return marker;
}


function showPOIbyIndex(index) {
    for (var j = 0; j < restaurantMarkers[index].length; j++) {
        if (restaurantMarkers[index][j]) {
            restaurantMarkers[index][j].setVisible(true);
        }
    }
}

function hidePOIbyIndex(index) {
    for (var j = 0; j < restaurantMarkers[index].length; j++) {
        if (restaurantMarkers[index][j]) {
            restaurantMarkers[index][j].setVisible(false);
        }
    }
}

function showRestaurantMarkers(){
    for (var i = 0; i < restaurantMarkers.length; i++) {
        for(var j=0;j < restaurantMarkers[i].length;j++) {
            restaurantMarkers[i][j].setVisible(true);
        }
    }
}

function hideRestaurantMarkers(){
    console.log("hide restaurant markers");
    for (var i = 0; i < restaurantMarkers.length; i++) {
        if(restaurantMarkers[i]) {
            for (var j = 0; j < restaurantMarkers[i].length; j++) {
                if (restaurantMarkers[i][j]) {
                    restaurantMarkers[i][j].setVisible(false);
                    restaurantMarkers[i][j].info.close();
                }
            }
        }
    }
}

function createPOIMarkers(boundsLatLng, index) {
    var request = {
        bounds: boundsLatLng,
        types: ['airport', 'bank', "department_store", "embassy", "gas_station",
            "hospital", "library", "pharmacy", "post_office", "university"]
    };

    if (getRestaurantMarkerStatus() == "enabled") {
        service.search(request, function (results, status) {
            if (status == google.maps.places.PlacesServiceStatus.OK) {
                var markerCount = 4;
                if (results.length < 4) {
                    markerCount = results.length;
                }
                if (!restaurantMarkers[index]) {
                    restaurantMarkers[index] = new Array(markerCount);
                }
                console.log("marker count " + markerCount);
                for (var i = 0; i < markerCount; i++) {
                    if (results[i]) {
                        createRestaurantMarker(results[i], index);
                    }
                }
            }
        });
    }
}