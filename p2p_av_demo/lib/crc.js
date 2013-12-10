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


'use strict';/*global ArrayBuffer,Int32Array*/

var backing = new ArrayBuffer(256 * 4);
var table = new Int32Array(backing);

function makeTable() {
    var i, j, c;
    for (i = 0; i < 256; ++i) {
        c = i;
        for (j = 0; j < 8; ++j) {
            if (c & 1) {
                c = 0xedb88320 ^ (c >>> 1);
            } else {
                c >>>= 1;
            }
        }
        table[i] = c;
    }
}

makeTable();

function update(crc, buf, start, end) {
    var i;
    for (i = start; i < end; ++i) {
        crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return crc;
}

function calculate(buf, start, end) {
    start = start || 0;
    end = end || buf.length;
    return ~update(0xffffffff, buf, start, end);
}

module.exports = {
    calculate: calculate
};