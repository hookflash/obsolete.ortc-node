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
    /*global EventTarget, gatewayClient, Event, b64, window, io ortc*/

    var self = null;
    var clientSocket = null;


    function SignallingChannel() {
        EventTarget.call(this);

        self = this;
        this.defineEventProperty('message');

        start();
    }

    Object.inherits(SignallingChannel, EventTarget);


    SignallingChannel.prototype.send = function (data) {

        data = JSON.parse(data);

        if (data.iceInfo) {
            console.log('iceInfo');

            data = JSON.stringify({
                iceInfo:
                    {
                        usernameFrag: gatewayClient.remoteConfig.port.ufrag,
                        password: gatewayClient.remoteConfig.port.pwd
                    }
            }, null, 4);

            dispatchMessage(data);
            return;
        }

        if (data.candidate) {

            clientSocket.emit('message',
           {
               kind: 'remotecandidate',
               type: (gatewayClient.local === 'host' ? 0 : 1),
               candidate: data.candidate,
               token: gatewayClient.key
           });

            return;
        }

        if (data.track) {

            clientSocket.emit('message',
           {
               kind: 'track',
               type: (gatewayClient.local === 'host' ? 0 : 1),
               track: data.track,
               token: gatewayClient.key
           });

            return;
        }

        if (data.action) {

            clientSocket.emit('message',
           {
               kind: 'action',
               type: (gatewayClient.local === 'host' ? 0 : 1),
               action: data.action,
               token: gatewayClient.key
           });

            return;
        }

        if (data.error) {

            clientSocket.emit('message',
           {
               kind: 'error',
               type: (gatewayClient.local === 'host' ? 0 : 1),
               error: data.error,
               token: gatewayClient.key
           });

            return;
        }
    };

    SignallingChannel.prototype.close = function () {
        //if (clientSocket) {
        //    clientSocket.disconnect();
        //    clientSocket = null;
        //}
    };

    function start() {

        if (!clientSocket) {
            clientSocket = connect(handleSocketIoMsg, function () {
                console.log('socketio: disconnected');
                dispatchMessage(JSON.stringify({ socket: 'disconnect' }));
            });
        }
        else {
            clientSocket.emit('message',
                           {
                               kind: 'register',
                               token: gatewayClient.key,
                               type: (gatewayClient.local === 'host' ? 0 : 1)
                           });
        }
    }

    function dispatchMessage(msg, type) {

        var evt = new Event('message');
        evt.data = msg;
        self.dispatchEvent(evt);
    }

    function handleSocketIoMsg(e) {

        if (e.kind === 'connect') {
            console.log('socketio: connected');

            clientSocket.emit('message',
                            {
                                kind: 'register',
                                token: gatewayClient.key,
                                type: (gatewayClient.local === 'host' ? 0 : 1)
                            });
        }
        else if (e.kind === 'start') {
            console.log('socketio: start');

            dispatchMessage(JSON.stringify({ start: 'start' }));
        }
        else if (e.kind === 'remotecandidate') {
            console.log('socketio: remotecandidate');

            dispatchMessage(JSON.stringify({ candidate: e.candidate }));
        }
        else if (e.kind === 'stop') {
            console.log('socketio: stop');

            dispatchMessage(JSON.stringify({ stop: 'stop' }));
        }
        else if (e.kind === 'track') {
            console.log('socketio: track');

            dispatchMessage(JSON.stringify({ track: e.track }));
        }
        else if (e.kind === 'action') {
            console.log('socketio: action');
            dispatchMessage(JSON.stringify({ action: e.action }));
        }
        else if (e.kind === 'error') {
            console.log('socketio: error');
            dispatchMessage(JSON.stringify({ error: e.error }));
        }
        else if (e.kind === 'duplicate') {
            console.log('socketio: duplicate');
            dispatchMessage(JSON.stringify({ duplicate: true }));
        }
    }

    function connect(messageHandlerCb, disconnectCb) {
        var hostname = window.document.location.hostname;
        var port = window.document.location.port;
        var url = 'http://' + hostname + ':' + port;

        var resultSocket = io.connect(url, { 'force new connection': true }); // as per https://github.com/LearnBoost/socket.io-client/issues/318
        //var resultSocket = io.connect(url);

        resultSocket.on('message', messageHandlerCb);

        if (messageHandlerCb) {
            resultSocket.on('connect', function () {
                messageHandlerCb({ kind: 'connect' });
            });
        }

        if (disconnectCb) {
            resultSocket.on('disconnect', function () {
                disconnectCb({ kind: 'disconnect' });
            });
        }

        return resultSocket;
    }


    global.SignallingChannel = SignallingChannel;


}(typeof window === 'object' ? window : global));
