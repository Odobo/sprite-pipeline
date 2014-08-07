function(odobo_assets_struct) {
    var nop = function() { };
    var gen_asset_id = (function() { var id = 0; var rnd = Math.random(); return function() { return [ 'ASSET', id++, rnd ].join('_'); }; })();
    var assets_by_asset_id = { };
    var image_spritesheets = { };
    var audio_players      = { };

    var ImageAsset = function(asset) {
        this._assetID = gen_asset_id();
        assets_by_asset_id[this._assetID] = asset;
        this.image_width  = asset.image_width;
        this.image_height = asset.image_height;
    };

    var px = function(x) { return x + 'px'; };

    ImageAsset.prototype.set_as_background = function(elt, dx, dy) {
        var asset = assets_by_asset_id[this._assetID];
        var st = elt.style;
        st.marginLeft = px(asset.padding_left + (dx || 0));
        st.marginTop  = px(asset.padding_top  + (dy || 0));
        st.width      = px(asset.sprite_w);
        st.height     = px(asset.sprite_h);
        st.background = 'url(' + image_spritesheets[asset.spritesheet_file].img_element.src + ') ' + px(-asset.sprite_x) + ' ' + px(-asset.sprite_y) + ' no-repeat';
        return elt;
    };

    ImageAsset.prototype.drawToContext = function(context, sx, sy, sw, sh, dx, dy, dw, dh) {
        var asset = assets_by_asset_id[this._assetID];
        var padding_left = asset.padding_left;
        var padding_top  = asset.padding_top;

        if (arguments.length < 6)
        {
            dx = sx;
            dy = sy;

            if (arguments.length < 4)
            {
                dw = asset.image_width;
                dh = asset.image_height;
            }
            else
            {
                dw = sw;
                dh = sh;
            }

            sx = 0;
            sy = 0;
            sw = asset.image_width;
            sh = asset.image_height;
        }

        var crop_left = sx - padding_left;
        var crop_top  = sy - padding_top;
        var sprite_w  = sw + Math.min(0, crop_left) + Math.min(0, padding_left + asset.sprite_w - sw);
        var sprite_h  = sh + Math.min(0, crop_top)  + Math.min(0, padding_top  + asset.sprite_h - sh);

        if ((sprite_w > 0) && (sprite_h > 0))
        {
            var scale_x = dw / sw;
            var scale_y = dh / sh;
            context.drawImage(
                image_spritesheets[asset.spritesheet_file].img_element,

                asset.sprite_x + Math.max(0, crop_left),
                asset.sprite_y + Math.max(0, crop_top),
                sprite_w,
                sprite_h,

                dx + (Math.max(0, - crop_left)) * scale_x,
                dy + (Math.max(0, - crop_top))  * scale_y,
                sprite_w * scale_x,
                sprite_h * scale_y);
        }
    };

    ImageAsset.prototype.createCanvas = function() { // cannot be cached, might be needed in several places at once, like a logo
        var canvas = window.document.createElement('canvas');
        canvas.width  = this.image_width;
        canvas.height = this.image_height;
        this.drawToContext(canvas.getContext('2d'), 0, 0);
        return canvas;
    };

    var AudioAsset = function(asset) {
        this._assetID = gen_asset_id();
        assets_by_asset_id[this._assetID] = asset;
        this.audio_length = asset.audio_length_ms;
    };

    AudioAsset.prototype.set_to_load_as_GDK_music = function() { return assets_by_asset_id[this._assetID].load_as_GDK_music = true; };
    AudioAsset.prototype.play = function(loop) { return audio_players[this._assetID](loop); };

    return {
        getAssets: (function() {
            var assets = (function rec(asset) {
                if (! (asset && (typeof(asset) === 'object')))
                    return asset;
                else if (Array.isArray(asset))
                    return asset.map(rec);
                else if (! asset.spritesheet_file)
                {
                    var ret = { };
                    for (var key in asset)
                        if (asset.hasOwnProperty(key))
                            ret[key] = rec(asset[key]);
                    return ret;
                }
                else if ('image_width' in asset)
                    return new ImageAsset(asset);
                else
                    return new AudioAsset(asset);
            })(odobo_assets_struct);

            return function() { return assets; };
        })(),

        withLoaded: function(client_asset, load_images, on_load_all) {
            var image_urls_hash = { };
            var audios_to_load  = { };
            (function rec(client_asset) {
                if (client_asset && (typeof(client_asset) === 'object'))
                {
                    if (client_asset._assetID)
                    {
                        var asset = assets_by_asset_id[client_asset._assetID];
                        if (('image_width' in asset))
                        {
                            var spritesheet = image_spritesheets[asset.spritesheet_file];
                            if (! (spritesheet && spritesheet.unload_img))
                                image_urls_hash[asset.spritesheet_file + '.png'] = asset.spritesheet_file;
                        }
                        else    // audio
                        {
                            if (! audio_players[client_asset._assetID])
                                audios_to_load[client_asset._assetID] = asset;
                        }
                    }
                    else
                        (Array.isArray(client_asset) ? client_asset.forEach(rec) : Object.keys(client_asset).forEach(function(key) { rec(client_asset[key]); }));
                }
            })(client_asset);
            var image_urls  = Object.keys(image_urls_hash);
            var audios_keys = Object.keys(audios_to_load);
            load_images(
                image_urls,
                audios_keys.map(function(k) { return audios_to_load[k]; }),
                function(imgs, players) {
                    for (var i = 0; i < image_urls.length; ++i)
                        image_spritesheets[image_urls_hash[image_urls[i]]] = imgs[i];
                    for (var j = 0; j < audios_keys.length; ++j)
                        audio_players[audios_keys[j]] = players[j];
                    on_load_all();
                });
        },

        unloadAssets: function(client_asset) { // TODO - Add some kind of reference counting, to not unload shared assets. Also, calling unload on currently loading asset won't unload it.
            (function rec(client_asset) {
                if (client_asset && (typeof(client_asset) === 'object'))
                {
                    if (client_asset._assetID)
                    {
                        var asset       = assets_by_asset_id[client_asset._assetID];
                        var spritesheet = ('image_width' in asset) && image_spritesheets[asset.spritesheet_file];
                        if (spritesheet && spritesheet.unload_img)
                        {
                            // currently GDK only supports whole audio spritesheet unloading, which would require an additional logic on game's side
                            var src = spritesheet.img_element.src;
                            spritesheet.unload_img();
                            image_spritesheets[asset.spritesheet_file] = { img_element: { src: src } };
                        }
                    }
                    else
                        (Array.isArray(client_asset) ? client_asset.forEach(rec) : Object.keys(client_asset).forEach(function(key) { rec(client_asset[key]); }));
                }
            })(client_asset);
        },

        GDKAssetLoaderMaker: function(GDK, res_path) {
            var make_res_path = function(u) { return res_path + '/' + u; };
            var setup_audio_player = (GDK.audio.isWebAudio()
                                      ? (function() {
                                          var audio_ctx = GDK.audio.getAudioContext();
                                          var make_channel = function(gdk_channel, on) {
                                              var channel = audio_ctx.createGain ? audio_ctx.createGain() : audio_ctx.createGainNode();
                                              channel.connect(gdk_channel);
                                              channel.gain.value = on ? 1 : 0;
                                              return channel;
                                          };

                                          var music_channel = make_channel(GDK.audio.getMusicOut(), GDK.settings.menu.get('gdkSoundSettingsPanel', 'musicOn'));
                                          var sound_channel = make_channel(GDK.audio.getSfxOut(),   GDK.settings.menu.get('gdkSoundSettingsPanel', 'sfxOn'));

                                          GDK.on(
                                              GDK.EVENT.SETTING_CHANGED,
                                              function(category, name, on) {
                                                  if (name === 'musicOn')
                                                      music_channel.gain.value = on ? 1 : 0;
                                                  if (name === 'sfxOn')
                                                      sound_channel.gain.value = on ? 1 : 0;
                                              });

                                          return function(asset) {
                                              var audio_path = make_res_path(asset.spritesheet_file);
                                              return function(loop) {
                                                  var source    = audio_ctx.createBufferSource();
                                                  source.buffer = GDK.audio.getBuffer(audio_path);
                                                  var gain = audio_ctx.createGain ? audio_ctx.createGain() : audio_ctx.createGainNode();
                                                  source.connect(gain);
                                                  gain.connect(asset.load_as_GDK_music ? music_channel : sound_channel);
                                                  var start  = asset.audio_start_ms  / 1000;
                                                  var length = asset.audio_length_ms / 1000;
                                                  if (loop)
                                                  {
                                                      source.loop      = true;
                                                      source.loopStart = start;
                                                      source.loopEnd   = start + length;
                                                  }
                                                  if (source.start)
                                                      source.start(0, start, length);
                                                  else if (source.noteGrainOn)
                                                      source.noteGrainOn(0, start, length);
                                                  var tim;
                                                  var ramp_gain = function(level, ms) {
                                                      if (ms && gain.gain.setTargetAtTime)
                                                          gain.gain.setTargetAtTime(level, audio_ctx.currentTime + ms / 1000, (ms / 1000) / 5);
                                                      else if (ms && gain.gain.setTargetValueAtTime)
                                                          gain.gain.setTargetValueAtTime(level, audio_ctx.currentTime + ms / 1000, (ms / 1000) / 5);
                                                      else
                                                          gain.gain.value = level;
                                                  };
                                                  return {
                                                      fade: function(level, ms, delay_ms) {
                                                          window.clearTimeout(tim);
                                                          gain.gain.cancelScheduledValues(audio_ctx.currentTime);
                                                          if (delay_ms)
                                                              tim = window.setTimeout(function() { ramp_gain(level, ms); }, delay_ms);
                                                          else
                                                              ramp_gain(level, ms);
                                                      },
                                                      stop: function() {
				                          if (source.stop)
                                                              source.stop(0);
				                          else if (source.noteOff)
                                                              source.noteOff(0);
                                                          source.disconnect();
                                                          gain.disconnect();
                                                      }
                                                  };
                                              };
                                          };
                                      })()
                                      : function(asset) {
                                          return function(loop) {
                                              var s = GDK.audio[loop ? 'loop' : 'play'](asset.single_file);
                                              return {
                                                  stop: function() { s.stop(); }
                                              };
                                          };
                                      });
            return function(assetLoader, on_progress) {
                return function(image_urls, audio_assets, cb) {
                    assetLoader.addImages(image_urls.map(make_res_path));
                    var player_by_spritesheet_file_single_file = { };
                    (function() {
                        var audio_ss_sounds = { };
                        audio_assets.forEach(
                            function(asset) {
                                var audio_path = make_res_path(asset.spritesheet_file);
                                if (! (audio_path in audio_ss_sounds))
                                    audio_ss_sounds[audio_path] = { };
                                audio_ss_sounds[audio_path][asset.single_file] = { type: asset.load_as_GDK_music ? 'music' : 'sfx', start: asset.audio_start_ms, length: asset.audio_length_ms, level: 100, alternate: make_res_path(asset.single_file) };
                                if (! player_by_spritesheet_file_single_file[asset.spritesheet_file])
                                    player_by_spritesheet_file_single_file[asset.spritesheet_file] = { };
                                player_by_spritesheet_file_single_file[asset.spritesheet_file][asset.single_file] = setup_audio_player(asset);
                            });
                        Object.keys(audio_ss_sounds).forEach(function(key) { assetLoader.addSounds(key, audio_ss_sounds[key]); });
                    })();
                    assetLoader.start(
                        function() {
                            cb(
                                image_urls.map(
                                    function(u) {
                                        var spritesheet_url = make_res_path(u);
                                        return {
                                            img_element: GDK.images.get(spritesheet_url),
                                            unload_img:  function() { GDK.images.unload(spritesheet_url); }
                                        };
                                    }),
                                audio_assets.map(function(asset) { return player_by_spritesheet_file_single_file[asset.spritesheet_file][asset.single_file]; }));
                        },
                        on_progress && function(ratio) { on_progress(ratio / 100); });
                };
            };
        },

        makeGenericLoader: function(dir_path) {
            var with_audio_asset_loaded = (
                function() {
                    var audio_context_class_name = ('AudioContext' in window) ? 'AudioContext' : (('webkitAudioContext' in window) ? 'webkitAudioContext' : (('mozAudioContext' in window) && 'mozAudioContext'));
                    if (! audio_context_class_name)
                        throw new Error('Browser doesn\'t support HTML5 Audio');
                    else
                    {
                        var spritesheet_buffers = { };
                        var extension_to_use = (new window.Audio()).canPlayType('audio/mp4') ? 'm4a' : 'ogg';
                        var audio_context = new window[audio_context_class_name]();
                        return function(asset, call_with_player) {
                            var call_with_buffer_player = function() {
                                call_with_player(
                                    function(loop) {
                                        var source    = audio_context.createBufferSource();
                                        source.buffer = spritesheet_buffers[url];
                                        source.connect(audio_context.destination);
                                        var start_sec  = asset.audio_start_ms  / 1000;
                                        var length_sec = asset.audio_length_ms / 1000;
                                        if (loop)
                                        {
                                            source.loop      = true;
                                            source.loopStart = start_sec;
                                            source.loopEnd   = start_sec + length_sec;
                                        }
                                        source.start(0, start_sec, length_sec);
                                        var stop_and_cleanup = function() {
                                            window.clearTimeout(cleanup_timeout);
                                            source.stop(0);
                                            source.disconnect();
                                        };
                                        var cleanup_timeout = (! loop) && window.setTimeout(stop_and_cleanup, asset.audio_length_ms);
                                        return stop_and_cleanup;
                                    });
                            };

                            var url = dir_path + '/' + asset.spritesheet_file + '.' + extension_to_use;
                            if (spritesheet_buffers[url])
                                call_with_buffer_player();
                            else
                            {
                                var xhr = new window.XMLHttpRequest();
                                xhr.open('GET', url);
                                xhr.responseType = 'arraybuffer';
                                xhr.onload  = function() {
                                    window.console.log('Loaded ' + url);
                                    audio_context.decodeAudioData(
                                        xhr.response,
                                        function(buffer) {
                                            spritesheet_buffers[url] = buffer;
                                            call_with_buffer_player();
                                        },
                                        function() { window.console.error('Decoding audio buffer failed'); });
                                };
                                xhr.send();
                            }
                        };
                    }
                })();

            return function(image_urls, audio_assets, cb) {
                var imgs = [ ];
                var players = [ ];
                (function load_next_image() {
                    if (imgs.length < image_urls.length)
                    {
                        var url = dir_path + '/' + image_urls[imgs.length];
                        var img = window.document.createElement('img');
                        img.onerror = function(err) { window.console.error('Couldn\'t load ' + url + ' with error: ', err); };
                        img.onload  = function() { window.console.log('Loaded ' + url); imgs.push({ img_element: img }); load_next_image(); };
                        img.src = url;
                    }
                    else
                        (function load_next_audio() {
                            ((players.length < audio_assets.length)
                             ? with_audio_asset_loaded(audio_assets[players.length], function(player) { players.push(player); load_next_audio(); })
                             : cb(imgs, players));
                        })();
                })();
            };
        }
    };
}
