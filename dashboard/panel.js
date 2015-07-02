/**
 * Init
 */
var po = $('#panelOverlay'),
	pot = po.find('.text');

// OBS connection check
doCheckOBSConnection();

$(document).on('click', '#doCheckOBSConnection', function () {
	doCheckOBSConnection();
});

function doCheckOBSConnection() {
	nodecg.sendMessage('checkObsConnection');

	pot.html('Waiting for OBS connection...');
	po.removeClass('hidden');
}

nodecg.Replicant('obsConnectedAndAuthenticated')
	.on('change', function (oldVal, newVal) {
		if (newVal) {
			pot.html('Running Transition...');
			po.addClass('hidden');
		} else {
			pot.html('<p>No connection to OBS</p><button id="doCheckOBSConnection" class="btn btn-primary btn-sm">Check connection...</button>');
			po.removeClass('hidden');
		}
	});

/**
 * Transitions
 */
var $transList = $('#ncg-t_transitionsList');

// Transition Modal
var $modalButton = $('#ncg-t_transitionModalButton'),
	$videoPreview = $('#ncg-t_videoPreview'),
	$transitionModal = $('#ncg-t_transitionModal'),
	DEFAULT_VIDEO = 'http://v2v.cc/~j/theora_testsuite/320x240.ogg',
	VIDEO_FOLDER = '/view/nodecg-transition/video/',
	videoFile,
	videoFilename;

var reconnectProtect = false;
nodecg.Replicant('transitions')
	.on('change', function (oldVal, newVal) {
        $transList.html('');
		var trans = newVal.slice(0);
		if (trans.length === 0) {
			trans.unshift({
				name: 'None',
				switchTime: 0
			});
		}

		trans.forEach(function(transition) {
            // The $trans element will have a jQuery data property `transition` with all its data
            var $trans = createTransitionListItem(transition);
            $transList.append($trans);
        });

        // If there's only one, it must be the "None" transition we just pushed
        if (trans.length === 1) {
	        if (!reconnectProtect) {
		        $transList.after('<p id="ncg-t_noTransitions" class="text-muted"><strong><small>You haven\'t added any transitions yet!</small></strong></p>');
		        reconnectProtect = true;
	        }
        } else {
	        $('#ncg-t_noTransitions').remove();
        }
	});

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

	$transitionModal.modal('show');
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
					console.log('[nodecg-transition] Errors!', data);
				}
			},
			error: function(jqXHR, textStatus, errorThrown) {
				console.log('[nodecg-transition] Errors!', textStatus);
			}
		});
	}
});

// Remove video file
$(document).on('click', '#ncg-t_removeFile', function (e) {
	e.preventDefault();

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

// Add (or update) transition
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
	            $transitionModal.modal('hide');
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

var activeTransition = nodecg.Replicant('activeTransition')
	.on('change', function (oldVal, newVal) {
        var $lis = $transList.find('li');
        $lis.removeClass('live');
        $lis.each(function(index, el) {
            var $el = $(el);
            if ($el.data('transition').name === newVal.name) {
                $el.addClass('live');
            }
        });
	});

// Update video on transition change
$(document).on('click', '#ncg-t_transitionsList a', function (e) {
    activeTransition.value = $(this).parent().data('transition');
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

		nodecg.sendMessage('deleteTransition', data, function(err) {
            if (err) {
                console.error(err);
                return;
            }
			$transitionModal.modal('hide');
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

nodecg.Replicant('scenes')
	.on('change', function(oldVal, newVal) {
        var sceneList = '';

		newVal.forEach(function(scene) {
            var sceneClass = (scene.name === currentScene ? ' class="live"' : '');
            sceneList += '<li'+sceneClass+'><a href="#" data-scene="'+scene.name+'">'+scene.name+'</a></li>';
        });

        listElem.html(sceneList);
	});

var currentScene = nodecg.Replicant('currentScene')
	.on('change', function(oldVal, newVal) {
		listElem.find('li').removeClass('live');
		listElem.find('a[data-scene="' + newVal + '"]').parent().addClass('live');
	});

$(document).on("click", "#ncg-t_sceneList a", function (e) {
    e.preventDefault();

    var newSceneName = $(this).data('scene'),
	    sceneSwitchTime = (activeTransition.value.switchTime * 1000).toFixed(0);

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
