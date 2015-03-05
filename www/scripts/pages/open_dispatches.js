
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
            if(currentShipment._id != shipments[i]._id) {
                items.push('<li><p> Begin: ' + shipments[i].route.start + '</br>Finish: ' + shipments[i].route.finish + '</p></li>');
            }else if(getLastShipmentStatus() != "paused" && getLastShipmentStatus() != "in progress"){
                items.push('<li><p> Begin: ' + shipments[i].route.start + '</br>Finish: ' + shipments[i].route.finish + '</p></li>');
            }
        }

        $('#dispatch-list').append(items.join(''));
        $("#dispatch-list li").click(function () {
            var index = $(this).index();
            isDispatchFromList = true;
            if (getLastShipmentStatus() == "in progress" || getLastShipmentStatus == "paused") {
                if(index >=selectedMarkerIndex){
                    index++;
                }
                navigator.notification.confirm("You already have a delivery in progress, are you sure you want to cancel it?",
                    function (button) {
                        if (button == 1) {
                            current_page = pickup_route_page;
                            var oldShipment = JSON.parse(JSON.stringify(currentShipment));
                            oldShipment.user_status = "open";
                            setLastShipmentStatus("open");
                            clearTimer();
                            clearRestaurantMarkers();
                            directionsDisplay.setMap(null);
                            currentShipment = shipments[index];
                            selectedMarkerIndex = index;
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