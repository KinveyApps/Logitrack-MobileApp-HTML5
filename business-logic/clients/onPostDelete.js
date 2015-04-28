function onPostDelete(request, response, modules) {
    var debug = modules.logger.info, entityId = request.entityId, collectionAccess = modules.collectionAccess;
    var shipmentCollection = collectionAccess.collection("shipment");
    shipmentCollection.remove({"client._id":entityId},function(err, res){
        if(err){
            debug("delete failed " + JSON.stringify(err));
        }
        response.complete(200);
    });
}