/*
*   Alex RodrÃ­guez
*   @jxarco 
*/

var LOAD_STEPS = 0;
var STEPS = 1;
var textures = {};

var default_shader_macros = {
        "N_SAMPLES": 2048,
    };

var $temp = {
    vec2 : vec2.create(),
    vec3 : vec3.create(),
    vec4 : vec4.create(),
    mat3 : mat3.create(),
    mat4 : mat4.create()
}

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

    renderer._uniforms["u_light_intensity"] = 1.0;
    renderer._uniforms["u_light_position"] = vec3.fromValues(1, 1, 2);

    light = new RD.SceneNode();
    light.visible = false;
    light.name = "light";
    light.color = [0, 0, 0];
    light.scaling = 0.05;
    light.mesh = "sphere";
    light.position = renderer._uniforms["u_light_position"];
    scene.root.addChild(light);

    renderer._uniforms["u_near"] = camera.near;
    renderer._uniforms["u_far"] = camera.far;

    bg_color = vec4.fromValues(0.03,0.08,0.13,1);
    
    // initialize some global parameters 
    window.glow = true;
    window.iterations = 8;
    window.threshold = 10.0;
    window.intensity = 1.0;

    // get response from files.php
    $.get("files.php", function(data, response){
       
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

    renderer.loadShaders("data/shaders.glsl", function(){
        
        // Environment BRDF (LUT) when reloading shaders
        EXRTool.brdf( 'brdfIntegrator');
        model.textures['brdf'] = "_brdf_integrator";

    }, default_shader_macros);
     

    for(var t in data)
    {
        if(data[t].fast)
            EXRTool.load( data[t].path, null, isReady );
    }

    // update gui
    gui.destroy();
    params_gui = drawGUI();
}

function isReady()
{
    LOAD_STEPS++;

    if(STEPS && LOAD_STEPS === STEPS)
    {
        parseSceneFigure( "Sphere" );
        setScene( "textures/eucalyptus_grove_spheremap.exr", true );
        gui.updateDisplay();
        gui.domElement.style.display = "block";
    }
}

function getQueryString() {
    // This function is anonymous, is executed immediately and 
    // the return value is assigned to QueryString!
    var query_string = {};
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i=0;i<vars.length;i++) {
      var pair = vars[i].split("=");
          // If first entry with this name
      if (typeof query_string[pair[0]] === "undefined") {
        query_string[pair[0]] = decodeURIComponent(pair[1]);
          // If second entry with this name
      } else if (typeof query_string[pair[0]] === "string") {
        var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
        query_string[pair[0]] = arr;
          // If third or later entry with this name
      } else {
        query_string[pair[0]].push(decodeURIComponent(pair[1]));
      }
    } 
      return query_string;
  }
  
  function sleep(milliseconds) {
      var start = new Date().getTime();
      for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds){
          break;
        }
      }
  }
