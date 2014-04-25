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
/* global $: true, Kinvey: true */
(function () {
    'use strict';

    var active_user;
    // Setup.
    // ------
    var loadingHide = function () {
        $.mobile.loading("hide");
    }
    var locationWatchId = null;
    var currentShipment = null;
    var shipments = null;
    var start_markers = [];
    var finish_markers = [];
    var addresses = [];
    var selectedMarkerIndex = 0;
    var lastUserPosition = null;
    var map;
    var infobox;
    var geocoder = new google.maps.Geocoder();
    var isStartMarkerSelected = false;
    var isCancelClicked = false;
    //shipment saving function
    function saveShipment(shipment, cb) {
        $.mobile.loading("show");
        Kinvey.DataStore.save('shipment', currentShipment, {
            relations: {
                'checkins': 'shipment-checkins',
                'route': 'route'
            },

            success: function (response) {
                cb(response);
            }
        }).then(loadingHide, loadingHide);
    }
    // Initialize Kinvey.
    var promise = Kinvey.init({
        appKey: 'kid_VTpS9qbe7q',
        appSecret: '5ae17c3bd8414d7f917c59a1c14a8fcd',
        sync: {
            enable: true,
            online: navigator.onLine
        }
    });
    promise.then(function (activeUser) {
        // Preload templates.
        active_user = activeUser;
        //        if (null !== activeUser) {
        //                 loadShipment();
        //                    $.mobile.loading("show");
        //                 $.mobile.changePage(pickup);
        //        }
    }).then(function () {
        $.when([
            $.Mustache.load('templates/search.html'),
            $.Mustache.load('templates/checkins.html')

        ]).then(function () {
            $.mobile.initializePage(); // Render page.	
        });
    }, function () {
        alert('cant connect to server');
    });

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


    // Default mustache data filters.
    var mustacheData = {
        self: function () {
            return this.author._id === Kinvey.getActiveUser()._id ||
                (null != this.recipient && this.recipient._id === Kinvey.getActiveUser()._id);
        },
        date: function () {
            return new Date(this._kmd.lmt).toUTCString();
        },
        isSelect: function () {
            return this.type == "select";
        },
        isCheckbox: function () {
            return this.type == 'checkbox';
        }
    };
    //Load route
    function loadShipment() {
        $.mobile.loading("show");
        Kinvey.DataStore.find('shipment', null, {
            relations: {
                'checkins': 'shipment-checkins',
                'route': 'route'
            },
            success: function (data) {
                if (data.length == 0) {
                    alert("No route found");
                } else {
                    shipments = data;
                    currentShipment = data[0];
                }
                $.mobile.changePage(pickup);
            }
        }).then(loadingHide, loadingHide);
    }

    var splash = $('#splash');
    splash.on({

        pageinit: function () {
            if (null !== active_user) {
                loadShipment();
            } else {
                $.mobile.changePage(login);
            }
        }
    });


    // Login.
    // -----
    var login = $('#login');
    login.on({
        pageinit: function () {

            login.on('click', '#login-label', function () {
                console.log("user creds : " + $('#username-input').val() + "   " + $('#password-input').val());
                $.mobile.loading("show");
                var promise = Kinvey.User.login({
                    username: $('#username-input').val(),
                    password: $('#password-input').val(),
                });

                promise.then(function (response) {
                    loadShipment();
                }, function (error) {
                    console.log("login error " + JSON.stringify(error));
                    alert(error.description);
                }).then(loadingHide, loadingHide);
            });

        }
    });


    var pickup = $('#pickup-route');
    pickup.on({
        pagebeforeshow: function (event, data) {
            if (isCancelClicked) {
                $("#step-name-label").text("Tap to Browse Different Pickups");
                $("#step-number-label").text("Waiting for Delivery");
                $("#next-label").css("visibility", "hidden");
                showMarkers();
                isStartMarkerSelected = false;
                isCancelClicked = false;
                infobox.close();
            }
        },
        pageinit: function () {
            $('#map_canvas').gmap({
                'zoom': 10,
                'disableDefaultUI': true,
                'callback': function () {}
            });

            pickup.on('click', '#next-btn', function () {
                console.log("click next button");
                if (isStartMarkerSelected) {
                    $.mobile.changePage(delivery_details, {
                        transition: "slide"
                    });
                }
            });
            pickup.on('click', '#dismiss-btn', function () {
                $("#alertcontainer").css("display", "none");
                $("#messagefg").css("display", "none");
            });
            pickup.on('click', '#view-btn', function () {
                $("#messagefg").css("display", "none");
                $("#message-confirm").css("display", "block");
            });
            pickup.on('click', '#cancel-btn', function () {
                $("#alertcontainer").css("display", "none");
                $("#message-confirm").css("display", "none");
                showMarkers(map);
                isStartMarkerSelected = false;
            });
            pickup.on('click', '#confirm-btn', function () {
                $("#alertcontainer").css("display", "none");
                $("#message-confirm").css("display", "none");
                $("#step-name-label").text("En Route to Pickup");
                $("#next-label").css("visibility", "visible");
                infobox.open(map, start_markers[selectedMarkerIndex]);
            });
            //              $("#alertcontainer").css("display", "block");
            //              $("#messagefg").css("display", "block");
            infobox = new InfoBox({
                content: document.getElementById("infobox"),
                pane: "floatPane",
                disableAutoPan: false,
                maxWidth: 150,
                pixelOffset: new google.maps.Size(-70, -85),
                zIndex: null,
                boxStyle: {
                    background: "url('http://google-maps-utility-library-v3.googlecode.com/svn/trunk/infobox/examples/tipbox.gif') no-repeat",
                    width: "140px",
                },
                closeBoxURL: "",
                infoBoxClearance: new google.maps.Size(1, 1)
            });
            google.maps.event.addListener(infobox, 'domready', function (e) {
                $('#infobox-arrow-btn').click(function (e) {
                    $.mobile.changePage(delivery_details, {
                        transition: "slide"
                    });
                })
            });

            var userRoute = currentShipment.route;

            var bounds = new google.maps.LatLngBounds();
            geocoder.geocode({
                'address': "33, Summer Street, Boston, MA 02110"
            }, function (results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    var user_coordinates = results[0].geometry.location;
                    var center_lat = user_coordinates.k;
                    var center_lon = user_coordinates.A;
                    var user = new google.maps.LatLng(center_lat, center_lon);

                    bounds.extend(user);
                    //TODO change user to user location
                    var mapOptions = {
                        center: user,
                        zoom: 15,
                    };
                    map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);
                    var user_marker = new google.maps.Marker({
                        position: user,
                        map: map,
                        icon: 'images/user_marker.png'
                    });
                    addAllStartMarkers(map);

                } else {
                    alert("Geocode was not successful for the following reason: " + status);
                }
            });


            //              //display checkins
            //              var checkins = currentShipment.checkins;
            //              for (var i = 0; i < checkins.length; i++) {
            //              if (checkins[i].position) {
            //              var position = checkins[i].position;
            //              $('#map_canvas').gmap('addMarker', {
            //                                    position: new google.maps.LatLng(position.lat, position.lon),
            //                                    'icon': 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
            //                                    });
            //              }
            //              }

            $('#map_canvas').gmap('refresh');

            //tracking user position
            if (locationWatchId) {
                navigator.geolocation.clearWatch(locationWatchId);
            }
            locationWatchId = navigator.geolocation.watchPosition(function (position) {
                lastUserPosition = position;
                var marker = $('#map_canvas').gmap('get', 'markers > current');
                if (marker) {
                    marker.setPosition(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
                } else {
                    $('#map_canvas').gmap('addMarker', {
                        'id': 'current',
                        'position': new google.maps.LatLng(position.coords.latitude, position.coords.longitude),
                        'icon': 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                    });
                }
                if (route.followUser) {
                    $('#map_canvas').gmap('option', {
                        'center': new google.maps.LatLng(position.coords.latitude, position.coords.longitude)
                    });
                }
            }, function (error) {
                console.log('code: ' + error.code + '\n' +
                    'message: ' + error.message + '\n');
            }, {
                timeout: 30000
            });
        },
        pageshow: function () {
            var the_height = ($(window).height() - $(this).find('[data-role="header"]').height() - $(this).find('[data-role="footer"]').height()) - 36;
            pickup.contentHeight = the_height;

            $(this).find('[data-role="content"]').height(the_height);
            $(this).find('#map_canvas').height(the_height + 32);
        }
    });

    function addAllStartMarkers(map) {
        var start_marker;
        var finish_marker;
        var coordinates;
        var route_addresses;
        for (var i in shipments) {
            if ( !! shipments[i].route) {
                route_addresses = {
                    start: shipments[i].route.start,
                    finish: shipments[i].route.finish
                };
                addresses.push(route_addresses);
                geocoder.geocode({
                    'address': shipments[i].route.start
                }, function (results, status) {
                    if (status == google.maps.GeocoderStatus.OK) {
                        start_marker = new google.maps.Marker({
                            position: new google.maps.LatLng(results[0].geometry.location.k, results[0].geometry.location.A),
                            map: map,
                            icon: 'images/start_marker.png'
                        });
                        start_markers.push(start_marker);
                        google.maps.event.addListener(start_marker, 'click', function () {
                            if (!isStartMarkerSelected) {
                                $("#alertcontainer").css("display", "block");
                                $("#message-confirm").css("display", "block");
                                $("#step-number-label").text("Step 1");
                                $("#step-name-label").text("Pickup");
                                selectedMarkerIndex = start_markers.indexOf(this);
                                setConfirmAddressText();
                                hideMarkers(map);
                                isStartMarkerSelected = true;
                            }
                        });

                    } else {
                        alert("Geocode was not successful for the following reason: " + status);
                    }
                });

                geocoder.geocode({
                    'address': shipments[i].route.finish
                }, function (results, status) {
                    if (status == google.maps.GeocoderStatus.OK) {
                        finish_marker = new google.maps.Marker({
                            position: new google.maps.LatLng(results[0].geometry.location.k, results[0].geometry.location.A),
                            map: map,
                            icon: 'images/finish_marker.png'
                        });
                        finish_marker.setMap(null);
                        finish_markers.push(finish_marker);
                    } else {
                        alert("Geocode was not successful for the following reason: " + status);
                    }
                });


            }
        }
    }

    function setConfirmAddressText() {
        // TODO
        //  $("#confirm-start-address").text(addressFormat(addresses[selectedMarkerIndex].start));
        //   $("#confirm-finish-address").text(addressFormat( addresses[selectedMarkerIndex].finish));
    }


    function addressFormat(address) {
        var ad = address.split(',');
        return new_address = ad[0] + " " + ad[1] + " <br>" + ad[2] + ", " + ad[3] + ad[4];
    }

    function nth_ocurrence(str, needle, nth) {
        for (i = 0; i < str.length; i++) {
            if (str.charAt(i) == needle) {
                if (!--nth) {
                    return i;
                }
            }
        }
        return false;
    }

    function hideMarkers(map) {
        clearMarkers();
        start_markers[selectedMarkerIndex].setMap(map);
        finish_markers[selectedMarkerIndex].setMap(map);
    }

    function clearMarkers() {
        setAllMap(null);
        clearFinishMarkers();
    }

    function clearFinishMarkers() {
        for (var i = 0; i < finish_markers.length; i++) {
            finish_markers[i].setMap(null);
        }
    }

    function showMarkers() {
        setAllMap(map);
        clearFinishMarkers();
    }

    function setAllMap(map) {
        for (var i = 0; i < start_markers.length; i++) {
            start_markers[i].setMap(map);
        }
    }

    var delivery_details = $('#delivery-details');
    delivery_details.on({
        pageinit: function () {
            delivery_details.on('click', '#delivery-details-back', function () {
                $.mobile.back({
                    transition: "slide"
                });
            });
            delivery_details.on('click', '#cancel-pickup-btn', function () {
                $.mobile.back({
                    transition: "slide"
                });
                isCancelClicked = true;
            });
        },
        pageshow: function () {
            //                        $("#delivery-start-address").text(addressFormat(addresses[selectedMarkerIndex].start));
            //                                                $("#delivery-finish-address").text(addressFormat(addresses[selectedMarkerIndex].finish));
        }
    });

    // Home.
    // -----
    var home = $('#home');
    home.on({
        /**
         * Init hook.
         */
        pageinit: function () {
            console.log("home pageinit");

            home.on('click', '#save', function () {
                var button = $(this).addClass('ui-disabled');
                //TODO: data search
                $.mobile.loading("show");
                Kinvey.DataStore.find('shipment', null, {
                    relations: {
                        'checkins': 'shipment-checkins',
                        'route': 'route'
                    },
                    success: function (data) {
                        if (data.length == 0) {
                            alert("No route found");
                        } else {
                            currentShipment = data[0];
                            button.removeClass('ui-disabled');
                            $.mobile.changePage(routeSettings);

                        }
                    }
                }).then(loadingHide, loadingHide);


            });
        },

        /**
         * Before show hook.
         */
        pagebeforeshow: function () {
            console.log("home pagebeforeshow");
            $.mobile.loading("show");
            Kinvey.DataStore.find('search-options', null, {
                success: function (response) {
                    window.searchOptions = response;
                    for (var i in response) {
                        if (response[i].values) {
                            var values = response[i].values;
                            var array = [];
                            for (var j in values) {
                                array[array.length] = {
                                    'name': j,
                                    'value': values[j]
                                };
                            }
                            response[i].values = array;
                        }
                    }
                    home.find('.search_form').mustache('search', $.extend({
                        searchOptions: window.searchOptions
                    }, mustacheData), {
                        method: 'html'
                    }).listview('refresh');
                    home.find("select").each(function () {
                        if ($(this).data('role') == 'slider') {
                            $(this).slider().slider('refresh');
                        } else {
                            $(this).selectmenu().selectmenu('refresh');
                        }
                    });

                }
            }).then(loadingHide, loadingHide);

        }
    });

    // maps.
    // --------
    var route = $('#route');
    route.on({
        pageinit: function () {
            console.log("route page init");
            /*debugger;
		Kinvey.DataStore.save('shipment', {
			'on-desk' : true,
			"pulped" : "yes",
			"status" : 'in_progress',
			'user_status' : null,
			'checkins' : [],
			'route' : {start:{
				lat:30.265146,
				lon: -97.747185
			}, finish:{
				lat: 30.246359,
				lon: -97.76918
			}}
			
		},{
			relations : {'checkins' : 'checkins', 'route' : 'route'},
			
			success : function(response){
				debugger;
			}
		});*/




            route.on("click", "#my_loc", function () {
                $(this).toggleClass("enabled");
                route.followUser = $(this).hasClass("enabled");

                //$(this).css("background-image", route.followUser ? "url:(../images/myl_normal.png)": "url:(../images/myl_disabled.png)")

            });

            route.on("click", ".ui-icon-ok", function () {
                navigator.notification.confirm("Do you really want to mark route as \"Done\"",
                    function (button) {
                        if (button == 1) {
                            currentShipment.user_status = "done";
                            saveShipment(currentShipment, function (data) {
                                currentShipment = data;
                                $.mobile.back();
                            });
                        }
                    },
                    "Change route status", ["OK", "Cancel"])
            });

            route.on("click", ".ui-icon-remove", function () {
                navigator.notification.confirm("Do you really want to reject route",
                    function (button) {
                        if (button == 1) {
                            currentShipment.user_status = "rejected";
                            saveShipment(currentShipment, function (data) {
                                currentShipment = data;
                                history.back();
                            });
                        }
                    },
                    "Change route status", ["OK", "Cancel"])
            });
            $('#map_canvas').gmap({
                'zoom': 10,
                'disableDefaultUI': true,
                'callback': function () {}
            })
        },
        pageshow: function () {
            console.log("route pageshow");
            var the_height = ($(window).height() - $(this).find('[data-role="header"]').height() - $(this).find('[data-role="footer"]').height()) - 36;
            route.contentHeight = the_height;

            $(this).find('[data-role="content"]').height(the_height);
            $(this).find('#map_canvas').height(the_height + 32);

            var userRoute = currentShipment.route;

            var bounds = new google.maps.LatLngBounds();

            var start = new google.maps.LatLng(userRoute.start.lat, userRoute.start.lon);
            var finish = new google.maps.LatLng(userRoute.finish.lat, userRoute.finish.lon);

            bounds.extend(start);
            bounds.extend(finish);

            $('#map_canvas').gmap('displayDirections', {
                    'origin': start,
                    'destination': finish,
                    'travelMode': google.maps.DirectionsTravelMode.DRIVING
                }, {},
                function (result, status) {
                    if (status === 'OK') {
                        var center = result.routes[0].bounds.getCenter();
                        $('#map_canvas').gmap('option', 'center', center);
                        $('#map_canvas').gmap('refresh');
                    } else {
                        alert('Unable to get route');
                    }
                }
            );


            //display checkins
            var checkins = currentShipment.checkins;
            for (var i = 0; i < checkins.length; i++) {
                if (checkins[i].position) {
                    var position = checkins[i].position;
                    $('#map_canvas').gmap('addMarker', {
                        position: new google.maps.LatLng(position.lat, position.lon),
                        'icon': 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
                    });
                }
            }

            $('#map_canvas').gmap('refresh');

            //tracking user position  
            //tracking user position  
            if (locationWatchId) {
                navigator.geolocation.clearWatch(locationWatchId);
            }
            locationWatchId = navigator.geolocation.watchPosition(function (position) {
                lastUserPosition = position;
                var marker = $('#map_canvas').gmap('get', 'markers > current');
                if (marker) {
                    marker.setPosition(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
                } else {
                    $('#map_canvas').gmap('addMarker', {
                        'id': 'current',
                        'position': new google.maps.LatLng(position.coords.latitude, position.coords.longitude),
                        'icon': 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                    });
                }
                if (route.followUser) {
                    $('#map_canvas').gmap('option', {
                        'center': new google.maps.LatLng(position.coords.latitude, position.coords.longitude)
                    });
                }
            }, function (error) {
                console.log('code: ' + error.code + '\n' +
                    'message: ' + error.message + '\n');
            }, {
                timeout: 30000
            });

        }
    });

    var checkins = $('#checkins');
    checkins.on({
        pageinit: function () {
            checkins.find("#ok").click(function () {
                if (checkins.find('.data li.selected').length > 0) {
                    var id = checkins.find('.data li.selected').data('id');
                    var checkin;
                    for (var i = 0; i < checkins.kinveyData.length; i++) {
                        if (checkins.kinveyData[i]._id == id) {
                            checkin = checkins.kinveyData[i];
                            break;
                        }
                    }
                    currentShipment.checkins.push({
                        position: {
                            lat: checkins.checkinPosition.coords.latitude,
                            lon: checkins.checkinPosition.coords.longitude
                        },
                        checkin: checkin
                    });
                    saveShipment(currentShipment, function (data) {
                        currentShipment = data;
                        window.history.go(-1);
                    });
                } else {
                    history.back();
                }
            });
        },
        pageshow: function () {
            checkins.find('.data').mustache('checkins', $.extend({
                checkins: checkins.kinveyData
            }, mustacheData), {
                method: 'html'
            }).listview('refresh');
            checkins.find('.data li').click(function () {
                if (!$(this).hasClass("selected")) {
                    checkins.find('.data li').removeClass("selected");
                    $(this).addClass("selected");
                }
            });


        }
    });

    var routeSettings = $('#route_settings');
    routeSettings.on({
        pageinit: function () {
            debugger;
            routeSettings.on("click", "#control i", function () {
                debugger;
                if ($(this).hasClass("fa-play")) {
                    $(this).removeClass("fa-play").addClass("fa-pause");
                } else {
                    $(this).removeClass("fa-pause").addClass("fa-play");
                }

                currentShipment.user_status = $(this).hasClass("fa-play") ? "in progress" : "paused";
                saveShipment(currentShipment);

            });

            routeSettings.on("click", "#checkin_btn", function () {
                var button = $(this).addClass('ui-disabled');
                if (!checkins.kinveyData) {
                    $.mobile.loading("show");
                    Kinvey.DataStore.find('checkins', null, {
                        success: function (response) {
                            if (lastUserPosition) {
                                checkins.kinveyData = response;
                                checkins.checkinPosition = lastUserPosition;
                                $.mobile.changePage(checkins);
                            } else {
                                navigator.notification.alert("Can't get your location. Please make sure that location services are enabled on your device.",
                                    function () {}, "Location missing", "OK");
                            }
                        }
                    }).then(loadingHide, loadingHide);
                } else {
                    checkins.checkinPosition = lastUserPosition;
                    $.mobile.changePage(checkins);

                }

                var button = $(this).removeClass('ui-disabled');

            });

            routeSettings.on("click", "#map_btn", function () {
                $.mobile.changePage(route);
            })
        },
        pageshow: function () {
            var the_height = ($(window).height() - $(this).find('[data-role="header"]').height() - $(this).find('[data-role="footer"]').height()) - 36;

            $("#control").css({
                'margin-top': (the_height - $("#control").height()) / 2 + 'px'
            });

            //tracking user position  
            if (locationWatchId) {
                navigator.geolocation.clearWatch(locationWatchId);
            }
            locationWatchId = navigator.geolocation.watchPosition(function (position) {
                lastUserPosition = position;
            }, function (error) {
                console.log('code: ' + error.code + '\n' +
                    'message: ' + error.message + '\n');
            }, {
                timeout: 30000
            });


        }
    });

    $(document).delegate("#route", "scrollstart", false);




}.call(this));