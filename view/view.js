document.addEventListener('ncgReady', function () {

	var video = document.getElementById('player'),
		videoFolder = '/nodecg-transition/video/';

	video.style.display = 'none';

	nodecg.sendMessage('newTransitionView');

	nodecg.listenFor('changeActiveTransition', updatePlayer);
	nodecg.listenFor('playTransition', playTransition);

	function updatePlayer(t) {

		if (!t.file) {
			video.width = 0;
			video.height = 0;
			video.src = '';
		} else {
			video.width = t.width;
			video.height = t.height;
			video.src = videoFolder + t.file;
		}

	}

	function playTransition() {
		video.style.display = 'block';
		video.play();
	}

	video.addEventListener('ended', function () {
		video.style.display = 'none';
	});

}, false);

