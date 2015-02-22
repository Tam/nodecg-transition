var video = document.getElementById('player'),
	videoFolder = '/view/nodecg-transition/video/';

video.style.display = 'none';

nodecg.listenFor('playTransition', playTransition);

nodecg.declareSyncedVar({
    name: 'activeTransition',
    setter: function(transition) {
        if (!transition.file) {
            video.width = 0;
            video.height = 0;
            video.src = '';
        } else {
            video.width = transition.width;
            video.height = transition.height;
            video.src = videoFolder + transition.file;
        }
    }
});

function playTransition() {
	video.style.display = 'block';
	video.play();
}

video.addEventListener('ended', function () {
	video.style.display = 'none';
});
