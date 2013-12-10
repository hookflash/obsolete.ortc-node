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
var crypto = require('crypto');
var crc = require('./crc');


var MAGIC_COOKIE = 0x2112A442;

var StunType = {
    BINDING: 0x001
};

var StunClass = {
    REQUEST: 0x0,
    INDICATION: 0x1,
    SUCCESS: 0x2,
    ERROR: 0x3
};

var StunAttribute = {
    MAPPED_ADDRESS: 0x0001,
    USERNAME: 0x0006,
    MESSAGE_INTEGRITY: 0x0008,
    XOR_MAPPED_ADDRESS: 0x0020,
    USE_CANDIDATE: 0x0025,
    FINGERPRINT: 0x8028
};

function StunBindingBuilder(loc, rem) {
    this.local = loc;
    this.remote = rem;
}

function writeAttribute(buf, i, attr) {
    var pad;
    buf.writeUInt16BE(attr.type, i);
    buf.writeUInt16BE(attr.value.length & 0xffff, i + 2);
    attr.value.copy(buf, i + 4);
    i += attr.value.length + 4;
    pad = ((i ^ 0x3) + 1) & 0x3; // round up to a multiple of 4
    buf.fill(0, i, i + pad);
    return i + pad;
}

function calculateIntegrity(buf, i, pwd) {
    var hmac = crypto.createHmac('sha1', new Buffer(pwd));
    var lengthBuf = new Buffer(2);
    // the length after integrity is added (+24), less the stun header (-20)
    lengthBuf.writeUInt16BE(i + 4, 0);
    hmac.update(buf.slice(0, 2));
    hmac.update(lengthBuf);
    hmac.update(buf.slice(4, i));
    return new Buffer(hmac.digest('binary'), 'binary');
}

function calculateFingerprint(buf, i) {
    var copy = new Buffer(i);
    buf.copy(copy, 0, 0, i);
    // the length after addition of fingerprint (+8), less the stun header (-20)
    copy.writeUInt16BE(i - 12, 2);
    return crc.calculate(copy, 0, i) ^ 0x5354554e;
}

StunBindingBuilder.prototype.build = function (tid, attrs) {
    var buf = new Buffer(548);
    var i = 20; // header size
    var username = false;
    var pwd, fingerprint;
    var request = !tid;

    buf.writeUInt8(request ? 0 : 1, 0);
    buf.writeUInt8(1, 1);
    // skip length
    buf.writeInt32BE(MAGIC_COOKIE, 4);
    (tid || crypto.randomBytes(12)).copy(buf, 8, 0, 12);
    (attrs || []).forEach(function (attr) {
        if (attr.type === StunAttribute.USERNAME) {
            username = true;
        }
        i = writeAttribute(buf, i, attr);
    });
    if (request && !username) {
        username = this.remote.username || (this.remote.ufrag + ':' + this.local.ufrag);
        i = writeAttribute(buf, i, {
            type: StunAttribute.USERNAME,
            value: new Buffer(username, 'utf8')
        });
    }
    if (this.remote.pwd) {
        // dvb12.09.28 only if they had one on the request...
        i = writeAttribute(buf, i, {
            type: StunAttribute.MESSAGE_INTEGRITY,
            value: calculateIntegrity(buf, i, this.remote.pwd)
        });
    }
    fingerprint = new Buffer(4);
    fingerprint.writeInt32BE(calculateFingerprint(buf, i), 0); // signed to deal with JS "integer" vagaries
    i = writeAttribute(buf, i, {
        type: StunAttribute.FINGERPRINT,
        value: fingerprint
    });
    // write length
    buf.writeUInt16BE((i - 20) & 0xffff, 2);
    return buf.slice(0, i);
};

function StunParser(pwdMap) {
    this.passwords = pwdMap;
}

StunParser.prototype.readAttribute = function (request, buf, i, attrs) {
    var type = buf.readUInt16BE(i);
    var length = buf.readUInt16BE(i + 2);
    var pad = ((length ^ 0x3) + 1) & 0x3;
    var value = buf.slice(i + 4, i + 4 + length);
    var attr = {
        type: type,
        value: value
    };
    attrs.push(attr);
    this.validateAttribute(request, buf, i, attr);
    return i + 4 + length + pad;
};

StunParser.prototype.validateAttribute = function (request, buf, i, attr) {
    var hmac, integrity, ufrag, idx;
    if (attr.type === StunAttribute.USERNAME) {
        ufrag = attr.value.toString('utf8');
        idx = ufrag.indexOf(':');
        this.ufrag = ufrag.substring(0, idx);
        this.rufrag = ufrag.substring(idx + 1);
        if (!this.passwords[this.ufrag]) {
            throw new Error('Unknown username fragment');
        }
    } else if (attr.type === StunAttribute.MESSAGE_INTEGRITY) {
        integrity = calculateIntegrity(buf, i, this.passwords[this.ufrag]);
        if (attr.value.toString('binary') !== integrity.toString('binary')) {
            throw new Error('Invalid message integrity');
        }
    } else if (attr.type === StunAttribute.FINGERPRINT) {
        if (attr.value.readInt32BE(0) !== calculateFingerprint(buf, i)) { // note, we have to read signed for CRC
            throw new Error('Invalid fingerprint');
        }
    }
};

StunParser.prototype.checkAttributes = function (binding) {
    var fingerprint;
    var j = binding.attributes.length - 1;
    while (j >= 0 && binding.attributes[j].type !== StunAttribute.FINGERPRINT) {
        binding.attributes.pop();
        --j;
    }
    if (j < 0) {
        throw new Error('No fingerprint');
    }
    fingerprint = binding.attributes.pop();
    --j;
    while (j >= 0 && binding.attributes[j].type !== StunAttribute.MESSAGE_INTEGRITY) {
        binding.attributes.pop();
        --j;
    }

    binding.attributes.push(fingerprint);
    return binding;
};

StunParser.prototype.parse = function (buf, ufrag) {
    var i = 20;
    var binding = {};
    var type = buf.readUInt16BE(0);
    var length = buf.readUInt16BE(2) + 20;
    var request;

    this.ufrag = ufrag;

    if (buf.readInt32BE(0) & 0xc003) {
        throw new Error('Leading bits or trailing length bits non-zero');
    }

    binding.type = (type & 0xf) | ((type & 0xe0) >>> 5) | ((type & 0x3e00) >>> 9);
    binding.stunClass = ((type & 0x10) >>> 4) | (type & 0x100 >>> 7);
    request = binding.stunClass === StunClass.REQUEST;
    if (buf.readUInt32BE(4) !== MAGIC_COOKIE) {
        throw new Error('No cookie!');
    }
    binding.transactionId = new Buffer(12);
    buf.copy(binding.transactionId, 0, 8, 20);
    binding.attributes = [];
    while (i < length) {
        i = this.readAttribute(request, buf, i, binding.attributes);
    }
    binding.ufrag = this.ufrag;
    binding.rufrag = this.rufrag;
    this.checkAttributes(binding);
    return binding;
};

if (process.env.stuntest) {
    try {

        require('buffer').INSPECT_MAX_BYTES = 200;

        var localPort = {
            ufrag: 'abc',
            'pwd': 'sh'
        };

        var remotePort = {
            'ufrag': '123',
            'pwd': 'secret'
        };

        var builder = new StunBindingBuilder(localPort, remotePort);
        var pwdMap = {};
        pwdMap[remotePort.ufrag] = remotePort.pwd;
        var parser = new StunParser(pwdMap);
        var buf = builder.build(null, []);
        console.log('request', buf);
        var parsed = parser.parse(buf);
        console.log('parsed request', parsed);

        buf = builder.build(parsed.transactionId, []);
        console.log('response', buf);
        parsed = parser.parse(buf, remotePort.ufrag);
        console.log('parsed response', parsed);
    }
    catch (e) {
        console.warn(e.stack);
    }
}

module.exports = {
    MAGIC_COOKIE: MAGIC_COOKIE,
    StunBindingBuilder: StunBindingBuilder,
    StunParser: StunParser,
    StunAttribute: StunAttribute,
    StunType: StunType,
    StunClass: StunClass
};