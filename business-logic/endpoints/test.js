function onRequest(request, response, modules) {
    var logger = modules.logger, email = modules.email, collectionAccess = modules.collectionAccess;
    var context = modules.backendContext;
    var http = modules.request;

    //email.send('do-not-reply@kinvey.com',
    //    "e.kozlov@softteco.com",
    //    'Delivery status',
    //    "Del",
    //    null,
    //    '<html>Your delivery from ' + "route.start" + " to " + "route.finish" + ' has been completed.' +
    //    '<ul><li>Delivery Date:' + "route._kmd.lmt" +
    //    '</li><li>Customer Name: </li>' +
    //    '<li>Pickup Address: route.start</li>' +
    //'<li>Delivery Address: route.finish</li>'+
    //'<li>Signature:</br> <img src="http://storage.googleapis.com/kinvey_production_3d519bccf2374fedbccbf29e5026da2f/1b4c8412-292a-43b3-b2fb-f506a03e2d82/9de9f5e1-957e-498c-8c15-7ffb992e95a2?GoogleAccessId=558440376631@developer.gserviceaccount.com&Expires=1432218448&Signature=WIFyUL9jSTEfQoFK1zLYtQz0Tu9cB%2FrFPY1j5%2F9WWuIix9YiLJKATpBDwL0RUdeyazlXebYtu3U799%2B%2FyTneP%2BmkusxPAJ8Xig%2BkHia9askGn3YhiMhIx6ZB8KjBOX1NzB250kcdqbEskUJ%2BBfMTQBN6SOpytB8cMSTAWgoG77Q%3D"/></li>'+
    //'</ul>'+
    //'</html>');

    //email.send('my-app@my-app.com',
    //    "e.kozlov@softteco.com",
    //    'Join my octacgon in my-app!',
    //    "You've been invited to join " + "'s octagon in my-app!",
    //    null,
    //    '<html>Youve been invited to join  <b>'+ "name "+'</b>s octagon in my-app!</html>');

    var uri = 'https://' + context.getAppKey() + ':' + context.getMasterSecret() + '@' + request.headers.host
        + '/blob/' + context.getAppKey() + '/?query={"_id": "df0376a1-b7ec-4458-986d-b1cd857acfe2"}&ttl_in_seconds=86400';

    var req = http.get({url: uri},
        function (error, responseBody, body) {

            if (error) {
                logger.error("Query failed images.js: " + error);
                var result = {"error": error};
                return response.error(error);
            }

            var results = JSON.parse(responseBody.body);
            response.body = results;
            response.complete(200);
            });
}
