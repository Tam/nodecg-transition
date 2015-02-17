getSettings = function(fs) {
	try {
		return JSON.parse(fs.readFileSync('bundles/nodecg-transition/settings.json', 'utf8'));
	} catch (e) {
		return new Error(e);
	}
};

var guid = (function() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000)
			.toString(16)
			.substring(1);
	}
	return function() {
		return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
			s4() + '-' + s4() + s4() + s4();
	};
})();

module.exports = function(nodecg) {

	/**
	 * Variables
	 */
	var express = require('express'),
		sys = require('sys'),
		fs = require('fs'),
		Datastore = require('nedb'),
		Q = require('q'),
		busboy = require('connect-busboy'),
		OBSRemote = require('obs-remote');

	var app = express(),
		db = new Datastore({ filename: 'bundles/nodecg-transition/transitions.db', autoload: true }),
		obs = new OBSRemote(),
		settings = getSettings(fs);

	/**
	 * Init
	 */
	app.use(busboy()); // For file uploading

	nodecg.listenFor('checkObsConnection', checkOBSConnection);

	obs.connect(settings.url + ":" + settings.port, settings.password);

	obs.onConnectionOpened(function () {
		nodecg.log.info("Connected to OBS");
		nodecg.sendMessage('obsConnectedAndAuthenticated', true);
	});

	obs.onConnectionClosed(function () {
		nodecg.log.info("Connection to OBS has been closed");
		nodecg.sendMessage('obsConnectedAndAuthenticated', false);
	});

	obs.onConnectionFailed(function () {
		nodecg.log.warn("Failed to connect to OBS");
		nodecg.sendMessage('obsConnectedAndAuthenticated', false);
	});

	obs.isAuthRequired(function (authRequired) {
		if (authRequired) {
			obs.authenticate(settings.password);
		} else {
			nodecg.sendMessage('obsConnectedAndAuthenticated', true);
		}
	});

	obs.onAuthenticationSucceeded(function () {
		nodecg.log.info("Successfully authenticated with OBS");
		nodecg.sendMessage('obsConnectedAndAuthenticated', true);
	});

	obs.onAuthenticationFailed(function (attemptsRemaining) {
		nodecg.log.warn("Failed to authenticate with OBS, " + attemptsRemaining + " attempts remaining");
		nodecg.sendMessage('obsConnectedAndAuthenticated', false);

		if (attemptsRemaining > 0) obs.authenticate(settings.password);
	});

	function checkOBSConnection() {
		nodecg.log.info("Check connection");
	}

	/**
	 * Transitions
	 */
	// Get all transitions from db
	function allTransitions() {
		var def = Q.defer();

		db.find({}, function (err, docs) {
			if (err) {
				def.reject(new Error(err));
			} else {
				def.resolve(docs);
			}
		});

		return def.promise.then(getTransitionsList);
	}

	// Update transitions list
	function getTransitionsList(transitions) {
		if (!transitions) {
			allTransitions();
			return;
		}

		nodecg.sendMessage('transitionsList', transitions);
	}

	// Find a transition by its _id
	function findTransitionById(id) {
		var def = Q.defer();

		db.findOne({ _id: id }, function (err, doc) {
			if (err || doc === null) {
				def.reject(new Error(err));
			} else {
				def.resolve(doc);
			}
		});

		return def.promise.done(getTransitionById);
	}

	function getTransitionById(transition) {
		if (typeof transition === 'string') {
			findTransitionById(transition);
			return;
		}

		nodecg.sendMessage('gotTransitionByName', transition);
	}

	// Add a transition to the db
	function updateTransition(transition) {
		if (!transition) return;

		var def = Q.defer();
		transition.id = transition.id || guid();
		db.update({ _id: transition.id }, transition, { upsert: true }, function (err, numReplaced, upsert) {
			if (err) {
				def.reject(new Error(err));
			} else {
				def.resolve(transition.id);

				if (upsert) {
					nodecg.log.info('Added "' + transition.name + '" to the DB');
				} else {
					nodecg.log.info('Updated "' + transition.name + '" in the DB');
				}
			}
		});
		return def.promise;
	}

	// Remove transition from the db
	function removeTransition(id) {
		db.remove({ _id: id }, {}, function (err, numRemoved) {
			nodecg.log.info('Transition "' + id + '" has been removed from the DB');
			nodecg.sendMessage('transitionDeleted');
		});
	}

	// NodeCG Hooks
	nodecg.listenFor('getTransitionsList', getTransitionsList);
	nodecg.listenFor('getTransitionsById', getTransitionById);
	nodecg.listenFor('deleteTransition', removeTransition);

	/**
	 * Video Files
	 */
	var videoFolder = 'bundles/nodecg-transition/video/';

	// View video
	app.use('/nodecg-transition/video', express.static(videoFolder));

	// Upload video file
	app.post('/nodecg-transition/upload', function(req, res) {
		var fstream;

		req.pipe(req.busboy);

		req.busboy.on('file', function (fieldname, file, filename) {
			nodecg.log.info('Uploading: ' + filename);
			fstream = fs.createWriteStream(videoFolder + filename);
			file.pipe(fstream);
			fstream.on('close', function() {
				res.status(200).json({
					status: 'success',
					data: filename
				});
			});
		});
	});

	// Remove video file
	app.post('/nodecg-transition/remove', function(req, res) {
		var filename = req.body.filename;
		fs.unlink(videoFolder + filename, function(err) {
			if (err) {
				res.status(500).json({
					status: 'error',
					error: err
				});
			} else {
				res.status(200).json({
					status: 'success',
					data: {}
				});
			}
		});
	});

	// Add / Update Transition
	app.post('/nodecg-transition/update', function (req, res) {
		var b = req.body,
			transition = {};
		transition.id = b.transitionId;
		transition.file = b.transitionFileLocation;
		transition.name = b.transitionName.replace(/["'\\]/g, "");
		transition.width = b.transitionWidth;
		transition.height = b.transitionHeight;
		transition.switchTime = b.transitionSceneSwitchTime;

		var savedTransition = updateTransition(transition);

		if (savedTransition) {
			res.status(200).json({
				status: 'success',
				data: {
					transitionName: savedTransition
				}
			});
		} else {
			res.status(500).json({
				status: 'error',
				error: 'Error! Check server log!'
			});
		}
	});

	/**
	 * Scenes
	 */
	getScenesList();

	function getScenesList() {
		obs.getSceneList(function (currentScene, scenes) {

			nodecg.sendMessage('scenesList', {
				currentScene: currentScene,
				scenes: scenes
			});

			nodecg.log.info('Scenes updated');

		});
	}

	obs.onScenesChanged(function (scenes) {
		nodecg.log.info(scenes.toString());
		getScenesList();
	});

	// Update the current active scene
	obs.onSceneSwitched(function (sceneName) {
		nodecg.log.info(sceneName);
		nodecg.sendMessage('currentScene', {
			name: sceneName
		});
	});

	function switchScene(data) {
		obs.setCurrentScene(dada.name);
	}

	// NodeCG Hooks
	nodecg.listenFor('reloadScenes', getScenesList);
	nodecg.listenFor('switchScene', switchScene);

	return app;
};