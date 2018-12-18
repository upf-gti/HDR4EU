/*
*   Alex Rodríguez
*   @jxarco 
*/

var default_shader_macros = {
    "N_SAMPLES": 4096,
    "GAMMA": 2.2,
};

var CORE        = null,
    LOAD_STEPS  = 6,
    STEPS       = 0,
    textures    = {},
    mainarea    = null,
    push_msgs   = 0,
    _dt         = 0.0;

function init()
{
    var last = now = getTime();

    CORE = new WS.Core();
    canvas = CORE.getCanvas();

    canvas.addEventListener("webglcontextlost", function(event) {
        event.preventDefault();
        console.error('Context lost');
    }, false);

    canvas.ondragover = () => {return false};
    canvas.ondragend = () => {return false};
    canvas.ondrop = (e) => processDrop(e);
    
    gui = CORE._gui;
    renderer = CORE._renderer;
    scene = CORE.scene;
    light = CORE._light;
    camera = CORE.controller._camera;
    
    // declare renderer uniforms
    renderer._uniforms["u_rotation"] = 0.0;
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

    // set param macros
    default_shader_macros[ 'INPUT_TEX_WIDTH' ] = gl.viewport_data[2];
    default_shader_macros[ 'INPUT_TEX_HEIGHT' ] = gl.viewport_data[3];
	default_shader_macros[ 'PIXEL_OFFSET' ] = 30;
	default_shader_macros[ 'EM_SIZE' ] = 1; // no parsing at initialization

    // initialize some global parameters 
    window.glow = true;
    window.iterations = 8;
    window.threshold = 10.0;
    window.intensity = 1.0;
    
    renderer.context.ondraw = function(){ CORE.render() };
    renderer.context.onupdate = function(dt){ CORE.update(dt) };

    renderer.context.animate();
    window.onresize = resize;

    // get response from files.php and init app
    $.get("files.php", function(data){ onread(data) });
}

function onread( data )
{
    // Save textures info for the GUI
    textures = JSON.parse(data);

    // Environment BRDF (LUT) when reloading shaders
    renderer.loadShaders("data/shaders.glsl", function(){
        
        HDRTool.brdf( 'brdfIntegrator');
        
        gui.init(); // init gui
        CORE.set( textures_folder + "whipple_creek.hdre" );

    }, default_shader_macros);
}



init();