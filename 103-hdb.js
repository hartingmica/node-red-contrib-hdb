/**
 * Copyright 2016 HARTING IT Software Development
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

/**
 NodeRed node with support for connecting and sending queries to the SAP HANA database.
 This project is based on the npm hdb project.

 @author <a href="mailto:oliver.beyer@HARTING.com">Oliver Beyer</a> (HARTING IT Cognitive Systems)
**/

module.exports = function(RED) {
    "use strict";
    var reconnect = RED.settings.mysqlReconnectTime || 30000;
	var hdb = require('hdb');

	function HANANode(config) {
        RED.nodes.createNode(this,config);
        this.host = config.host;
        this.port = config.port;

        this.connected = false;
        this.connecting = false;

        var node = this;

        function doConnect() {
            node.connecting = true;
            node.connection = hdb.createClient({
                host : node.host,
                port : node.port,
                user : node.credentials.user,
                password : node.credentials.password
            });

            node.connection.connect(function(err) {
                node.connecting = false;
                if (err) {
                    node.error(err);
                    node.tick = setTimeout(doConnect, reconnect);
                } else {
                    node.connected = true;
                }
            });

            node.connection.on('error', function(err) {
                node.connected = false;
                if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                    doConnect(); // silently reconnect...
                } else {
                    node.error(err);
                    doConnect();
                }
            });
        }

        this.connect = function() {
            if (!this.connected && !this.connecting) {
                doConnect();
            }
        }

        this.on('close', function (done) {
            if (this.tick) { clearTimeout(this.tick); }
            if (this.connection) {
                node.connection.end(function(err) {
                    if (err) { node.error(err); }
                    done();
                });
            } else {
                done();
            }
        });
    }
    RED.nodes.registerType("HANAdatabase",HANANode, {
        credentials: {
            user: {type: "text"},
            password: {type: "password"}
        }
    });


    function HANANodeIn(config) {
        RED.nodes.createNode(this,config);
        this.hdb = config.hdb;
        this.hdbConfig = RED.nodes.getNode(this.hdb);

        if (this.hdbConfig) {
            this.hdbConfig.connect();
            var node = this;
            node.on("input", function(msg) {
                if (typeof msg.topic === 'string') {
                    //console.log("query:",msg.topic);
                    var bind = Array.isArray(msg.payload) ? msg.payload : [];
                    node.hdbConfig.connection.exec(msg.topic, bind, function(err, rows) {
                        if (err) { node.error(err,msg); }
                        else {
                            msg.payload = rows;
                            node.send(msg);
                        }
                    });
                }
                else {
                    if (typeof msg.topic !== 'string') { node.error("msg.topic : the query is not defined as a string"); }
                }
            });
        }
        else {
            this.error("HANA database not configured");
        }
    }
    RED.nodes.registerType("sap hana",HANANodeIn);
}
