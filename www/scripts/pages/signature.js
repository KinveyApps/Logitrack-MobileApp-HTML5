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
var signature = $('#signature');
var sigWrapper;

signature.on({
    pageinit: function () {

        sigWrapper = $(".sigPad").signaturePad({drawOnly: true, lineTop: 90000});

        signature.on('click', "#save-signature-btn", function () {
            if (sigWrapper.validateForm()) {
                var signatureBase64 = sigWrapper.getSignatureImage();
                signatureBase64 = signatureBase64.substr(signatureBase64.indexOf(',') + 1);
                console.log("start update " + signatureBase64);
                var signatureArrayBuffer = _base64ToArrayBuffer(signatureBase64);
                $.mobile.loading("show");
                //Kinvey save avatar image file starts
                var promise = Kinvey.File.upload(signatureArrayBuffer, {
                    mimeType: 'image/png',
                    size: signatureBase64.length
                }, {
                    success: function (file) {
                        console.log("success " + JSON.stringify(file));
                        currentShipment.signature = {
                            _type: 'KinveyFile',
                            _id: file._id
                        };
                        saveShipment(JSON.parse(JSON.stringify(currentShipment)), function (data) {
                            $.mobile.back({
                                transition: "slide"
                            });
                        });
                    },
                    error: function (error) {
                        console.log("error " + JSON.stringify(error));
                    }
                }).then(loadingHide, loadingHide);
            }
            ;
        });

        signature.on('click', ".clearButton", function () {
            if (currentShipment.signature && currentShipment.signature._id) {
                $.mobile.loading("show");
                var promise = Kinvey.File.destroy(currentShipment.signature._id);
                promise.then(function () {
                    delete currentShipment.signature;
                    saveShipment(JSON.parse(JSON.stringify(currentShipment)), function (data) {
                    });
                }, function (err) {
                    console.log("delete signature error");
                }).then(loadingHide, loadingHide);
            }
        });

        signature.on('click', '#signature-back', function () {
            $.mobile.back({
                transition: "slide"
            });
        });
    },
    pageshow: function(){
        if(currentShipment.signature && currentShipment.signature._id){
            $.mobile.loading("show");
            var promise = Kinvey.File.download(currentShipment.signature._id, {
                success: function(response) {
                    var canvas = document.getElementById('canvasPad');
                    var ctx = canvas.getContext("2d");
                    var image = new Image();
                    image.src = response._downloadURL;
                    image.onload = function() {
                        ctx.drawImage(image, 0, 0);
                        loadingHide();
                    };
                },
                error: function (error) {
                    console.log("error " + JSON.stringify(error));
                }
            }).then(loadingHide,loadingHide);
        }
    }
});
