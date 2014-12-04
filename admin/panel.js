Object.size = function(obj) {
	var size = 0, key;
	for (key in obj) {
		if (obj.hasOwnProperty(key)) size++;
	}
	return size;
};

$(function () {

	/**
	 * Transitions
	 */
	// Get transitions from db
	nodecg.sendMessage('getTransitionsList');
	nodecg.listenFor('transitionsList', updateTransitionsList);

	var transListElem = $('#ncg-t_transitionsList');

	function updateTransitionsList(data) {
		var transitions = data.transitions,
			transitionsCount = Object.size(transitions);

		if (transitionsCount < 1) {
			transListElem.html('<p class="text-muted"><strong><small>You haven\'t added any transitions yet!</small></strong></p>');
		} else {

			for (var i = 0; i < transitionsCount; i++) {
				console.log('Name, Resolution, Duration, Scene Switch Time');
			}

		}
	}

	// Transition Modal
	var modalButton = $('#ncg-t_transitionModalButton'),
		defaultVideo = 'http://v2v.cc/~j/theora_testsuite/320x240.ogg',
		videoPreview = $('#ncg-t_videoPreview');

	// Reset modal on close
	$(document).on('hidden.bs.modal', '#ncg-t_transitionModal', function(e) {
		$(this).find('input').val('');
		$('#ncg-t_transitionAddModalButton').button('reset');
		videoPreview.attr('src', defaultVideo);
	});

	// Upload video file
	var videoFile,
		videoFilename,
		videoFolder = '/nodecg-transition/video/';

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

		var filename = $('#ncg-t_transitionFileLocationSet').val();
		filename = (filename=='' ? videoFilename : filename);

		$.ajax({
			url: '/nodecg-transition/remove',
			type: 'POST',
			data: {'filename':filename},
			success: function(data, textStatus, jqXHR) {
				if (typeof data.error === 'undefined') {
					$('#ncg-t_addFile').find('input').val('');
					$('#ncg-t_fileUpload').removeClass('hidden');
					$('#ncg-t_fileUploaded').addClass('hidden');
					videoPreview.attr('src', defaultVideo);
				} else {
					console.log('Errors!', data);
				}
			},
			error: function(jqXHR, textStatus, errorThrown) {
				console.log('Errors!', textStatus);
			}
		});
	});

	// Video preview current time
	videoPreview.on('timeupdate', function () {
		$('#ncg-t_transitionSceneSwitchTime').val(this.currentTime);
	});

	$(document).on('click', '#ncg-t_transitionModalButton', function (e) {
		e.preventDefault();
		//
	});

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
	    var newSceneName = $(this).attr('data-scene');
        listElem.find('li').removeClass('live');
        $(this).parent().addClass('live');
	    nodecg.sendMessage('switchScene', {
		    name: newSceneName
	    });
        return false;
    });

});