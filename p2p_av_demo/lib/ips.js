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
var nets = require('os').networkInterfaces();
var i;
var all = [];

function filterAddresses(addr) {
    return !addr.internal && addr.family === 'IPv4';
}

function getAddress(addr) {
    return addr.address;
}

for (i in nets) {
    if (nets.hasOwnProperty(i)) {
        all = all.concat(nets[i].filter(filterAddresses).map(getAddress));
    }
}

// console.log(all[0]);
module.exports = all;