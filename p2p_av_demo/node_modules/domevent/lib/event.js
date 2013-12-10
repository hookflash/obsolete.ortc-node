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
interface Event
{
  // PhaseType
  const unsigned short              NONE            = 0;
  const unsigned short              CAPTURING_PHASE = 1;
  const unsigned short              AT_TARGET       = 2;
  const unsigned short              BUBBLING_PHASE  = 3;

  readonly attribute DOMString      type;
  readonly attribute EventTarget?   target;
  readonly attribute EventTarget?   currentTarget;
  readonly attribute unsigned short eventPhase;
  readonly attribute boolean        bubbles;
  readonly attribute boolean        cancelable;
  readonly attribute DOMTimeStamp   timeStamp;
  void                              stopPropagation();
  void                              preventDefault();
  void                              initEvent(DOMString eventTypeArg, 
                                              boolean canBubbleArg, 
                                              boolean cancelableArg);
  // Introduced in DOM Level 3:
  void                              stopImmediatePropagation();
  readonly attribute boolean        defaultPrevented;
  readonly attribute boolean        isTrusted;
};
 */

(function(g) {
  'use strict'; /*jshint browser:true,node:true*/

  var Event = g.Event = function(type, bubbles, cancelable) {
      this.initEvent(type, bubbles, cancelable);
      Object.defineReadOnlyProperty(this, 'defaultPrevented', false);
      Object.defineReadOnlyProperty(this, 'isTrusted', false);
    };

  Event.NONE = 0;
  Event.CAPTURING_PHASE = 1;
  Event.AT_TARGET = 2;
  Event.BUBBLING_PHASE = 3;

  function notImplemented() {
    throw new Error('not implemented');
  }

  Event.prototype.stopPropagation = notImplemented;
  Event.prototype.preventDefault = notImplemented;
  Event.prototype.stopImmediatePropagation = notImplemented;
  Event.prototype.initEvent = function(type, bubbles, cancelable) {
    if (!type) {
       throw new Error('Not enough arguments');
    }
    if (bubbles || cancelable) {
      throw new Error('no bubbles/cancels');
    }
    Object.defineReadOnlyProperty(this, 'type', type);
    Object.defineReadOnlyProperty(this, 'bubbles', false);
    Object.defineReadOnlyProperty(this, 'cancelable', false);
  };
}(typeof window === 'object' ? window : global));