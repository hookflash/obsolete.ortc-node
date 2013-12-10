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


'use strict';
var ip = require('./ips')[0];
var port = 8888;

/*
 * Modules
 */
var http = require('http');
var dgram = require('dgram');
var crypto = require('crypto');
var fs = require('fs');
var stun = require('./stun');
var socketio = require('socket.io');

/*
 * Global variables.
 */
var passwords;
var parser;
var httpServer = null;
var ioSocket = null;
var udpSocket;
var configs = {};
var rooms = {};
var sessions = {};


var clientJs = {

    '/signallingchannel.js': 'signallingchannel.js',
    '/gatewayclient-p2p.js': 'gatewayclient-p2p.js',
    '/gatewayclient-ortc-p2p.js': 'gatewayclient-ortc-p2p.js',
    '/objext.js': '../node_modules/objext/lib/objext.js',
    '/base64.js': '../node_modules/base64/lib/base64.js',
    '/event.js': '../node_modules/domevent/lib/event.js',
    '/eventTarget.js': '../node_modules/domevent/lib/eventTarget.js',
    '/defineEventProperty.js': '../node_modules/domevent/lib/defineEventProperty.js',

    '/ortc.js': '../node_modules/ortc/src/ortc.js',
    '/dictionaries.js': '../node_modules/ortc/src/dictionaries.js',
    '/RTCSocket.js': '../node_modules/ortc/src/RTCSocket.js',
    '/RTCTrack.js': '../node_modules/ortc/src/RTCTrack.js',
    '/RTCConnection.js': '../node_modules/ortc/src/RTCConnection.js',
    '/MediaStream.js': '../node_modules/ortc/src/MediaStream.js',
    '/getUserMedia.js': '../node_modules/ortc/src/getUserMedia.js',

    '/checker.js': '../node_modules/ice.js/lib/checker.js',
    '/candidateevent.js': '../node_modules/ice.js/lib/candidateevent.js',
    '/reflexive.js': '../node_modules/ice.js/lib/reflexive.js',
    '/transport.js': '../node_modules/ice.js/lib/transport.js',
    '/gather.js': '../node_modules/ice.js/lib/gather.js',
    '/transportbuilder.js': '../node_modules/ice.js/lib/transportbuilder.js'
};

/*
 * Other functions.
 */
function init() {
    rooms = {};
    configs = {};
    passwords = {};
    parser = new stun.StunParser(passwords);
}

init();

function closeRooms(key) {
    console.log('closeRooms');

    if (rooms.hasOwnProperty(key)) {
        console.log('terminating room[' + key + ']...');
        var room = rooms[key];
        var host = room.clients[0];
        var guest = room.clients[1];

        if (host) {
            host.emit('message', { kind: 'stop' });
        }

        if (guest) {
            guest.emit('message', { kind: 'stop' });
        }

        rooms[key].clients = [];
    }
}

function startsWith(str, sub) {
    return str.substring(0, sub.length) === sub;
}

function derived(base, tag, length) {
    var hmac = crypto.createHmac('sha256', base);
    hmac.update(tag);
    var output = new Buffer(hmac.digest('binary'), 'binary');
    if (length) {
        output = output.slice(0, length);
    }
    return output.toString('base64');
}

function randomSsrc() {
    return crypto.randomBytes(4).readInt32BE(0) >>> 1; // avoid the nasty sign bit
}

function generateSideSpecificFields(key, tag) {
    var config = {
        port: {
            ip: process.env.gateway_ip || ip,
            port: port,
            ufrag: key.toString('base64') + '-' + tag,
            pwd: derived(key, tag + 'pwd', 12)
        },
        sdes: {
            key: derived(key, tag + 'key', 16),
            salt: derived(key, tag + 'salt', 14)
        },
        ssrc: randomSsrc()
    };

    passwords[config.port.ufrag] = config.port.pwd;
    return config;
}

function newConfig() {
    var key = crypto.randomBytes(12);
    var config = {
        key: key.toString('base64'),
        host: generateSideSpecificFields(key, 'host'),
        guest: generateSideSpecificFields(key, 'guest')
    };

    configs[config.key] = config;
    console.log('generated config', config);
    return config.key;
}

function httpHandler(req, res) {
    var key;
    var sessId;

    console.log('req.url: ', req.url);

    if (req.method === 'GET') {
        if (req.url === '/') {
            res.writeHead(302, {
                Location: '/index.html'
            });
            res.end();
        } else if (startsWith(req.url, '/config/')) {
            key = req.url.substring(req.url.indexOf('/', 1) + 1);
            if (!configs[key]) {
                res.writeHead(404);
                res.end();
            } else {
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Cache-Control': 'no-cache'
                });
                res.end(JSON.stringify(configs[key], null, 4));
            }
        } else if (req.url === '/status') {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=UTF-8'
            });

            var status;
            for (var room in rooms) {
                if (rooms.hasOwnPropery(room)) {
                    status.room = room;
                    status.passwords = passwords;
                }
            }

            res.end(JSON.stringify({
                status: status
            }), null, 4);
        } else if (startsWith(req.url, '/ortcreg/')) {
            var newconf = newConfig();
            rooms[newconf] = { online: false, clients: [] };

            console.log('room created for config ', newconf);

            sessId = req.url.substring(req.url.indexOf('/', 1) + 1);

            if (!sessions[sessId]) {
                sessions[sessId] = [];
            }

            sessions[sessId].push(newconf);

            res.writeHead(302, {
                Location: '/ortc/' + newconf
            });
            res.end();
        } else if (startsWith(req.url, '/ortc/')) {
            key = req.url.substring(req.url.indexOf('/', 1) + 1);
            if (!configs[key]) {
                res.writeHead(404);
                res.end();
            } else {
                res.writeHead(200);
                key = req.url.substring(1, req.url.indexOf('/', 1));
                res.end(fs.readFileSync(__dirname + '/gatewayclient-' + key + '.html'));
            }
        } else if (req.url === '/index.html') {
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=UTF-8'
            });
            res.end(fs.readFileSync(__dirname + '/index.html'));
        } else if (clientJs[req.url]) {
            res.writeHead(200, {
                'Content-Type': 'application/javascript; charset=UTF-8'
            });
            res.end(fs.readFileSync(__dirname + '/' + clientJs[req.url]));
        } else {
            res.writeHead(404);
            res.end();
        }
    } else if (startsWith(req.url, '/reset/') && req.method === 'POST') {

        sessId = req.url.substring(req.url.indexOf('/', 1) + 1);
        var sess = sessions[sessId];

        if (sess) {
            sess.forEach(function (roomkey) {
                closeRooms(roomkey);
            });
        }

        res.writeHead(200);
        res.end();
    } else {
        res.writeHead(406, {
            Allow: 'GET'
        });
        res.end();
    }
}

httpServer = http.createServer(httpHandler);
httpServer.listen(port);
ioSocket = socketio.listen(httpServer);

function handleMessage(socket, data) {

    console.log('data.kind: ' + data.kind);

    /*
     * Message type means it is guest or host.
     * For host it's 0, for guest - 1.
     */
    var host = null;
    var guest = null;
    var configKey = data.token;
    var type = data.type;

    if (data.kind === 'register') {

        if (!configKey || !rooms[configKey]) {
            return;
        }

        console.log('[', socket.id, '] was registered, token: ', configKey, 'type: ', (type === 0 ? 'host' : 'guest'));

        if (rooms[configKey].clients[type] && rooms[configKey].clients[type].action) {
            socket.emit('message', { kind: 'duplicate' });
        }
        else {

            if (rooms[configKey].clients[type]) {
                rooms[configKey].clients[type].disconnect();
            }

            rooms[configKey].clients[type] = socket;

            host = rooms[configKey].clients[0];
            guest = rooms[configKey].clients[1];

            if (host && guest) {
                host.emit('message', { kind: 'start' });
                guest.emit('message', { kind: 'start' });
            }
        }
    }
    else if (data.kind === 'stop') {
        closeRooms(configKey);
    }
    else if (data.kind === 'action') {

        if (rooms && rooms[configKey] && rooms[configKey].clients && rooms[configKey].clients.length > 1) {
            var action = data.action;

            console.log('action = ' + action);

            host = rooms[configKey].clients[0];
            guest = rooms[configKey].clients[1];

            if (rooms[configKey].clients[type]) {
                rooms[configKey].clients[type].action = action;
            }

            if (action === 'call') {

                if (host && host.action === action && guest && guest.action === action) {
                    host.emit('message', { kind: 'action', action: action });
                    guest.emit('message', { kind: 'action', action: action });

                    rooms[configKey].clients[0].action = '1';
                    rooms[configKey].clients[1].action = '1';
                    console.log('emit both call');
                }
            }

            if (action === 'hangup') {
                if (host && guest) {
                    host.emit('message', { kind: 'action', action: action });
                    guest.emit('message', { kind: 'action', action: action });
                }
            }
        }
    }
    else {
        // forwarding packets to other peer.

        if (!configKey || !rooms[configKey]) {
            return;
        }

        var otherType = (data.type === 0 ? 1 : 0);

        console.log('[', socket.id, '] sending general messsage, token: ', configKey, 'type: ', data.type, 'othertype: ', otherType);

        var s = rooms[configKey].clients[otherType];

        if (s) {
            s.emit('message', data);
        }
    }
}

function handleDisconnect(socket) {
    console.log('[', socket.id, '] was disconnected');

    for (var keyR in rooms) {
        if (rooms.hasOwnProperty(keyR)) {

            var clients = rooms[keyR].clients;

            for (var keyC in clients) {
                if (clients.hasOwnProperty(keyC)) {

                    console.log('client socket.id: ' + clients[keyC].id);
                    if (clients[keyC].id === socket.id) {
                        closeRooms(keyR);
                        return;
                    }
                }
            }
        }
    }
}

ioSocket.on('connection', function (client) {
    console.log('[', client.id, '] was connected');

    client.on('message', function (data) {
        handleMessage(client, data);
    });

    client.on('disconnect', function () {
        handleDisconnect(client);
    });
});

function isType(type) {
    return function (attr) {
        return attr.type === type;
    };
}

function ipToInt32(ip) {
    var intVal = 0;
    var i;
    var piece = 0;
    for (i = 0; i < ip.length; ++i) {
        if (ip.charAt(i) === '.') {
            intVal += piece;
            piece = 0;
            intVal = (intVal * 256);
        } else {
            piece = (piece * 10) + parseInt(ip.charAt(i), 10);
        }
    }
    intVal += piece;
    return intVal;
}

function buildMappedAddress(rinfo) {
    var xor = stun.MAGIC_COOKIE;
    var type = stun.StunAttribute.XOR_MAPPED_ADDRESS;

    var mappedAddress = new Buffer(8);
    mappedAddress.writeUInt16BE(1, 0);
    var portX = rinfo.port ^ ((xor >> 16) & 0x0000ffff);
    var ip32X = ipToInt32(rinfo.address) ^ xor;
    mappedAddress.writeUInt16BE(portX, 2);
    mappedAddress.writeInt32BE(ip32X, 4);

    return {
        type: type,
        value: mappedAddress
    };
}

function buildResponse(binding, rinfo) {
    var attrs = [];
    var builder = new stun.StunBindingBuilder({}, {
        ufrag: binding.ufrag,
        pwd: passwords[binding.ufrag]
    });

    // echo nominations
    if (binding.attributes.some(isType(stun.StunAttribute.USE_CANDIDATE))) {
        attrs.push({
            type: stun.StunAttribute.USE_CANDIDATE,
            value: new Buffer(0)
        });
    }

    // send the XOR-MAPPED-ADDRESS
    attrs.push(buildMappedAddress(rinfo));
    return builder.build(binding.transactionId, attrs);
}

function answerMessage(err, bytes) {
    if (err) {
        console.warn('error', err);
    }
}

udpSocket = dgram.createSocket('udp4');

udpSocket.on('message', function (msg, rinfo) {
    var binding, response;

    // we use udp only for taking stun checks.
    console.log('udpSocket : onmessage');

    try {
        binding = parser.parse(msg);

        if (binding.type === stun.StunType.BINDING && binding.stunClass === stun.StunClass.RESPONSE) {
            console.log('response!', binding);
        }

        if (binding.type !== stun.StunType.BINDING || binding.stunClass !== stun.StunClass.REQUEST) {
            throw new Error('Not a STUN Binding request');
        }

        response = buildResponse(binding, rinfo);
        udpSocket.send(response, 0, response.length, rinfo.port, rinfo.address, answerMessage);

    } catch (e) {
        console.log(e.stack);
    }
});

udpSocket.bind(port);
