// ==UserScript==
// @id             iitc-plugin-portal-ages@nerd4lyfe
// @name           IITC plugin: Portal Inactive Ages
// @category       Layer
// @version        0.1.6.20170108.21732
// @namespace      https://github.com/seattletechie/iitc-plugins
// @updateURL      https://.meta.js
// @downloadURL    https://static.iitc.me/build/release/plugins/portal-ages.user.js
// @description    [iitc-2017-01-08-021732] Show portal ages on the map.
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @include        https://*.ingress.com/mission/*
// @include        http://*.ingress.com/mission/*
// @match          https://*.ingress.com/mission/*
// @match          http://*.ingress.com/mission/*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
    // ensure plugin framework is there, even if iitc is not yet loaded
    if(typeof window.plugin !== 'function') window.plugin = function() {};

    //PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
    //(leaving them in place might break the 'About IITC' page or break update checks)
    plugin_info.buildName = 'iitc';
    plugin_info.dateTimeVersion = '20170108.21732';
    plugin_info.pluginId = 'portal-ages';
    //END PLUGIN AUTHORS NOTE



    // PLUGIN START ////////////////////////////////////////////////////////

    // use own namespace for plugin
    window.plugin.portalInactiveAges = function() {};

    window.plugin.portalInactiveAges.NAME_WIDTH = 80;
    window.plugin.portalInactiveAges.NAME_HEIGHT = 23;

    window.plugin.portalInactiveAges.labelLayers = {};
    window.plugin.portalInactiveAges.labelLayerGroup = null;

    window.daysSince = function(date) {
        return Math.round((Date.now() - date)/(1000*60*60*24));
    };

    window.plugin.portalInactiveAges.setupCSS = function() {
        $("<style>").prop("type", "text/css").html('.plugin-portal-ages{color:#FFFFBB;font-size:11px;line-height:12px;text-align:center;padding: 2px;overflow:hidden;'
                                                   // could try this if one-line ages are used
                                                   //    +'white-space: nowrap;text-overflow:ellipsis;'
                                                   +'text-shadow:1px 1px #000,1px -1px #000,-1px 1px #000,-1px -1px #000, 0 0 5px #000;pointer-events:none;}'
                                                  ).appendTo("head");
    };


    window.plugin.portalInactiveAges.removeLabel = function(guid) {
        var previousLayer = window.plugin.portalInactiveAges.labelLayers[guid];
        if(previousLayer) {
            window.plugin.portalInactiveAges.labelLayerGroup.removeLayer(previousLayer);
            delete plugin.portalInactiveAges.labelLayers[guid];
        }
    };

    window.plugin.portalInactiveAges.addLabel = function(guid, latLng) {
        var previousLayer = window.plugin.portalInactiveAges.labelLayers[guid];
        if (!previousLayer) {

            var d = window.portals[guid].options.data;
            //var portalName = d.title;
            var da = new Date(window.portals[guid].options.timestamp);
            var portalName = da.toLocaleDateString() + "</br>" + window.daysSince(da) + " days";

            var label = L.marker(latLng, {
                icon: L.divIcon({
                    className: 'plugin-portal-ages',
                    iconAnchor: [window.plugin.portalInactiveAges.NAME_WIDTH/2,0],
                    iconSize: [window.plugin.portalInactiveAges.NAME_WIDTH,window.plugin.portalInactiveAges.NAME_HEIGHT],
                    html: portalName
                }),
                guid: guid,
            });
            window.plugin.portalInactiveAges.labelLayers[guid] = label;
            label.addTo(window.plugin.portalInactiveAges.labelLayerGroup);
        }
    };

    window.plugin.portalInactiveAges.clearAllPortalLabels = function() {
        for (var guid in window.plugin.portalInactiveAges.labelLayers) {
            window.plugin.portalInactiveAges.removeLabel(guid);
        }
    };


    window.plugin.portalInactiveAges.updatePortalLabels = function() {
        var guid, portalPoints, buckets, point;
        // as this is called every time layers are toggled, there's no point in doing it when the leyer is off
        if (!map.hasLayer(window.plugin.portalInactiveAges.labelLayerGroup)) {
            return;
        }

        portalPoints = {};

        for (guid in window.portals) {
            var p = window.portals[guid];
            if (p._map && p.options.timestamp && p.options.team === 0) {  // only consider portals added to the map and with a title
                point = map.project(p.getLatLng());
                portalPoints[guid] = point;
            }
        }

        // for efficient testing of intersection, group portals into buckets based on the label size
        buckets = {};
        for (guid in portalPoints) {
            point = portalPoints[guid];

            var bucketId = L.point([Math.floor(point.x/(window.plugin.portalInactiveAges.NAME_WIDTH*2)),Math.floor(point.y/window.plugin.portalInactiveAges.NAME_HEIGHT)]);
            // the guid is added to four buckets. this way, when testing for overlap we don't need to test
            // all 8 buckets surrounding the one around the particular portal, only the bucket it is in itself
            var bucketIds = [bucketId, bucketId.add([1,0]), bucketId.add([0,1]), bucketId.add([1,1])];
            for (var i in bucketIds) {
                var b = bucketIds[i].toString();
                if (!buckets[b]) buckets[b] = {};
                buckets[b][guid] = true;
            }
        }

        var coveredPortals = {};

        for (var bucket in buckets) {
            var bucketGuids = buckets[bucket];
            for (guid in bucketGuids) {
                point = portalPoints[guid];
                // the bounds used for testing are twice as wide as the portal name marker. this is so that there's no left/right
                // overlap between two different portals text
                var largeBounds = L.bounds (
                    point.subtract([window.plugin.portalInactiveAges.NAME_WIDTH,0]),
                    point.add([window.plugin.portalInactiveAges.NAME_WIDTH,window.plugin.portalInactiveAges.NAME_HEIGHT])
                );

                for (var otherGuid in bucketGuids) {
                    if (guid != otherGuid) {
                        var otherPoint = portalPoints[otherGuid];

                        if (largeBounds.contains(otherPoint)) {
                            // another portal is within the rectangle for this one's name - so no name for this one
                            coveredPortals[guid] = true;
                            break;
                        }
                    }
                }
            }
        }

        for (guid in coveredPortals) {
            delete portalPoints[guid];
        }

        // remove any not wanted
        for (guid in window.plugin.portalInactiveAges.labelLayers) {
            if (!(guid in portalPoints)) {
                window.plugin.portalInactiveAges.removeLabel(guid);
            }
        }

        // and add those we do
        for (guid in portalPoints) {
            window.plugin.portalInactiveAges.addLabel(guid, portals[guid].getLatLng());
        }
    };

    // as calculating portal marker visibility can take some time when there's lots of portals shown, we'll do it on
    // a short timer. this way it doesn't get repeated so much
    window.plugin.portalInactiveAges.delayedUpdatePortalLabels = function(wait) {

        if (window.plugin.portalInactiveAges.timer === undefined) {
            window.plugin.portalInactiveAges.timer = setTimeout ( function() {
                window.plugin.portalInactiveAges.timer = undefined;
                window.plugin.portalInactiveAges.updatePortalLabels();
            }, wait*1000);

        }
    };


    var setup = function() {
        window.plugin.portalInactiveAges.setupCSS();

        window.plugin.portalInactiveAges.labelLayerGroup = new L.LayerGroup();
        window.addLayerGroup('Portal InactiveAges', window.plugin.portalInactiveAges.labelLayerGroup, true);

        window.addHook('requestFinished', function() { setTimeout(function(){window.plugin.portalInactiveAges.delayedUpdatePortalLabels(3.0);},1); });
        window.addHook('mapDataRefreshEnd', function() { window.plugin.portalInactiveAges.delayedUpdatePortalLabels(0.5); });
        window.map.on('overlayadd overlayremove', function() { setTimeout(function(){window.plugin.portalInactiveAges.delayedUpdatePortalLabels(1.0);},1); });
        window.map.on('zoomend', window.plugin.portalInactiveAges.clearAllPortalLabels );

    };

    // PLUGIN END //////////////////////////////////////////////////////////


    setup.info = plugin_info; //add the script info data to the function as a property
    if(!window.bootPlugins) window.bootPlugins = [];
    window.bootPlugins.push(setup);
    // if IITC has already booted, immediately run the 'setup' function
    if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);


/**
 * Created by Trevor Jorgenson on 2/16/2017.
 */
