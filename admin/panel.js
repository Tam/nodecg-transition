$(function () {

	// Tell server to get scenes list on page load
	nodecg.sendMessage('reloadScenes', true);

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