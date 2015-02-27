Logitrack-HTML5
===============

##Get Kinvey API Keys

1. Visit [Kinvey official site](http://www.kinvey.com/) and create your own Kinvey account.
2. Choose the "Get started" option that suits you best. 
3. Name your app, choose app platform and click "Create app backend".
4. On the app dashboard page, you will find your App Key and App Secret. 
5. Specify your app key and secret in `scripts/pages/splash.js` constant variables

```javascript
var promise = Kinvey.init({
            appKey: 'MY_APP_KEY',
            appSecret: 'MY_APP_SECRET',
            sync: {
                enable: true,
                online: navigator.onLine
            }
        });
```


## Preinstallation for building app on Android:

 1. Install [Android SDK](https://spring.io/guides/gs/android/)
 2. Install [Apache ANT](http://ant.apache.org/manual/install.html#jpackage)


##Installation

1. Install [node.js](http://nodejs.org/download/) on your machine
2. Install latest version of cordova:

   `sudo npm install -g cordova`

   Windows users should run command without sudo

3. Install all necessary cordova plugins:

```
   cordova plugin add org.apache.cordova.geolocation
   cordova plugin add org.apache.cordova.device
   cordova plugin add org.apache.cordova.dialogs
   cordova plugin add org.apache.cordova.camera
```

4. Add platform that you want to build

   `cordova platform add <platform>`

5. For launch app run command

   `cordova emulate <PLATFORM>`

##Troubleshouting
   If you successfully run the app but see only blue map, try to change location of your simulator.
   iOS: Simulator Menu -> Debug -> Location

   If you see only white screen try to update platform code running these commands:

   ```
    cordova platform add <PLATFORM>
    cordova platform remove <PLATFORM>
    cordova platform add <PLATFORM>`
   ```

   One other possible solution is to update plugins. You could do this by running these commands for all plugins:

   ```
   cordova plugin rm <PLUGIN_NAME>
   cordova plugin add <PLUGIN_NAME>
   ```


## License

Copyright (c) 2015 Kinvey, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
