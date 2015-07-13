function onPreSave(request, response, modules) {

    var logger = modules.logger,
        collectionAccess = modules.collectionAccess,
        context = modules.backendContext,
        http = modules.request;

    var body = request.body;

    if (request.method == "PUT" && body.user_status == "open") {
        collectionAccess.collection("shipment").find({"_id": collectionAccess.objectID(request.entityId)}, {}, function (err, results) {
            if (err) {
                return response.error(err);
            }
            var shipment = results[0];
            if (!shipment) {
                return response.continue();
            } else {
                if ((shipment.user_status == "paused" || shipment.user_status == "in progress") && shipment.signature && shipment.signature._id) {
                    var uri = 'https://' + context.getAppKey() + ':' + context.getMasterSecret() + '@' + request.headers.host
                        + '/blob/' + context.getAppKey() + '/' + shipment.signature._id;

                    var req = http.del({url: uri},
                        function (error, res, body) {

                            var results = JSON.parse(res.body);
                            if(results.error){
                                error = results;
                            }
                            if (error) {
                                return response.error(error);
                            }else {
                                return response.continue();
                            }
                        });
                } else {
                    return response .continue();
                }
            }
        })
    } else {
        return response.continue();
    }
}