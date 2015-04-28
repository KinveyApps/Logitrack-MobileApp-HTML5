function onPostSave(request, response, modules) {
    var logger = modules.logger, email = modules.email, body = request.body, collectionAccess = modules.collectionAccess, push = modules.push;
    var userCollection = collectionAccess.collection("user");
    logger.info("query body " + JSON.stringify(body));

    if (body.user_status == "done") {
        var routeCollection = collectionAccess.collection('route');
        routeCollection.findOne({"_id": collectionAccess.objectID(body.route._id)}, {},
            function (err, route) {
                if (err) {
                    logger("Query failed: " + err);
                    response.complete(200);
                }
                logger.info("route info " + JSON.stringify(route));
                userCollection.findOne({"_id": collectionAccess.objectID(body.driver._id)}, {},
                    function (err, driver) {
                        logger.info("driver " + JSON.stringify(driver));
                        var driverEmail = driver.email;

                        if (driverEmail) {
                            logger.info("request body " + JSON.stringify(body));
                            logger.info("send email to " + driverEmail);
                            //collectionAccess.collection('clients').findOne({"_id": collectionAccess.objectID(route.client._id)}, {},
                            //    function (err, client) {
                            //        if(err){
                            //            logger.error("fetch client error " + err);
                            //        }else{
                            //            route.client = client.first_name + " " + client.last_name;
                            //        }
                                    email.send('do-not-reply@kinvey.com',
                                        driverEmail,
                                        'Delivery status',
                                        'Your delivery from ' + route.start + " to " + route.finish + ' has been completed.');
                                //});
                        }
                        response.complete(200);
                    }
                );
            });
    } else if (body.user_status == "open") {
        logger.info("open " + request.method);
        // send push to driver about 'open' shipment
        userCollection.findOne({"_id": collectionAccess.objectID(body.driver._id)}, {},
            function (err, driver) {
                if(request.method == "POST" && request.entityId === undefined){
                    push.sendMessage(driver, "You have a new pickup. Please go to your dispatch list to accept.");
                }
                response.complete(200);
            }
        );
    } else {
        response.complete(200);
    }
}