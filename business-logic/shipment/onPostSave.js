function onPostSave(request, response, modules) {
    var logger = modules.logger, email = modules.email, body = request.body, collectionAccess = modules.collectionAccess, push = modules.push;
    var context = modules.backendContext;
    var http = modules.request;
    var userCollection = collectionAccess.collection("user");
    logger.info("query body " + JSON.stringify(body));

    if (body.user_status == "done") {
        var routeCollection = collectionAccess.collection('route');
        routeCollection.findOne({"_id": collectionAccess.objectID(body.route._id)}, {},
            function (err, route) {
                if (err) {
                    logger("Query failed: " + err);
                    return response.complete(200);
                }
                logger.info("route info " + JSON.stringify(route));
                userCollection.findOne({"_id": collectionAccess.objectID(body.driver._id)}, {},
                    function (err, driver) {
                        logger.info("driver " + JSON.stringify(driver));
                        var driverEmail = driver.email;

                        if (driverEmail) {
                            logger.info("request body " + JSON.stringify(body));
                            logger.info("send email to " + driverEmail);
                            collectionAccess.collection('clients').findOne({"_id": collectionAccess.objectID(body.client._id)}, {},
                                function (err, client) {
                                    logger.info("Client " + JSON.stringify(client));
                                    if(err){
                                        logger.error("fetch client error " + err);
                                    }else{
                                        route.client = client.first_name + " " + client.last_name;
                                        if(body.signature && body.signature._id){
                                            getSignatureDownloadURL(body.signature._id,function(signature){
                                                var htlmText = getHtmlText(route,signature)
                                                email.send('do-not-reply@kinvey.com',
                                                    driverEmail,
                                                    'Delivery status',
                                                    "Delivery status",
                                                    null,
                                                    htlmText);
                                                return response.complete(200);
                                            });
                                        }else{
                                            var htlmText = getHtmlText(route,body.signature);
                                            email.send('do-not-reply@kinvey.com',
                                                driverEmail,
                                                'Delivery status',
                                                "Delivery status",
                                                null,
                                                htlmText);
                                            return response.complete(200);
                                        }
                                    }
                                });
                        }else{
                            return response.complete(200);
                        }
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
                return response.complete(200);
            }
        );
    } else {
        return response.complete(200);
    }

    var getSignatureDownloadURL = function (signature_id, callback) {
        var uri = 'https://' + context.getAppKey() + ':' + context.getMasterSecret() + '@' + request.headers.host
            + '/blob/' + context.getAppKey() + '/?query={"_id":"' + signature_id + '"}&ttl_in_seconds=86400';

        var req = http.get({url: uri},
            function (error, responseBody, body) {
                if (error) {
                    logger.error("Query failed " + error);
                    var result = {"error": error};
                    return callback();
                }

                var results = JSON.parse(responseBody.body);
                return callback(results[0]);
            });
    };

    var getHtmlText = function(route, signature){
        var htlmText = '<html>Your delivery has been completed.' +
            '<ul><li>Delivery Date:' + route._kmd.lmt +
            '</li><li>Customer Name:' + route.client +' </li>' +
            '<li>Pickup Address:' + route.start +'</li>' +
            '<li>Delivery Address:' + route.finish + '</li>';
        if(signature){
            htlmText+='<li>Signature:</br> <img src="' + signature._downloadURL + '"' + '/></li>';
        }
        htlmText+='</ul>'+ '</html>';
        return htlmText;
    }
}