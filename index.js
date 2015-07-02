'use strict';

var express = require('express'),
    fs = require('fs.extra'),
    locallydb = require('locallydb'),
    Q = require('q'),
    busboy = require('connect-busboy'),
    util = require('util'),
    OBSRemote = require('obs-remote');

var app = express(),
    db = new locallydb('db/nodecg-transition').collection('transitions'),
    obs = new OBSRemote();

var VIDEO_FOLDER = 'bundles/nodecg-transition/view/video/';

// Load settings, throw error if missing
var settings = JSON.parse(fs.readFileSync('bundles/nodecg-transition/settings.json', 'utf8'));

module.exports = function(nodecg) {

    var obsConnectedAndAuthenticated = nodecg.Replicant('obsConnectedAndAuthenticated', {
        defaultValue: false,
	    persistent: false
    });

	/**
	 * Init
	 */
	app.use(busboy()); // For file uploading

	connectToOBS();
	var areWeEvenConnected = false;

	function connectToOBS() {
		obs.connect(settings.url + ':' + settings.port, settings.password);
	}

	obs.onConnectionOpened = function () {
		nodecg.log.info('Connected to OBS');
		areWeEvenConnected = true;
		checkOBSConnection();
	};

	obs.onConnectionClosed = function () {
		nodecg.log.info('Connection to OBS has been closed');
		areWeEvenConnected = false;
		obsConnectedAndAuthenticated.value = false;
	};

	obs.onConnectionFailed = function () {
		nodecg.log.warn('Failed to connect to OBS');
		areWeEvenConnected = false;
		obsConnectedAndAuthenticated.value = false;
	};

	obs.onAuthenticationSucceeded = function () {
		nodecg.log.info('Successfully authenticated with OBS');
		successfullOBSConnection();
	};

	obs.onAuthenticationFailed = function (attemptsRemaining) {
		nodecg.log.warn('Failed to authenticate with OBS, %d attempts remaining', attemptsRemaining);
		obsConnectedAndAuthenticated.value = false;

		if (attemptsRemaining > 0) obs.authenticate(settings.password);
	};

	nodecg.listenFor('checkObsConnection', checkOBSConnection);

	function checkOBSConnection() {
		obs.isAuthRequired(function (authRequired) {
			areWeEvenConnected = true;
			if (authRequired) {
				obs.authenticate(settings.password);
			} else {
				successfullOBSConnection();
			}
		});

		if (!areWeEvenConnected) {
			connectToOBS();
		}
	}

	function successfullOBSConnection() {
		getScenesList();
		obsConnectedAndAuthenticated.value = true;
	}

	/**
	 * Transitions
	 */

    var transitions = nodecg.Replicant('transitions', {
        defaultValue: db.items.slice(0), // Use a clone
		persistent: false
    });

    var activeTransition = nodecg.Replicant('activeTransition', {
	    defaultValue: {
            name: 'None',
            switchTime: 0
        },
	    persistent: false
    });

	nodecg.listenFor('deleteTransition', function(transition, cb) {
        if (!transition || !transition.cid || !transition.filename) {
            var err = new Error('Missing key data, not deleting transition');
            nodecg.log.error(err);
            cb(err);
            return;
        }

        transition.cid = parseInt(transition.cid);

        try {
            // Remove from DB
            db.remove(transition.cid);
	        transitions.value = db.items.slice(0); // Use a clone
        } catch (err) {
            nodecg.log.error(err);
            cb(err);
            return;
        }

        // Remove video file
        var videoPath = VIDEO_FOLDER + transition.filename;
        if (fs.existsSync(videoPath)) {
            fs.unlink(VIDEO_FOLDER + transition.filename, function(err) {
                if (err) {
                    nodecg.log.error(err);
                    cb(err);
                } else {
                    cb(null);
                }
            });
        } else {
            cb(null);
        }
    });

    nodecg.listenFor('deleteVideo', function(filename, cb) {
        fs.unlink(VIDEO_FOLDER + filename, function(err) {
            if (err) {
                nodecg.log.error(err);
                cb(err);
            } else {
                // If there are any transitions for this, delete them
                try {
                    var transitionItems = db.where({ file: filename }).items;
                    transitionItems.forEach(function(transition) {
                        db.remove(parseInt(transition.cid));
                    });
	                transitions.value = db.items.slice(0); // Use a clone
                } catch (err) {
                    nodecg.log.error(err);
                }
                cb(null);
            }
        });
    });

	/**
	 * Video Files
	 */

	// Upload video file
	app.post('/nodecg-transition/upload', function(req, res) {
		var fstream;

		req.pipe(req.busboy);

		req.busboy.on('file', function (fieldname, file, filename) {
			nodecg.log.info('Uploading: ' + filename);
			fstream = fs.createWriteStream(VIDEO_FOLDER + filename);
			file.pipe(fstream);
			fstream.on('close', function() {
				res.status(200).json({
					status: 'success',
					data: filename
				});
			});
		});
	});

    nodecg.listenFor('upsertTransition', function(transition, cb) {
        try {
            // If we have CID already, we must be updating an existing entry
            if (transition.cid) {
                db.update(parseInt(transition.cid), transition);

                // If what we just edited is the current transition, re-assign it
                if (parseInt(transition.cid) === parseInt(activeTransition.value.cid)) {
                    // Because LocallyDB keeps everything in memory, we have to be very careful about object references
                    // For this reason, we assign a clone.
                    var newActiveTransition = db.where({ cid: parseInt(activeTransition.value.cid) }).items[0];
                    if (newActiveTransition) {
	                    activeTransition.value = util._extend({}, newActiveTransition);
                    }
                }

                nodecg.log.info('Updated "' + transition.name + '" in the DB');
            } else {
                db.insert(transition);
                nodecg.log.info('Added "' + transition.name + '" to the DB');
            }

	        transitions.value = db.items.slice(0); // Use a clone

            cb(null);
        } catch (err) {
            nodecg.log.error(err);
            cb(err);
        }
    });

	/**
	 * Scenes
	 */
    var scenes = nodecg.Replicant('scenes', { defaultValue: [], persistent: false });
    var currentScene = nodecg.Replicant('currentScene', { defaultValue: '', persistent: false });

	function getScenesList() {
		obs.getSceneList(function (currentSceneName, scenesList) {
			currentScene.value = currentSceneName;
			scenes.value = scenesList;
			nodecg.log.info('Scenes updated');
		});
	}

	obs.onScenesChanged = function (scenes) {
		getScenesList();
	};

	// Update the current active scene
	obs.onSceneSwitched = function (sceneName) {
		currentScene.value = sceneName;
	};

	// NodeCG Hooks
	nodecg.listenFor('reloadScenes', getScenesList);
	nodecg.listenFor('switchScene', function (sceneName) {
        obs.setCurrentScene(sceneName);
    });

	nodecg.mount(app);
};
