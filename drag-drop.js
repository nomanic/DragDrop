/**
 * DragDrop.js
 *
 * A JavaScript micro-framework for adding drag-and-drop functionality
 * to elements for advanced UI development.
 *
 * @author     James Brumond
 * @version    0.3.0
 * @copyright  Copyright 2011 James Brumond
 * @license    Dual licensed under MIT and GPL
 */

/*jshint browser: true, bitwise: false, camelcase: false, eqnull: true, latedef: false,
  plusplus: false, jquery: true, shadow: true, smarttabs: true, loopfunc: true */

(function() {

	var

	// Is this a touch device?
	touchEvents = (('ontouchstart' in window)||(navigator.MaxTouchPoints > 0)||(navigator.msMaxTouchPoints > 0)),
	isIE = navigator.appName.indexOf('Microsoft Internet Explorer') != -1,
	// A class to add when an element is being dragged
	dragClass = 'drag',

	/**
	 * The DragDrop namespace
	 *
	 * Example:
	 *
	 *   DragDrop.bind ( element[, options ]);
	 *   DragDrop.unbind ( reference );
	 *
	 * @access  public
	 */
	DragDrop = (function() {
		var self = { },

		// Determine the events to bind to
		events = (touchEvents ?
			{
				start: 'touchstart',
				move: 'touchmove',
				end: 'touchend'
			} : {
				start: 'mousedown',
				move: 'mousemove',
				end: 'mouseup'
			}
		),

		// Elements already bound
		bindings = [ ],

		// Check if a given binding (element/anchor pair) already exists
		bindingExists = function(element, anchor) {
			for (var i = 0, c = bindings.length; i < c; i++) {
				if (bindings[i] && bindings[i].element === element && bindings[i].anchor === anchor) {
					return true;
				}
			}
			return false;
		},

		// Do something with a given binding's given event stack
		withBindingEvent = function(reference, event, func) {
			if (bindings[reference._id] && bindings[reference._id].events[event]) {
				func(bindings[reference._id].events[event]);
			}
		},

		// Parse the arguments of DragDrop.bind
		parseOptions = function(element, options) {
			options = options || { };
			options.element = element;
			options.anchor = options.anchor || element;
			options.boundingBox = options.boundingBox || null;
			options.releaseAnchors = options.releaseAnchors || [ ];
			options.releaseAnchors.unshift(document);
			return options;
		},

		// The next binding ID to use
		nextBinding = 1,

	// ------------------------------------------------------------------
	//  A constructor for a resource type used in referencing bindings

		BindingReference = function() {
			this._id = nextBinding++;
		};

		BindingReference.prototype.unbind = function() {
			return DragDrop.unbind(this);
		};

		BindingReference.prototype.bindEvent = function(event, func) {
			return DragDrop.bindEvent(this, event, func);
		};

		BindingReference.prototype.unbindEvent = function(event, func) {
			return DragDrop.unbindEvent(this, event, func);
		};

		BindingReference.prototype.invokeEvent = function(event, source) {
			return DragDrop.invokeEvent(this, event, source);
		};

		BindingReference.prototype.setBoundingBox = function(box) {
			bindings[this._id].boundingBox = box;
		};

	// ----------------------------------------------------------------------------
	//  Public Functions

		// Make an element draggable
		self.bind = function(element, options) {
			options = parseOptions(element, options);
			if (! isObject(options.element)) {
				throw new Error('Must give an element to drag');
			}
			if (getStyle(options.element, 'position') === 'static') {
				throw new Error('Cannot drag-drop an element with position:static');
			}
			// Check to make sure the elements aren't already bound
			if (! bindingExists(options.element, options.anchor)) {
				// Initialize the binding object
				var reference = new BindingReference();
				var binding = {
					element: options.element,
					anchor: options.anchor,
					child: options.childscroll,
					center: options.center,
					click: options.click,
					dclick: options.dclick,
					clc:0,
					mving:0,
					momentum: options.momentum,
					mass: options.momentum,
					drag: options.drag?options.drag:0.95,
					params: options.params,
					releaseAnchors: options.releaseAnchors,
					dragging: false,
					event: null,
					shouldUnbind: false,
					boundingBox: options.boundingBox,
					events: {
						beforedrag: Callstack(options.beforedrag),
						dragstart: Callstack(options.dragstart),
						dragend: Callstack(options.dragend),
						drag: Callstack(options.drag),
						unbind: Callstack(options.unbind)
					}
				};
				// Bind the first event
				binding.event = Events.bind(binding.child?binding.child:binding.anchor, events.start, function(e) {
					// Make sure it's a left click or touch event
					if ((window.event && e.button === 1) || e.button === 0 || touchEvents) {
						stopEvent(e);
						var chld=binding.child,ox=touchEvents ?e.changedTouches[0].pageX:e.clientX,oy=touchEvents ?e.changedTouches[0].pageY:e.clientY,b=binding.element,oh=b.offsetHeight,ow=b.offsetWidth,db=binding.dclick;
						// Call any "beforedrag" events before calculations begin
						binding.events.beforedrag.call(
							b, new DragEvent('beforedrag', e, binding), binding.params
						);
						// Make sure everyone knows the element is being dragged
						binding.dragging = true;
						addClass(b, dragClass);
						// Start calculating movement
						var fp=fPosXY(b),xp=(binding.center==1)?(ox-fp[0])-(ow/2):0,yp=(binding.center==1)?(oy-fp[2])-(oh/2):0;
						// These are used in some bounding box calculations
						if (chld) {
							var startX = b.scrollLeft,startY = b.scrollTop;
							var startOffsetLeft = b.scrollLeft,startOffsetTop = b.scrollTop,startTotalOffset = fPosSC(chld);
							b.x0=b.scrollLeft;
							b.y0=b.scrollTop;
						}
						else {
							var startX = getPos(b, 'left')+xp,startY = getPos(b, 'top')+yp;
							var startOffsetLeft = b.offsetLeft,startOffsetTop = b.offsetTop,startTotalOffset = getOffset(b);
							b.x0=b.offsetLeft;
							b.y0=b.offsetTop;
						}
						// A place to hold on to event functions we are going to unbind later
						var tempEvents = [ ];
						// The target for the move and end events is dependent on the input type
						var target = (touchEvents ? binding.anchor : document);
						if (binding.clc==0) {
							binding.clc=1;
							var iw=(binding.click?(binding.tm=requestTimeout(click,500)):0);
						}
						else if ((binding.clc==1)&&(db)) {
							binding.clc=0;
							var iw4=binding.tm?clearRequestTimeout(binding.tm):0,iw=db?db(b):0;
							return stopEvent(e);
						}
						b.vx=0;
						b.vy=0;
						b.d0 = new Date();
						b.d2 = new Date();
						// Bind the movement event
						tempEvents.push(Events.bind(target, events.move, function(e2) {
							// Find all needed offsets
							var ox2=touchEvents ?e2.changedTouches[0].pageX:e2.clientX,oy2=touchEvents ?e2.changedTouches[0].pageY:e2.clientY,b=binding.element,oh=b.offsetHeight,ow=b.offsetWidth;
							b.d0 = b.d2;
							b.d2 = new Date();
							if ((distancem(ox2,oy2,ox,oy)>3)||(binding.clc==2)) {
								binding.clc=2;
								var iw=binding.tm?clearRequestTimeout(binding.tm):0;
								if (chld) {
									b.x0=b.scrollLeft;
									b.y0=b.scrollTop;
									var posX=(startX - (ox2-ox));
									var posY=(startY - (oy2-oy));
								}
								else {
									b.x0=b.offsetLeft;
									b.y0=b.offsetTop;
									var posX=(startX + (ox2-ox));
									var posY=(startY + (oy2-oy));
								}
								// Enforce any bounding box
								if (binding.boundingBox) {
									var box = binding.boundingBox;
									var minX, maxX, minY, maxY;
									// Bound inside offset parent
									if (box === 'offsetParent') {
										var parent = binding.element.offsetParent;
										if (getStyle(binding.element, 'position') === 'relative') {
											minX = -startOffsetLeft;
											minY = -startOffsetTop;
										} else {
											minX = minY = 0;
										}
										maxX = parent.clientWidth + minX;
										maxY = parent.clientHeight + minY;
									}
									// Bound to the dimensions of the window
									else if (box === 'windowSize') {
										var dimensions = getWindowSize();
										if (getStyle(binding.element, 'position') === 'relative') {
											minX = -startTotalOffset.x;
											minY = -startTotalOffset.y;
										} else {
											minX = minY = 0;
										}
										maxX = dimensions.x + minX;
										maxY = dimensions.y + minY;
									}
									// Manual bounding box
									else {
										minX = box.x.min;
										maxX = box.x.max;
										minY = box.y.min;
										maxY = box.y.max;
									}
									posX = Math.max(minX, Math.min(maxX - ow, posX));
									posY = Math.max(minY, Math.min(maxY - oh, posY));
								}
								if (chld) {
										// Move the element
										b.scrollLeft = IV(posX);
										b.scrollTop = IV(posY);
										binding.x=b.scrollLeft;
										binding.y=b.scrollTop;
								}
								else {
										// Move the element
										b.style.left = posX + 'px';
										b.style.top = posY + 'px';
										binding.x=b.offsetLeft;
										binding.y=b.offsetTop;
								}
								// Call any "drag" events
								binding.events.drag.call(
									b, new DragEvent('drag', e2, binding), binding.params
								);
							}
							return stopEvent(e2);
						}));
						// Bind the release events
						for (var i = 0, c = binding.releaseAnchors.length; i < c; i++) {
							var elem = binding.releaseAnchors[i];
							tempEvents.push(
								Events.bind(elem, events.end, onRelease(elem))
							);
						}
						// Avoid text selection problems
						document.body.focus();
						tempEvents.push(Events.bind(document, 'selectstart', false));
						tempEvents.push(Events.bind(binding.anchor, 'dragstart', false));
						// Call any "dragstart" events
						binding.events.dragstart.call(
							b, new DragEvent('dragstart', e, binding), binding.params
						);
						return false;
					}
					function mover() {
						if (binding.mving) {return;}
						binding.mving=1;
						var b=binding.element;
						if ((Math.abs(b.vx)>0.5)||(Math.abs(b.vy)>0.5)) {
							var tt=Math.abs((new Date().getTime() - (b.d0).getTime())/1000);
							if (binding.child) {
								var iw=(binding.x-=(b.vx*tt)+(b.vx=b.vx*(1-(binding.drag*tt))))+(binding.y-=(b.vy*tt)+(b.vy=b.vy*(1-(binding.drag*tt))))+(b.d0 = new Date());
							}
							else {
								var iw=(binding.x+=(b.vx*tt)+(b.vx=b.vx*(1-(binding.drag*tt))))+(binding.y+=(b.vy*tt)+(b.vy=b.vy*(1-(binding.drag*tt))))+(b.d0 = new Date());
							}
							var posX=binding.x;
							var posY=binding.y;
							// Enforce any bounding box
							if (binding.boundingBox) {
								var box = binding.boundingBox;
								var minX, maxX, minY, maxY;
								// Bound inside offset parent
								if (box === 'offsetParent') {
									var parent = binding.element.offsetParent;
									if (getStyle(binding.element, 'position') === 'relative') {
										minX = -startOffsetLeft;
										minY = -startOffsetTop;
									} else {
										minX = minY = 0;
									}
									maxX = parent.clientWidth + minX;
									maxY = parent.clientHeight + minY;
								}
								// Bound to the dimensions of the window
								else if (box === 'windowSize') {
									var dimensions = getWindowSize();
									if (getStyle(binding.element, 'position') === 'relative') {
										minX = -startTotalOffset.x;
										minY = -startTotalOffset.y;
									} else {
										minX = minY = 0;
									}
									maxX = dimensions.x + minX;
									maxY = dimensions.y + minY;
								}
								// Manual bounding box
								else {
									minX = box.x.min;
									maxX = box.x.max;
									minY = box.y.min;
									maxY = box.y.max;
								}
								posX = Math.max(minX, Math.min(maxX - b.offsetWidth, posX));
								posY = Math.max(minY, Math.min(maxY - b.offsetHeight, posY));
							}
							if (binding.child) {
									// Move the element
									b.scrollLeft = posX;
									b.scrollTop = posY;
									binding.x=IV(b.scrollLeft);
									binding.y=IV(b.scrollTop);
							}
							else {
									// Move the element
									b.style.left = posX + 'px';
									b.style.top = posY + 'px';
									binding.x=b.offsetLeft;
									binding.y=b.offsetTop;
							}
							requestTimeout(mover,100);
						}
						else {
							b.vx=0;
							b.vy=0;
						}
						binding.mving=0;
					}
					function click(e) {
						binding.clc=0;
						var o=binding.click,iw=o?o(binding.element):0;
					}
					function distancem(x0, y0, x1, y1) {
						return Math.sqrt((x0 - x1) * (x0 - x1) + (y0 - y1) * (y0 - y1));
					}
					function onRelease(elem) {
						return function(e2) {
							var b=binding.element;
							// Unbind move and end events
							for (var i = 0, c = tempEvents.length; i < c; i++) {
								Events.unbind(tempEvents[i]);
							}
							// Clean up...
							binding.dragging = false;
							removeClass(b, dragClass);
							if (binding.shouldUnbind) {
								DragDrop.unbind(b, binding.anchor);
							}
							// Call any "dragend" events
							if (binding.clc==2) {
								binding.clc=0;
								binding.events.dragend.call(
									b, new DragEvent('dragend', e2, binding, {
										releaseAnchor: elem
									}, binding.params)
								);
								if (binding.momentum) {
									b.d1 = new Date();
									var v,tt = Math.abs((b.d1.getTime() - b.d0.getTime())/500),t2=(tt*tt),iw4=0.0001*binding.mass;
									if (binding.child) {
										b.vx = iw4*(b.x0-b.scrollLeft)/t2;
										b.vy = iw4*(b.y0-b.scrollTop)/t2;
									}
									else {
										b.vx = iw4*(b.offsetLeft-b.x0)/t2;
										b.vy = iw4*(b.offsetTop-b.y0)/t2;
									}
									if ((Math.abs(b.vx)>200)||(Math.abs(b.vy)>200)) {
										var rt=(Math.abs(b.vx)/Math.abs(b.vy));
										if (Math.abs(b.vx)>Math.abs(b.vy)) {
											b.vy=200/rt*(b.vy>0?1:-1);
											b.vx=200*(b.vx>0?1:-1);
										}
										else {
											b.vx=200*rt*(b.vy>0?1:-1);
											b.vy=200*(b.vy>0?1:-1);
										}
									}
									b.d0 = new Date();
									mover();
								}
								return stopEvent(e2);
							}
						};
					}
				});
				// Add the binding to the list
				bindings[reference._id] = binding;
				return reference;
			}
		};

		// Remove an element's draggableness
		self.unbind = function(reference) {
			if (reference instanceof BindingReference) {
				var id = reference._id;
				if (bindings[id]) {
					if (bindings[id].dragging) {
						bindings[id].shouldUnbind = true;
					} else {
						Events.unbind(bindings[id].event);
						bindings[id] = null;
					}
					// Call any "unbind" events
					binding.events.unbind.call(
						binding.element, new DragEvent('unbind', e, binding), binding.params
					);
				}
			}
		};

		// Bind a drag event
		self.bindEvent = function(reference, event, func) {
			withBindingEvent(reference, event, function(stack) {
				stack.push(func);
			});
		};

		// Unbind a drag event
		self.unbindEvent = function(reference, event, func) {
			withBindingEvent(reference, event, function(stack) {
				stack.remove(func);
			});
		};

		// Manually invoke a drag event
		self.invokeEvent = function(reference, event, source) {
			withBindingEvent(reference, event, function(stack) {
				stack.call(
					bindings[reference._id].element,
					new DragEvent(event, source, reference)
				);
			});
		};

		return self;
	}()),

// ----------------------------------------------------------------------------
//  Helper Functions

	// Array Remove - By John Resig (MIT Licensed)
	arrayRemove = function(array, from, to) {
		var rest = array.slice((to || from) + 1 || array.length);
		array.length = from < 0 ? array.length + from : from;
		return array.push.apply(array, rest);
	},

	// Get the position of an element
	getPos = function(elem, from) {
		var pos = parseFloat(getStyle(elem, from));
		return (isNaN(pos) ? 0 : pos);
	},

	// Get a style property from an element
	getStyle = function(elem, prop) {
		if (elem.currentStyle) {
			return elem.currentStyle[prop];
		} else if (window.getComputedStyle) {
			return document.defaultView.getComputedStyle(elem, null).getPropertyValue(prop);
		} else if (elem.style) {
			return elem.style[prop];
		}
	},

	// Get the dimensions of the window
	getWindowSize = function() {
		return {
			x: window.innerWidth || document.documentElement.clientWidth || body().clientWidth,
			y: window.innerHeight || document.documentElement.clientHeight || body().clientHeight
		};
	},

	// Get the total offset position of an element in the document
	getOffset = function(elem) {
		var x = 0;
		var y = 0;
		if (elem.offsetParent) {
			do {
				x += elem.offsetLeft;
				y += elem.offsetTop;
			} while (elem = elem.offsetParent);
		}
		return {x: x, y: y};
	},

	// Stop an event
	stopEvent = function(evt) {
		if (evt.preventDefault) {
			evt.preventDefault();
		}
		if (evt.stopPropagation) {
			evt.stopPropagation();
		}
		evt.returnValue = false;
		return false;
	},

	// Regular expressions for matching classnames
	cnRegexes = { },

	// Remove a class from an element
	removeClass = function(elem, cn) {
		if (! cnRegexes[cn]) {
			cnRegexes[cn] = new RegExp('(^|\\s)+' + cn + '(\\s|$)+');
		}
		elem.className = elem.className.replace(cnRegexes[cn], ' ');
	},

	// Add a class to an element
	addClass = function(elem, cn) {
		removeClass(elem, cn);
		elem.className += ' ' + cn;
	},

	// Check for a non-null object
	isObject = function(value) {
		return !! (value && typeof value === 'object');
	},

	// Gets the target property of an event
	getEventTarget = function(evt) {
		var target;
		if (evt.target) {
			target = evt.target;
		} else if (evt.srcElement) {
			target = evt.srcElement;
		}
		if (target.nodeType === 3) {
			target = target.parentNode;
		}
		return target;
	},

	/**
	 * A stackable function
	 *
	 * @access  private
	 * @param   function  an initial function
	 * @return  function
	 */
	Callstack = function(func) {
		var stack = [ ];
		var result = function() {
			var ret;
			for (var i = 0, c = stack.length; i < c; i++) {
				ret = stack[i].apply(this, arguments);
			}
			return ret;
		};
		result.push = function() {
			stack.push.apply(stack, arguments);
		};
		result.remove = function() {
			var args = Array.prototype.slice.call(arguments);
			var result = [ ];
			OUTER: for (var i = 0, c1 = stack.length; i < c1; i++) {
				for (var j = 0, c2 = args.length; j < c2; j++) {
					if (stack[i] === args[j]) {
						continue OUTER;
					}
				}
				result.push(stack[i]);
			}
			stack = result;
		};
		if (typeof func === 'function') {
			stack.push(func);
		}
		return result;
	},

	/**
	 * Custom event constructor
	 *
	 * @access  private
	 * @param   string    type
	 * @param   object    original event object
	 */
	DragEvent = function DragEvent(type, original, binding, extras) {
		this.type = type;
		this.originalEvent = original;
		this.altKey = original.altKey || false;
		this.ctrlKey = original.ctrlKey || false;
		this.shiftKey = original.shiftKey || false;
		this.timestamp = original.timestamp || (+new Date());
		this.pos = getPosition(original);
		this.binding = binding;
		this.target = getEventTarget(original);

		if (extras) {
			for (var i in extras) {
				if (extras.hasOwnProperty(i)) {
					this[i] = extras[i];
				}
			}
		}
	},

	/**
	 * A namespace with functions for event binding
	 *
	 * Example:
	 *
	 *   Bind
	 *    var evt = Events.bind(obj, 'event', function() { ... });
	 *
	 *   Unbind
	 *    Events.unbind(evt);
	 *     -OR-
	 *    evt.unbind();
	 *
	 * @access  private
	 */
	Events = (function() {

		var

		// Bind an event
		bindEvent = (function() {
			if (document.addEventListener) {
				return function(obj, event, func) {
					obj.addEventListener(event, func, false);
				};
			} else if (document.attachEvent) {
				return function(obj, event, func) {
					obj.attachEvent('on' + event, func);
				};
			} else {
				return function() { };
			}
		}()),

		// Unbind an event
		unbindEvent = (function() {
			if (document.removeEventListener) {
				return function(obj, event, func) {
					obj.removeEventListener(event, func, false);
				};
			} else if (document.detachEvent) {
				return function(obj, event, func) {
					obj.detachEvent('on' + event, func);
				};
			} else {
				return function() { };
			}
		}());

		// Build the return value
		return {
			bind: function(obj, event, func) {
				var oldFunc = (func === false) ? function(e) {
					return stopEvent(e);
				} : func;
				func = function(e) {
					return oldFunc.call(obj, e || window.event);
				};
				bindEvent(obj, event, func);
				var ret = function() {
					unbindEvent(obj, event, func);
				};
				ret.unbind = function() {ret();};
				return ret;
			},
			unbind: function(unbinder) {
				unbinder();
			}
		};

	}());

	function getPosition(evt) {
		var posX = 0;
		var posY = 0;
		if ((evt.targetTouches)&&(evt.targetTouches.length>0)) {
			posX = evt.targetTouches[0].pageX;
			posY = evt.targetTouches[0].pageY;
		} else if (evt.pageX || evt.pageY) {
			posX = evt.pageX;
			posY = evt.pageY;
		} else if (evt.clientX || evt.clientY) {
			posX = evt.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
			posY = evt.clientY + document.body.scrollTop + document.documentElement.scrollTop;
		}
		return {x: posX, y: posY};
	}

	function gob(o,q){return (typeof o==='string')?((o==='')?q:document.getElementById(o)):o;};

	function fPosXY(el){
	    var curleft = 0,curtop = 0,curtopscroll = 0,curleftscroll = 0,_el=gob(el),ow=gob(el).offsetWidth,oh=gob(el).offsetHeight;
		curleft = _el.offsetLeft;
		curtop = _el.offsetTop;
	    if (_el.offsetParent){
	        var elScroll = _el;
	        while (elScroll = elScroll.parentNode) {
	            curtopscroll = elScroll.scrollTop ? elScroll.scrollTop : 0;
	            curleftscroll = elScroll.scrollLeft ? elScroll.scrollLeft : 0;
	            curleft -= curleftscroll;
	            curtop -= curtopscroll;
	        }
	        while (_el = _el.offsetParent) {
	            curleft += _el.offsetLeft;
	            curtop += _el.offsetTop;
	        }
	    }
	    var offsetX = isIE ? document.body.scrollLeft : window.pageXOffset,offsetY = isIE ? document.body.scrollTop : window.pageYOffset;
	    return [curleft + offsetX,curleft + offsetX+ow,curtop + offsetY,curtop + offsetY+oh];
	}
	function fPosSC(el){
		var fp=fPosXY(el);
		return {x:fp[0],y:fp[2]};
	}

// ----------------------------------------------------------------------------
//  Expose

	window.DragDrop = DragDrop;

	// requestAnimationFrame() shim by Paul Irish
	// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
	window.requestAnimFrame = (function() {
		return  window.requestAnimationFrame       ||
				window.webkitRequestAnimationFrame ||
				window.mozRequestAnimationFrame    ||
				window.oRequestAnimationFrame      ||
				window.msRequestAnimationFrame     ||
				function(/* function */ callback, /* DOMElement */ element){
					window.setTimeout(callback, 1000 / 60);
				};
	})();

	/**
	 * Behaves the same as setTimeout except uses requestAnimationFrame() where possible for better performance
	 * @param {function} fn The callback function
	 * @param {int} delay The delay in milliseconds
	 */

	window.requestTimeout = function(fn, delay) {
		if( !window.requestAnimationFrame      	&&
			!window.webkitRequestAnimationFrame &&
			!(window.mozRequestAnimationFrame && window.mozCancelRequestAnimationFrame) && // Firefox 5 ships without cancel support
			!window.oRequestAnimationFrame      &&
			!window.msRequestAnimationFrame)
				return window.setTimeout(fn, delay);

		var start = new Date().getTime(),
			handle = new Object();

		function loop(){
			var current = new Date().getTime(),
				delta = current - start;

			delta >= delay ? fn.call() : handle.value = requestAnimFrame(loop);
		};

		handle.value = requestAnimFrame(loop);
		return handle;
	};

	/**
	 * Behaves the same as clearTimeout except uses cancelRequestAnimationFrame() where possible for better performance
	 * @param {int|object} fn The callback function
	 */
	window.clearRequestTimeout = function(handle) {
		window.cancelAnimationFrame ? window.cancelAnimationFrame(handle.value) :
		window.webkitCancelAnimationFrame ? window.webkitCancelAnimationFrame(handle.value) :
		window.webkitCancelRequestAnimationFrame ? window.webkitCancelRequestAnimationFrame(handle.value) : /* Support for legacy API */
		window.mozCancelRequestAnimationFrame ? window.mozCancelRequestAnimationFrame(handle.value) :
		window.oCancelRequestAnimationFrame	? window.oCancelRequestAnimationFrame(handle.value) :
		window.msCancelRequestAnimationFrame ? window.msCancelRequestAnimationFrame(handle.value) :
		clearTimeout(handle);
	};

}());
