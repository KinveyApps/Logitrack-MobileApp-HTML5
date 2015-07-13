function onPreDelete(request, response, modules) {
    var debug = modules.logger.info, entityId = request.entityId, collectionAccess = modules.collectionAccess;
    debug("params " + JSON.stringify(request));
    debug("entityId " + entityId);
    var shipmentCheckinsCollection = collectionAccess.collection("shipment-checkins");
    var routeCollection = collectionAccess.collection("route");
    if (entityId) {
        shipmentCheckinsCollection.remove({"shipment_id": entityId.toString()}, function (err, res) {
            if (err) {
                debug("delete failed " + JSON.stringify(err));
            }
            debug("result " + JSON.stringify(res));
            response.continue();
        });
    }else{
      response.continue();
    }

//     var shipmentCollection = collectionAccess.collection("shipment");
//     shipmentCollection.find({"client._id":result.client._id,"route._id":result.route._id},{},function(err, result){
//       if(err){
//         debug("Query failed " + JSON.stringify(err));
//         response.continue();
//       }
//       debug("result " + JSON.stringify(result));
//       if(result){
//       shipmentCollection.remove({"client._id":result.client._id,"route._id":result.route._id,"_id":{"$ne":collectionAccess.objectID(entityId)}},function(err, res){
// 	  if(err){
// 	    debug("delete failed " + JSON.stringify(err));
// 	  }
// 	  response.continue();
// 	}); 
//       }else{
    //   }
    // });
}