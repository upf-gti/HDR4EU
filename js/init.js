/*
*   Alex Rodríguez
*   @jxarco 
*/

var LOAD_STEPS = 0;
var STEPS = 1;
var textures = {};

var default_shader_macros = {
        "N_SAMPLES": 2048,
    },
    irradiance_mode = EXRLoader.SAMPLING;

var $temp = {
    vec2 : vec2.create(),
    vec3 : vec3.create(),
    vec4 : vec4.create(),
    mat3 : mat3.create(),
    mat4 : mat4.create()
}

var loader = new EXRLoader();

var push_msgs = 0;

// save all buffer files to avoid reading twice
var tmp = {};
var _dt = 0.0;
var showingTex = false;

var t1, t2, t;
var current_em = "";
var current_figure = "";

function init()
{
    var last = now = getTime();
    scene = new RD.Scene();
    var context = GL.create({width: window.innerWidth, height: window.innerHeight});
    
    var queries = getQueryString();
    
    if(queries['samples'])
        default_shader_macros['N_SAMPLES'] = queries['samples'];
    
    renderer = new RD.Renderer(context, {
        autoload_assets: true
    });
    
    rt = renderer.textures; 

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
        
        var file = e.dataTransfer.files[0],
            name = file.name;

        var reader = new FileReader();
        reader.onload = function (event) {
            var data = event.target.result;
            var options = {
                filename: name,
                data: data
            }
            onDragDialog( null, options );
        };

        reader.readAsArrayBuffer(file);
        return false;
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
    renderer._uniforms["u_light_position"] = vec3.fromValues(2, 2, 2);

    renderer._uniforms["u_near"] = camera.near;
    renderer._uniforms["u_far"] = camera.far;

    bg_color = vec4.fromValues(0.03,0.08,0.13,1);
    
    // initialize some global parameters 
    window.glow = true;
    window.iterations = 8;
    window.threshold = 10.0;
    window.intensity = 1.0;

    // get response from files.php
    $.get("files.php", function(data){
       
        onInit(JSON.parse(data));
    }) 

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

        // show any texture asked in gui
        if(showingTex && gl.textures[params_gui['Show texture']])
        {
            gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

            let tex_name = params_gui['Show texture'],
                shader = window.show_shader || null,
                uniforms = window.show_shader_uniforms || null;

            gl.textures[tex_name].toViewport(shader, uniforms);
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
    // save here for the gui
    textures = data;
    showLoading();

    setTimeout(function(){
        Integrate_BRDF_EM(); // Environment BRDF (LUT)

        for(var t in data)
        {
            if(data[t].fast)
                loadEXRTexture( data[t].path, null, isReady );
        }
    
        // update gui
        gui.destroy();
        params_gui = drawGUI();
    }, 500);
}

function isReady()
{
    LOAD_STEPS++;
    $("#progress").css("width", ((LOAD_STEPS/STEPS)*100 + "%") );

    if(STEPS && LOAD_STEPS === STEPS)
    {
        parseSceneFigure( "Roughness scale" );
        setScene( "textures/eucalyptus_grove_spheremap.exr", true );
    }

    if(true)
    {
        gui.updateDisplay();
        gui.domElement.style.display = "block";
        removeLoading();
    }
}

