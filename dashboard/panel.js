Object.size = function(obj) {
	var size = 0, key;
	for (key in obj) {
		if (obj.hasOwnProperty(key)) size++;
	}
	return size;
};

/**
 * Init
 */
var po = $('#panelOverlay'),
	pot = po.find('.text'),
	waitingForObs;

// OBS connection check
doCheckOBSConnection();

$(document).on('click', '#doCheckOBSConnection', function () {
	doCheckOBSConnection();
});

function doCheckOBSConnection() {
	nodecg.sendMessage('checkObsConnection');

	pot.html('Waiting for OBS connection...');
	po.removeClass('hidden');

	waitingForObs = setTimeout(function () {
		checkObsConnection(false);
	}, 10000);
}

nodecg.listenFor('obsConnectedAndAuthenticated', checkObsConnection);

function checkObsConnection(isConnectedAndAuthenticated) {
	if (!isConnectedAndAuthenticated) {
		pot.html('No connection to OBS<br /><br/><button id="doCheckOBSConnection" class="btn btn-primary btn-sm">Check connection...</button>');
		po.removeClass('hidden');
	} else {
		clearTimeout(waitingForObs);
		pot.html('Running Transition...');
		po.addClass('hidden');
	}
}

/**
 * Transitions
 */
// Get transitions from db
getTransitionList();
nodecg.listenFor('transitionDeleted', getTransitionList);
nodecg.listenFor('transitionsList', updateTransitionsList);

function getTransitionList() {
	nodecg.sendMessage('getTransitionsList');
}

var transListElem = $('#ncg-t_transitionsList');

function updateTransitionsList(data) {
	var transitions = data,
		transitionsCount = Object.size(transitions);

	if (transitionsCount < 1) {
		transListElem.append('<p class="text-muted"><strong><small>You haven\'t added any transitions yet!</small></strong></p>');
	} else {

		transListElem.html('<div class="radio"><label><input type="radio" name="ncg-t_transitionList" value="none" checked/>None</label></div>');

		for (var i = 0; i < transitionsCount; i++) {
			var transition = transitions[i];

			transListElem.append('<div class="radio"><label><input type="radio" name="ncg-t_transitionList" value="'+ transition._id +'"/>' + transition.name + '</label><a href="#" data-id="'+ transition._id +'" data-file="'+ transition.file +'" data-name="'+ transition.name +'" data-width="'+ transition.width +'" data-height="'+ transition.height +'" data-switchTime="'+ transition.switchTime +'">Edit</a></div>');
		}

	}
}

// Transition Modal
var modalButton = $('#ncg-t_transitionModalButton'),
	defaultVideo = 'http://v2v.cc/~j/theora_testsuite/320x240.ogg',
	videoPreview = $('#ncg-t_videoPreview'),
	videoFolder = '/nodecg-transition/video/',
	videoFile,
	videoFilename,
	activeTransition = {
		switchTime: 0
	};

// Open modal & populate with edit data
$(document).on('click', '#ncg-t_transitionsList a', function (e) {
	e.preventDefault();
	var t = $(this);

	videoFilename = t.attr('data-file');

	$('#ncg-t_transitionId').val(t.attr('data-id'));
	$('#ncg-t_fileUpload').addClass('hidden');
	$('#ncg-t_fileUploaded').removeClass('hidden').find('input').val(videoFilename);
	$('#ncg-t_transitionName').val(t.attr('data-name'));
	$('#ncg-t_transitionWidth').val(t.attr('data-width'));
	$('#ncg-t_transitionHeight').val(t.attr('data-height'));
	$('#ncg-t_transitionSceneSwitchTime').val(t.attr('data-switchTime'));

	videoPreview.attr('src', videoFolder + videoFilename);

	$('#ncg-t_transitionModalLabel').text('Update Transition');
	modalButton.val('Update Transition');

	$('#ncg-t_transitionModalRemoveButton').removeClass('hidden');

	$('#ncg-t_transitionModal').modal('show');
	return false;
});

// Reset modal on close
$(document).on('hidden.bs.modal', '#ncg-t_transitionModal', function(e) {
	$(this).find('input').val('');
	$('#ncg-t_transitionModalLabel').text('Add Transition');
	modalButton.val('Add Transition');
	$('#ncg-t_transitionModalRemoveButton').addClass('hidden');
	$('#ncg-t_transitionForm').find('.has-error').removeClass('has-error');
	$('#ncg-t_fileUpload').removeClass('hidden');
	$('#ncg-t_fileUploaded').addClass('hidden');
	videoPreview.attr('src', defaultVideo);
});

// Upload video file
$(document).on('change', '#ncg-t_transitionFileLocation', function (e) {
	videoFile = e.target.files;
});

$(document).on('click', '#ncg-t_uploadFile', function (e) {
	e.preventDefault();

	if (videoFile) {
		var data = new FormData();

		$.each(videoFile, function(key, value) {
			data.append(key, value);
		});

		$.ajax({
			url: '/nodecg-transition/upload',
			type: 'POST',
			data: data,
			cache: false,
			dataType: 'json',
			processData: false,
			contentType: false,
			success: function(data, textStatus, jqXHR) {
				if (typeof data.error === 'undefined') {
					var filename = data.data;
					$('#ncg-t_fileUpload').addClass('hidden');
					$('#ncg-t_fileUploaded').removeClass('hidden').find('input').val(filename);
					videoPreview.attr('src', videoFolder + filename);
					videoFilename = filename;
				} else {
					console.log('Errors!', data);
				}
			},
			error: function(jqXHR, textStatus, errorThrown) {
				console.log('Errors!', textStatus);
			}
		});
	}
});

// Remove video file
$(document).on('click', '#ncg-t_removeFile', function (e) {
	e.preventDefault();

	if (confirm('Are you sure? (Can\'t be undone. Canceling the modal without a video will break all the things when updating a transition!)')) {

		var filename = $('#ncg-t_transitionFileLocationSet').val();
		filename = (filename == '' ? videoFilename : filename);

		removeVideo(filename);

	}
});

// Video preview current time
videoPreview.on('timeupdate', function () {
	$('#ncg-t_transitionSceneSwitchTime').val(this.currentTime);
});

// Add transition
$(document).on('click', '#ncg-t_transitionModalButton', function (e) {
	e.preventDefault();

	if (validateTransitionForm()) {
		var data = $('#ncg-t_transitionForm').serialize();

		$.ajax({
			url: '/nodecg-transition/update',
			type: 'POST',
			data: data,
			success: function(data, textStatus, jqXHR) {
				if (typeof data.error === 'undefined') {
					nodecg.sendMessage('getTransitionsList');
					$('#ncg-t_transitionModal').modal('hide');
				} else {
					console.log('Errors!', data);
				}
			},
			error: function(jqXHR, textStatus, errorThrown) {
				console.log('Errors!', textStatus);
			}
		});
	}

});

// Validate Form
function validateTransitionForm() {
	var formValid = true;

	// Video File
	if (!$('#ncg-t_transitionFileLocationSet').val()) {
		$('#ncg-t_fileUpload').addClass('has-error');
		$('#ncg-t_fileUploaded').addClass('has-error');
		formValid = false;
	} else {
		$('#ncg-t_fileUpload').removeClass('has-error');
		$('#ncg-t_fileUploaded').removeClass('has-error');
	}

	// Transition Name
	var transitionName = $('#ncg-t_transitionName');
	if (!transitionName.val()) {
		transitionName.parent().addClass('has-error');
		formValid = false;
	} else {
		transitionName.parent().removeClass('has-error');
	}

	// Video Resolution
	// Width
	var transitionWidth = $('#ncg-t_transitionWidth');
	if (!transitionWidth.val() || transitionWidth.val() < 0) {
		transitionWidth.parent().addClass('has-error');
		formValid = false;
	} else {
		transitionWidth.parent().removeClass('has-error');
	}
	// Height
	var transitionHeight = $('#ncg-t_transitionHeight');
	if (!transitionHeight.val() || transitionWidth.val() < 0) {
		transitionHeight.parent().addClass('has-error');
		formValid = false;
	} else {
		transitionHeight.parent().removeClass('has-error');
	}

	// Scene Switch Time
	var sceneSwitchTime = $('#ncg-t_transitionSceneSwitchTime');
	if (!sceneSwitchTime.val() || sceneSwitchTime.val() < 0) {
		sceneSwitchTime.parent().addClass('has-error');
		formValid = false;
	} else {
		sceneSwitchTime.parent().removeClass('has-error');
	}

	return formValid;
}

// Update video on transition change
$(document).on('change', '#ncg-t_transitionsList input', function () {
	var t = $(this).parent().parent().find('a'),
		transition = {};

	if (t.attr('data-id')) {

		activeTransition = {
			id: t.attr('data-id'),
			file: t.attr('data-file'),
			name: t.attr('data-name'),
			width: t.attr('data-width'),
			height: t.attr('data-height'),
			switchTime: t.attr('data-switchTime')
		};

		transition.file = activeTransition.file;
		transition.width = activeTransition.width;
		transition.height = activeTransition.height;

	} else {
		activeTransition = {
			switchTime: 0
		};
	}

	nodecg.sendMessage('changeActiveTransition', transition);
});

// Delete Transition
$(document).on('click', '#ncg-t_transitionModalRemoveButton', function (e) {
	e.preventDefault();

	if (confirm('Are you sure? (Can\'t be undone, video will be deleted)')) {
		var id = $('#ncg-t_transitionId').val(),
			video = $('#ncg-t_transitionFileLocationSet').val();
		nodecg.sendMessage('deleteTransition', id);
		removeVideo(video);
		$('#ncg-t_transitionModal').modal('hide');
	}

	return false;
});

function removeVideo(filename) {
	$.ajax({
		url: '/nodecg-transition/remove',
		type: 'POST',
		data: {'filename': filename},
		success: function (data, textStatus, jqXHR) {
			if (typeof data.error === 'undefined') {
				$('#ncg-t_addFile').find('input').val('');
				$('#ncg-t_fileUpload').removeClass('hidden');
				$('#ncg-t_fileUploaded').addClass('hidden');
				videoPreview.attr('src', defaultVideo);
			} else {
				console.log('Errors!', data);
			}
		},
		error: function (jqXHR, textStatus, errorThrown) {
			console.log('Errors!', textStatus);
		}
	});
}

/**
 * Scenes
 */
// Tell server to get scenes list on page load
nodecg.sendMessage('reloadScenes');

// Listen for scenes list
nodecg.listenFor('scenesList', updateScenesList);
nodecg.listenFor('currentScene', updateCurrentScene);

// Scene List
var listElem = $('#ncg-t_sceneList');

function updateScenesList(data) {
	var sceneList = "",
		currentScene = data.currentScene,
		scenes = data.scenes;

	for (var i = 0; i < scenes.length; i++) {
		var sceneName = scenes[i]['name'],
			sceneClass = (sceneName !== currentScene ? '' : ' class="live"');
		sceneList += '<li'+sceneClass+'><a href="#" data-scene="'+sceneName+'">'+sceneName+'</a></li>';
	}

	listElem.html(sceneList);
}

function updateCurrentScene(data) {
	var currentScene = data.name;
	listElem.find('li').removeClass('live');
	listElem.find('a[data-scene="' + currentScene + '"]').parent().addClass('live');
}

$(document).on("click", "#ncg-t_sceneList a", function (e) {
    e.preventDefault();

    var newSceneName = $(this).attr('data-scene'),
	    sceneSwitchTime = (activeTransition.switchTime * 1000).toFixed(0);

    nodecg.sendMessage('playTransition');

    pot.html('Running Transition...');
    po.removeClass('hidden');

    setTimeout(function () {
	    listElem.find('li').removeClass('live');
	    $(this).parent().addClass('live');
	    nodecg.sendMessage('switchScene', {
		    name: newSceneName
	    });
	    po.addClass('hidden');
    }, sceneSwitchTime);

    return false;
});