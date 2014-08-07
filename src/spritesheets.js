// -*- js2-include-node-externs: t; js2-additional-externs: ("JSON" "setImmediate" "clearImmediate"); eval: (js2-set-default-externs) -*-

var CACHE_VERSION = 3;

var nop = function() { };
var pad_right = function(str, n) {
    while (str.length < n)
        str += ' ';
    return str;
};
var pad_left = function(str, n) {
    while (str.length < n)
        str = ' ' + str;
    return str;
};
var find = function(pred, arr) {
    for (var i = 0; i < arr.length; ++i)
        if (pred(arr[i]))
            return arr[i];
    return undefined;
};
var sort = function(cmp, lst) {
    return lst.slice(0).sort(cmp);
};
var iota = function(n) {
    var lst = [ ];
    for (var i = 0; i < n; ++i)
        lst.push(i);
    return lst;
};
var merge = function(_arguments_) { return Array.prototype.concat.apply([ ], arguments); };

var path     = require('path');
var fs       = require('fs');
var fs_extra = require('fs-extra');
var os       = require('os');
var crypto   = require('crypto');

var hash_file = function(file_path) { return crypto.createHash('md5').update(fs.readFileSync(file_path)).digest('hex'); };

var spawn = require('child_process').spawn;
var spawned = function(cmd, args, error_or_exit_cb, maybe_exit_cb) {
    var error_cb = maybe_exit_cb ?  error_or_exit_cb : function(err) { console.error('Error running ' + [ cmd ].concat(args).join(' ') + ': ' + proc.stderr.read()); };
    var exit_cb  = maybe_exit_cb || error_or_exit_cb;
    var proc = spawn(cmd, args);
    proc.on('error', error_cb);
    proc.on('exit',  function(code, signal) { ((code > 0) ? error_cb() : exit_cb(proc.stdout)); });
    return function() { proc.kill('SIGKILL'); };
};

var withGenericImageRenderer = function(log, call_with_renderer) {
    var cancel_renderer_tests = function() { };
    (function (call_with_grahics) { // determine graphics package
        var Canvas = false;
        try { Canvas = require('canvas'); } catch (e) { }
        if (Canvas)
        {
            log('Using node-canvas');
            call_with_grahics( // node-canvas based
                {
                    call_with_trimmed_sprites: function(paths, cb) {
                        var cleanups = [ ];
                        cb(
                            paths.map(
                                function(path) {
                                    var img = new Canvas.Image();
                                    img.src = path;
                                    var width  = img.width;
                                    var height = img.height;
                                    var canvas = new Canvas(width, height);
                                    var ctx = canvas.getContext('2d');
                                    ctx.drawImage(img, 0, 0);

                                    var pixels = ctx.getImageData(0, 0, width, height).data;
                                    var is_transparent_pixel = function(row, col) { return pixels[(row * width + col) * 4 + 3] === 0; }; // 4 Bpp
                                    var trim_left = (
                                        function() {
                                            for (var col = 0; col < width; ++col)
                                                for (var row = 0; row < height; ++row)
                                                    if (! is_transparent_pixel(row, col))
                                                        return col;
                                            return col;
                                        })();

                                    var trim_top = (
                                        function() {
                                            for (var row = 0; row < height; ++row)
                                                for (var col = 0; col < width; ++col)
                                                    if (! is_transparent_pixel(row, col))
                                                        return row;
                                            return row;
                                        })();

                                    var trim_right = (
                                        function() {
                                            for (var col = width - 1; col > trim_left - 1; --col)
                                                for (var row = 0; row < height; ++row)
                                                    if (! is_transparent_pixel(row, col))
                                                        return col;
                                            return col;
                                        })();

                                    var trim_bottom = (
                                        function() {
                                            for (var row = height - 1; row > trim_top - 1; --row)
                                                for (var col = 0; col < width; ++col)
                                                    if (! is_transparent_pixel(row, col))
                                                        return row;
                                            return row;
                                        })();

                                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                                    var trim_width  = trim_right  - trim_left + 1;
                                    var trim_height = trim_bottom - trim_top  + 1;
                                    canvas.width    = trim_width;
                                    canvas.height   = trim_height;
                                    ctx.drawImage(img, trim_left, trim_top, trim_width, trim_height, 0, 0, trim_width, trim_height);

                                    var ret = {
                                        trimmed_canvas: canvas,
                                        trimmed_width:  trim_width,
                                        trimmed_height: trim_height,
                                        trim_left:      trim_left,
                                        trim_top:       trim_top,
                                        orig_width:     width,
                                        orig_height:    height,
                                        compare_key:    crypto.createHash('md5').update((trim_width * trim_height > 0) ? canvas.toBuffer() : '').digest('hex') + ':' + trim_width + 'x' + trim_height
                                    };

                                    cleanups.push(function() { ret.trimmed_canvas = canvas = null; });
                                    return ret;
                                }),
                            function() { cleanups.forEach(function(c) { c(); }); });
                        return function() { };
                    },
                    identical_sprites: function(trimmed_a, trimmed_b, cb) {
                        var imm = setImmediate( // to prevent "Maximum call stack size exceeded"
                            function() {
                                var a_pixels = trimmed_a.trimmed_canvas.getContext('2d').getImageData(0, 0, trimmed_a.trimmed_width, trimmed_a.trimmed_height).data;
                                var b_pixels = trimmed_b.trimmed_canvas.getContext('2d').getImageData(0, 0, trimmed_b.trimmed_width, trimmed_b.trimmed_height).data;
                                for (var i = 0; i < a_pixels.length; ++i)
                                    if (a_pixels[i] !== b_pixels[i])
                                        return cb(false);
                                return cb(true);
                            });
                        return function() { clearImmediate(imm); };
                    },
                    render_spritesheet: function(width, height, rects, output_path, on_render) {
                        var canvas = new Canvas(width, height);
                        var ctx = canvas.getContext('2d');
                        rects.forEach(function(rect) { ctx.drawImage(rect.trimmed.trimmed_canvas, rect.x, rect.y); });
                        var imm = setImmediate(function() { canvas.pngStream().pipe(fs.createWriteStream(output_path)).on('finish', function() { imm && on_render(); }); });
                        return function() { clearImmediate(imm); imm = null; };
                    }
                });
        }
        else
        {
            console.warn('Node-canvas not found');
            cancel_renderer_tests = function() { convert_test.kill('SIGKILL'); };
            var convert_test = spawned(
                'convert', [ ],
                function() { console.error('Neither node-canvas nor ImageMagick found'); },
                function(stdout) {
                    cancel_renderer_tests = function() { };
                    var stdout_str = '' + stdout.read();
                    if (stdout_str.indexOf('Version: ImageMagick') !== 0)
                        console.error('Wrong ImageMagick version:\n' + stdout_str);
                    else
                    {
                        log('Using ImageMagick');
                        call_with_grahics( // ImageMagick
                            {
                                call_with_trimmed_sprites: function(paths, cb) {
                                    var cancel_trim = function() { };
                                    var trimmed_paths = [ ];
                                    (function trim_sprite(i) {
                                        if (i < paths.length)
                                        {
                                            var sprite_path  = paths[i];
                                            var trimmed_path = path.join(os.tmpDir(), 'trimmed_sprite_' + i + '_' + path.basename(sprite_path));
                                            var border = 1; // 1px to add as a transparent sprite border to have trim based on transparency (see http://www.imagemagick.org/Usage/crop/#trim_color)
                                            cancel_trim = spawned(
                                                'convert',
                                                [ sprite_path, '-bordercolor', 'transparent', '-border', border, '-trim', '-set', 'page', '%[fx:page.width-' + (2 * border) + ']x%[fx:page.height-' + (2 * border) + ']+%[fx:page.x-' + border + ']+%[fx:page.y-' + border + ']', trimmed_path ],
                                                function() { trimmed_paths.push(trimmed_path); trim_sprite(i + 1); });
                                        }
                                        else
                                            cancel_trim = spawned(
                                                'identify', [ '-format', '%w %h %X %Y %W %H %b\n' ].concat(trimmed_paths),
                                                function(stdout) {
                                                    cancel_trim = function() { };
                                                    var identify_lines = ('' + stdout.read()).split('\n');
                                                    cb(trimmed_paths.map(
                                                        function(trimmed_path, i) {
                                                            var line = identify_lines[i];
                                                            var items = line.split(' ').map(function(i) { return parseInt(i, 10); });
                                                            if (! items.every(function(i) { return (typeof(i) === 'number') && (! isNaN(i)); }))
                                                                throw new Error('Invalid identify return: "' +  line + '" for ' + trimmed_path + ' (' + items.join(', ') + ')');
                                                            return {
                                                                trimmed_path:   trimmed_path,
                                                                trimmed_width:  items[0],
                                                                trimmed_height: items[1],
                                                                trim_left:      items[2],
                                                                trim_top:       items[3],
                                                                orig_width:     items[4],
                                                                orig_height:    items[5],
                                                                compare_key:    items[6] + ':' + items[0] + 'x' + items[1]
                                                            };
                                                        }),
                                                       function(sprites) { trimmed_paths.forEach(fs.unlinkSync); });
                                                });
                                    })(0);
                                    return function() { cancel_trim(); };
                                },
                                identical_sprites: function(trimmed_a, trimmed_b, cb) {
                                    var compare_process = spawn('compare', [ '-metric', 'AE', trimmed_a.trimmed_path, trimmed_b.trimmed_path, 'null:' ]);
                                    compare_process.on('error', function() { console.error('Error running compare:\n' + compare_process.stderr.read()); });
                                    compare_process.on(
                                        'exit',
                                        function(code) {
                                            if (code > 1)
                                                throw new Error(code + ': ' + compare_process.stderr.read() + ' ( ' + trimmed_a.trimmed_path + ' and ' + trimmed_b.trimmed_path + ' )');
                                            else
                                                cb(code === 0);
                                        });
                                    return function() { compare_process.kill('SIGKILL'); };
                                },
                                render_spritesheet: function(width, height, rects, output_path, on_render) {
                                    var compose_args = [ '-size', width + 'x' + height, 'xc:none' ];
                                    rects.forEach(function(rect) { compose_args.push(rect.trimmed.trimmed_path, '-geometry', '+' + rect.x + '+' + rect.y, '-composite'); });
                                    return spawned('convert', compose_args.concat([ output_path ]), on_render);
                                }
                            });
                    }
                });
        }
    })(function(graphics) {
        call_with_renderer(
            function(log, spritesheet_name, sprite_paths, output_dir, compile_options, call_with_outputs_and_get_sprite) {
                var stop_image_spritesheet_rendering = function() { cancel_trim(); };
                var cancel_trim = graphics.call_with_trimmed_sprites(
                    sprite_paths,
                    function(trimmed_sprites, cleanup_trimmed_sprites) {
                        var sprite_padding = 1;
                        var path_to_sprite = { };
                        var compare_buckets = { };
                        var sprites = sprite_paths.map(
                            function(sprite_path, i) {
                                var trimmed = trimmed_sprites[i];
                                path_to_sprite[sprite_path] = {
                                    trimmed_w:    trimmed.trimmed_width,
                                    trimmed_h:    trimmed.trimmed_height,
                                    padding_left: trimmed.trim_left,
                                    padding_top:  trimmed.trim_top,
                                    image_width:  trimmed.orig_width,
                                    image_height: trimmed.orig_height
                                };
                                var sprite = {
                                    sprite_idx:    i,
                                    sprites_paths: [ sprite_path ],
                                    sprite_w:      trimmed.trimmed_width,
                                    sprite_h:      trimmed.trimmed_height,
                                    trimmed:       trimmed
                                };
                                var compare_key = trimmed.compare_key;
                                if (! compare_buckets[compare_key])
                                    compare_buckets[compare_key] = [ ];
                                compare_buckets[compare_key].push(sprite);
                                return sprite;
                            });

                        (function diff_key_sprites(compare_keys) {
                            if (compare_keys.length > 0)
                            {
                                var key_sprites = compare_buckets[compare_keys[0]];
                                var uniques = [ key_sprites[0] ];
                                (function diff_sprite(sprites) {
                                    if (sprites.length > 0)
                                    {
                                        var diffed_sprite = sprites[0];
                                        (function diff_with(other_sprites) {
                                            if (other_sprites.length > 0)
                                            {
                                                var other_sprite = other_sprites[0];
                                                stop_image_spritesheet_rendering = graphics.identical_sprites(
                                                    diffed_sprite.trimmed,
                                                    other_sprite.trimmed,
                                                    function(identical) {
                                                        if (! identical)
                                                            uniques.push(diffed_sprite);
                                                        else
                                                        {
                                                            other_sprite.sprites_paths.push.apply(other_sprite.sprites_paths, diffed_sprite.sprites_paths);
                                                            diffed_sprite.sprites_paths = [ ];
                                                        }
                                                        diff_with(other_sprites.slice(1));
                                                    });
                                            }
                                            else
                                                diff_sprite(sprites.slice(1));
                                        })(uniques.slice(0));
                                    }
                                    else
                                        diff_key_sprites(compare_keys.slice(1));
                                })(key_sprites.slice(1));
                            }
                            else
                            {
                                var unique_sprites = sprites.filter(function(s) { return s.sprites_paths.length > 0; });
                                var max_side_length = 2048;

                                var named_fn = function(name, fn) { return { name: name, fn: fn }; };
                                var named_sort_compares = [
                                    named_fn('order',        function(a, b) { return a.sprite_idx - b.sprite_idx; }),
                                    named_fn('height',       function(a, b) { return b.sprite_h - a.sprite_h; }),
                                    named_fn('height/w',     function(a, b) { return (b.sprite_h - a.sprite_h) || (b.sprite_w - a.sprite_w); }),
                                    named_fn('height/-w',    function(a, b) { return (b.sprite_h - a.sprite_h) || (a.sprite_w - b.sprite_w); }),
                                    named_fn('width',        function(a, b) { return b.sprite_w - a.sprite_w; }),
                                    named_fn('width/h',      function(a, b) { return (b.sprite_w - a.sprite_w) || (b.sprite_h - a.sprite_h); }),
                                    named_fn('width/-h',     function(a, b) { return (b.sprite_w - a.sprite_w) || (a.sprite_h - b.sprite_h); }),
                                    named_fn('area',         function(a, b) { return (b.sprite_w * b.sprite_h) - (a.sprite_w * a.sprite_h); }),
                                    named_fn('circumf',      function(a, b) { return (b.sprite_w + b.sprite_h) - (a.sprite_w + a.sprite_h); }),
                                    named_fn('maxside/min',  function(a, b) { return (Math.max(b.sprite_w, b.sprite_h) - Math.max(a.sprite_w, a.sprite_h)) || (Math.min(b.sprite_w, b.sprite_h) - Math.min(a.sprite_w, a.sprite_h)); }),
                                    named_fn('maxside/-min', function(a, b) { return (Math.max(b.sprite_w, b.sprite_h) - Math.max(a.sprite_w, a.sprite_h)) || (Math.min(a.sprite_w, a.sprite_h) - Math.min(b.sprite_w, b.sprite_h)); })
                                ];

                                var guillotine = function(sprites) {
                                    var layouts = [ ];
                                    named_sort_compares.forEach(
                                        function(named_sort_compare) {
                                            var eval_by_recursion_direction = function(recurse_right) {
                                                var eval_by_split_direction = function(split_right) {
                                                    layouts.push(
                                                        {
                                                            description: [ pad_right(named_sort_compare.name, 13), (recurse_right ? '>' : 'v') + (split_right ? '|' : '-') ].join(' '),
                                                            with_spritesheets_rects: function(cb) {
                                                                var cancel_with_spritesheets_rects;
                                                                var spritesheets = [ ];
                                                                var sprites_to_process = sort(named_sort_compare.fn, sprites);
                                                                (function process_next_sprite() {
                                                                    if (sprites_to_process.length > 0)
                                                                    {
                                                                        var sprite = sprites_to_process.shift();
                                                                        if (! find(function(s) { return s.try_put(sprite); }, spritesheets))
                                                                        {
                                                                            var root  = { x: 0, y: 0, w: max_side_length, h: max_side_length };
                                                                            var sheet = {
                                                                                sheet_rects: [ ],
                                                                                try_put:     function(sprite) {
                                                                                    var w = sprite.sprite_w;
                                                                                    var h = sprite.sprite_h;
                                                                                    var rect = (
                                                                                        function rec(r) {
                                                                                            return ((r.down && r.right)
                                                                                                    ? (recurse_right ? (rec(r.right) || rec(r.down)) : (rec(r.down) || rec(r.right)))
                                                                                                    : ((w <= r.w) && (h <= r.h) && r));
                                                                                        })(root);
                                                                                    if (rect)
                                                                                    {
                                                                                        var pad_w = (sprite_padding + w);
                                                                                        var pad_h = (sprite_padding + h);
                                                                                        rect.right = { x: rect.x + pad_w, y: rect.y,         w: rect.w - pad_w,               h: split_right ? rect.h : pad_h };
                                                                                        rect.down  = { x: rect.x,         y: rect.y + pad_h, w: split_right ? pad_w : rect.w, h: rect.h - pad_h               };
                                                                                        sheet.sheet_rects.push({ dst_x: rect.x, dst_y: rect.y, dst_sprite: sprite });
                                                                                    }
                                                                                    return rect;
                                                                                }
                                                                            };
                                                                            if (! sheet.try_put(sprite))
                                                                                throw new Error('Sprites too big to fit a spritesheet: [ ' + sprite.sprites_paths.join(', ') + ' ]');
                                                                            spritesheets.push(sheet);
                                                                        }
                                                                        var imm = setImmediate(process_next_sprite);
                                                                        cancel_with_spritesheets_rects = function() { clearImmediate(imm); };
                                                                    }
                                                                    else
                                                                        cancel_with_spritesheets_rects = with_optimized_layouts(spritesheets.map(function(s) { return s.sheet_rects; }), cb);
                                                                })();
                                                                return function() { cancel_with_spritesheets_rects(); };
                                                            }
                                                        });
                                                };
                                                eval_by_split_direction(true);
                                                eval_by_split_direction(false);
                                            };
                                            eval_by_recursion_direction(true);
                                            eval_by_recursion_direction(false);
                                        });
                                    return layouts;
                                };

                                var strip_packers = function(sprites) {
                                    var evaluate_two_phase = function(algo_name, first_pass, second_pass) {
                                        var two_phase = function(by_height) {
                                            var by_width_desc = function(desc) {
                                                return {
                                                        description: algo_name + ' ' + (by_height ? 'height' : 'width') + (desc ? '-' : '+'),
                                                        with_spritesheets_rects: function(cb) {
                                                            var strip_packer = function(select_level) {
                                                                return function(arr, get_w_param) {
                                                                    var levels = [ ];
                                                                    arr.forEach(
                                                                        function(item) {
                                                                            var required_space = get_w_param(item);
                                                                            var existing_level = select_level(required_space + 1, levels);
                                                                            if (! existing_level)
                                                                                levels.push({ level_items: [ item ], residual_space: max_side_length - required_space });
                                                                            else
                                                                            {
                                                                                existing_level.level_items.push(item);
                                                                                existing_level.residual_space -= (required_space + 1);
                                                                            }
                                                                        });
                                                                    return levels.map(function(level) { return level.level_items; });
                                                                };
                                                            };
                                                            var get_w_param = function(sprite) { return sprite[by_height ? 'sprite_w' : 'sprite_h']; };
                                                            var get_h_param = function(sprite) { return sprite[by_height ? 'sprite_h' : 'sprite_w']; };
                                                            var levels = strip_packer(first_pass)(sprites.sort(function(a, b) { return (get_h_param(b) - get_h_param(a)) || (desc ? (get_w_param(b) - get_w_param(a)) : (get_w_param(a) - get_w_param(b))); }), get_w_param);
                                                            var bins   = strip_packer(second_pass)(levels, function(level_sprites) { return get_h_param(level_sprites[0]); });
                                                            var spritesheets_rects = [ ];
                                                            bins.forEach(
                                                                function(levels) {
                                                                    var rects = spritesheets_rects[spritesheets_rects.push([ ]) - 1];
                                                                    var bin_y = 0;
                                                                    levels.forEach(
                                                                        function(level_sprites) {
                                                                            var level_x = 0;
                                                                            level_sprites.forEach(
                                                                                function(sprite) {
                                                                                    rects.push(by_height ? { dst_sprite: sprite, dst_x: level_x, dst_y: bin_y } : { dst_sprite: sprite, dst_x: bin_y, dst_y: level_x });
                                                                                    level_x += get_w_param(sprite) + sprite_padding;
                                                                                });
                                                                            bin_y += get_h_param(level_sprites[0]) + sprite_padding;
                                                                        });
                                                                });

                                                            return with_optimized_layouts(spritesheets_rects, cb);
                                                        }
                                                };
                                            };

                                            return merge(
                                                by_width_desc(true),
                                                by_width_desc(false));
                                        };

                                        return merge(
                                            two_phase(true),
                                            two_phase(false));
                                    };

                                    var next_fit  = function(required_space, levels) { var last = (levels.length > 0) && levels[levels.length - 1]; return last && (required_space <= last.residual_space) && last; };
                                    var first_fit = function(required_space, levels) { return find(function(level) { return required_space <= level.residual_space; }, levels); };
                                    var best_fit  = function(required_space, levels) {
                                        var best_level = null;
                                        levels.forEach(
                                            function(level) {
                                                var new_residual = level.residual_space - required_space;
                                                if ((new_residual > 0) && ((! best_level) || (new_residual < (best_level.residual_space - required_space))))
                                                    best_level = level;
                                            },
                                            levels);
                                        return best_level;
                                    };
                                    var make_closest_strip_packer = function() {
                                        var last_level_id = 0;
                                        return function(required_space, levels) {
                                            var level_ids = iota(levels.length);
                                            var fit_level_id = find(function(level_id) { var fit = (required_space <= levels[level_id].residual_space); if (fit) last_level_id = level_id; return fit; }, level_ids.slice(last_level_id).concat(level_ids.slice(0, last_level_id).reverse()));
                                            return (typeof(fit_level_id) === 'number') && levels[fit_level_id];
                                        };
                                    };

                                    return merge(
                                        evaluate_two_phase('NFD + NFD', next_fit,  next_fit),
                                        evaluate_two_phase('FFD + FFD', first_fit, first_fit),
                                        evaluate_two_phase('FFD + BFD', first_fit, best_fit),
                                        evaluate_two_phase('BFD + FFD', best_fit,  first_fit),
                                        evaluate_two_phase('BFD + BFD', best_fit,  best_fit),
                                        evaluate_two_phase('Closest Strip', make_closest_strip_packer(), make_closest_strip_packer()));
                                };

                                var with_optimized_layouts = function(rects, cb) {
                                    var cancel_with_optimized_layouts = function() { };
                                    if (rects.length === 1)
                                        cb(rects);
                                    else
                                    {
                                        var last_sheet_sprites = rects[rects.length - 1].map(function(r) { return r.dst_sprite; });
                                        (function next(named_spritesheets, last_spritesheets_rects) {
                                            if (named_spritesheets.length > 0)
                                                cancel_with_optimized_layouts = named_spritesheets[0].with_spritesheets_rects(function(sr) { next(named_spritesheets.slice(1), last_spritesheets_rects.concat([ sr ])); });
                                            else
                                            {
                                                cancel_with_optimized_layouts = function() { };
                                                var rects_sizes = last_spritesheets_rects.filter(
                                                    function(sheets) { return sheets.length === 1; }
                                                ).map(
                                                    function(sheets) { var rects = sheets[0]; return { rects: rects, height: Math.max.apply(Math, rects.map(function(r) { return r.dst_y + r.dst_sprite.sprite_h; })) }; }
                                                ).sort(
                                                    function(rsa, rsb) { return rsa.height - rsb.height; });
                                                if (rects_sizes.length > 0)
                                                    rects[rects.length - 1] = rects_sizes[0].rects;
                                                cb(rects);
                                            }
                                        })(merge(guillotine(last_sheet_sprites), strip_packers(last_sheet_sprites)), [ ]);
                                    }
                                    return function() { cancel_with_optimized_layouts(); };
                                };

                                var maxrects = function(sprites) {
                                        sprites.sort(function(a, b) { return ((b.sprite_w * b.sprite_h) - (a.sprite_w * a.sprite_h)) || (a.sprite_idx - b.sprite_idx); });
                                        var maxrect = function(algo_name, compare_rects) {
                                            return {
                                                description: 'Maxrects ' + algo_name,
                                                with_spritesheets_rects: function(cb) {
                                                    var sheets = [ ];
                                                    var min_w = Math.min.apply(Math, sprites.map(function(s) { return s.sprite_w; }));
                                                    var min_h = Math.min.apply(Math, sprites.map(function(s) { return s.sprite_h; }));
                                                    var min_a = Math.min.apply(Math, sprites.map(function(s) { return s.sprite_w * s.sprite_h; }));
                                                    var sprite_id = 0;
                                                    var imm;
                                                    (function process_next_sprite() {
                                                        if (sprite_id < sprites.length)
                                                        {
                                                            var sprite = sprites[sprite_id++];
                                                            var best_rect = null;
                                                            var best_sheet;
                                                            sheets.forEach(
                                                                function(sheet) {
                                                                    sheet.free_rects.forEach(
                                                                        function(r) {
                                                                            if (r.to_remove) return;
                                                                            if ((sprite.sprite_w <= r.w) && (sprite.sprite_h <= r.h) && ((! best_rect) || (compare_rects(best_rect, r, sprite) > 0)))
                                                                            {
                                                                                best_rect  = r;
                                                                                best_sheet = sheet;
                                                                            }
                                                                        });
                                                                });
                                                            if (! best_rect)
                                                            {
                                                                best_rect  = { x: 0, y: 0, w: max_side_length, h: max_side_length };
                                                                best_sheet = { free_rects: [ best_rect ], rects: [ ] };
                                                                sheets.push(best_sheet);
                                                            }
                                                            var sprite_w = sprite.sprite_w;
                                                            var sprite_h = sprite.sprite_h;
                                                            best_sheet.rects.push({ dst_x: best_rect.x, dst_y: best_rect.y, dst_sprite: sprite });
                                                            var new_rects = [ ];
                                                            best_sheet.free_rects.forEach(
                                                                function(r) {
                                                                    var keep_r = true;
                                                                    if ((r.x + r.w > best_rect.x) && (r.x < best_rect.x + sprite_w) && (r.y + r.h > best_rect.y) && (r.y < best_rect.y + sprite_h)) // overlapping rects
                                                                    {
                                                                        var append_free_rect = function(x, y, w, h) {
                                                                            keep_r = false;
                                                                            if ((w >= min_w) && (h >= min_h) && ((w * h) >= min_a))
                                                                                new_rects.push({ x: x, y: y, w: w, h: h });
                                                                        };
                                                                        if ((best_rect.x + sprite_w > r.x) && (best_rect.x < r.x + r.w))
                                                                        {
                                                                            if (best_rect.y > r.y)
                                                                                append_free_rect(r.x, r.y, r.w, best_rect.y - r.y - sprite_padding);
                                                                            else if (best_rect.y + sprite_h < r.y + r.h)
                                                                                append_free_rect(r.x, best_rect.y + sprite_h + sprite_padding, r.w, r.y + r.h - (best_rect.y + sprite_h + sprite_padding));
                                                                            else if ((best_rect.y === r.y) && (best_rect.y + sprite_h === r.y + r.h))
                                                                                keep_r = false;
                                                                        }
                                                                        if ((best_rect.y + sprite_h > r.y) && (best_rect.y < r.y + r.h))
                                                                        {
                                                                            if (best_rect.x > r.x)
                                                                                append_free_rect(r.x, r.y, best_rect.x - r.x - sprite_padding, r.h);
                                                                            else if (best_rect.x + sprite_w < r.x + r.w)
                                                                                append_free_rect(best_rect.x + sprite_w + sprite_padding, r.y, r.x + r.w - (best_rect.x + sprite_w + sprite_padding), r.h);
                                                                            else if ((best_rect.x === r.x) && (best_rect.x + sprite_w === r.x + r.w))
                                                                                keep_r = false;
                                                                        }
                                                                    }
                                                                    if (keep_r)
                                                                        new_rects.push(r);
                                                                });
                                                            best_sheet.free_rects = new_rects;
                                                            imm = setImmediate(process_next_sprite);
                                                        }
                                                        else
                                                            cb(sheets.map(function(s) { return s.rects; }));
                                                    })();
                                                    return function() { clearImmediate(imm); };
                                                }
                                            };
                                        };

                                        var bssf = function(ra, rb, sprite) { return Math.min(ra.w - sprite.sprite_w, ra.h - sprite.sprite_h) - Math.min(rb.w - sprite.sprite_w, rb.h - sprite.sprite_h); };
                                        return merge(
                                            maxrect('BL',  function(ra, rb) { return (ra.y - rb.y) || (ra.x - rb.x); }),
                                            maxrect('LB',  function(ra, rb) { return (ra.x - rb.x) || (ra.y - rb.y); }),
                                            maxrect('BAF', function(ra, rb, sprite) { return ((ra.x * ra.y) - (rb.x * rb.y)) || bssf(ra, rb, sprite); }),
                                            maxrect('BSSF', bssf),
                                            maxrect('BLSF', function(ra, rb, sprite) { return Math.min(ra.w - sprite.sprite_w, ra.h - sprite.sprite_h) - Math.min(rb.w - sprite.sprite_w, rb.h - sprite.sprite_h); }));
                                };

                                var heuristics = merge(
                                    guillotine(unique_sprites),
                                    strip_packers(unique_sprites),
                                    maxrects(unique_sprites));

                                var bin_size_cache = { };
                                (function process_next_heuristic(spritesheet_layouts) {
                                    if (heuristics.length > 0)
                                    {
                                        var heuristic = heuristics.shift();
                                        var tim = setTimeout(function() { console.warn('Canceling ' + heuristic.description + ' at ' + ((Date.now() - start) / 1000) + ' sec as it takes too long to process'); cancel_heuristic_processing(); process_next_heuristic(spritesheet_layouts); }, 1000 * 10);
                                        var start = Date.now();
                                        stop_image_spritesheet_rendering = function() { clearTimeout(tim); cancel_heuristic_processing(); };
                                        var cancel_heuristic_processing = heuristic.with_spritesheets_rects(
                                            function(spritesheets_rects) {
                                                clearTimeout(tim);
                                                var layout_description = heuristic.description;
                                                var path_to_rect = { };
                                                var bins = spritesheets_rects.map(
                                                    function(spritesheet_rects, i) {
                                                        var round_to_pow_2 = function(x) { return Math.pow(2, Math.ceil(Math.log(x) / Math.log(2))); };
                                                        var spritesheet_width  = Math.max.apply(Math, spritesheet_rects.map(function(r) { return r.dst_x + r.dst_sprite.sprite_w; }));
                                                        var spritesheet_height = Math.max.apply(Math, spritesheet_rects.map(function(r) { return r.dst_y + r.dst_sprite.sprite_h; }));
                                                        var spritesheet_base_name = spritesheet_name + '_' + i;
                                                        spritesheet_rects.forEach(
                                                            function(rect) {
                                                                rect.spritesheet_base_name = spritesheet_base_name;
                                                                rect.dst_sprite.sprites_paths.forEach(function(path) { path_to_rect[path] = rect; });
                                                            });
                                                        var sheet_name = spritesheet_base_name + (compile_options.debug_mode ? ('_' + layout_description.replace(/([\<\>"\s'$`\\\/])/g,'_')) : '') + '.png';
                                                        var sheet_path = path.join(output_dir, sheet_name);
                                                        var render_bin = function(on_render) {
                                                            return graphics.render_spritesheet(
                                                                round_to_pow_2(spritesheet_width),
                                                                round_to_pow_2(spritesheet_height),
                                                                spritesheet_rects.map(function(rect) { return { trimmed: rect.dst_sprite.trimmed, x: rect.dst_x, y: rect.dst_y }; }),
                                                                sheet_path,
                                                                on_render);
                                                        };
                                                        return {
                                                            w: spritesheet_width,
                                                            h: spritesheet_height,
                                                            call_with_disk_space: (
                                                                function() {
                                                                    return function(cb) {
                                                                        var bin_size_cache_key = JSON.stringify(spritesheet_rects.map(function(rect) { return [ rect.dst_sprite.sprite_idx, rect.dst_x, rect.dst_y ].join('_'); }).sort());
                                                                        if (bin_size_cache_key in bin_size_cache)
                                                                        {
                                                                            var imm = setImmediate(function() { cb(bin_size_cache[bin_size_cache_key]); });
                                                                            return function() { clearImmediate(imm); };
                                                                        }
                                                                        else
                                                                            return render_bin(
                                                                                function() {
                                                                                    var stats = fs.statSync(sheet_path);
                                                                                    fs.unlinkSync(sheet_path);
                                                                                    bin_size_cache[bin_size_cache_key] = stats.size;
                                                                                    cb(bin_size_cache[bin_size_cache_key]);
                                                                                });
                                                                    };
                                                                })(),
                                                            render_bin: function(output_cb) {
                                                                return render_bin(function() { log(sheet_path + ' saved'); output_cb(sheet_name); });
                                                            }
                                                        };
                                                    });

                                                process_next_heuristic(spritesheet_layouts.concat([ {
                                                    description:       layout_description + '\t' + bins.reduce(function(arr, bin) { return arr.concat(bin.w + 'x' + bin.h); }, [ ]),
                                                    spritesheets_cnt:  spritesheets_rects.length,
                                                    spritesheets_area: bins.reduce(function(sum, bin) { return sum + bin.w * bin.h; }, 0),
                                                    spritesheets_circ: bins.reduce(function(sum, bin) { return sum + bin.w + bin.h; }, 0),
                                                    spritesheets_height: bins.reduce(function(sum, bin) { return sum + bin.h; }, 0),
                                                    swaps:             (function() {
                                                        var swaps = 0;
                                                        var prev_spritesheet = null;
                                                        sprite_paths.forEach(
                                                            function(sprite_path) {
                                                                var spritesheet = path_to_rect[sprite_path].spritesheet_base_name;
                                                                if (prev_spritesheet && (prev_spritesheet !== spritesheet))
                                                                    swaps++;
                                                                prev_spritesheet = spritesheet;
                                                            });
                                                        return swaps;
                                                    })(),
                                                    call_with_disk_space: function(cb) {
                                                        var stop;
                                                        (function rnd(i, disk_space) {
                                                            if (i < bins.length)
                                                                stop = bins[i].call_with_disk_space(function(size) { rnd(i + 1, disk_space + size); });
                                                            else
                                                            {
                                                                stop = function() { };
                                                                cb(disk_space);
                                                            }
                                                        })(0, 0);
                                                        return function() { stop(); };
                                                    },
                                                    render: function(call_with_outputs_and_get_sprite) {
                                                        var stop;
                                                        (function rnd(i, outputs) {
                                                            if (i < bins.length)
                                                                stop = bins[i].render_bin(function(output) { rnd(i + 1, outputs.concat(output)); });
                                                            else
                                                            {
                                                                stop = function() { };
                                                                call_with_outputs_and_get_sprite(
                                                                    outputs,
                                                                    function(sprite_path) {
                                                                        var r = path_to_rect[sprite_path];
                                                                        var s = path_to_sprite[sprite_path];
                                                                        return {
                                                                            spritesheet_file: r.spritesheet_base_name,
                                                                            sprite_x:         r.dst_x,
                                                                            sprite_y:         r.dst_y,
                                                                            sprite_w:         s.trimmed_w,
                                                                            sprite_h:         s.trimmed_h,
                                                                            padding_left:     s.padding_left,
                                                                            padding_top:      s.padding_top,
                                                                            image_width:      s.image_width,
                                                                            image_height:     s.image_height
                                                                        };
                                                                    });
                                                            }
                                                        })(0, [ ]);
                                                        return function() { stop(); };
                                                    }
                                                } ]));
                                            });
                                    }
                                    else
                                    {
                                        spritesheet_layouts.sort(function(l1, l2) { return (l1.swaps - l2.swaps) || (l1.spritesheets_cnt - l2.spritesheets_cnt) || (l1.spritesheets_height - l2.spritesheets_height) || (l1.spritesheets_area - l2.spritesheets_area); });
                                        // spritesheet_layouts.forEach(function(layout) { console.warn([ spritesheet_name, layout.swaps, pad_left(layout.spritesheets_height, 5), pad_left(layout.spritesheets_circ, 5), '(' + pad_left(layout.spritesheets_area, 9) + ')', layout.description ].join('\t')); });
                                        (compile_options.debug_mode
                                         ? ((function rec(layouts, outputs, get_sprite_info) {
                                             if (layouts.length > 0)
                                                 stop_image_spritesheet_rendering = layouts[0].render(function(outputs, get_sprite_info) { rec(layouts.slice(1), outputs, get_sprite_info); });
                                             else
                                             {
                                                 cleanup_trimmed_sprites();
                                                 call_with_outputs_and_get_sprite(outputs, get_sprite_info);
                                             }
                                         })(spritesheet_layouts))
                                         : (compile_options.least_space
                                            ? (function rec(layouts, sizes_layouts) {
                                                if (layouts.length > 0)
                                                {
                                                    var layout = layouts[0];
                                                    stop_image_spritesheet_rendering = layout.call_with_disk_space(function(disk_space) { rec(layouts.slice(1), sizes_layouts.concat([ { disk_space: disk_space, layout: layout } ])); });
                                                }
                                                else
                                                    stop_image_spritesheet_rendering = sizes_layouts.sort(
                                                        function(sla, slb) { return sla.disk_space - slb.disk_space; }
                                                    )[0].layout.render(
                                                        function(outputs, get_sprite_info) { cleanup_trimmed_sprites(); call_with_outputs_and_get_sprite(outputs, get_sprite_info); });
                                            })(spritesheet_layouts.filter(function(l) { return l.swaps === spritesheet_layouts[0].swaps; }), [ ])
                                            : (stop_image_spritesheet_rendering = spritesheet_layouts[0].render(function(outputs, get_sprite_info) { cleanup_trimmed_sprites(); call_with_outputs_and_get_sprite(outputs, get_sprite_info); }))));
                                    }
                                })([ ]);
                            }
                        })(Object.keys(compare_buckets));
                    });
                return function() { stop_image_spritesheet_rendering(); };
            });
    });
    return function() { cancel_renderer_tests(); };
};

var render_audio_spritesheet = function(log, spritesheet_name, sprite_paths, output_dir, compile_options, call_with_outputs_and_get_sprite) {
    var stop_audio_spritesheet_rendering = spawned(
        'ffmpeg', [ '-version' ],
        function(stdout_stream) {
            var stdout = '' + stdout_stream.read();
            if (stdout.indexOf('ffmpeg version') !== 0)
                throw new Error('Wrong ffmpeg version:\n' + stdout);
            else
            {
                var outputs = [ ];
                var convert_with = function(converters, input_path, input_options, output_name, on_convert) {
                    var stop_converter = function() { };
                    (function convert(converters) {
                        if (converters.length > 0)
                        {
                            var conv = converters[0];
                            var output_path = path.join(output_dir, outputs[outputs.push(output_name + conv.ext) - 1]);
                            stop_converter = spawned(
                                'ffmpeg', [ '-y' ].concat(input_options).concat([ '-i', input_path ]).concat(conv.opts).concat([ '-ac', conv.channels ]).concat(output_path),
                                function() {
                                    stop_converter = function() { };
                                    log(output_path + ' saved');
                                    convert(converters.slice(1));
                                });
                        }
                        else
                            on_convert();
                    })(converters);
                    return function() { stop_converter(); };
                };

                var converter = function(ext, channels, opts) { return { ext: ext, channels: channels, opts: opts }; };
                var stereo_converters = [
                    converter('.m4a', 2, [ ]),
                    converter('.ogg', 2, '-acodec libvorbis -f ogg'.split(' '))
                ];

                var next_start_ms   = 0;
                var sprite_tmp_path = path.join(os.tmpDir(), 'audio_sprite_' + spritesheet_name);
                var sheet_writer    = fs.createWriteStream(sprite_tmp_path);
                var tmp_sample_rate = 44100;
                var tmp_channels    = 2;
                var bytes_per_ms    = tmp_sample_rate * tmp_channels * 2 / 1000;
                var path_to_sprite  = { };
                var tmp_format_opts = [ '-ac', tmp_channels, '-f', 's16le' ];

                (function process_sound(sound_nr) {
                    if (sound_nr < sprite_paths.length)
                    {
                        var stop = false;
                        var stop_convert = function() { };
                        stop_audio_spritesheet_rendering = function() { convert_sound.kill('SIGKILL'); stop = true; stop_convert(); };
                        var next_audio_sync = (
                            function() {
                                var calls = 0;
                                return function() {
                                    if ((! stop) && (++calls === 2))
                                        process_sound(sound_nr + 1);
                                };
                            })();
                        var sprite_path = sprite_paths[sound_nr];
                        var size = 0;
                        var convert_sound = spawn('ffmpeg', [ '-i', sprite_path, '-ar', tmp_sample_rate ].concat(tmp_format_opts).concat('pipe:'));
                        var stdout = convert_sound.stdout;
                        stdout.on('data', function(data) { size += data.length; });
                        stdout.pipe(sheet_writer, { end: false });
                        stdout.on(
                            'finish',
                            function() {
                                var single_file_name = [ spritesheet_name, sound_nr, path.basename(sprite_path, path.extname(sprite_path)) ].join('_');
                                var length_ms = size / bytes_per_ms;
                                path_to_sprite[sprite_path] = {
                                    single_file:      single_file_name,
                                    spritesheet_file: spritesheet_name,
                                    audio_start_ms:   next_start_ms,
                                    audio_length_ms:  length_ms
                                };
                                next_start_ms += length_ms;

                                var silence_length_ms = (sound_nr === (sprite_paths.length - 1)) ? 0 : 1000;
                                var buffer = new Buffer(silence_length_ms * bytes_per_ms);
                                buffer.fill(0);
                                sheet_writer.write(
                                    buffer,
                                    function() {
                                        if (! stop)
                                        {
                                            next_start_ms += silence_length_ms;
                                            stop_convert = convert_with(stereo_converters, sprite_path, [ ], single_file_name, next_audio_sync);
                                        }
                                    });
                            });
                        convert_sound.on('close', function(code) {
                            if (code)
                                throw new Error('Error processing ' + sprite_path);
                            else
                                next_audio_sync();
                        });
                    }
                    else
                    {
                        sheet_writer.end();
                        stop_audio_spritesheet_rendering = convert_with(
                            stereo_converters.concat([ converter('-mob.m4a', 1, [ ]), converter('-mob.ogg', 1, '-acodec libvorbis -f ogg'.split(' ')) ]),
                            sprite_tmp_path,
                            tmp_format_opts,
                            spritesheet_name,
                            function() { fs.unlinkSync(sprite_tmp_path); call_with_outputs_and_get_sprite(outputs, function(path) { return path_to_sprite[path]; }); });
                    }
                })(0);
            }
        });
    return function() { stop_audio_spritesheet_rendering(); };
};

var recurse = function(test, proc) {
    return function rec(obj) {
        if (test(obj))
            return proc(obj);
        else if (! (obj && (typeof(obj) === 'object')))
            return obj;
        else if (Array.isArray(obj))
            return obj.map(rec);
        else
        {
            var ret = { };
            for (var key in obj)
                if (obj.hasOwnProperty(key))
                    ret[key] = rec(obj[key]);
            return ret;
        }
    };
};

exports.compile = function(output_dir, compile_options, gen_cb, on_done) {
    var log = compile_options.log || console.log;
    var stop_rendering = function() { ignore_getting_image_renderer(); };
    var ignore_getting_image_renderer = withGenericImageRenderer(
        log,
        function(render_image_spritesheet) {
            var mmm = require('mmmagic');
            var magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);

            var assets_structure = gen_cb(
                function(spritesheet_name) {
                    var sprite_paths = [ ];
                    var render_and_call_with_get_sprite_info;
                    var with_sprite_info = function(sprite_path, call_with_sprite_info) {
                        var spritesheet_cache_path = compile_options.cache_dir && path.join(compile_options.cache_dir, spritesheet_name + '.cache.json');
                        var spritesheet_cache = spritesheet_cache_path && fs.existsSync(spritesheet_cache_path) && JSON.parse(fs.readFileSync(spritesheet_cache_path));
                        if (spritesheet_cache
                            &&
                            ((spritesheet_cache.cache_version === CACHE_VERSION) || (function() { log('Cache version change detected: ' + CACHE_VERSION + ' (was ' + spritesheet_cache.cache_version + ')'); return false; })())
                            &&
                            ((! compile_options.least_space) || spritesheet_cache.least_space)
                            &&
                            (spritesheet_cache.input_files.length === sprite_paths.length)
                            &&
                            spritesheet_cache.input_files.every(function(f, i) { return f.file_hash === hash_file(sprite_paths[i]); })
                            &&
                            spritesheet_cache.output_files.every(function(f) { var out_path = path.join(compile_options.cache_dir, f.spritesheet_name); return fs.existsSync(out_path) && (f.file_hash === hash_file(out_path)); }))
                        {
                            spritesheet_cache.output_files.forEach(function(f) { fs_extra.copySync(path.join(compile_options.cache_dir, f.spritesheet_name), path.join(output_dir, f.spritesheet_name)); });
                            with_sprite_info = function(sprite_path, cb) { cb(spritesheet_cache.input_files[sprite_paths.indexOf(sprite_path)].sprite_info); return nop; };
                            return with_sprite_info(sprite_path, call_with_sprite_info);
                        }
                        else
                        {
                            var stop_spritesheet_rendering = nop;

                            (function accumulate_types(paths, types) {
                                if (paths.length > 0)
                                {
                                    var file_path = paths[0];
                                    var ignore_mime = false;
                                    stop_spritesheet_rendering = function() { ignore_mime = true; };
                                    magic.detectFile(
                                        file_path,
                                        function(err, mime_type) {
                                            if (ignore_mime)
                                                return;
                                            else if (err)
                                                throw err;
                                            else
                                            {
                                                var type = mime_type.split('/')[0];
                                                if (type.match(/^(image|audio)$/))
                                                    accumulate_types(paths.slice(1), types.concat(type));
                                                else // some audio files get detected as other formats, ffprobe tests them more thoroughly
                                                    stop_spritesheet_rendering = spawned(
                                                        'ffprobe', [ '-v', 'quiet', '-print_format', 'json', '-show_streams', file_path ],
                                                        function(stdout) {
                                                            var streams = JSON.parse(stdout.read()).streams;
                                                            ((streams[0].codec_type === 'audio')
                                                             ? accumulate_types(paths.slice(1), types.concat('audio'))
                                                             : console.error('Unknown file type for ' + JSON.stringify(file_path) + ': ' + JSON.stringify(mime_type)));
                                                        });
                                            }
                                        });
                                }
                                else
                                {
                                    var first_type = types[0];
                                    if (types.slice(1).some(function(t) { return t !== first_type; }))
                                        throw new Error('Incompatible types in the same spritesheet "' + spritesheet_name + '":\n' + types.map(function(t, i) { return t + ' ' + sprite_paths[i]; }).join('\n'));
                                    else
                                    {
                                        log('Processing ' + spritesheet_name);
                                        stop_spritesheet_rendering = ((first_type === 'audio') ? render_audio_spritesheet : render_image_spritesheet)(
                                            log,
                                            spritesheet_name,
                                            sprite_paths,
                                            output_dir,
                                            compile_options,
                                            function(outputs, get_sprite_info) {
                                                stop_spritesheet_rendering = nop;
                                                with_sprite_info = function(sprite_path, cb) { cb(get_sprite_info(sprite_path)); return nop; };

                                                if (spritesheet_cache_path)
                                                    fs.writeFileSync(
                                                        spritesheet_cache_path,
                                                        JSON.stringify({
                                                            cache_version: CACHE_VERSION,
                                                            least_space:   compile_options.least_space,
                                                            input_files:   sprite_paths.map(function(p) { return { file_hash: hash_file(p), sprite_info: get_sprite_info(p) }; }),
                                                            output_files:  outputs.map(function(o) { fs_extra.copySync(path.join(output_dir, o), path.join(compile_options.cache_dir, o)); return { file_hash: hash_file(path.join(output_dir, o)), spritesheet_name: o }; })
                                                        }, null, 4),
                                                        { encoding: 'utf8' });

                                                with_sprite_info(sprite_path, call_with_sprite_info);
                                            });
                                    }
                                }
                            })(sprite_paths, [ ]);
                            return function() { stop_spritesheet_rendering(); };
                        }
                    };

                    return function(sprite_path) {
                        sprite_paths.push(sprite_path);
                        return { _compile_for_JSON: function(cb) { return with_sprite_info(sprite_path, cb); } };
                    };
                });

            (function compile_struct(obj, cb) {
                if (! (obj && (typeof(obj) === 'object')))
                    cb(obj);
                else if (obj._compile_for_JSON)
                {
                    stop_rendering = function() { cancel_compile(); };
                    var cancel_compile = obj._compile_for_JSON(function(sprite_info) { stop_rendering = function() { clearImmediate(imm); }; var imm = setImmediate(function() { cb(sprite_info); }); });
                }
                else if (Array.isArray(obj))
                {
                    var new_arr = [ ];
                    (function rec(arr) {
                        ((arr.length > 0)
                         ? compile_struct(arr[0], function(new_elt) { new_arr.push(new_elt); rec(arr.slice(1)); })
                         : cb(new_arr));
                    })(obj);
                }
                else
                {
                    var new_obj = { };
                    (function rec(keys) {
                        ((keys.length > 0)
                         ? compile_struct(obj[keys[0]], function(new_elt) { new_obj[keys[0]] = new_elt; rec(keys.slice(1)); })
                         : cb(new_obj));
                    })(Object.keys(obj).sort());
                }
            })(assets_structure, on_done);
        });
    return function() { stop_rendering(); };
};

// eg. process.stdout.write(JSON.stringify(exports.exportToStringStruct(...)))
exports.exportToStringStruct = function(gen_cb) {
    var marker = { };
    var mappings = gen_cb(
        function(spritesheet_name) {
            return function(sprite_path) {
                return { marker: marker, value: 'PATH:' + spritesheet_name + ':' + sprite_path };
            };
        });
    return {
        mappings: recurse(
            function(mappings) {
                return (mappings
                        &&
                        ((typeof(mappings) === 'string')
                         ||
                         (mappings.marker === marker)));
            },
            function(mappings) {
                return (typeof(mappings) === 'string') ? ('STRING:' + mappings) : mappings.marker;
            })(mappings)
    };
};

// require('odobo_spritesheets').compileStringStruct(output_dir, compile_options, require('odobo_spritesheets').exportToStringStruct(struct_generator));
// is equivalent to
// require('odobo_spritesheets').compile(output_dir, compile_options, struct_generator);
exports.compileStringStruct = function(output_dir, compile_options, struct, cb) {
    return exports.compile(
        output_dir,
        compile_options,
        function(spritesheet) {
            var spritesheets_by_name = { };
            return recurse(
                function(sub_mappings) { return typeof(sub_mappings) === 'string'; },
                function(sub_mappings) {
                    var colon_pos = sub_mappings.indexOf(':');
                    var prefix    = sub_mappings.substr(0, colon_pos);
                    var argument  = sub_mappings.substr(colon_pos + 1);
                    var handler   = ({
                        STRING: function() { return argument; },
                        PATH:   function() {
                            var spritesheet_name_path = argument.split(':');
                            var spritesheet_name = spritesheet_name_path[0];
                            if (! spritesheets_by_name[spritesheet_name])
                                spritesheets_by_name[spritesheet_name] = spritesheet(spritesheet_name);
                            return spritesheets_by_name[spritesheet_name](spritesheet_name_path[1]);
                        }
                    })[prefix];

                    if (handler)
                        return handler();
                    else
                        throw new Error('Unknown string prefix ' + JSON.stringify(prefix) + ' in ' + JSON.stringify(sub_mappings));
                })(struct.mappings);
        },
        cb);
};

exports.run = function(input_dir, output_dir, compile_options, call_with_js_files) {
    try {
        try {
            var json_path = path.join(input_dir, 'odobo_assets', 'odobo_assets.json');
            var json = fs.readFileSync(json_path);
        } catch (e) {
            throw 'Error opening ' + JSON.stringify(json_path) + ' file';
        }
        try {
            var struct = JSON.parse(json);
        } catch (e) {
            throw 'Error parsing ' + JSON.stringify(json_path) + ' file';
        }
        try {
            if (! ('mappings' in struct))
                throw 'Missing "mappings" property';
            struct.mappings = recurse(
                function(sub_mappings) { return typeof(sub_mappings) === 'string'; },
                function(sub_mappings) {
                    var colon_pos = sub_mappings.indexOf(':');
                    var prefix    = sub_mappings.substr(0, colon_pos);
                    var argument  = sub_mappings.substr(colon_pos + 1);
                    var handler   = ({
                        STRING: function() { return argument; },
                        PATH:   function() {
                            var spritesheet_name_path = argument.split(':');
                            return spritesheet_name_path[0] + ':' + path.join(input_dir, spritesheet_name_path[1]);
                        }
                    })[prefix];

                    if (handler)
                        return prefix + ':' + handler();
                    else
                        throw new Error('Unknown string prefix ' + JSON.stringify(prefix) + ' in ' + JSON.stringify(sub_mappings));
                })(struct.mappings);
            return exports.compileStringStruct(
                output_dir,
                compile_options,
                struct,
                function(compiled_assets) {
                    var js_output_file_name = 'spritesheets-client.js';
                    fs.writeFileSync(
                        path.join(output_dir, js_output_file_name),
                        'var odobo_assets = (' + fs.readFileSync(path.join(__dirname, 'spritesheets-client-constructor.js'), { encoding: 'utf8' }) + ')(' + JSON.stringify(compiled_assets, null, 4) + ');\n',
                        { encoding: 'utf8' });
                    call_with_js_files({ javascript: [ js_output_file_name ] });
                });
        } catch (e) {
            throw 'Error processing ' + JSON.stringify(json_path) + ' file:\n\t' + e;
        }
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};
