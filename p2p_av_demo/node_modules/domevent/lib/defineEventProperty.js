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


(function (g) {
  'use strict'; /*jshint browser:true,node:true*/

  var EventTarget = g.EventTarget;

  /**
   * A helper function for defining event listener properties (the onfoo property for the 'foo' event)
   * @param obj {EventTarget} the event target to attach the property to
   * @param name {string} the name of the event (without the 'on')
   */
  EventTarget.prototype.defineEventProperty = function(name) {
    var currentListener;
    Object.defineProperty(this, 'on' + name, {
      get: function() {
        return currentListener;
      },
      set: function(v) {
        if (currentListener) {
          this.removeEventListener(name, currentListener);
        }
        if (typeof v === 'function') {
          currentListener = v;
          this.addEventListener(name, v);
        } else {
          currentListener = null;
        }
      }
    });
  };
}(typeof window === 'object' ? window : global));