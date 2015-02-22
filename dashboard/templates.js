// Inspired by substack (https://gist.github.com/substack/d68a9d437c926efc46ab)

// Find all templates on the page, and make them easily accessible from the `templates` object
// Also hides the original templates, so they don't display on the page
var telems = document.querySelectorAll('[template]');
var templates = {};
for (var i = 0; i < telems.length; i++) {
    telems[i].style.display = 'none';
    var key = telems[i].getAttribute('template');
    templates[key] = telems[i];
}

function createTransitionListItem (transition) {
    var trans = templates.transition.cloneNode(true);
    trans.querySelector('.name').textContent = transition.name;
    trans.style.display = 'flex';

    if (transition.name.toLowerCase() === 'none') {
        trans.querySelector('.transition-edit').style.display = 'none';
    }

    var $trans = $(trans).data('transition', transition);
    return $trans;
}
