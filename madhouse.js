(function () {
    'use strict';

    var MADHOUSE_ID = 3464;
    var ANIMATION_GENRE = 16;
    var PLUGIN_NAME = 'madhouse_anime';

    var mad_icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>';

    function MadhouseComponent(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var items = [];
        var html = $('<div></div>');
        var body = $('<div class="category-full items items--cards"></div>');
        var total_pages = 0;
        var current_page = 0;
        var loading_data = false;
        var last = false;
        var comp = this;

        this.activity = null;

        this.create = function () {
            if (!this.activity) {
                var active = Lampa.Activity.active();
                if (active && active.activity) {
                    this.activity = active.activity;
                }
            }

            if (this.activity) this.activity.loader(true);

            html.addClass('layer--wheight');

            scroll.minus();
            scroll.body(body);

            scroll.onWheel = function (step) {
                if (!Lampa.Controller.own(comp)) comp.start();
                if (step > 0) Navigator.move('down');
                else Navigator.move('up');
            };

            scroll.onEnd = function () {
                comp.next();
            };

            html.append(scroll.render());

            comp.loadPage(1);
        };

        this.loadPage = function (page) {
            if (loading_data) return;
            loading_data = true;

            var url = Lampa.TMDB.api('discover/tv?with_companies=' + MADHOUSE_ID + '&with_genres=' + ANIMATION_GENRE + '&sort_by=vote_average.desc&vote_count.gte=10&page=' + page);

            network.silent(url, function (data) {
                total_pages = data.total_pages || 0;
                current_page = page;
                comp.build(data.results || []);
                loading_data = false;
                if (comp.activity) comp.activity.loader(false);
                comp.start();
            }, function () {
                loading_data = false;
                if (comp.activity) comp.activity.loader(false);
            });
        };

        this.next = function () {
            if (current_page < total_pages && !loading_data) {
                comp.loadPage(current_page + 1);
            }
        };

        this.build = function (results) {
            results.forEach(function (element) {
                element.media_type = element.media_type || 'tv';

                var card = Lampa.Maker.make('Card', element);
                card.create();

                var render = card.render();
                render.addClass('selector');

                render.on('hover:focus', function () {
                    last = render;
                    scroll.update(render, true);

                    if (element.backdrop_path) {
                        Lampa.Background.change(Lampa.TMDB.image('t/p/w1280' + element.backdrop_path));
                    } else if (element.poster_path) {
                        Lampa.Background.change(Lampa.TMDB.image('t/p/w1280' + element.poster_path));
                    }
                });

                render.on('hover:enter', function () {
                    var method = element.media_type === 'movie' ? 'movie' : 'tv';
                    Lampa.Activity.push({
                        url: method + '/' + element.id,
                        component: 'full',
                        id: element.id,
                        method: method,
                        card: element,
                        source: 'tmdb'
                    });
                });

                body.append(render);
                items.push(render);
            });
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(last || false, scroll.render());
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
                    else comp.next();
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });
            Lampa.Controller.toggle('content');
        };

        this.pause = function () {};
        this.stop = function () {};

        this.render = function () {
            return html;
        };

        this.destroy = function () {
            network.clear();
            scroll.destroy();
            html.remove();
            body.remove();
            items = [];
        };
    }

    function addMenuItem() {
        var button = Lampa.Menu.addButton(mad_icon, 'Madhouse', function () {
            Lampa.Activity.push({
                url: '',
                title: 'Madhouse Anime',
                component: PLUGIN_NAME,
                page: 1
            });
        });
        button.addClass('madhouse-menu-item');
    }

    function init() {
        Lampa.Template.add('madhouse_style', '<style>.madhouse-menu-item .menu__ico svg{width:2.2em;height:2.2em;fill:currentColor}</style>');
        $('body').append(Lampa.Template.get('madhouse_style'));

        addMenuItem();
        Lampa.Component.add(PLUGIN_NAME, MadhouseComponent);
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
