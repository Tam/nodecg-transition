$(function () {

    // Scene List
    var listElem = $('#ncg-t_sceneList');
    var scenes = [ // Sample code
        'Scene 1',
        'Scene 2',
        'Scene 3'
    ];
    var sceneList = "";
    for (var i = 0; i < scenes.length; i++) {
        sceneList += '<li><a href="#" data-scene="'+scenes[i]+'">'+scenes[i]+'</a></li>';
    }
    listElem.html(sceneList);
    listElem.find('li:nth-child(2n)').addClass('live'); // Sample code

    $(document).on("click", "#ncg-t_sceneList a", function (e) {
        e.preventDefault();
        listElem.find('li').removeClass('live');
        $(this).parent().addClass('live');
        return false;
    });

});