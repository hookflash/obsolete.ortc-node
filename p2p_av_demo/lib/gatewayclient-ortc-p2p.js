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
    'use strict'; /*jshint browser:true,node:false*/
    /*global ortc, RTCConnection, SignallingChannel, alert */


    var gatewayClient = global.gatewayClient;
    var SignallingChannel = global.SignallingChannel;
    var RTCConnection = ortc.RTCConnection;


    var sigCh = null;
    var rtcConn = null;
    var peerReady = false;


    gatewayClient.go = function (action) {

        if (peerReady) {

            if (action.toLowerCase() === 'call') {

                showMessage("Calling...");
                updateCallStat("HangUp");
                signalMessage(JSON.stringify({ "action": "call" }));
            }

            if (action.toLowerCase() === 'hangup') {

                closeConnection();
                signalMessage(JSON.stringify({ "action": "hangup" }));
            }
        }
        else {
            var msg = "Peer (" + (gatewayClient.local === "host" ? "guest" : "host") + ") not ready yet.";
            showMessage(msg, true);
        }
    };

    // update call status
    function updateCallStat(stat) {
        var btn = document.getElementById('go');

        if (btn) {
            btn.value = stat;
            btn.disabled = false;
        }
    }

    // close RTCConnection
    function closeConnection() {
        if (rtcConn) {
            rtcConn.close();
            document.getElementById('pluginholder').style.visibility = 'hidden';
            sigCh.close();
        }
        gatewayClient.initialize();
        window.location.reload();
    }

    // initialize
    gatewayClient.initialize = function () {

        try {
            ortc.getPlugin();
            sigCh = new SignallingChannel();
            sigCh.onmessage = handleMessages;
            peerReady = false;
        }
        catch (e) {
            document.getElementById('go').disabled = true;
            showMessage("ORTC plugin failure.", true);
        }
    };

    // signal message to other peer
    function signalMessage(msg) {

        if (sigCh) {
            sigCh.send(msg);
        }
    }

    // start RTCConnection between two peers
    function start() {
        var options = new ortc.RTCConnectionOptions([new ortc.RTCIceServer("stun:168.61.2.180:8888")]);

        rtcConn = new RTCConnection(options);

        // Send my ICE information to the other peer
        signalMessage(JSON.stringify({ "iceInfo": { "usernameFrag": rtcConn.local.ice.usernameFrag, "password": rtcConn.local.ice.password } }));

        // Apply any local ICE candidate and send it to the remote
        rtcConn.oncandidate = function (evt) {
            console.log('got local ICE candidate: ', evt.candidate.connectionAddress + ':' + evt.candidate.connectionPort);
            //rtcConn.setLocalCandidate(evt.candidate);
            signalMessage(JSON.stringify({ "candidate": evt.candidate }));
        };

        // Get a local stream, show it in a self-view and add it to be sent
        ortc.getUserMedia({ "audio": true, "video": true }, gotMedia, gotMediaError);


        // All candidate discoveries have completed
        rtcConn.onendofcandidates = function (evt) {
            console.log('all candidate discoveries have completed');
        };

        // Candidate local/remote pairing done
        rtcConn.onactivecandidate = function (evt) {
            console.log('candidate local/remote pairing done: ', evt.localCandidate.connectionAddress + ':' + evt.localCandidate.connectionPort +
                ' and ' + evt.remoteCandidate.connectionAddress + ':' + evt.remoteCandidate.connectionPort);
        };

        // Unknown track recieved
        rtcConn.onunknowntrack = function (evt) {
            console.log('unknown track recieved: ', evt.rtpExtHeaders.ssrc);
        };

        // connection state has changed
        rtcConn.onstatechanged = function (evt) {
            console.log('connection state changed to ' + rtcConn.state);

            if (rtcConn.state === ortc.RTCConnectionState.CONNECTED) {
                console.log('ice connection has been established');
                updateCallStat('HangUp');
                showMessage('Call connected...');
                document.getElementById('pluginholder').style.visibility = 'visible';
            }

            if (rtcConn.state === ortc.RTCConnectionState.CLOSED) {
                console.log('ice connection has been lost');
                updateCallStat('Call');
                showMessage('Call disconnected...', true);
            }
        };
    }

    // getUserMedia success handler
    function gotMedia(stream) {

        rtcConn.send(stream);

        // send stream description to the peer
        rtcConn.sendStreams().forEach(function (stream) {
            signalMessage(JSON.stringify({ "stream": stream }));
        });
    }

    // getUserMedia error handler
    function gotMediaError(e) {
        showMessage(e, true);
        console.log('gotMediaError: ', e);
        signalMessage(JSON.stringify({ "error": "Encountered media error: " + e + "\n Please hang up and retry." }));
    }

    function showMessage(msg, err) {

        var stat = document.getElementById('status');

        if (stat) {
            stat.innerText = msg;
            stat.style.color = 'blue';

            if (err) {
                stat.style.color = 'red';
                showAlert(msg);
            }
        }
    }

    function showAlert(msg) {
        document.getElementById('alert').style.display = 'block';
        document.getElementById('alertMsg').innerText = msg;
    }

    // handle messages from other peer
    function handleMessages(evt) {

        var message = JSON.parse(evt.data);

        if (message.start) {

            document.getElementById('go').disabled = false;
            showMessage("Ready to connect.");
            peerReady = true;
            return;
        }

        if (message.action) {

            if (message.action === 'call') {
                start();
            }

            if (message.action === 'hangup') {
                closeConnection();
            }

            return;
        }

        if (message.stop) {

            showMessage("Connection terminated. Please restart demo.", true);
            closeConnection();
            return;
        }

        if (message.error) {
            console.log(message.error);
            showMessage(message.error, true);
            return;
        }

        var msg = '';

        if (message.duplicate) {
            msg = 'Another ' + (gatewayClient.local === "guest" ? "guest" : "host") + ' is opened from different location. Please close that and try again.';
            document.getElementById('go').disabled = true;
            console.log(msg);
            showMessage(msg, true);
            return;
        }

        if (message.socket) {

            if (message.socket === 'disconnect') {
                msg = 'This client has disconnected from the signalling channel.';
                document.getElementById('go').disabled = true;
                console.log(msg);
                showMessage(msg, true);
            }

            return;
        }

        if (rtcConn) {
            if (message.iceInfo) {

                rtcConn.remote.ice.usernameFrag = message.iceInfo.usernameFrag;
                rtcConn.remote.ice.password = message.iceInfo.password;
                rtcConn.connect();
                return;
            }

            if (message.candidate) {

                console.log('got remote ICE candidate: ', message.candidate.connectionAddress + ':' + message.candidate.connectionPort);
                rtcConn.addRemoteCandidate(message.candidate);
                return;
            }

            if (message.stream) {

                console.log('got recieving stream: ', message.stream);
                rtcConn.receive(message.stream);
                return;
            }
        }
    }

    // get RTCCapabilities
    function getCapabilities() {
        var util = ortc.util;

        var capabilities = util.getRTCCapabilities();

        var audCodec = util.getRTCCodec("PCMU");
        var vdoCodec = util.getRTCCodec("H264");
    }

}(typeof window === 'object' ? window : global));