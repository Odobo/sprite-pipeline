var random_elt = function(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
};

var assets = ODOBO_ASSETS;
var pets_assets = assets.getAssets();

assets.withLoaded( // assets are not being preloaded, need explicit call to load (will be reused if already loaded)
    pets_assets,
    assets.makeGenericLoader(), // some kind of a progress loader can be plugged in etc
    function() {
        var canvas = window.document.createElement('canvas');
        canvas.width  = '350';
        canvas.height = '350';
        window.document.body.appendChild(canvas);
        var ctx = canvas.getContext('2d');

        var frames = [ ];
        var start_time = window.Date.now();
        var prev_frame = 0;
        (function frame_loop() {
            var curr_frame = Math.round((window.Date.now() - start_time) / (1000 / 25));
            if (curr_frame !== prev_frame)
            {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                var frame;
                for (var i = 0; i < curr_frame - prev_frame; ++i)
                {
                    if (frames.length > 0)
                        frame = frames.shift();
                    else
                    {
                        // run out of animation frames, randomly select new animation
                        var new_animation = random_elt(pets_assets.fudge_animations.idle_animations); // for new_animations's structure see example definitions above
                        frames = new_animation.frames.slice(0); // new_animation.frames is an array of ImageAssets
                        frame = frames.shift();
                        if (new_animation.sound)
                            new_animation.sound.play(); // new_animation.sound is an AudioAsset with a "play" method
                        break;
                    }
                }
                frame.drawToContext(ctx, 0, 0); // ImageAsset.drawToContext
                prev_frame = curr_frame;
            }
            window.requestAnimationFrame(frame_loop);
        })();
    });
