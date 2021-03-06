﻿// https://github.com/Infocatcher/Custom_Buttons/tree/master/CB_Source_Editor
// http://infocatcher.ucoz.net/js/cb/cbSourceEditor.js

// Source Editor (formerly Orion Editor) button for Custom Buttons
// (code for "initialization" section)

// (c) Infocatcher 2012-2014
// version 0.1.0a4 - 2014-02-24

const watcherId = "customButtonsSourceEditor_" + this.id;
var {Application, Components} = window; // Prevent garbage collection in Firefox 3.6 and older
var watcher = Application.storage.get(watcherId, null);
if(!watcher) {
	watcher = {
		REASON_STARTUP: 1,
		REASON_SHUTDOWN: 2,
		REASON_WINDOW_LOADED: 3,
		REASON_WINDOW_CLOSED: 4,

		get obs() {
			delete this.obs;
			return this.obs = Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
		},
		get ww() {
			delete this.ww;
			return this.ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
				.getService(Components.interfaces.nsIWindowWatcher);
		},
		get wm() {
			delete this.wm;
			return this.wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				.getService(Components.interfaces.nsIWindowMediator);
		},
		init: function(reason) {
			if("Services" in window && parseFloat(Services.appinfo.platformVersion) < 27) {
				this.isBrowserWindow = function() {
					return false; // CodeMirror is available only since Firefox 27.0a1 (2013-09-24)
				};
			}
			this.obs.addObserver(this, "quit-application-granted", false);
			var ws = this.wm.getEnumerator(null);
			while(ws.hasMoreElements())
				this.initWindow(ws.getNext(), reason);
			this.ww.registerNotification(this);
		},
		destroy: function(reason) {
			this.obs.removeObserver(this, "quit-application-granted");
			var ws = this.wm.getEnumerator(null);
			while(ws.hasMoreElements())
				this.destroyWindow(ws.getNext(), reason);
			this.ww.unregisterNotification(this);
		},
		initWindow: function(window, reason, isFrame) {
			if(this.isBrowserWindow(window)) {
				this.initBrowserWindow(window, reason);
				return;
			}
			if(!this.isEditorWindow(window))
				return;
			_log("initWindow(): isFrame: " + isFrame);
			var document = window.document;
			if(isFrame)
				window.addEventListener("unload", this, false);

			Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
				.getService(Components.interfaces.mozIJSSubScriptLoader)
				.loadSubScript("chrome://global/content/globalOverlay.js", window);

			var isCodeMirror = false;
			try { // See chrome://browser/content/devtools/scratchpad.js
				Components.utils.import("resource:///modules/source-editor.jsm", window);
				var SourceEditor = window.SourceEditor;
			}
			catch(e) {
				var require = Components.utils.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools.require;
				var SourceEditor = window.SourceEditor = require("devtools/sourceeditor/editor");
				isCodeMirror = true;
			}

			// See view-source:chrome://browser/content/devtools/scratchpad.xul
			// + view-source:chrome://browser/content/devtools/source-editor-overlay.xul
			var psXUL = (isCodeMirror
			? '<!DOCTYPE popupset [\
				<!ENTITY % sourceEditorStrings SYSTEM "chrome://browser/locale/devtools/sourceeditor.dtd">\
				%sourceEditorStrings;\
			]>\
			<popupset id="sourceEditorPopupset"\
				xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">\
				<menupopup id="sourceEditorContext"\
					onpopupshowing="goUpdateSourceEditorMenuItems()">\
					<menuitem id="menu_undo"/>\
					<menuitem id="menu_redo"/>\
					<menuseparator/>\
					<menuitem id="menu_cut"/>\
					<menuitem id="menu_copy"/>\
					<menuitem id="menu_paste"/>\
					<menuitem id="menu_delete"/>\
					<menuseparator/>\
					<menuitem id="menu_selectAll"/>\
					<menuseparator/>\
					<menuitem id="menu_find"/>\
					<menuitem id="menu_findAgain"/>\
					<menuseparator/>\
					<menuitem id="se-menu-gotoLine"\
						label="&gotoLineCmd.label;"\
						accesskey="&gotoLineCmd.accesskey;"\
						key="key_gotoLine"\
						oncommand="goDoCommand(\'cmd_gotoLine\')"/>\
				</menupopup>\
			</popupset>'
			: '<popupset id="sourceEditorPopupset"\
				xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">\
				<menupopup id="sourceEditorContext"\
					onpopupshowing="goUpdateSourceEditorMenuItems()">\
					<menuitem id="se-menu-undo"/>\
					<menuitem id="se-menu-redo"/>\
					<menuseparator/>\
					<menuitem id="se-menu-cut"/>\
					<menuitem id="se-menu-copy"/>\
					<menuitem id="se-menu-paste"/>\
					<menuitem id="se-menu-delete"/>\
					<menuseparator/>\
					<menuitem id="se-menu-selectAll"/>\
					<menuseparator/>\
					<menuitem id="se-menu-find"/>\
					<menuitem id="se-menu-findAgain"/>\
					<menuseparator/>\
					<menuitem id="se-menu-gotoLine"/>\
				</menupopup>\
			</popupset>'
			).replace(/>\s+</g, "><");

			var ps = new DOMParser().parseFromString(psXUL, "application/xml").documentElement;
			document.documentElement.appendChild(ps);

			window.setTimeout(function() {
				function appendNode(nodeName, id) {
					var node = document.createElement(nodeName);
					node.id = id;
					document.documentElement.appendChild(node);
				}
				appendNode("commandset", "editMenuCommands");
				appendNode("commandset", "sourceEditorCommands");
				appendNode("keyset", "sourceEditorKeys");
				appendNode("keyset", "editMenuKeys");

				this.loadOverlays(
					window,
					function done() {
						window.setTimeout(function() {
							var mp = document.getElementById("sourceEditorContext");
							if(mp.state == "closed")
								return;
							Array.forEach(
								mp.getElementsByAttribute("command", "*"),
								function(mi) {
									var cmd = mi.getAttribute("command");
									var controller = document.commandDispatcher
										.getControllerForCommand(cmd);
									if(controller && !controller.isCommandEnabled(cmd))
										mi.setAttribute("disabled", "true");
								}
							);
						}, 0);
						if(!isCodeMirror)
							return;
						// See view-source:chrome://browser/content/devtools/scratchpad.xul in Firefox 27.0a1
						window.goUpdateSourceEditorMenuItems = function() {
							goUpdateGlobalEditMenuItems();
							var commands = ["cmd_undo", "cmd_redo", "cmd_cut", "cmd_paste", "cmd_delete"];
							commands.forEach(goUpdateCommand);
						};
						var cmdsMap = {
							"se-menu-undo":   "cmd_undo",
							"se-menu-redo":   "cmd_redo",
							"se-menu-cut":    "cmd_cut",
							"se-menu-copy":   "cmd_copy",
							"se-menu-paste":  "cmd_paste",
							"se-menu-delete": "cmd_delete",
							__proto__: null
						};
						for(var id in cmdsMap) {
							var mi = document.getElementById(id);
							mi && mi.setAttribute("command", cmdsMap[id]);
						}
						// We can't use command="cmd_selectAll", menuitem will be wrongly disabled sometimes
						var enabledCmdsMap = {
							"se-menu-selectAll": "cmd_selectAll",
							"se-menu-findAgain": "cmd_findAgain",
							__proto__: null
						};
						for(var id in enabledCmdsMap) {
							var mi = document.getElementById(id);
							if(mi) {
								mi.removeAttribute("command");
								mi.removeAttribute("disabled");
								mi.setAttribute("oncommand", "goDoCommand('" + enabledCmdsMap[id] + "');");
							}
						}
						// Workaround: emulate keyboard shortcut
						var keyCmdsMap = {
							"menu_find":      { keyCode: KeyboardEvent.DOM_VK_F, charCode: "f".charCodeAt(0), ctrlKey: true },
							"menu_findAgain": { keyCode: KeyboardEvent.DOM_VK_G, charCode: "g".charCodeAt(0), ctrlKey: true },
							__proto__: null
						};
						var _key = function() {
							var e = this._keyData;
							var evt = document.createEvent("KeyboardEvent");
							evt.initKeyEvent(
								"keydown", true /*bubbles*/, true /*cancelable*/, window,
								e.ctrlKey || false, e.altKey || false, e.shiftKey || false, e.metaKey || false,
								e.keyCode || 0, e.charCode || 0
							);
							document.commandDispatcher.focusedElement.dispatchEvent(evt);
						};
						for(var id in keyCmdsMap) {
							var mi = document.getElementById(id);
							if(mi) {
								mi.removeAttribute("command");
								mi.removeAttribute("disabled");
								mi.setAttribute("oncommand", "this._key();");
								mi._keyData = keyCmdsMap[id];
								mi._key = _key;
							}
						}
					},
					["chrome://global/content/editMenuOverlay.xul", function check(window) {
						return window.document.getElementById("editMenuCommands").hasChildNodes();
					}],
					["chrome://browser/content/devtools/source-editor-overlay.xul", function check(window) {
						return window.document.getElementById("sourceEditorCommands").hasChildNodes();
					}]
				);
			}.bind(this), 500); // We should wait to not break other extensions with document.loadOverlay()

			Array.slice(document.getElementsByTagName("cbeditor")).forEach(function(cbEditor) {
				if("__sourceEditor" in cbEditor)
					return;
				var code = cbEditor.value;
				var se = isCodeMirror
					? new SourceEditor({
						mode: SourceEditor.modes.js,
						value: code,
						lineNumbers: true,
						contextMenu: "sourceEditorContext"
					})
					: new SourceEditor();
				se.__isCodeMirror = isCodeMirror;
				var seElt = document.createElement("hbox");
				seElt.className = "sourceEditor";
				seElt.setAttribute("flex", 1);
				seElt.__sourceEditor = se;
				cbEditor.parentNode.insertBefore(seElt, cbEditor);
				//cbEditor.setAttribute("hidden", "true");
				cbEditor.setAttribute("collapsed", "true");
				cbEditor.parentNode.appendChild(cbEditor);
				cbEditor.__sourceEditor = se;
				cbEditor.__sourceEditorElt = seElt;
				cbEditor.__defineGetter__("value", function() {
					if("__sourceEditor" in this) {
						var se = this.__sourceEditor;
						if(!se.__initialized)
							return se.__value;
						return se.getText().replace(/\r\n?|\n\r?/g, "\n");
					}
					return this.textbox.value;
				});
				cbEditor.__defineSetter__("value", function(v) {
					if("__sourceEditor" in this) {
						var se = this.__sourceEditor;
						if(!se.__initialized) {
							var _this = this;
							se.__onLoadCallbacks.push(function() {
								_this.value = v;
							});
							return se.__value = v;
						}
						return se.setText(v.replace(/\r\n?|\n\r?/g, "\n"));
					}
					return this.textbox.value = v;
				});
				cbEditor.selectLine = function(lineNumber) {
					if("__sourceEditor" in this) {
						var se = this.__sourceEditor;
						if(!se.__initialized) {
							var _this = this, args = arguments;
							se.__onLoadCallbacks.push(function() {
								_this.selectLine.apply(_this, args);
							});
							return undefined;
						}
						if(se.__isCodeMirror) {
							//se.focus();
							//se.setCursor({ line: lineNumber - 1, ch: 0 });
							//~ todo: optimize
							var val = this.value;
							var lines = val.split("\n");
							var line = Math.min(lineNumber - 1, lines.length);
							var ch = lines[line].length;
							se.focus();
							return se.setSelection({ line: line, ch: 0 }, { line: line, ch: ch });
						}
						else {
							var selStart = se.getLineStart(lineNumber - 1);
							var selEnd = se.getLineEnd(lineNumber - 1, false);
							se.focus();
							return se.setSelection(selStart, selEnd);
						}
					}
					return this.__proto__.selectLine.apply(this, arguments);
				};
				se.__initialized = false;
				se.__onLoadCallbacks = [];
				se.__value = code;
				var onTextChanged = se.__onTextChanged = function() {
					window.editor.changed = true;
				};
				var isLoaded = reason == this.REASON_WINDOW_LOADED;
				function done() {
					se.__initialized = true;
					se.__onLoadCallbacks.forEach(function(fn) {
						try {
							fn();
						}
						catch(e) {
							Components.utils.reportError(e);
						}
					});
					delete se.__onLoadCallbacks;
					delete se.__value;
				}
				if(isCodeMirror) {
					se.appendTo(seElt).then(function() {
						window.setTimeout(function() {
							se.on("change", onTextChanged);
							if(isLoaded) {
								var seGlobal = Components.utils.getGlobalForObject(SourceEditor.prototype);
								var cm = seGlobal.editors.get(se);
								cm.clearHistory();
							}
						}, isFrame ? 50 : 15); // Oh, magic delays...
						done();

						// See resource:///modules/devtools/sourceeditor/editor.js
						// doc.defaultView.controllers.insertControllerAt(0, controller(this, doc.defaultView));
						var controllers = window.controllers; // nsIControllers
						var controller = se.__cmdController = controllers.getControllerAt(0);
						var tabs = document.getElementById("custombuttons-editbutton-tabbox");
						if("__cmdControllers" in tabs)
							tabs.__cmdControllers.push(controller);
						else {
							tabs.__cmdControllers = [controller];
							var onSelect = tabs.__onSelect = function() {
								var seElt = tabs.selectedPanel;
								if(!seElt || !("__sourceEditor" in seElt))
									return;
								var se = seElt.__sourceEditor;
								var curController = se.__cmdController;
								tabs.__cmdControllers.forEach(function(controller) {
									try {
										if(controller == curController)
											controllers.insertControllerAt(0, controller);
										else
											controllers.removeController(controller);
									}
									catch(e) {
									}
								});
							};
							tabs.addEventListener("select", onSelect, false);
							window.setTimeout(onSelect, 0); // Activate controller from selected tab
						}
					});
				}
				else {
					se.init(
						seElt,
						{
							mode: SourceEditor.MODES.JAVASCRIPT,
							showLineNumbers: true,
							initialText: code,
							placeholderText: code, // For backward compatibility
							contextMenu: "sourceEditorContext"
						},
						function callback() {
							done();
							isLoaded && se.resetUndo && se.resetUndo();
							se.addEventListener(SourceEditor.EVENTS.TEXT_CHANGED, onTextChanged);

							// Hack to use selected editor
							var controller = se.ui._controller;
							var tabs = document.getElementById("custombuttons-editbutton-tabbox");
							controller.__defineGetter__("_editor", function() {
								var seElt = tabs.selectedPanel;
								var se = seElt && seElt.__sourceEditor
									|| document.getElementsByTagName("cbeditor")[0].__sourceEditor;
								return se;
							});
							controller.__defineSetter__("_editor", function() {});
						}
					);
				}
			}, this);

			var origExecCmd = window.editor.execute_oncommand_code;
			window.editor.execute_oncommand_code = function() {
				var cd = document.commandDispatcher;
				var cdFake = {
					__proto__: cd,
					get focusedElement() {
						var tabs = document.getElementById("custombuttons-editbutton-tabbox");
						var selectedTab = tabs.selectedTab;
						if(selectedTab && selectedTab.id == "code-tab")
							return document.getElementById("code").textbox.inputField;
						return cd.focusedElement;
					}
				};
				document.__defineGetter__("commandDispatcher", function() {
					return cdFake;
				});
				try {
					var ret = origExecCmd.apply(this, arguments);
				}
				catch(e) {
					Components.utils.reportError(e);
				}
				// document.hasOwnProperty("commandDispatcher") == false, so we cat just delete our fake property
				delete document.commandDispatcher;
				return ret;
			};

			window.addEventListener("load", function ensureObserversAdded() {
				window.removeEventListener("load", ensureObserversAdded, false);
				window.setTimeout(function() { window.editor.removeObservers(); }, 0);
				window.setTimeout(function() { window.editor.addObservers();    }, 0);
			}, false);
		},
		destroyWindow: function(window, reason, isFrame) {
			if(reason == this.REASON_WINDOW_CLOSED)
				window.removeEventListener("DOMContentLoaded", this, false); // Window can be closed before DOMContentLoaded
			if(this.isBrowserWindow(window)) {
				this.destroyBrowserWindow(window, reason);
				return;
			}
			if(!this.isEditorWindow(window) || !("SourceEditor" in window))
				return;
			_log("destroyWindow(): isFrame: " + isFrame);
			var document = window.document;
			if(isFrame)
				window.removeEventListener("unload", this, false);

			var tabs = document.getElementById("custombuttons-editbutton-tabbox");
			if("__onSelect" in tabs) {
				tabs.removeEventListener("select", tabs.__onSelect, false);
				delete tabs.__onSelect;
				delete tabs.__cmdControllers;
			}

			Array.slice(document.getElementsByTagName("cbeditor")).forEach(function(cbEditor) {
				if(!("__sourceEditor" in cbEditor))
					return;
				var se = cbEditor.__sourceEditor;
				var isCodeMirror = se.__isCodeMirror;
				if(isCodeMirror)
					se.off("change", se.__onTextChanged);
				else
					se.removeEventListener(window.SourceEditor.EVENTS.TEXT_CHANGED, se.__onTextChanged);
				delete se.__onTextChanged;
				if(reason == this.REASON_SHUTDOWN) {
					var val = cbEditor.value;
					delete cbEditor.value;
					delete cbEditor.selectLine;

					var seElt = cbEditor.__sourceEditorElt;
					seElt.parentNode.insertBefore(cbEditor, seElt);
					seElt.parentNode.removeChild(seElt);
					delete cbEditor.__sourceEditorElt;
					delete cbEditor.__sourceEditor;
					delete seElt.__sourceEditor;

					cbEditor.value = val;
					window.setTimeout(function() {
						cbEditor.removeAttribute("collapsed");
					}, 0);
				}
				se.destroy();
				if("__cmdController" in se) {
					try {
						window.controllers.removeController(se.__cmdController);
					}
					catch(e) {
					}
					delete se.__cmdController;
				}
			}, this);

			if(reason == this.REASON_SHUTDOWN) {
				delete window.editor.execute_oncommand_code;
				[
					"sourceEditorPopupset",
					"editMenuCommands",
					"sourceEditorCommands",
					"sourceEditorKeys",
					"editMenuKeys"
				].forEach(function(id) {
					var node = document.getElementById(id);
					node && node.parentNode.removeChild(node);
				});
				[
					// chrome://global/content/globalOverlay.js
					"closeWindow", "canQuitApplication", "goQuitApplication", "goUpdateCommand", "goDoCommand",
					"goSetCommandEnabled", "goSetMenuValue", "goSetAccessKey", "goOnEvent", "visitLink",
					"setTooltipText", "NS_ASSERT",
					// chrome://global/content/editMenuOverlay.xul => view-source:chrome://global/content/editMenuOverlay.js
					"goUpdateGlobalEditMenuItems", "goUpdateUndoEditMenuItems", "goUpdatePasteMenuItems"
				].forEach(function(p) {
					delete window[p];
				});
				delete window.SourceEditor;
			}
			//~ todo: we have one not removed controller!
			//LOG("getControllerCount(): " + window.controllers.getControllerCount());
		},
		initBrowserWindow: function(window, reason) {
			_log("initBrowserWindow()");
			window.addEventListener("DOMContentLoaded", this, false);
			Array.forEach(window.frames, function(frame) {
				this.initWindow(frame, reason, true);
			}, this);
		},
		destroyBrowserWindow: function(window, reason) {
			_log("destroyBrowserWindow()");
			window.removeEventListener("DOMContentLoaded", this, false);
			Array.forEach(window.frames, function(frame) {
				this.destroyWindow(frame, reason, true);
			}, this);
		},
		isEditorWindow: function(window) {
			return window.location.href.substr(0, 41) == "chrome://custombuttons/content/editor.xul";
		},
		isBrowserWindow: function(window) {
			var loc = window.location.href;
			return loc == "chrome://browser/content/browser.xul"
				|| loc == "chrome://navigator/content/navigator.xul";
		},
		observe: function(subject, topic, data) {
			if(topic == "quit-application-granted")
				this.destroy();
			else if(topic == "domwindowopened")
				subject.addEventListener("DOMContentLoaded", this, false);
			else if(topic == "domwindowclosed")
				this.destroyWindow(subject, this.REASON_WINDOW_CLOSED);
		},
		handleEvent: function(e) {
			switch(e.type) {
				case "DOMContentLoaded":
					//var window = e.currentTarget;
					var window = e.target.defaultView;
					window.removeEventListener(e.type, this, false);
					var isFrame = window != e.currentTarget;
					this.initWindow(window, this.REASON_WINDOW_LOADED, isFrame);
				break;
				case "unload":
					//var window = e.currentTarget;
					var window = e.target.defaultView;
					window.removeEventListener(e.type, this, false);
					this.destroyWindow(window, this.REASON_WINDOW_CLOSED, true);
			}
		},
		loadOverlays: function() {
			this.runGenerator(this.loadOverlaysGen, this, arguments);
		},
		loadOverlaysGen: function loadOverlaysGen(window, callback/*, overlayData1, ...*/) {
			var gen = loadOverlaysGen.__generator;
			for(var i = 2, l = arguments.length; i < l; ++i) {
				var overlayData = arguments[i];
				this.loadOverlay(window, overlayData[0], overlayData[1], function() {
					gen.next();
				});
				yield 0;
			}
			callback();
			yield 0;
		},
		loadOverlay: function(window, uri, check, callback) {
			var document = window.document;
			var stopWait = Date.now() + 4500;
			window.setTimeout(function load() {
				_log("loadOverlay(): " + uri);
				var tryAgain = Date.now() + 800;
				try {
					document.loadOverlay(uri, null);
				}
				catch(e) {
					window.setTimeout(callback, 0);
					return;
				}
				window.setTimeout(function ensureLoaded() {
					if(check(window))
						window.setTimeout(callback, 0);
					else if(Date.now() > stopWait)
						return;
					else if(Date.now() > tryAgain)
						window.setTimeout(load, 0);
					else
						window.setTimeout(ensureLoaded, 50);
				}, 50);
			}, 0);
		},
		runGenerator: function(genFunc, context, args) {
			var gen = genFunc.apply(context, args);
			genFunc.__generator = gen;
			gen.next();
		}
	};
	Application.storage.set(watcherId, watcher);
	setTimeout(function() {
		watcher.init(watcher.REASON_STARTUP);
	}, 50);
}
function destructor(reason) {
	if(reason == "update" || reason == "delete") {
		watcher.destroy(watcher.REASON_SHUTDOWN);
		Application.storage.set(watcherId, null);
	}
}
if(
	typeof addDestructor == "function" // Custom Buttons 0.0.5.6pre4+
	&& addDestructor != ("addDestructor" in window && window.addDestructor)
)
	addDestructor(destructor, this);
else
	this.onDestroy = destructor;

function _log(s) {
	var d = new Date();
	var ms = d.getMilliseconds();
	var ts = d.toLocaleFormat("%M:%S:") + "000".substr(String(ms).length) + ms + " ";
	Services.console.logStringMessage("[Custom Buttons :: Source Editor] " + ts + s);
}