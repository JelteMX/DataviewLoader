/*global logger*/
/*
    DataviewLoader
    ========================

    @file      : DataviewLoader.js
    @version   : 1.3.1
    @author    : JvdGraaf
    @date      : Mon, 24 Apr 2017 15:02:42 GMT
    @copyright : Appronto
    @license   : Apache2

    Documentation
    ========================
    Describe your widget here.
*/

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
  "dojo/_base/declare",
  "mxui/widget/_WidgetBase",
  "dijit/_TemplatedMixin",

  "mxui/dom",
  "dojo/dom",
  "dojo/dom-style",
  "dojo/dom-class",
  "dojo/_base/lang",
  "dojo/_base/event",

  "dojo/text!DataviewLoader/widget/template/DataviewLoader.html"
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, dojoStyle, dojoClass, dojoLang, dojoEvent, widgetTemplate) {
    "use strict";

    // Declare widget's prototype.
    return declare("DataviewLoader.widget.DataviewLoader", [_WidgetBase, _TemplatedMixin], {
        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        // DOM elements
        divContent: null,
        divLoader: null,

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
        _loadingStarted: false,
        _renderedForm: false,
        _debounce: null,
        _pageInitiated: false,
        active: true,

        update: function (obj, callback) {
            if (this._contextObj !== obj){
                console.log(this.id + ".update on new object");
                this._loadingStarted = false;

                this._contextObj = obj;
                this._resetSubscriptions();
                this._updateRendering(callback); // We're passing the callback to updateRendering to be called after DOM-manipulation
            } else {
                this._executeCallback(callback, "update");
            }
        },

        resize: function (box) {
            if (!this._renderedForm) {
                console.log(this.id, this);
                if (this._debounce) {
                    clearTimeout(this._debounce);
                }
                setTimeout(dojoLang.hitch(this, function () {
                    if (this.domNode.offsetParent !== null) {
                        console.log(this.id, this.domNode.offsetParent);
                        this._renderedForm = true;
                        this._loadAndShowcontent();
                    }
                }), 250);
            }
        },

        uninitialize: function () {
            logger.debug(this.id + ".uninitialize");
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
            this.active = false;
        },

        _updateRendering: function (callback) {
            logger.debug(this.id + "._updateRendering");

            if (this._contextObj) {
                dojoStyle.set(this.divContent, "display", "none");
                dojoStyle.set(this.divLoader, "display", "block");

                if(this.fadeContent){
                    dojoClass.add(this.divContent, "loaderfade");
                }
            }

            this._executeCallback(callback, "_updateRendering");

            if (this.domNode.offsetParent !== null) {
                this._renderedForm = true;
                this._loadAndShowcontent();
            }
        },

        _loadAndShowcontent: function () {
            logger.debug(this.id + "._loadAndShowcontent");
            if (this._loadingStarted === false) {
                this._loadingStarted = true;
                if (this._contextObj && this.loadingMF) {
                    this._execMf(this.loadingMF, this._contextObj.getGuid(), this._processMicroflowCallback);
                } else if (this._contextObj) {
                    this._setPage(this._contextObj);
                }
            }
        },

        _processMicroflowCallback: function (objs) {
            logger.debug(this.id + "._processMicroflowCallback");
            if (this.active) {
                if (this.asyncCall) {
                    this._setPage(this._contextObj);
                } else {
                    this._setPage(objs[0]);
                }
            } else {
                 console.info(this.id + "._processMicroflowCallback Skip loading because widget is destroyed.");
            }
        },

        _setPage: function (pageObj) {
            logger.debug(this.id + "._setPage");

            if(this._pageInitiated) {
                if (this._loadingStarted) {
                    this._showPage();
                } else {
                    console.log(this.id + "_setPage skip because already set.");
                }
            } else {
                this._pageInitiated = true;
                this.divContent.innerHTML= "";

                var openFormOptions =  {
                    location: "content",
                    domNode: this.divContent,
                    callback: dojoLang.hitch(this, this._showPage),
                    error: function (error) {
                        console.log(error.description);
                    }
                };

                if (pageObj) {
                    var pageContext = new mendix.lib.MxContext();
                    pageContext.setTrackObject(pageObj);
                    openFormOptions.context = pageContext;
                }

                mx.ui.openForm(this.pageContent, openFormOptions);
            }
        },

        _showPage: function () {
            console.log(this.id + "._showPage on form");

            dojoStyle.set(this.divContent, "display", "block");
            dojoStyle.set(this.divLoader, "display", "none");

            this._loadingStarted = false;
        },

        _resetSubscriptions: function () {
            logger.debug(this.id + "._resetSubscriptions");
            this.unsubscribeAll();

            if (this._contextObj && this.refreshAction) {
                logger.debug(this.id + "._resetSubscriptions setup refresh handler");
                this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: dojoLang.hitch(this, function (guid) {
                        if (this._loadingStarted === false){
                            console.log(this.id + ".Refresh triggered.");
                            this._updateRendering();
                        } else {
                            console.log(this.id + ".Refresh skip because of loading started.");
                        }
                    })
                });
            }
        },

        _execMf: function (mf, guid, cb) {
            logger.debug(this.id + "._execMf" + (mf ? ": " + mf : ""));
            if (mf && guid) {
                var mfObject = {
                    async : this.asyncCall,
                    params: {
                        applyto: "selection",
                        guids: [guid]
                    },
                    callback: (cb && typeof cb === "function" ? dojoLang.hitch(this, cb) : null),
                    error: function (error) {
                        console.debug(error.description);
                    }
                };
                if (!mx.version || mx.version && parseInt(mx.version.split(".")[0]) < 7) {
                    // < Mendix 7
                    mfObject.store = {
                        caller: this.mxform
                    };
                } else {
                    mfObject.origin = this.mxform;
                }
                mx.ui.action(mf, mfObject, this);
            }
        },

        _executeCallback: function (cb, from) {
            logger.debug(this.id + "._executeCallback" + (from ? " from " + from : ""));
            if (cb && typeof cb === "function") {
                cb();
            }
        }
    });
});

require(["DataviewLoader/widget/DataviewLoader"]);
