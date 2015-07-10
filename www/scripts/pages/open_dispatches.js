
var isDispatchFromList = false;
var previousPage;
//dispatch page
var dispatchPage = $('#open-dispatch');
dispatchPage.on({
    pagebeforeshow: function (event, data) {
        previousPage = currentPage;
        currentPage = OPEN_DISPATCHES_PAGE;
        var items = [];
        var dispatchList = $('#dispatch-list');
        dispatchList.find('li').remove();
        getOpenShipments(function(err){
            if(err){
                navigator.notification.alert("Error",function(){},'Fetching shipment query failed with error ' + JSON.stringify(err) ,'OK');
            }else {
                for (var i = 0; i < shipments.length; i++) {
                    if (currentShipment._id != shipments[i]._id) {
                        items.push('<li><p> Begin: ' + shipments[i].route.start + '</br>Finish: ' + shipments[i].route.finish + '</p></li>');
                    } else if (getLastShipmentStatus() != "paused" && getLastShipmentStatus() != "in progress") {
                        items.push('<li><p> Begin: ' + shipments[i].route.start + '</br>Finish: ' + shipments[i].route.finish + '</p></li>');
                    }
                }

                dispatchList.append(items.join(''));
                dispatchList.find("li").click(clickDispatch);
            }
        });
    },
    pageinit: function () {
        dispatchPage.on('click', '#dispatch-back', function () {
            isBackPressed = true;
            $.mobile.back({
                transition: "slide"
            });
        });


    }
});

var clickDispatch = function(){
    var index = $(this).index();
    isDispatchFromList = true;
    if (getLastShipmentStatus() == "in progress" || getLastShipmentStatus() == "paused") {
        if(index >=selectedMarkerIndex){
            index++;
        }
        navigator.notification.confirm("You already have a delivery in progress, are you sure you want to cancel it?",
            function (button) {
                if (button == 1) {
                    currentPage = PICKUP_ROUTE_PAGE;
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
};

var getOpenShipments = function(callback){
    var user = Kinvey.getActiveUser();
    var query = new Kinvey.Query();
    query.equalTo('user_status', 'open').or().equalTo('user_status', 'in progress').or().equalTo('user_status', 'paused');
    query.equalTo("driver._id", user._id);
    query.exists('route');
    query.descending("_kmd.ect");
    Kinvey.DataStore.find('shipment', query, {
        relations: {
            'route': 'route'
        },
        success: function (data) {
            console.log("get shipments " + JSON.stringify(data));
            shipments = data;
            clearMarkers();
            startMarkers = [];
            finishMarkers = [];
            addresses = [];
            addAllStartMarkers(map);
            isStartMarkerSelected = false;
            if(infobox) {
                infobox.close();
                infobox.setMap(null);
            }
            return callback();
        },
        error: function(err){
            return callback(err);
        }
    });
};