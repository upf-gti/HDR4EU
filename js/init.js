/*
*   Alex Rodri­guez
*   @jxarco 
*/

var max_steps = 5;
var textures = {};

var default_shader_macros = {
        "N_SAMPLES": 4096,
    };

var $temp = {
    vec2 : vec2.create(),
    vec3 : vec3.create(),
    vec4 : vec4.create(),
    mat3 : mat3.create(),
    mat4 : mat4.create()
}

var push_msgs = 0, gui, _dt = 0.0
var current_em = "no current", last_em = "no previous";

function init()
{
    var now = getTime();
    scene = new RD.Scene();
    var context = GL.create({width: window.innerWidth, height: window.innerHeight});
        
    if(queries['samples'])
        default_shader_macros['N_SAMPLES'] = queries['samples'];
    
    renderer = new RD.Renderer(context, {
        autoload_assets: true
    });
    
    renderer.canvas.addEventListener("webglcontextlost", function(event) {
        event.preventDefault();
        console.error('Context lost');
    }, false);

    document.body.appendChild(renderer.canvas); //attach

    document.body.ondragover = function(){ return false;}
    document.body.ondragend = function(){ return false;}
    document.body.ondrop = function( e )
    {
        e.preventDefault();
        onDragDialog( e.dataTransfer.files[0] );
    }

    camera = new RD.Camera();
    camera.perspective( 45, gl.canvas.width / gl.canvas.height, 0.01, 10000);
    camera.lookAt( [0,2,5],[0,0,0],[0,1,0] );

    skybox = setSkybox( scene );
    model = new RD.SceneNode();
    model.name = "Model figure";
    model.render_priority = RD.PRIORITY_ALPHA;
    model.blend_mode = RD.BLEND_ALPHA;
    scene.root.addChild(model);

    // declare renderer uniforms
    renderer._uniforms["u_tonemapping"] = 2.0;
    renderer._uniforms["u_exposure"] = 0.0;
    renderer._uniforms["u_offset"] = 0.0;
    renderer._uniforms["u_channel"] = 0.0;
    renderer._uniforms["u_enable_ao"] = true;

    renderer._uniforms["u_light_intensity"] = 1.0;
    renderer._uniforms["u_light_position"] = vec3.fromValues(1, 1, 2);

    renderer._uniforms["u_light2_intensity"] = 1.0;
    renderer._uniforms["u_light2_position"] = vec3.fromValues(-1, 1, -2);

    light = new RD.SceneNode();
    light.visible = false;
    light.name = "light";
    light.color = [0, 0, 0];
    light.scaling = 0.05;
    light.mesh = "sphere";
    light.position = renderer._uniforms["u_light_position"];
    scene.root.addChild(light);

    light2 = new RD.SceneNode();
    light2.visible = false;
    light2.name = "light2";
    light2.color = [0, 0, 0];
    light2.scaling = 0.05;
    light2.mesh = "sphere";
    light2.position = renderer._uniforms["u_light2_position"];
    scene.root.addChild(light2);

    renderer._uniforms["u_near"] = camera.near;
    renderer._uniforms["u_far"] = camera.far;

    bg_color = vec4.fromValues(0.03,0.08,0.13,1);
    
    // initialize some global parameters 
    window.glow = false;
    window.iterations = 8;
    window.threshold = 10.0;
    window.intensity = 1.0;

    var url = "files.php";

    if(window.location.host.includes( "github" ))
        url = "https://api.github.com/repos/upf-gti/HDR4EU/contents/textures/sphere_maps";

    $.get(url, function(data){
       
        if(!window.location.host.includes( "github" ))
        {
            onInit( JSON.parse(data) );
            return;
        }

        // getting files from github
        var success = {};

        // Prepare data
        for(var i = 0; i < data.length; i++)
        {
            let name = replaceAll(data[i].name, '_', ' ');
            name = firstLetterUC(name);
            success[ name ] = data[i];
        }   

        onInit( success );
    }) ;

    // draw initial parameters
    params_gui = drawGUI();

    // Render FPS
    window.refresh_time = 250;
	window.last_fps = 0;
    window.last_time = 0;
    window.frames = 0;

    mySceneTex = new GL.Texture(2048,2048, { texture_type: GL.TEXTURE_2D, type: gl.FLOAT, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    glow_tex = null;

    renderer.context.ondraw = function()
    {
        renderer.clear(bg_color);
        gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
        skybox.position = camera.position;
        
        renderer.render(scene, camera);

        mySceneTex.drawTo(function(){
            renderer.clear(bg_color);
            gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
            renderer.render(scene, camera);
        });
        
        if(window.glow && renderer.shaders["glow"])
        {
            // apply glow
            glow_tex = getGlowTexture(mySceneTex, {
                iterations: window.iterations,
                threshold: window.threshold,
                intensity: window.intensity
            });
            // render applying gamma correction, exposure, tone mapping etc
            glow_tex.toViewport( renderer.shaders['fx'], renderer._uniforms );
        }

        else
        {
            mySceneTex.toViewport( renderer.shaders['fx'], renderer._uniforms );
        }

        renderFPS();
            
        last = now;
        now = getTime();
    }

    renderer.context.onupdate = function(dt)
    {
        _dt = dt;
        scene.update(dt);

        // update u_average_lum for tonemapping
        renderer._uniforms["u_average_lum"] = getAverage( window.average_texture );

        // Set scene params to params in GUI
        updateSceneFromGUI();
        // Update Bindings
        updateKeyBindings( dt );
    }

    renderer.context.animate();
    window.onresize = resize;

    // Set GUI bindings
    setKeyBindings();
    updateGUIBindings();
}

function onInit( data )
{
    // Save textures info for the GUI
    textures = data;
    showLoading();

    // Set brdf LUT
    renderer.loadShaders("data/shaders.glsl", function(){
        
        // Environment BRDF (LUT) when reloading shaders
        HDRTool.brdf( 'brdfIntegrator');
        model.textures['brdf'] = "_brdf_integrator";

        params_gui = drawGUI();

        let initScene = textures_folder + "galileo_probe.hdre";

        if(queries['scene'])
            initScene = textures_folder + queries['scene'];
        
        setScene( initScene );

    }, default_shader_macros);
}