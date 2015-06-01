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
var signaturePage = $('#signature');
var sigWrapper;
var offlineSignatures = getOfflineSignatures();
offlineSignatures = (offlineSignatures) ? offlineSignatures : {};
var clearedSignatures = getClearedSignatures();
clearedSignatures = (clearedSignatures) ? clearedSignatures : {};

signaturePage.on({
    pageinit: function () {

        sigWrapper = $(".sigPad").signaturePad({drawOnly: true, lineTop: 90000});

        signaturePage.on('click', "#save-signature-btn", function () {
            if (sigWrapper.validateForm()) {
                var signatureBase64 = sigWrapper.getSignatureImage();
                if (navigator.onLine) {
                    signatureBase64 = signatureBase64.substr(signatureBase64.indexOf(',') + 1);
                    var signatureArrayBuffer = _base64ToArrayBuffer(signatureBase64);
                    $.mobile.loading("show");
                    //Kinvey save avatar image file starts
                    var promise = Kinvey.File.upload(signatureArrayBuffer, {
                        mimeType: 'image/png',
                        size: signatureBase64.length,
                        sig: sigWrapper.getSignature()
                    }, {
                        success: function (file) {
                            currentShipment.signature = {
                                _type: 'KinveyFile',
                                _id: file._id,
                                sig: file.sig
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
                } else {
                    delete clearedSignatures[currentShipment._id];
                    offlineSignatures[currentShipment._id] = {
                        signatureBase64: signatureBase64,
                        shipment: currentShipment,
                        sig: sigWrapper.getSignature()
                    };
                    setOfflineSignatures();
                    setClearedSignatures();
                    sigWrapper.clearCanvas();
                    $.mobile.back({
                        transition: "slide"
                    });
                }
            };
        });

        signaturePage.on('click', ".clearButton", function () {
            if(navigator.onLine) {
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
            }else{
                delete offlineSignatures[currentShipment._id];
                if(currentShipment.signature && currentShipment.signature._id){
                    clearedSignatures[currentShipment._id] = {
                        signature_id: currentShipment.signature._id,
                        shipment: currentShipment
                    };
                    delete currentShipment.signature;
                }
                setOfflineSignatures();
                setClearedSignatures();
            }
        });

        signaturePage.on('click', '#signature-back', function () {
            $.mobile.back({
                transition: "slide"
            });
        });
    },
    pageshow: function(){
        if (navigator.onLine) {
            if (currentShipment.signature && currentShipment.signature.sig) {
                sigWrapper.regenerate(currentShipment.signature.sig);
            }
        } else {
            var offlineSignature = offlineSignatures[currentShipment._id];
            if (offlineSignature && offlineSignature.sig) {
                sigWrapper.regenerate(offlineSignature.sig);
            }
        }
    }
});
