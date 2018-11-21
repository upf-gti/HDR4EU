/*
*   Alex Rodríguez
*   @jxarco 
*/

var default_shader_macros = {
        "N_SAMPLES": 4096,
        "GAMMA": 2.2,
};

var LOAD_STEPS  = 6,
    STEPS       = 0,
    textures    = {},
    mainarea    = null,
    push_msgs   = 0,
    _dt         = 0.0;

function init()
{
    var last = now = getTime();

    wScene = new WS.WScene();
    wGUI = wScene._gui;
    canvas = wScene._renderer.canvas;

    canvas.addEventListener("webglcontextlost", function(event) {
        event.preventDefault();
        console.error('Context lost');
    }, false);

    canvas.ondragover = () => {return false};
    canvas.ondragend = () => {return false};
    canvas.ondrop = (e) => processDrop(e);
    
    renderer = wScene._renderer;
    scene = wScene.scene;
    light = wScene._light;
    camera = wScene.controller._camera;
    
    // declare renderer uniforms
    renderer._uniforms['u_viewport'] = gl.viewport_data;
    renderer._uniforms["u_rotation"] = 0.0;
    renderer._uniforms["u_tonemapping"] = 2.0;
    renderer._uniforms["u_exposure"] = 0.0;
    renderer._uniforms["u_offset"] = 0.0;
    renderer._uniforms["u_channel"] = 0.0;
    renderer._uniforms["u_enable_ao"] = true;
    renderer._uniforms["u_correctAlbedo"] = true;
    renderer._uniforms["u_ibl_intensity"] = 1.0;

    renderer._uniforms["u_albedo"] = vec3.fromValues( 1, 1, 1);

    renderer._uniforms["u_near"] = camera.near;
    renderer._uniforms["u_far"] = camera.far;
    
    // Atmospherical Scattering
    renderer._uniforms['u_SunPos'] = 0.4;
    renderer._uniforms['u_SunIntensity'] = 22.0;
    renderer._uniforms["u_MieDirection"] = 0.76;
    renderer._uniforms['u_originOffset'] = 0.0;
    renderer._uniforms['u_MieCoeff'] = 21;
    
    // initialize some global parameters 
    window.glow = true;
    window.iterations = 8;
    window.threshold = 10.0;
    window.intensity = 1.0;
    
    render_mode = WS.FORWARD;
    renderer.context.ondraw = () => wScene.render( render_mode );
    renderer.context.onupdate = (dt) => {

        wScene.update(dt);

    }

    // picker
   /* var pixelPickerText = document.getElementById('pixelPickerText');
    var pixelPickerColor = document.getElementById('pixelPickerColor');
    pixelPickerPos = { x: 0, y: 0 };
    pixelPickerScheduled = false;

    sample2D = function() {
        pixelPickerScheduled = false;
        var x = pixelPickerPos.x;
        var y = pixelPickerPos.y;
        var p = ctx2d.getImageData(x, y, 1, 1).data;
        pixelPickerText.innerHTML =
            "r:  " + format255(p[0]) + " g:  " + format255(p[1]) + " b:  " + format255(p[2]) +
            "<br>r: " + (p[0] / 255).toFixed(2) + " g: " + (p[1] / 255).toFixed(2) + " b: " + (p[2] / 255).toFixed(2);
        pixelPickerColor.style.backgroundColor = 'rgb(' + p[0] + ',' + p[1] + ',' + p[2] + ')';
    }*/

    renderer.context.animate();
    window.onresize = resize;

    // get response from files.php and init app
    $.get("files.php", (data) => onread(data));
}

function onread( data )
{
    // Save textures info for the GUI
    textures = JSON.parse(data);

    // Environment BRDF (LUT) when reloading shaders
    renderer.loadShaders("data/shaders.glsl", function(){
        
        HDRTool.brdf( 'brdfIntegrator');
        // renderer.loadTexture("data/brdfLUT.png", renderer.default_texture_settings, (tex)=>{
        //     gl.textures['_brdf_integrator'] = tex;
        // });
        
        wGUI.init(); // init gui
        wScene.set( textures_folder + "eucalyptus_grove.hdre" );

    }, default_shader_macros);
}
