
var isDispatchFromList = false;
var previous_page;
//dispatch page
var dispatch = $('#open-dispatch');
dispatch.on({
    pagebeforeshow: function (event, data) {
        previous_page = current_page;
        current_page = open_dispatches_page;
        var items = [];
        $('#dispatch-list li').remove();
        for(var i=0;i<shipments.length;i++){
            items.push('<li><p> Begin: ' + shipments[i].route.start + '</br>Finish: ' + shipments[i].route.finish + '</p></li>');
        }

        $('#dispatch-list').append(items.join(''));
        $("#dispatch-list li").click(function () {
            var index = $(this).index();
            if(currentShipment._id == shipments[index]._id && (getLastShipmentStatus() == "paused" || getLastShipmentStatus() == "in progress")){
                navigator.notification.alert("This shipment is active at the moment",function(){},'Active shipment','OK');
            }else {
                isDispatchFromList = true;
                if (getLastShipmentStatus() == "in progress" || getLastShipmentStatus == "paused") {
                    navigator.notification.confirm("You already have a delivery in progress, are you sure you want to cancel it?",
                        function (button) {
                            if (button == 1) {
                                current_page = pickup_route_page;
                                var oldShipment = JSON.parse(JSON.stringify(currentShipment));
                                oldShipment.user_status = "open";
                                setLastShipmentStatus("open");
                                clearTimer();
                                clearRestaurantMarkers();
                                //$("#timer").text('00:00:00');
                                //$("#tracking-state").css("visibility", "hidden");
                                //$("#green-circle-right").css("visibility", "hidden");
                                //$("#pause-btn").css("visibility", "hidden");
                                //$("#play-btn").css("visibility", "hidden");
                                //$("#green-circle-central").css("visibility", "hidden");
                                //$("#green-circle-left").css("visibility", "visible");
                                //$("#timer").css('visibility', "hidden");
                                //confirm_infobox.close();
                                //confirm_infobox.setMap(null);
                                //infobox.close();
                                //infobox.setMap(null);
                                //last_time = [0, 0, 0];
                                //clearInterval(my_timer);
                                //isConfirmBoxOpen = false;
                                //isDeliveryComplitedClicked = true;
                                //selectedMarkerIndex = index;
                                directionsDisplay.setMap(null);
                                currentShipment = shipments[index];
                                saveShipment(oldShipment, function (data) {
                                    $.mobile.changePage(pickup, {transition: "slide"});
                                });
                            }
                        },
                        "Cancel current route", ["Yes", "No"]);
                } else {
                    currentShipment = shipments[index];
                    selectedMarkerIndex = index;
                    isDispatchFromList = true;
                    $.mobile.changePage(pickup, {transition: "slide"});
                }
            }
        });
    },
    pageinit: function () {
        dispatch.on('click', '#dispatch-back', function () {
            isBackPressed = true;
            $.mobile.back({
                transition: "slide"
            });
        });


    },
    pageshow: function () {

    }
});