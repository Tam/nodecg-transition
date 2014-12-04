getSettings = function(fs) {
	try {
		return JSON.parse(fs.readFileSync('bundles/nodecg-transition/settings.json', 'utf8'));
	} catch (e) {
		return new Error(e);
	}
};

function utf8_encode(argString) {
	//  discuss at: http://phpjs.org/functions/utf8_encode/
	// original by: Webtoolkit.info (http://www.webtoolkit.info/)
	// improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	// improved by: sowberry
	// improved by: Jack
	// improved by: Yves Sucaet
	// improved by: kirilloid
	// bugfixed by: Onno Marsman
	// bugfixed by: Onno Marsman
	// bugfixed by: Ulrich
	// bugfixed by: Rafal Kukawski
	// bugfixed by: kirilloid
	//   example 1: utf8_encode('Kevin van Zonneveld');
	//   returns 1: 'Kevin van Zonneveld'

	if (argString === null || typeof argString === 'undefined') {
		return '';
	}

	var string = (argString + ''); // .replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	var utftext = '',
		start, end, stringl = 0;

	start = end = 0;
	stringl = string.length;
	for (var n = 0; n < stringl; n++) {
		var c1 = string.charCodeAt(n);
		var enc = null;

		if (c1 < 128) {
			end++;
		} else if (c1 > 127 && c1 < 2048) {
			enc = String.fromCharCode(
				(c1 >> 6) | 192, (c1 & 63) | 128
			);
		} else if ((c1 & 0xF800) != 0xD800) {
			enc = String.fromCharCode(
				(c1 >> 12) | 224, ((c1 >> 6) & 63) | 128, (c1 & 63) | 128
			);
		} else { // surrogate pairs
			if ((c1 & 0xFC00) != 0xD800) {
				throw new RangeError('Unmatched trail surrogate at ' + n);
			}
			var c2 = string.charCodeAt(++n);
			if ((c2 & 0xFC00) != 0xDC00) {
				throw new RangeError('Unmatched lead surrogate at ' + (n - 1));
			}
			c1 = ((c1 & 0x3FF) << 10) + (c2 & 0x3FF) + 0x10000;
			enc = String.fromCharCode(
				(c1 >> 18) | 240, ((c1 >> 12) & 63) | 128, ((c1 >> 6) & 63) | 128, (c1 & 63) | 128
			);
		}
		if (enc !== null) {
			if (end > start) {
				utftext += string.slice(start, end);
			}
			utftext += enc;
			start = end = n + 1;
		}
	}

	if (end > start) {
		utftext += string.slice(start, stringl);
	}

	return utftext;
}

module.exports = function(nodecg) {

	var express = require('express'),
		app = express(),
		sys = require('sys'),
		fs = require('fs'),
		squirrel = require('squirrel'),
		settings = getSettings(fs);

	squirrel(['websocket','cli-color','crypto-js'], function(err, ws, clc, CryptoJS) {

		var W3CWebSocket = ws.w3cwebsocket;

		// Log helper function
		var bundleName = '[NodeCG-Transition] ';
		var logCodes = {
			'warn': clc.red.bold(bundleName),
			'info': clc.cyan(bundleName)
		};
		var log = function(msg, type) {
			switch (type) {
				case 'warn':
					console.log(logCodes.warn + msg);
					break;
				case 'info':
					console.log(logCodes.info + msg);
					break;
				default:
					console.log(logCodes.info + msg);
			}
		};

		// OBS Remote
		if (settings.OBSRemoteURL == '') {
			log('OBS Remote URL not set!', 'warn');
		} else {

			// Connection Variables
			var obsRemoteUrl = 'ws://' + settings.OBSRemoteURL + ':4444/',
				obsSocket,
				requestCallbacks = {},
				websocketConnected = false,
				currentMessageCounter = 1;

			// Attempt to connect to OBS Remote
			connectWebSocket();
			function connectWebSocket() {
				log('Attempting to connect to OBS Remote');
				obsSocket = new W3CWebSocket(obsRemoteUrl, "obsapi");

				try {
					obsSocket.onopen = _onWSConnect;
					obsSocket.onmessage = _onWSReceiveMessage;
					obsSocket.onerror = _onWSError;
					obsSocket.onclose = _onWSClose;
				} catch (e) {
					console.log(logCodes.warn + e);
				}
			}

			// Default WebSocket functions
			function _onWSConnect() {
				log('Successfully connected to OBS Remote');
				websocketConnected = true;
				checkAuth();
			}

			function _onWSReceiveMessage(msg) {
				var res = JSON.parse(msg.data);

				if (!res) return;

				var updateType = res["update-type"];
				if (updateType) {
					switch (updateType) {
						case "SwitchScenes":
							onSceneSwitched(res);
							break;
						case "ScenesChanged":
							onScenesChanged(res);
							break;
						default: return;
					}
				} else {
					var id = res["message-id"];

					if (res["status"] == "error") {
						log(res["error"], 'warn');
					}

					var callback = requestCallbacks[id];
					if(callback) {
						callback(res);
						requestCallbacks[id] = null;
					}
				}
			}

			function _onWSError(e) {
				log("Connection Error", 'warn');
				obsSocket.close();
			}

			function _onWSClose() {
				log("Connection to OBS Remote has been closed");
			}

			// Message Handling
			function getNextID() {
				currentMessageCounter++;
				return currentMessageCounter + "";
			}

			function sendMessage(msg, callback) {
				if(websocketConnected)
				{
					var id =  getNextID();
					if(!callback)
					{
						requestCallbacks[id] = function(){};
					}
					else
					{
						requestCallbacks[id] = callback;
					}
					msg["message-id"] = id;

					var serializedMessage = JSON.stringify(msg);
					obsSocket.send(serializedMessage);
				}
			}

			// Authenticate the User
			var authSalt = "",
				authChallenge = "";

			function checkAuth() {
				var myJSONRequest = {};
				myJSONRequest["request-type"] = "GetAuthRequired";
				sendMessage(myJSONRequest, authRequired);
			}

			function authRequired(res) {
				var authReq = res['authRequired'];

				if (authReq) {
					authSalt = res['salt'];
					authChallenge = res['challenge'];

					var pass = settings.password,
						authHash = CryptoJS.SHA256(utf8_encode(pass) + utf8_encode(authSalt)).toString(CryptoJS.enc.Base64),
						authResp = CryptoJS.SHA256(utf8_encode(authHash) + utf8_encode(authChallenge)).toString(CryptoJS.enc.Base64),
						myJSONRequest = {};

					myJSONRequest["request-type"] = "Authenticate";
					myJSONRequest["auth"] = authResp;
					sendMessage(myJSONRequest, authenticationResponse);
				} else {
					initNCGT();
				}
			}

			function authenticationResponse(res) {
				if (res['status'] == "ok") {
					log('Authentication Successful');
					initNCGT();
				} else {
					// Auth Failed. This warning is caught by _onWSReceiveMessage's error status catching
				}
			}

			// Successful connection & Auth
			function initNCGT() {
				getScenesList();
			}

			// When the scenes are changed
			function onScenesChanged() {
				getScenesList();
			}

			// Get the scenes list
			nodecg.listenFor('reloadScenes', getScenesList);

			function getScenesList() {
				var request = {};
				request["request-type"] = "GetSceneList";

				sendMessage(request, receiveScenes);
			}

			function receiveScenes(res) {
				var status = res["status"];

				if (status == "ok") {
					var currentScene = res["current-scene"],
						scenes = res["scenes"];

					if (scenes) {
						nodecg.sendMessage('scenesList', {
							currentScene: currentScene,
							scenes: scenes
						});
						log('Scenes updated');
					}

				} else {
					log("Unable to fetch scenes list", 'warn');
				}
			}

			// Update the current active scene
			function onSceneSwitched(res) {
				//log('Scenes Switched!');
				nodecg.sendMessage('currentScene', {
					name: res['scene-name']
				});
			}

			// Switch the live scene
			nodecg.listenFor('switchScene', switchScene);

			function switchScene(data) {
				var newSceneName = data.name,
					request = {};

				request["request-type"] = "SetCurrentScene";
				request["scene-name"] = newSceneName;
				sendMessage(request);
			}

		}

	});

	return app;
};