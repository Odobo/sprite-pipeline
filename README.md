# Requirements

* [`ffmpeg`](http://www.ffmpeg.org/) (with aac and libvorbis encoders) in PATH for audio spritesheets,
* Either npm's [`canvas`](https://npmjs.org/package/canvas) module (faster) or [ImageMagick's](http://www.imagemagick.org/) utilities (`convert` and `identify`) in PATH for image spritesheets,
* Npm's [`mmmagic`](https://npmjs.org/package/mmmagic) module for file type identification.

# Usage

A developer defines a structure in a JSON file (location to be determined), and this structure, handled by our tool, is being exposed back for a game client.

All datatypes but strings get passed on as given, which means e.g.

    :::javascript
    {
            "foo": [ 1, 2, 3 ],
            "bar": {
                   "baz": 456,
                   "visible": true
            }
    }

will be exposed unchanged on the client side.

The only special case is a string, which currently[\*][note] gets decoded into 2 datatypes, and the discriminator is string's prefix separated from the rest with a colon:

1. `"STRING:Lorem ipsum"` denotes a literal string.
The value passed on to client will be a substring starting right after the colon, and the example above would yield "Lorem ipsum" string.

2. `"PATH:dog_idle_animation_1:/path/to/a/frame003.png"`
or
3. `"PATH:button_sounds:/path/to/a/click.wav"` denote an asset.

The asset types get decoded to the spritesheet name and asset path, which start after the first colon, and are separated by another colon.

The examples above would result in
2. an image asset located at "/path/to/a/frame003.png" being placed on a "dog\_idle\_animation\_1" images spritesheet, and
3. an audio asset located at "/path/to/a/click.wav" being places on a "button\_sounds" audio spritesheet.

Actual asset type is determined directly from a file pointed by a path.

Image and audio assets are exposed on the client side as JS objects with appropriate properties attached (like for drawing an image on a canvas, or playing a sound).

[note]: Further extensions possible, like "GLOB:cat\_walk\_animation:/path/to/cat/walk/animation/*.png" resolving to an array of asset object etc


More practical example follows below: (with "// ..." standing for lines removed for clarity, full example attached)

    :::javascript
    {
        "mappings": {
            "preloads": {
                "preload_pets":   "PATH:preload_sprite_sheet:Stills/Preloader/preload_graphic_Main_1.png",
                "blue_bar":       "PATH:preload_sprite_sheet:Stills/Preloader/Preloader_Screen_Frame_Blue.png",
                "progress_bar":   "PATH:preload_sprite_sheet:Stills/Preloader/Preloader_Screen_Progress_Bar.png",
                "revolver_logo":  "PATH:preload_sprite_sheet:Stills/Preloader/revolver_logo.png",
                "revolver_logo2": "PATH:preload_sprite_sheet:Stills/Preloader/revolver_logo_2.png"
            },
            "chichi_animations": {
                "intro_animation": {
                    "frames": [
                        "PATH:chichi_intro:Frames/Side Pets/chichi_intro/chichi_intro_001.png",
                        "PATH:chichi_intro:Frames/Side Pets/chichi_intro/chichi_intro_002.png",
                        "PATH:chichi_intro:Frames/Side Pets/chichi_intro/chichi_intro_003.png",
                        // ...
                        "PATH:chichi_intro:Frames/Side Pets/chichi_intro/chichi_intro_040.png",
                        "PATH:chichi_intro:Frames/Side Pets/chichi_intro/chichi_intro_041.png",
                        "PATH:chichi_intro:Frames/Side Pets/chichi_intro/chichi_intro_042.png"
                    ]
                },
                "idle_animations": [
                    {
                        "sound": "PATH:sounds:Audio/61_Chichi_barking.wav",
                        "frames": [
                            "PATH:chichi_barking:Frames/Side Pets/chichi_barking/chichi_barking_001.png",
                            // ...
                            "PATH:chichi_barking:Frames/Side Pets/chichi_barking/chichi_barking_049.png"
                        ]
                    },
                    {
                        "sound": "PATH:sounds:Audio/59_Chichi_begging.wav",
                        "frames": [
                            "PATH:chichi_begging:Frames/Side Pets/chichi_begging/chichi_begging_001.png",
                            // ...
                            "PATH:chichi_begging:Frames/Side Pets/chichi_begging/chichi_begging_052.png"
                        ]
                    },
                    {
                        "frames": [
                            "PATH:chichi_idle_loop:Frames/Side Pets/chichi_idle_loop/chichi_idle_loop_001.png",
                            // ...
                            "PATH:chichi_idle_loop:Frames/Side Pets/chichi_idle_loop/chichi_idle_loop_032.png"
                        ]
                    },
                    {
                        "frames": [
                            "PATH:chichi_idle_random:Frames/Side Pets/chichi_idle_random/chichi_idle_random_001.png",
                            // ...
                            "PATH:chichi_idle_random:Frames/Side Pets/chichi_idle_random/chichi_idle_random_031.png"
                        ]
                    },
                    {
                        "sound": "PATH:sounds:Audio/58_Chichi_panting.wav",
                        "frames": [
                            "PATH:chichi_panting:Frames/Side Pets/chichi_panting/chichi_panting_001.png",
                            // ...
                            "PATH:chichi_panting:Frames/Side Pets/chichi_panting/chichi_panting_052.png"
                        ]
                    },
                    {
                        "frames": [
                            "PATH:chichi_resting:Frames/Side Pets/chichi_resting/chichi_resting_001.png",
                            // ...
                            "PATH:chichi_resting:Frames/Side Pets/chichi_resting/chichi_resting_060.png"
                        ]
                    },
                    {
                        "sound": "PATH:sounds:Audio/60_Chichi_scratching.wav",
                        "frames": [
                            "PATH:chichi_scratching:Frames/Side Pets/chichi_scratching/chichi_scratching_001.png",
                            // ...
                            "PATH:chichi_scratching:Frames/Side Pets/chichi_scratching/chichi_scratching_084.png"
                        ]
                    },
                    {
                        "frames": [
                            "PATH:chichi_smiling_1:Frames/Side Pets/chichi_smiling_1/chichi_smiling_1_001.png",
                            // ...
                            "PATH:chichi_smiling_1:Frames/Side Pets/chichi_smiling_1/chichi_smiling_1_032.png"
                        ]
                    },
                    {
                        "frames": [
                            "PATH:chichi_smiling_2:Frames/Side Pets/chichi_smiling_2/chichi_smiling_2_001.png",
                            // ...
                            "PATH:chichi_smiling_2:Frames/Side Pets/chichi_smiling_2/chichi_smiling_2_050.png"
                        ]
                    }
                ],
                "exit_animation": {
                    "frames": [
                        "PATH:chichi_exit:Frames/Side Pets/chichi_exit/chichi_exit_001.png",
                        // ...
                        "PATH:chichi_exit:Frames/Side Pets/chichi_exit/chichi_exit_048.png"
                    ]
                }
            },
            "fudge_animations": {
                "intro_animation": {
                    "frames": [
                        "PATH:fudge_intro:Frames/Side Pets/fudge_intro/fudge_intro_001.png",
                        // ...
                        "PATH:fudge_intro:Frames/Side Pets/fudge_intro/fudge_intro_043.png"
                    ]
                },
                "idle_animations": [
                    {
                        "sound": "PATH:sounds:Audio/62_Fudge_headrubbing.wav",
                        "frames": [
                            "PATH:fudge_headrubbing:Frames/Side Pets/fudge_headrubbing/fudge_headrubbing_001.png",
                            // ...
                            "PATH:fudge_headrubbing:Frames/Side Pets/fudge_headrubbing/fudge_headrubbing_057.png"
                        ]
                    },
                    {
                        "sound": "PATH:sounds:Audio/64_Fudge_hissing.wav",
                        "frames": [
                            "PATH:fudge_hissing:Frames/Side Pets/fudge_hissing/fudge_hissing_001.png",
                            // ...
                            "PATH:fudge_hissing:Frames/Side Pets/fudge_hissing/fudge_hissing_049.png"
                        ]
                    },
                    {
                        "frames": [
                            "PATH:fudge_idle_loop:Frames/Side Pets/fudge_idle_loop/fudge_idle_loop_001.png",
                            // ...
                            "PATH:fudge_idle_loop:Frames/Side Pets/fudge_idle_loop/fudge_idle_loop_033.png"
                        ]
                    },
                    {
                        "frames": [
                            "PATH:fudge_idle_random:Frames/Side Pets/fudge_idle_random/fudge_idle_random_001.png",
                            // ...
                            "PATH:fudge_idle_random:Frames/Side Pets/fudge_idle_random/fudge_idle_random_032.png"
                        ]
                    },
                    {
                        "frames": [
                            "PATH:fudge_kneading:Frames/Side Pets/fudge_kneading/fudge_kneading_001.png",
                            // ...
                            "PATH:fudge_kneading:Frames/Side Pets/fudge_kneading/fudge_kneading_048.png"
                        ]
                    },
                    {
                        "frames": [
                            "PATH:fudge_looking:Frames/Side Pets/fudge_looking/fudge_looking_001.png",
                            // ...
                            "PATH:fudge_looking:Frames/Side Pets/fudge_looking/fudge_looking_069.png"
                        ]
                    },
                    {
                        "frames": [
                            "PATH:fudge_pawlicking:Frames/Side Pets/fudge_pawlicking/fudge_pawlicking_001.png",
                            // ...
                            "PATH:fudge_pawlicking:Frames/Side Pets/fudge_pawlicking/fudge_pawlicking_070.png"
                        ]
                    },
                    {
                        "frames": [
                            "PATH:fudge_sad:Frames/Side Pets/fudge_sad/fudge_sad_001.png",
                            // ...
                            "PATH:fudge_sad:Frames/Side Pets/fudge_sad/fudge_sad_048.png"
                        ]
                    },
                    {
                        "sound": "PATH:sounds:Audio/63_Fudge_smile.wav",
                        "frames": [
                            "PATH:fudge_smiling:Frames/Side Pets/fudge_smiling/fudge_smiling_001.png",
                            // ...
                            "PATH:fudge_smiling:Frames/Side Pets/fudge_smiling/fudge_smiling_042.png"
                        ]
                    }
                ],
                "exit_animation": {
                    "frames": [
                        "PATH:fudge_exit:Frames/Side Pets/fudge_exit/fudge_exit_001.png",
                        // ...
                        "PATH:fudge_exit:Frames/Side Pets/fudge_exit/fudge_exit_034.png"
                    ]
                }
            }
        }
    }

At the moment automated odobo-specific mechanism is missing, to process the example above one needs to call a `require('odobo_spritesheets').compileStringStruct` function:

    :::javascript
    require('odobo_spritesheets').compileStringStruct(
        'output_path',
        { cache_dir: '.cache' },
        fs.readFileSync('path/to/structure.json', { encoding: 'utf8' }));
    

Alternatively to define assets programatically one can use provided abstraction by defining a generate\_assets\_structure function taking a spritesheet constructor as an argument, and returning assets structure.
An example expressed programatically below yields identical structure as the JSON structure above:

    :::javascript
    var generate_assets_structure = function(spritesheet) {
        var path = require('path');
        var glob = require('glob');
    
        var add_sound = spritesheet('sounds');
        var side_pet_sounds_by_name = {
            chichi_panting:    add_sound('Audio/58_Chichi_panting.wav'),
            chichi_begging:    add_sound('Audio/59_Chichi_begging.wav'),
            chichi_scratching: add_sound('Audio/60_Chichi_scratching.wav'),
            chichi_barking:    add_sound('Audio/61_Chichi_barking.wav'),
            fudge_headrubbing: add_sound('Audio/62_Fudge_headrubbing.wav'),
            fudge_smiling:     add_sound('Audio/63_Fudge_smile.wav'),
            fudge_hissing:     add_sound('Audio/64_Fudge_hissing.wav')
        };
    
        var side_pet_animations = function(pet_name) {
            var pet_animation_dirs = glob.sync('Frames/Side Pets/' + pet_name + '_*');
            var setup_pet_animation_dir = function(dir) {
                var animation_name = path.basename(dir); // eg. "chichi_panting"
                return {
                    sound:  side_pet_sounds_by_name[animation_name],
                    frames: glob.sync(dir + '/*.png').map(spritesheet(animation_name)) // create a spritesheet and append all *.png frames
                };
            };
            var find_animation_dir = function(name_regexp) {
                for (var i = 0; i < pet_animation_dirs.length; ++i)
                    if (name_regexp.test(pet_animation_dirs[i]))
                        return pet_animation_dirs[i];
                throw new Error('Missing animation dir matching ' + name_regexp + ' for ' + pet_name);
            };
            return {
                intro_animation: setup_pet_animation_dir(find_animation_dir(/intro$/)),
                idle_animations: pet_animation_dirs.filter(function(dir) { return ! /(intro|exit)/.test(dir); }).map(setup_pet_animation_dir), // filter out "intro" and "exit" animations
                exit_animation:  setup_pet_animation_dir(find_animation_dir(/exit$/))
            };
        };
    
        // assets structure - equivalent to JSON definition
        return {
            preloads: (function() {
                var preloader_image = spritesheet('preload_sprite_sheet');
                return {
                    preload_pets:   preloader_image('Stills/Preloader/preload_graphic_Main_1.png'),
                    blue_bar:       preloader_image('Stills/Preloader/Preloader_Screen_Frame_Blue.png'),
                    progress_bar:   preloader_image('Stills/Preloader/Preloader_Screen_Progress_Bar.png'),
                    revolver_logo:  preloader_image('Stills/Preloader/revolver_logo.png'),
                    revolver_logo2: preloader_image('Stills/Preloader/revolver_logo_2.png')
                };
            })(),
            chichi_animations: side_pet_animations('chichi'),
            fudge_animations:  side_pet_animations('fudge')
        };
    };

At the moment automated odobo-specific mechanism is missing, to process the example above one needs to call a `require('odobo_spritesheets').compile` function:

    :::javascript
    require('odobo_spritesheets').compile(
        'output_path',
        { cache_dir: '.cache' },
        generate_assets_structure);
    

An example of a client-side utilization of assets structure for idle pet animation presented below, where an ODOBO_ASSETS variable stands for a tool-generated object exposed to a game-dev, and two asset specific methods being used (AudioAsset.play and ImageAsset.drawToContext):


    :::javascript
    var random_elt = function(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    };
    
    var pets_assets = ODOBO_ASSETS.getAssets();
    var chichi_idle_animations = pets_assets.chichi_animations.idle_animations;

    // assets are not being preloaded, need explicit call to make sure, if already loaded then would be reused
    ODOBO_ASSETS.withLoaded(
        chichi_idle_animations,
        ODOBO_ASSETS.makeGenericLoader(), // some kind of a progress loader can be plugged in etc
        function() {
            var canvas = window.document.createElement('canvas');
            window.document.body.appendChild(canvas);
            var ctx = canvas.getContext('2d');
    
            var frames = [ ];
            (function frame_loop() {
                if (frames.length === 0)
                {
                    // run out of animation frames, randomly select new animation
                    // for new_animations's structure see example definitions above
                    var new_animation = random_elt(chichi_idle_animations);
                    frames = new_animation.frames.slice(0); // new_animation.frames is an array of ImageAssets
                    if (new_animation.sound)
                        new_animation.sound.play(); // new_animation.sound is an AudioAsset with a "play" method
                }
    
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                var frame = frames.shift();
                frame.drawToContext(ctx, 0, 0); // ImageAsset.drawToContext
                window.requestAnimationFrame(frame_loop);
            })();
        });

To make it work a HTML page is needed that includes assets-processing JS, like below:

    :::html
    <html>
      <body></body>
      <script src="output_path/spritesheets-client.js"></script>
    // example code from above
      </script>
    </html>



# Working example

To see an example in action, definition and client files are contained in the project's `example` subdirectory.


### Assets
A working directory of [Pets Pay Day game client](https://bitbucket.org/Odobo/odbg_petspayday) is needed to provide actual assets.
To clone it use:

`$ git clone git@bitbucket.org:Odobo/odbg_petspayday.git`


### Spritesheets
Once downloaded next day, to generate spritesheets `cd` to the `example` subdirectory and use command:

`$ NODE_PATH=$NODE_PATH:../../ node ppd-compile-test.js </path/to/odbg_petspayday/assets>`

This creates an `output` directory used by `ppd-example.html` and `ppd-example.js` files.


### HTTP server
To make sounds work `ppd-example.html` needs to be open through HTTP server e.g. python's SimpleHTTPServer like this:

`$ python -m SimpleHTTPServer 8001`


### Browser
Finally point a browser to the `ppd-example.html` page to see results.
