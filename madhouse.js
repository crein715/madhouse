(function () {
    'use strict';

    var PROXY_URL = 'https://p01--corsproxy--h7ynqrkjrc6c.code.run/';
    var API_BASE = 'https://api.hikka.io/';
    var ANIME_URL = PROXY_URL + API_BASE + 'anime';
    var DETAILS_URL = function (slug) { return PROXY_URL + API_BASE + 'anime/' + slug; };
    var MADHOUSE_SLUG = 'madhouse-b52579';
    var PLUGIN_NAME = 'madhouse_anime';
    var ITEMS_PER_PAGE = 15;

    var mad_icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>';

    var STATUS_STD_MAP = {
        'finished': 'ended',
        'ongoing': 'returning_series',
        'announced': 'planned',
        'paused': 'in_production',
        'discontinued': 'canceled'
    };

    function proxyHeaders(extra) {
        var h = { 'x-requested-with': 'lme-ukraine' };
        if (extra) for (var k in extra) h[k] = extra[k];
        return h;
    }

    function normalizeAnime(a) {
        var mt = a.media_type || 'tv';
        return {
            id: a.slug,
            title: a.title_ua || a.title_en || a.title_ja,
            name: mt !== 'movie' ? (a.title_ua || a.title_en || a.title_ja) : undefined,
            original_title: a.title_en || a.title_ja || a.title_ua,
            original_name: mt !== 'movie' ? (a.title_en || a.title_ja || a.title_ua) : null,
            source: 'hikka',
            img: a.image,
            poster: a.image,
            vote_average: a.score || a.native_score || 0,
            overview: a.synopsis_ua || a.synopsis_en || '',
            year: a.year,
            release_date: a.year ? a.year + '-01-01' : undefined,
            first_air_date: mt !== 'movie' && a.year ? a.year + '-01-01' : undefined,
            status: STATUS_STD_MAP[a.status] || a.status,
            media_type: mt,
            hikka_slug: a.slug,
            translated_ua: a.translated_ua
        };
    }

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
            if (!comp.activity) {
                try {
                    var active = Lampa.Activity.active();
                    if (active && active.activity) comp.activity = active.activity;
                } catch (e) {}
            }

            if (comp.activity) comp.activity.loader(true);

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

            var url = ANIME_URL;
            if (page > 1) url += '?page=' + page;

            var postData = JSON.stringify({
                studios: [MADHOUSE_SLUG],
                sort: ['score:desc'],
                media_type: [],
                status: [],
                season: [],
                rating: [],
                years: [],
                genres: [],
                only_translated: false
            });

            network["native"](url, function (data) {
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch (e) {
                        loading_data = false;
                        if (comp.activity) comp.activity.loader(false);
                        return;
                    }
                }

                if (data && data.list) {
                    total_pages = data.pagination ? data.pagination.pages : 1;
                    current_page = page;
                    var results = data.list.map(normalizeAnime);
                    comp.build(results);
                }

                loading_data = false;
                if (comp.activity) comp.activity.loader(false);
                comp.start();
            }, function () {
                loading_data = false;
                if (comp.activity) comp.activity.loader(false);
            }, postData, {
                method: 'POST',
                headers: proxyHeaders({ 'Content-Type': 'application/json' })
            });
        };

        this.next = function () {
            if (current_page < total_pages && !loading_data) {
                comp.loadPage(current_page + 1);
            }
        };

        this.build = function (results) {
            results.forEach(function (element) {
                var card = Lampa.Maker.make('Card', element);
                card.create();

                var render = card.render();
                render.addClass('selector');

                render.on('hover:focus', function () {
                    last = render;
                    scroll.update(render, true);
                    if (element.img) Lampa.Background.change(element.img);
                });

                render.on('hover:enter', function () {
                    if (comp.activity) comp.activity.loader(true);
                    var slug = element.hikka_slug || element.id;

                    network.silent(DETAILS_URL(slug), function (details) {
                        if (typeof details === 'string') {
                            try { details = JSON.parse(details); } catch (e) {}
                        }

                        if (details && details.slug) {
                            var mt = details.media_type === 'movie' ? 'movie' : 'tv';
                            Lampa.Activity.push({
                                url: '',
                                component: 'full',
                                id: details.slug,
                                method: mt,
                                card: {
                                    id: details.slug,
                                    title: details.title_ua || details.title_en || details.title_ja,
                                    name: mt !== 'movie' ? (details.title_ua || details.title_en) : undefined,
                                    original_title: details.title_ja || details.title_en,
                                    original_name: mt !== 'movie' ? (details.title_en || details.title_ja) : null,
                                    poster_path: details.image,
                                    img: details.image,
                                    backdrop_path: details.image,
                                    vote_average: details.score || 0,
                                    overview: (details.synopsis_ua || details.synopsis_en || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'),
                                    release_date: details.year ? details.year + '-01-01' : undefined,
                                    first_air_date: mt !== 'movie' && details.year ? details.year + '-01-01' : undefined,
                                    genres: (details.genres || []).map(function (g, i) {
                                        return { id: g.slug || i, name: g.name_ua || g.name_en || g.name };
                                    }),
                                    production_companies: (details.companies || []).filter(function (c) {
                                        return c.type === 'studio';
                                    }).map(function (c) {
                                        return { id: c.company.slug, name: c.company.name };
                                    }),
                                    source: 'hikka'
                                },
                                source: 'hikka'
                            });
                        }
                        if (comp.activity) comp.activity.loader(false);
                    }, function () {
                        if (comp.activity) comp.activity.loader(false);
                    }, false, {
                        headers: proxyHeaders({ 'Content-Type': 'application/json' })
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
