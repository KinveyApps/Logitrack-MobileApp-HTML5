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

function getLastShipmentStatus() {
    return localStorage.getItem("status");
}

function setLastShipmentStatus(status) {
    localStorage.setItem("status", status);
}

function setLastShipmentId(shipmentId) {
    localStorage.setItem("shipmentId", shipmentId);
}

function setLastDriverId(driverId){
    localStorage.setItem("driverId",driverId);
};

function getLastDriverId(){
    return localStorage.getItem("driverId");
}

function getLastShipmentId() {
    return localStorage.getItem("shipmentId");
}

function saveTimer(last_time, lastTimeOfSave){
    localStorage.setItem("timer",last_time.toString());
    localStorage.setItem("lastTimeOfSave",lastTimeOfSave);
}

function getTimer() {
    var timer = localStorage.getItem("timer");
    var lastTimeOfSave = localStorage.getItem("lastTimeOfSave");
    var timeDifference = (new Date().getTime() - lastTimeOfSave) / 1000;
    var lastTimer = timer.split(',').map(Number);
    if(getLastShipmentStatus() == "in progress" && timer !== "0,0,0") {
        var h = ((timeDifference / 3600).toFixed()) / 1;
        timeDifference -= h * 3600;
        var m = ((timeDifference / 60).toFixed()) / 1;
        timeDifference -= m * 60;
        var s = timeDifference.toFixed() / 1;
        lastTimer[2] += s;
        if (lastTimer[2] > 59) {
            lastTimer[1]++;
            lastTimer[2] = lastTimer[2] % 60;
        }
        lastTimer[1] += m;
        if (lastTimer[1] > 59) {
            lastTimer[0]++;
            lastTimer[1] = lastTimer[1] % 60;
        }
        lastTimer[0] += h;
    }
    console.log("timer  " + lastTimer);
    return lastTimer;
}

function clearTimer(){
    localStorage.setItem("timer","0,0,0");
    //localStorage.setItem("lastTimeOfSave",);
}

function getPushStatus() {
    var status = localStorage.getItem("push");
    if(status){
        return status;
    }else{
        return "enabled";
    }
}

function savePushStatus(status) {
    localStorage.setItem("push", status);
}

function getDeviceId() {
    var deviceId = localStorage.getItem("deviceId");
    console.log("device id " + deviceId);
    return deviceId;
}

function saveDeviceId(deviceId) {
    localStorage.setItem("deviceId", deviceId);
}