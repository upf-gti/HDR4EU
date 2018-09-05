/*
*   Alex Rodríguez
*   @jxarco 
*/

/*
    Set bindings for GUI actions
*/
function setKeyBindings(ctx)
{
    ctx = ctx || renderer.context;

    ctx.captureKeys(true);
    ctx.onkeydown = function(e)
    {
        if(e.keyCode === 82)
        {
        renderer.loadShaders("data/shaders.glsl", function(){
            showMessage("Shaders reloaded");
        }, default_shader_macros); 
        }
    }
    ctx.captureMouse(true);
    ctx.onmousemove = function(e)
    {
        var mouse = [e.canvasx, gl.canvas.height - e.canvasy];
        if (e.dragging && e.leftButton) {
            camera.orbit(-e.deltax * _dt * 0.1, RD.UP,  camera._target);
            camera.orbit(-e.deltay * _dt * 0.1, camera._right, camera._target );
        }
        if (e.dragging && e.rightButton) {
            camera.moveLocal([-e.deltax * 0.1 * _dt, e.deltay * 0.1 * _dt, 0]);
        }
    }
    ctx.onmousewheel = function(e)
    {
        if(!e.wheel)
            return;

        let d = vec3.dist(camera.position, camera.target) * 3;
        let delta = e.wheel < 0 ? _dt * d : - _dt * d;

        // vec3.copy($temp.vec3, camera._target);
        camera.moveLocal( [0, 0, delta]);
        // vec3.copy( camera._target, $temp.vec3);
    }
}

/*
    Update bindings for GUI actions
*/
function updateKeyBindings(dt, ctx)
{
    ctx = ctx || renderer.context;

    if(ctx.keys["UP"] || ctx.keys["W"]){            camera.moveLocal([0,0,-dt * 10]);}
    else if(ctx.keys["DOWN"] || ctx.keys["S"]){     camera.moveLocal([0,0,dt * 10]);}

    if(ctx.keys["RIGHT"] || ctx.keys["D"]){         camera.moveLocal([dt * 10,0,0]);}
    else if(ctx.keys["LEFT"] || ctx.keys["A"]){     camera.moveLocal([dt * -10,0,0]);}
    
    if(ctx.keys["SPACE"]){                              camera.moveLocal([0,dt * 10,0]);}
    else if(ctx.keys["SHIFT"]){                         camera.moveLocal([0,dt * -10,0]);}
}

/*
    Update bindings for GUI actions
*/
function updateGUIBindings()
{
    gui.mesh.onFinishChange(function(){
        parseSceneFigure( params_gui['Mesh'] );
    });
    
    gui.scene_sm.onChange(function() {
        showMessage("Loading scene");
        var tex = textures[ params_gui['Scene'] ];
        setScene( tex.path, !tex.cubemap );
    });

    gui.channels.onChange(function(){
        renderer._uniforms["u_channel"] = gui.tmp["channels"].indexOf( params_gui['Channel'] );
    });

    gui.tonemapping.onChange(function(){
        renderer._uniforms["u_tonemapping"] = gui.tmp["tonemapping"].indexOf( params_gui['Tone mapping'] );
    });

    gui.cubemap.onChange(function(){
        skybox.flags.visible = params_gui['Draw skybox'];
    });

    gui.samples.onFinishChange(function(){
        
        var samples = parseInt(params_gui['PrefilteringSamples']);

        if(samples <= 0)
        throw("invalid number of samples");

        if(samples == default_shader_macros['N_SAMPLES'])
        return;

        default_shader_macros['N_SAMPLES'] = samples;
        renderer.loadShaders("data/shaders.glsl", function(){console.log("Samples changed")}, default_shader_macros);
    });

//    gui.show_texture.onFinishChange(function(){
//        showingTex = (params_gui['Show texture'] === '') ? false:true;
//    });
    
    /*
    gui.light.onChange(function(){
        let x = params_gui['Light color'][0]/255.0;
        let y = params_gui['Light color'][1]/255.0;
        let z = params_gui['Light color'][2]/255.0;
        gui.tmp["Light"] = vec3.fromValues( x, y, z);
    });

    gui.light_position.onFinishChange(function(){

        let a = params_gui['Light position'];
        let x = parseInt(a.trim().split(/\s+/)[0]);
        let y = parseInt(a.trim().split(/\s+/)[1]);
        let z = parseInt(a.trim().split(/\s+/)[2]);
        renderer._uniforms["u_light_position"] = vec3.fromValues(x, y, z);
        console.log(renderer._uniforms["u_light_position"]);
    });
    
    gui.light_intensity.onChange(function(){
        renderer._uniforms["u_light_intensity"] = params_gui['Light intensity'];
    });
    */
}

/*
    Update scene taking params stored in the GUI
*/
function updateSceneFromGUI()
{
    renderer._uniforms["u_exposure"] = params_gui['Exposure'];
    renderer._uniforms["u_offset"] = params_gui['Offset'];
    renderer._uniforms["u_albedo"] = vec3.fromValues( params_gui['Albedo'][0]/255.0, params_gui['Albedo'][1]/255.0,params_gui['Albedo'][2]/255.0);
    renderer._uniforms["u_light_color"] = gui.tmp["Light"];
    
    model._uniforms["u_roughness"] = params_gui['Roughness'];
    model._uniforms["u_metalness"] = params_gui['Metalness'];

    renderer._uniforms["u_enable_ao"] = params_gui['Apply AO'];

    window.glow = params_gui['Glow'];
    window.iterations = params_gui['Iterations'];
    window.threshold = params_gui['Threshold'];
    window.intensity = params_gui['Intensity'];
}