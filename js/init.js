/*
*   Alex Rodríguez
*   @jxarco 
*/

var default_shader_macros = {
    "N_SAMPLES": 4096,
    "GAMMA": 2.2,
};

var CORE        = new WS.Core(),
    LOAD_STEPS  = 6,
    STEPS       = 0,
    textures    = {},
    mainarea    = null,
    _dt         = 0.0;

function init()
{
    var last = now = getTime();

    canvas = CORE.getCanvas();

    canvas.addEventListener("webglcontextlost", function(event) {
        event.preventDefault();
        console.error('Context lost');
	    console.error(event);
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
    CORE.setUniform("near", camera.near);
    CORE.setUniform("far", camera.far);
	CORE.setUniform("rotation", 0.0);
    CORE.setUniform("exposure", 0.0);
    CORE.setUniform("offset", 0.0);
    CORE.setUniform("channel", 0.0);
    CORE.setUniform("enable_ao", true);
    CORE.setUniform("correctAlbedo", true);
    CORE.setUniform("ibl_intensity", 1.0);
    CORE.setUniform("albedo", vec3.fromValues( 1, 1, 1));
    
	// SSAO
	CORE.setUniform("radius", 16.0);
	CORE.setUniform("outputChannel", 0.0);

    // Atmospherical Scattering
    CORE.setUniform('SunPos', 0.4);
    CORE.setUniform('SunIntensity', 22.0);
    CORE.setUniform("MieDirection", 0.76);
    CORE.setUniform('originOffset', 0.0);
    CORE.setUniform('MieCoeff', 21);

    // set param macros
    default_shader_macros[ 'INPUT_TEX_WIDTH' ] = gl.viewport_data[2];
    default_shader_macros[ 'INPUT_TEX_HEIGHT' ] = gl.viewport_data[3];
	default_shader_macros[ 'PIXEL_OFFSET' ] = 30;
	default_shader_macros[ 'EM_SIZE' ] = 1; // no parsing at initialization
    
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
	CORE.reloadShaders(default_shader_macros, function(){
        
		var brdf = Texture.fromURL("data/brdfLUT.png");
		gl.textures['_brdf_integrator'] = brdf;
        
		
		CORE.set( textures['Studio'] );
		ssao.init();
		gui.init(); // init gui

    });
}
