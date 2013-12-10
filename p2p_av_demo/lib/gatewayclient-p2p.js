/*
 *   Copyright © Microsoft Open Technologies, Inc.
 *   All Rights Reserved        
 *   Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 *   the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 *   THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 *   INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
 *   MERCHANTABLITY OR NON-INFRINGEMENT. 
 *   
 *   See the Apache 2 License for the specific language governing permissions and limitations under the License.
 */


(function (global) {
    'use strict';/*jshint browser:true,node:false*/
    /*global, window, b64*/


    var gatewayClient = {};
    global.gatewayClient = gatewayClient;

    window.onload = function () {

        var key = window.location.pathname.substring(window.location.pathname.indexOf('/', 1) + 1);
        gatewayClient.key = key;

        var local = (window.location.hash === 'guest' || window.location.hash === '#guest') ? 'guest' : 'host';
        var remote = (local === 'host') ? 'guest' : 'host';

        if (local === 'guest') {
            document.getElementById('inviteother').innerHTML = 'Open <span id="other">host</span> page using: <a id="ortcRemote" href="#host">this link</a>.';
        }

        document.title += " " + local;
        document.getElementById('heading').innerHTML += " (" + local + ')';

        document.getElementById('role').innerHTML = local;
        document.getElementById('other').innerHTML = remote;

        gatewayClient.local = local;
        gatewayClient.remote = remote;

        function promptRemote(e) {
            window.prompt('Share the following link with your ' + remote + ':', e.target.href);
            e.preventDefault();
        }

        ['ortc'].forEach(function (type) {
            var el = document.getElementById(type + 'Remote');
            el.addEventListener('click', promptRemote);
            el.href = '/' + type + '/' + key + '#' + remote;
        });

        function go() {
            var btn = document.getElementById('go');

            if (btn) {
                gatewayClient.go(btn.value);
            }
        }

        document.getElementById('go').addEventListener('click', go);

        gatewayClient.getGatewayConfig(gotGatewayConfig);
        gatewayClient.initialize();
    };

    gatewayClient.getGatewayConfig = function (gotGatewayConfig) {
        var xhr = new XMLHttpRequest();
        var key = window.location.pathname.substring(window.location.pathname.indexOf('/', 1) + 1);
        xhr.open('GET', '/config/' + key, false);
        xhr.addEventListener('load', function (e) {
            var gatewayConfig = JSON.parse(e.target.responseText);
            var localConfig = fixConfig(gatewayConfig, gatewayClient.local);
            var remoteConfig = fixConfig(gatewayConfig, gatewayClient.remote);
            gotGatewayConfig(localConfig, remoteConfig);
        });
        xhr.send();
    };

    function gotGatewayConfig(local, remote) {
        gatewayClient.localConfig = local;
        gatewayClient.remoteConfig = remote;
    }

    function fixConfig(gatewayConfig, role) {
        var config = gatewayConfig[role]; // only pass back local stuff
        config.sdes.key = b64.Decode(config.sdes.key);
        config.sdes.salt = b64.Decode(config.sdes.salt);
        return config;
    }

}(typeof window === 'object' ? window : global));
