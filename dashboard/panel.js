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

    // TODO: This does nothing. Fix.
	waitingForObs = setTimeout(function () {
		checkObsConnection(false);
	}, 10000);
}

nodecg.declareSyncedVar({
    name: 'obsConnectedAndAuthenticated',
    setter: function (isConnectedAndAuthenticated) {
        if (isConnectedAndAuthenticated) {
            clearTimeout(waitingForObs);
            pot.html('Running Transition...');
            po.addClass('hidden');
        } else {
            pot.html('<p>No connection to OBS</p><button id="doCheckOBSConnection" class="btn btn-primary btn-sm">Check connection...</button>');
            po.removeClass('hidden');
        }
    }
});

/**
 * Transitions
 */
var $transList = $('#ncg-t_transitionsList');

nodecg.declareSyncedVar({
    name: 'transitions',
    setter: function (transitions) {
        $transList.html('');
        transitions.unshift({
            name: 'None',
            switchTime: 0
        });

        transitions.forEach(function(transition) {
            // The $trans element will have a jQuery data property `transition` with all its data
            var $trans = createTransitionListItem(transition);
            $transList.append($trans);
        });

        // If there's only one, it must be the "None" transition we just pushed
        if (transitions.length === 1) {
            $transList.after('<p class="text-muted"><strong><small>You haven\'t added any transitions yet!</small></strong></p>');
        }
    }
});

// Transition Modal
var $modalButton = $('#ncg-t_transitionModalButton'),
	DEFAULT_VIDEO = 'http://v2v.cc/~j/theora_testsuite/320x240.ogg',
	$videoPreview = $('#ncg-t_videoPreview'),
	VIDEO_FOLDER = '/view/nodecg-transition/video/',
	videoFile,
	videoFilename;

// Open modal & populate with edit data
$(document).on('click', '.transition-edit', function (e) {
	e.preventDefault();
    var transition = $(this).parent().data('transition');

	videoFilename = transition.file;

	$('#ncg-t_transitionId').val(transition.cid);
	$('#ncg-t_fileUpload').addClass('hidden');
	$('#ncg-t_fileUploaded').removeClass('hidden').find('input').val(videoFilename);
	$('#ncg-t_transitionName').val(transition.name);
	$('#ncg-t_transitionWidth').val(transition.width);
	$('#ncg-t_transitionHeight').val(transition.height);
	$('#ncg-t_transitionSceneSwitchTime').val(transition.switchTime);

	$videoPreview.attr('src', VIDEO_FOLDER + videoFilename);

	$('#ncg-t_transitionModalLabel').text('Update Transition');
	$modalButton.val('Update Transition');

	$('#ncg-t_transitionModalRemoveButton').removeClass('hidden');

	$('#ncg-t_transitionModal').modal('show');
	return false;
});

// Reset modal on close
$(document).on('hidden.bs.modal', '#ncg-t_transitionModal', function(e) {
	$(this).find('input').val('');
	$('#ncg-t_transitionModalLabel').text('Add Transition');
	$modalButton.val('Add Transition');
	$('#ncg-t_transitionModalRemoveButton').addClass('hidden');
	$('#ncg-t_transitionForm').find('.has-error').removeClass('has-error');
	$('#ncg-t_fileUpload').removeClass('hidden');
	$('#ncg-t_fileUploaded').addClass('hidden');
	$videoPreview.attr('src', DEFAULT_VIDEO);
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
					$videoPreview.attr('src', VIDEO_FOLDER + filename);
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

    // TODO: This does nothing, removeVideo doesn't exist
	if (confirm('Are you sure? (Can\'t be undone. Canceling the modal without a video will break all the things when updating a transition!)')) {
		var filename = $('#ncg-t_transitionFileLocationSet').val() || videoFilename;
        nodecg.sendMessage('deleteVideo', filename, function(err) {
            if (err) {
                console.error(err);
            } else {
                $('#ncg-t_fileUpload').removeClass('hidden').find('input').val();
                $('#ncg-t_fileUploaded').addClass('hidden').find('input').val();
            }
        });
	}
});

// Video preview current time
$videoPreview.on('timeupdate', function () {
	$('#ncg-t_transitionSceneSwitchTime').val(this.currentTime);
});

// Add transition
$(document).on('click', '#ncg-t_transitionModalButton', function (e) {
	e.preventDefault();

	if (validateTransitionForm()) {
        var data = {};
        jQuery($('#ncg-t_transitionForm')).serializeArray().map(function(item) {
            data[item.name] = item.value;
        });

        nodecg.sendMessage('upsertTransition', data, function(err) {
            if (err) {
                console.error(err);
            } else {
                $('#ncg-t_transitionModal').modal('hide');
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

nodecg.declareSyncedVar({
    name: 'activeTransition',
    initialVal: {
        name: 'None',
        switchTime: 0
    },
    setter: function(transition) {
        var $lis = $transList.find('li');
        $lis.removeClass('live');
        $lis.each(function(index, el) {
            var $el = $(el);
            if ($el.data('transition').name === transition.name) {
                console.log('okay we in there');
                console.log($el);
                $el.addClass('live');
            }
        });
    }
});

// Update video on transition change
$(document).on('click', '#ncg-t_transitionsList a', function (e) {
    nodecg.variables.activeTransition = $(this).parent().data('transition');
    e.preventDefault();
});

// Delete Transition
$(document).on('click', '#ncg-t_transitionModalRemoveButton', function (e) {
	e.preventDefault();

	if (confirm('Are you sure? (Can\'t be undone, video will be deleted)')) {
        var data = {
            cid: $('#ncg-t_transitionId').val(),
            filename: $('#ncg-t_transitionFileLocationSet').val()
        };

        console.log(data.cid);

		nodecg.sendMessage('deleteTransition', data, function(err) {
            if (err) {
                console.error(err);
                return;
            }
            $('#ncg-t_transitionModal').modal('hide');
        });
	}

	return false;
});

/**
 * Scenes
 */
// Scene List
var listElem = $('#ncg-t_sceneList');

// Tell server to get scenes list on page load
nodecg.sendMessage('reloadScenes');

nodecg.declareSyncedVar({
    name: 'currentScene',
    setter: function (currentScene) {
        listElem.find('li').removeClass('live');
        listElem.find('a[data-scene="' + currentScene + '"]').parent().addClass('live');
    }
});

nodecg.declareSyncedVar({
    name: 'scenes',
    setter: function (scenes) {
        var sceneList = '';

        scenes.forEach(function(scene) {
            var currentScene = nodecg.variables.currentScene;
            var sceneClass = (scene.name === currentScene ? ' class="live"' : '');
            sceneList += '<li'+sceneClass+'><a href="#" data-scene="'+scene.name+'">'+scene.name+'</a></li>';
        });

        listElem.html(sceneList);
    }
});

$(document).on("click", "#ncg-t_sceneList a", function (e) {
    e.preventDefault();

    var newSceneName = $(this).data('scene'),
	    sceneSwitchTime = (nodecg.variables.activeTransition.switchTime * 1000).toFixed(0);

    nodecg.sendMessage('playTransition');

    pot.html('Running Transition...');
    po.removeClass('hidden');

    setTimeout(function () {
	    listElem.find('li').removeClass('live');
	    $(this).parent().addClass('live');
	    nodecg.sendMessage('switchScene', newSceneName);
	    po.addClass('hidden');
    }, sceneSwitchTime);

    return false;
});
