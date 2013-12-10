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
/*
WEBIDL
// Introduced in DOM Level 2:
interface EventTarget
{
  // Modified in DOM Level 3:
  void    addEventListener(DOMString type, 
                           EventListener? listener, 
                           optional boolean useCapture = false);
  void    removeEventListener(DOMString type, 
                              EventListener? listener, 
                              optional boolean useCapture = false);
  boolean dispatchEvent(Event event);
};
*/

(function(g) {
  'use strict'; /*jshint browser:true,node:true*/

  var Event = g.Event;

  var EventTarget = g.EventTarget = function() {
      Object.defineProperty(this, 'listeners', {
        value: {},
        writable: false,
        enumerable: false
      });
    };

  /**
   * Add an event listener.
   * @param name {string} the name of the event
   * @param handler {function} the function to call
   */
  EventTarget.prototype.addEventListener = function(name, handler) {
    if(!this.listeners[name]) {
      this.listeners[name] = [];
    }
    if(typeof handler === 'function' || (typeof handler === 'object' && typeof handler.handleEvent === 'function')) {
      this.listeners[name].push(handler);
    } else {
      throw new Error('handler is neither function nor EventListener');
    }
  };

  EventTarget.prototype.removeEventListener = function(name, func) {
    var idx;
    if(!this.listeners[name]) {
      return;
    }
    idx = this.listeners[name].indexOf(func);
    if(idx >= 0) {
      this.listeners[name].splice(idx, 1);
    }
  };

  EventTarget.prototype.dispatchEvent = function(evt) {
    var notify;
    if(!(evt instanceof Event)) {
      throw new Error('can\'t dispatch a non-Event');
    }
    Object.defineReadOnlyProperty(evt, 'target', this);
    Object.defineReadOnlyProperty(evt, 'currentTarget', this);
    Object.defineReadOnlyProperty(evt, 'timeStamp', new Date());
    Object.defineReadOnlyProperty(evt, 'eventPhase', Event.AT_TARGET);

    function call(f) {
      try {
        if(typeof f === 'function') {
          f(evt);
        } else {
          f.handleEvent.call(f, evt);
        }
      } catch(e) {
        if(console && console.log) {
          console.log('error in event dispatch', e, e.stack);
        }
      }
    }

    if(this.listeners[evt.type]) {
      notify = this.listeners[evt.type].slice(); // clone to fix the current set of listeners
      g.setTimeout(function() {
        notify.forEach(call);
      }, 0);
    }
  };
}(typeof window === 'object' ? window : global));