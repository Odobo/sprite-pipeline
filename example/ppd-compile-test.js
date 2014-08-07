// -*- js2-include-node-externs: t; eval: (js2-set-default-externs) -*-

var path = require('path');
var glob = require('glob');

if (process.argv.length < 3)
    console.warn('Error: Missing assets directory path');
else
{
    var assets_dir_path = process.argv[2];
    var assets_path = function(subpath) { return path.join(assets_dir_path, subpath); };
    require('odobo_spritesheets').compile(
        './output',
        { },
        function(spritesheet) {
            var add_sound = spritesheet('sounds');
            var side_pet_sounds_by_name = {
                chichi_panting:    add_sound(assets_path('Audio/58_Chichi_panting.wav')),
                chichi_begging:    add_sound(assets_path('Audio/59_Chichi_begging.wav')),
                chichi_scratching: add_sound(assets_path('Audio/60_Chichi_scratching.wav')),
                chichi_barking:    add_sound(assets_path('Audio/61_Chichi_barking.wav')),
                fudge_headrubbing: add_sound(assets_path('Audio/62_Fudge_headrubbing.wav')),
                fudge_smiling:     add_sound(assets_path('Audio/63_Fudge_smile.wav')),
                fudge_hissing:     add_sound(assets_path('Audio/64_Fudge_hissing.wav'))
            };

            var side_pet_animations = function(pet_name) {
                var pet_animation_dirs = glob.sync(assets_path('Frames/Side Pets/' + pet_name + '_*'));
                var setup_pet_animation_dir = function(dir) {
                    var animation_name = path.basename(dir); // eg. "chichi_panting"
                    return {
                        sound:  side_pet_sounds_by_name[animation_name],
                        frames: glob.sync(path.join(dir, '*.png')).map(spritesheet(animation_name)) // create a spritesheet and append all *.png frames
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
                    idle_animations: pet_animation_dirs.filter(function(dir) { return ! /(intro|exit)$/.test(dir); }).map(setup_pet_animation_dir), // filter out "intro" and "exit" animations
                    exit_animation:  setup_pet_animation_dir(find_animation_dir(/exit$/))
                };
            };

            // assets structure - equivalent to JSON definition
            return {
                preloads: (function() {
                    var preloader_image = spritesheet('preload_sprite_sheet');
                    return {
                        preload_pets:   preloader_image(assets_path('Stills/Preloader/preload_graphic_Main_1.png')),
                        blue_bar:       preloader_image(assets_path('Stills/Preloader/Preloader_Screen_Frame_Blue.png')),
                        progress_bar:   preloader_image(assets_path('Stills/Preloader/Preloader_Screen_Progress_Bar.png')),
                        revolver_logo:  preloader_image(assets_path('Stills/Preloader/revolver_logo.png')),
                        revolver_logo2: preloader_image(assets_path('Stills/Preloader/revolver_logo_2.png'))
                    };
                })(),
                chichi_animations: side_pet_animations('chichi'),
                fudge_animations:  side_pet_animations('fudge')
            };
        },
        function() { });
}
