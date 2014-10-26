(function ($, _, Backbone) {

    // config

    var config = {
        settings: {
            lowTile: 1,
            highTile: 100,
            guessesAllowed: 13
        },
        strings: {
            highGuess: 'High',
            lowGuess: 'Low',
            rightGuess: 'Match'
        },
        overlays: {
            manual: {
                closeOnClick: false,
                mask: {
                    color: '#333',
                    loadSpeed: 100,
                    maskId: 'mask',
                    opacity: 0.75,
                    zIndex: 9998
                },
                oneInstance: false
            },
            auto: {
                load: true
            }
        }
    };

    // vent

    var vent = _.extend({}, Backbone.Events);

    // models

    var Game = Backbone.Model.extend({
        defaults: {
            guess: null,
            guessAccuracy: null,
            guessesAllowed: config.settings.guessesAllowed,
            guessesMade: 0,
            guessesRemaining: config.settings.guessesAllowed
        },
        initialize: function () {
            var secretNumber = this.generateSecretNumber(),
                self = this;

            console.log(secretNumber)

            this.listenTo(vent, 'game:guess', function (guess) {
                self.handleGuess(guess);
                if (self.get('guess') !== secretNumber) {
                    self.handleWrongGuess(guess, secretNumber);
                } else {
                    self.handleRightGuess(guess, secretNumber);
                }
            });
        },
        generateSecretNumber: function () {
            var lowTile = config.settings.lowTile,
                highTile = config.settings.highTile;
            return Math.floor(Math.random() * (highTile - lowTile + 1)) + lowTile;
        },
        handleGuess: function (guess) {
            this.set('guess', guess);
            this.set('guessesMade', this.get('guessesMade') + 1);
            this.set('guessesRemaining', this.get('guessesAllowed') - this.get('guessesMade'));
        },
        handleWrongGuess: function (guess, secretNumber) {
            var guessAccuracy;
            if (this.get('guessesRemaining') === 0) {
                vent.trigger('game:result', {
                    result: 'lose',
                    secretNumber: secretNumber
                });
            }
            if (guess < secretNumber) {
                guessAccuracy = config.strings.lowGuess;
            } else if (guess > secretNumber) {
                guessAccuracy = config.strings.highGuess;
            }
            this.set('guessAccuracy', guessAccuracy);
        },
        handleRightGuess: function (guess, secretNumber) {
            vent.trigger('game:result', {
                result: 'win',
                secretNumber: secretNumber
            });
            this.set('guessAccuracy', config.strings.rightGuess);
        }
    });

    // views

    var PlayingAreaView = Backbone.View.extend({
        initialize: function () {
            var gaugesView,
                tilesView;
            gaugesView = new GaugesView({
                el: this.$('#gauges'),
                model: app.models.game
            });
            tilesView =  new TilesView({
                el: this.$('#tiles')
            });
            this.listenTo(vent, 'game:start', this.show);
        },
        show: function () {
            this.$el.expose();
        }
    });

    var GaugesView = Backbone.View.extend({
        ids: {
            'guess'                : 'guess',
            'guess-accuracy'       : 'guessAccuracy',
            'guesses-allowed'      : 'guessesAllowed',
            'guesses-made'         : 'guessesMade',
            'guesses-remaining'    : 'guessesRemaining'
        },
        initialize: function () {
            var self = this;
            this.updateAll();
            this.listenTo(vent, 'game:guess', this.updateAll);
            this.model.on('change:guessesAllowed', function (model) {
                self.update('guesses-allowed');
                self.update('guesses-remaining');
            });
        },
        updateAll: function () {
            for (var id in this.ids) {
                this.update(id);
            }
        },
        update: function (id) {
            var $el = this.$('#' + id + ' > .value'),
                guessAccuracy = this.model.get('guessAccuracy');
            $el.html(this.model.get(this.ids[id]));
            if (guessAccuracy && id === 'guess-accuracy') {
                $el.removeClass().addClass('value ' + guessAccuracy.toLowerCase());
            }
        }
    });

    var TileLinkView = Backbone.View.extend({
        tagName: 'a',
        className: 'tile',
        initialize: function (options) {
            this.$el.attr('href', '#' + options.number).html(options.number);
            this.render();
        }
    });

    var TileView = Backbone.View.extend({
        className: 'tile',
        events: {
            'click a': 'onClick'
        },
        states: ['visited', 'match'],
        initialize: function (options) {
            this.tileLinkView = new TileLinkView(options);
            this.$el.append(this.tileLinkView.el);
            this.listenTo(vent, 'game:start', this.onGameStart);
            this.render();
        },
        onClick: function (e) {
            var state = this.states[0],
                guess = parseInt(this.$el.text(), 10),
                self = this;
            e.preventDefault();
            this.$el.addClass(state).find('a.tile').addClass(state);
            this.listenTo(vent, 'game:result', function (data) {
                self.onGameResult($(e.target), data.result);
            });
            vent.trigger('game:guess', guess);
        },
        onGameStart: function () {
            var states = this.states.join(' ');
            this.$el.removeClass(states).find('a.tile').removeClass(states);
        },
        onGameResult: function ($eventTarget, result) {
            this.handleResult($eventTarget, result);
            if (result === 'win') {
                this.handleWin($eventTarget);
            }
        },
        handleResult: function ($eventTarget, result) {
            $eventTarget
                .unbind('click')
                .attr('rel', '#' + result)
                .overlay(
                    $.extend(
                        {},
                        config.overlays.manual,
                        config.overlays.auto
                    )
                );
        },
        handleWin: function ($eventTarget) {
            var stateToRemove = this.states[0],
                stateToAdd = this.states[1];
            $eventTarget
                .removeClass(stateToRemove)
                .addClass(stateToAdd)
                .parent('.tile')
                .removeClass(stateToRemove)
                .addClass(stateToAdd);
        }
    });

    var TilesView = Backbone.View.extend({
        initialize: function () {
            var lowTile = config.settings.lowTile,
                highTile = config.settings.highTile;
            for (var i = lowTile; i < (highTile + 1); i++) {
                tileView = new TileView({
                    number: i
                });
                this.$el.append(tileView.el);
            }
        }
    });

    var DialogView = Backbone.View.extend({
        initialize: function (options) {
            var id = this.$el.attr('id');
            if (id === 'splash') {
                this.$el
                    .overlay(
                        $.extend(
                            {},
                            config.overlays.manual,
                            config.overlays.auto
                        )
                    );
            } else {
                this.$el.overlay(config.overlays.manual);
            }
            this.listenTo(vent, 'dialog:show', this.show);
            this.listenTo(vent, 'game:start', this.closeOverlay);
            if (options.isPlayButton) {
                return new PlayButtonView({
                    el: this.$('a[href="#play"]')
                });
            }
        },
        show: function (id) {
            this.openOverlay();
            if (this.$el.attr('id') === id) {
                this.$el.show();
            } else {
                this.$el.hide();
            }
        },
        openOverlay: function () {
            $.mask.getMask().show();
        },
        closeOverlay: function () {
            var overlay = this.$el.hide().data('overlay');
            overlay.close();
            $.mask.close();
        }
    });

    var SplashView = DialogView.extend({
        initialize: function (options) {
            this._super(options);
        }
    });

    var PlayButtonView = Backbone.View.extend({
        events: {
            'click': 'onClick'
        },
        onClick: function (e) {
            e.preventDefault();
            vent.trigger('game:start');
        }
    });

    var SettingsView = DialogView.extend({
        events: {
            'change input[type=radio]': 'onChange',
            'click .button-red': 'onCancel'
        },
        onChange: function (e) {
            var guesses = $(e.target).attr('value');
            this.model.set({
                'guessesAllowed': guesses,
                'guessesRemaining': guesses
            });
        },
        onCancel: function (e) {
            var guesses = this.model.previousAttributes().guessesAllowed;
            e.preventDefault();
            this.model.set({
                'guessesAllowed': guesses,
                'guessesRemaining': guesses
            });
        }
    });

    var ResultView = DialogView.extend({
        initialize: function (options) {
            this._super(options);
            this.listenTo(vent, 'game:result', this.show);
        },
        show: function (data) {
            this._super(data.result);
            this.$('span.secret-number').html(data.secretNumber);
        }
    });

    var DialogTriggerView = Backbone.View.extend({
        events: {
            'click': 'onClick'
        },
        initialize: function () {
            var self = this;
            this.$el.attr('rel', this.$el.attr('href')).overlay(config.overlays.manual);
        },
        onClick: function (e) {
            e.preventDefault();
            this.showDialog();
        },
        showDialog: function (e) {
            vent.trigger('dialog:show', this.$el.attr('href').slice(1));
        }
    });

    // init code

    var app = {};
    app.models = {};
    app.models.game = new Game();

    app.init = function () {
        app.initPlayingArea($('#play'));
        $('div.dialog').each(app.initDialogs);
        $('a.dialog').each(app.initDialogTriggers);
    };

    app.initPlayingArea = function ($el) {
        return new PlayingAreaView({
            el: $el
        });
    };

    app.initDialogs = function () {
        var $el = $(this),
            id = $el.attr('id'),
            view;
        switch (id) {
            case 'splash':
                view = new SplashView({
                    el: $el,
                    isPlayButton: true
                });
                break;
            case 'settings':
                view = new SettingsView({
                    el: $el,
                    model: app.models.game
                });
                break;
            case 'win':
            case 'lose':
                view = new ResultView({
                    el: $el,
                    isPlayButton: true
                });
                break;
            default:
                view = new DialogView({
                    el: $el
                });
        }
        return view;
    };

    app.initDialogTriggers = function () {
        return new DialogTriggerView({
            el: $(this)
        });
    };

    app.init();

}(jQuery, _, Backbone));
