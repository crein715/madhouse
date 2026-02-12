(function () {
    'use strict';

    var STORAGE_KEY = 'madhouse_watched';

    var mad_icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>';

    var eye_icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';

    function getWatched() {
        var data = Lampa.Storage.get(STORAGE_KEY, '[]');
        if (!Array.isArray(data)) return [];
        return data;
    }

    function isWatched(id) {
        return getWatched().indexOf(id) !== -1;
    }

    function toggleWatched(id) {
        var list = getWatched();
        var idx = list.indexOf(id);
        if (idx === -1) {
            list.push(id);
        } else {
            list.splice(idx, 1);
        }
        Lampa.Storage.set(STORAGE_KEY, list);
        return idx === -1;
    }

    function splitResults(results) {
        var unwatched = [];
        var watched = [];
        results.forEach(function (item) {
            if (isWatched(item.id)) {
                watched.push(item);
            } else {
                unwatched.push(item);
            }
        });
        return { unwatched: unwatched, watched: watched };
    }

    function createSectionHeader(text) {
        var header = document.createElement('div');
        header.className = 'madhouse-section-header';
        header.textContent = text;
        return header;
    }

    function MadhouseComponent(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250, end_ratio: 2 });
        var html = document.createElement('div');
        var body = document.createElement('div');
        var items = [];
        var active = 0;
        var total_pages = 1;
        var loading = false;
        var last = null;
        var activity = null;
        var listener = Lampa.Listener;

        var allResults = [];
        var gridUnwatched = null;
        var gridWatched = null;
        var headerUnwatched = null;
        var headerWatched = null;

        body.classList.add('category-full');

        scroll.minus();
        scroll.append(body);
        html.appendChild(scroll.render(true));

        function createCard(element) {
            var card_data = Object.assign({}, element, {
                title: element.name || element.title,
                original_title: element.original_name || element.original_title,
                release_date: element.first_air_date || element.release_date
            });

            var card = new Lampa.Card(card_data, { object: object });
            card.create();

            card.render(true).on('hover:enter', function () {
                Lampa.Router.call('full', card_data);
            });

            card.render(true).on('hover:focus', function () {
                last = card.render(true);
                active = items.indexOf(card);
                scroll.update(card.render(true));
                Lampa.Background.change(Lampa.Utils.cardImgBackground(card_data));
            });

            card.render(true).on('hover:long', function () {
                showMenu(card, card_data);
            });

            if (isWatched(element.id)) {
                card.render(true).style.opacity = '0.4';

                var badge = document.createElement('div');
                badge.classList.add('madhouse-watched-badge');
                badge.innerHTML = eye_icon;
                var view = card.render(true).querySelector('.card__view');
                if (view) view.appendChild(badge);
            }

            return card;
        }

        function showMenu(card, card_data) {
            var enabled = Lampa.Controller.enabled().name;
            var watched = isWatched(card_data.id);

            var menu_items = [
                {
                    title: watched ? '✕ Mark as Unwatched' : '✓ Mark as Watched',
                    watched_toggle: true
                }
            ];

            Lampa.Select.show({
                title: card_data.title || card_data.name,
                items: menu_items,
                onBack: function () {
                    Lampa.Controller.toggle(enabled);
                },
                onSelect: function (a) {
                    if (a.watched_toggle) {
                        toggleWatched(card_data.id);
                        Lampa.Controller.toggle(enabled);
                        activity.refresh();
                    }
                }
            });
        }

        function ensureSections() {
            if (!headerUnwatched) {
                headerUnwatched = createSectionHeader('Unwatched');
                body.appendChild(headerUnwatched);
            }
            if (!gridUnwatched) {
                gridUnwatched = document.createElement('div');
                gridUnwatched.className = 'madhouse-grid';
                body.appendChild(gridUnwatched);
            }
            if (!headerWatched) {
                headerWatched = createSectionHeader('Watched');
                body.appendChild(headerWatched);
            }
            if (!gridWatched) {
                gridWatched = document.createElement('div');
                gridWatched.className = 'madhouse-grid';
                body.appendChild(gridWatched);
            }
        }

        function fullRebuild(results) {
            items.forEach(function (c) { c.destroy(); });
            items = [];

            if (gridUnwatched) gridUnwatched.innerHTML = '';
            if (gridWatched) gridWatched.innerHTML = '';

            ensureSections();

            results.forEach(function (element) {
                var card = createCard(element);
                if (isWatched(element.id)) {
                    gridWatched.appendChild(card.render(true));
                } else {
                    gridUnwatched.appendChild(card.render(true));
                }
                items.push(card);
            });
        }

        function appendNewResults(newResults) {
            ensureSections();

            newResults.forEach(function (element) {
                var card = createCard(element);
                if (isWatched(element.id)) {
                    gridWatched.appendChild(card.render(true));
                } else {
                    gridUnwatched.appendChild(card.render(true));
                }
                items.push(card);
            });
        }

        function loadData() {
            if (loading) return;
            loading = true;
            activity.loader(true);

            Lampa.Api.list(object, function (data) {
                loading = false;
                activity.loader(false);

                total_pages = data.total_pages || 1;

                var newResults = data.results || [];
                allResults = allResults.concat(newResults);
                fullRebuild(allResults);

                activity.toggle();
                Lampa.Layer.visible(scroll.render(true));
            }, function () {
                loading = false;
                activity.loader(false);
                activity.toggle();
            });
        }

        function loadNext() {
            if (loading) return;
            if ((object.page || 1) >= total_pages) return;

            object.page = (object.page || 1) + 1;
            loading = true;

            Lampa.Api.list(object, function (data) {
                loading = false;
                total_pages = data.total_pages || 1;

                var newResults = data.results || [];
                allResults = allResults.concat(newResults);
                appendNewResults(newResults);

                Lampa.Layer.visible(scroll.render(true));
                Lampa.Controller.collectionSet(scroll.render(true));
                Lampa.Controller.collectionFocus(last || false, scroll.render(true));
            }, function () {
                loading = false;
            });
        }

        this.create = function () {
            loadData();
        };

        this.start = function () {
            scroll.onWheel = function (step) {
                if (!Lampa.Controller.own(this)) this.start();
                Navigator.move(step > 0 ? 'down' : 'up');
            }.bind(this);

            scroll.onEnd = function () {
                loadNext();
            };

            Lampa.Controller.add('content', {
                link: this,
                invisible: true,
                toggle: function () {
                    scroll.restorePosition();
                    Lampa.Controller.collectionSet(scroll.render(true));
                    Lampa.Controller.collectionFocus(last || false, scroll.render(true));
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                right: function () {
                    if (Navigator.canmove('right')) Navigator.move('right');
                },
                up: function () {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () {
                    if (Navigator.canmove('down')) Navigator.move('down');
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });

            Lampa.Controller.toggle('content');
        };

        this.pause = function () {};
        this.stop = function () {};

        this.render = function (js) {
            return js ? html : $(html);
        };

        this.destroy = function () {
            scroll.destroy();
            items.forEach(function (card) {
                card.destroy();
            });
            items = [];
            html.remove();
            body.remove();
        };

        this.activity = activity;

        Object.defineProperty(this, 'activity', {
            set: function (val) {
                activity = val;
            },
            get: function () {
                return activity;
            }
        });
    }

    function addMenuItem() {
        var button = Lampa.Menu.addButton(mad_icon, 'Madhouse', function () {
            Lampa.Activity.push({
                url: 'discover/tv',
                title: 'Madhouse Anime',
                component: 'madhouse_full',
                source: 'tmdb',
                page: 1,
                card_type: true,
                companies: 3464,
                genres: 16,
                sort_by: 'vote_average.desc',
                filter: {
                    'vote_count.gte': 10
                }
            });
        });
        button.addClass('madhouse-menu-item');
    }

    function init() {
        Lampa.Component.add('madhouse_full', MadhouseComponent);

        Lampa.Template.add('madhouse_style', '<style>' +
            '.madhouse-menu-item .menu__ico svg{width:2.2em;height:2.2em;fill:currentColor}' +
            '.madhouse-watched-badge{position:absolute;top:0.5em;right:0.5em;background:rgba(0,0,0,0.7);border-radius:50%;padding:0.3em;display:flex;align-items:center;justify-content:center;z-index:2}' +
            '.madhouse-watched-badge svg{fill:#4CAF50}' +
            '.madhouse-section-header{width:100%;padding:1em 0.5em 0.5em;font-size:1.3em;font-weight:600;color:rgba(255,255,255,0.9);border-bottom:2px solid rgba(255,255,255,0.15);margin-bottom:0.8em;clear:both}' +
            '.madhouse-grid{display:flex;flex-wrap:wrap;gap:0;width:100%}' +
            '.madhouse-grid .card{width:calc(100% / 6);flex-shrink:0}' +
        '</style>');
        $('body').append(Lampa.Template.get('madhouse_style'));

        addMenuItem();
    }

    if (!window.plugin_madhouse_ready) {
        window.plugin_madhouse_ready = true;
        if (window.appready) {
            init();
        } else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type == 'ready') {
                    init();
                }
            });
        }
    }
})();
