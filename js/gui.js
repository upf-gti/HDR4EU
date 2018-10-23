/*
*   Alex Rodri­guez
*   @jxarco 
*/

function drawGUI()
{
    var params_gui = {

        'Exposure': renderer._uniforms["u_exposure"],
        'Offset': renderer._uniforms["u_offset"],

        'Show texture': "Write tex name",

        'Mesh': "",
        'Scene': "",

        'Albedo': [255, 255, 255],
        'Roughness': 0.25,
        'Metalness': 0.5,
        'Channel': 'All',
        'Apply AO': renderer._uniforms["u_enable_ao"],
      
        'Light color': [0, 0, 0],
        'Light X': 1,
        'Light Y': 1,
        'Light Z': 2,
        'Light intensity': renderer._uniforms["u_light_intensity"],

        'Disable IBL': false,
        'Draw skybox': true,
        'Draw light': false,
        'Tone mapping': 'Uncharted2',
        'Glow': window.glow,
        'Iterations': window.iterations,
        'Threshold': window.threshold,
        'Intensity': window.intensity,

        'Show FPS': true,
        'PrefilteringSamples': "" + default_shader_macros['N_SAMPLES'],

        'Reload shaders': () =>
            renderer.loadShaders("data/shaders.glsl", function(){
                showMessage("Shaders reloaded");
            }, default_shader_macros),
            
        'Get skybox': () => HDRTool.getSkybox(current_em),
    };

    if(gui)
        gui.destroy();

    gui = new dat.GUI();
    gui.domElement.style.display = "none";
    gui.tmp = {};
    
    gui.tmp["channels"] = ["All", "Diffuse", "Specular", "Roughness", "Metalness", "AO", "Opacity"];
    gui.tmp["tonemapping"] = ["None", "Reinhard", "Uncharted2"];

    // Scene folder
    var f1 = gui.addFolder("Scene");
    gui.scene_sm = f1.add( params_gui, 'Scene', getTextures());
    gui.mesh = f1.add( params_gui, 'Mesh', getScenes());
    gui.channels = f1.add( params_gui, 'Channel', gui.tmp["channels"] );
    // Debug sphere
    gui.f2 = gui.addFolder("Sphere PBR");
    gui.f2.add( params_gui, 'Roughness', 0, 1, 0.01);
    gui.f2.add( params_gui, 'Metalness', 0, 1, 0.01);
    // HDR options
    var f_render = gui.addFolder("Render");
    f_render.addColor( params_gui, 'Albedo');
    f_render.add( params_gui, 'Exposure', -10, 10, 0.01 );
    f_render.add( params_gui, 'Offset', -0.5, 0.5, 0.001 );
    f_render.add( params_gui, 'Disable IBL');
    gui.tonemapping = f_render.add( params_gui, 'Tone mapping', gui.tmp["tonemapping"]);
    f_render.add( params_gui, 'Apply AO' );
    gui.cubemap = f_render.add( params_gui, 'Draw skybox' );
    gui.draw_light = f_render.add( params_gui, 'Draw light' );
    // Glow
    var f_glow = gui.addFolder( "FX" );
    gui.glow = f_glow.add( params_gui, 'Glow' );
    f_glow.add( params_gui, 'Iterations', 0, 16, 1 );
    f_glow.add( params_gui, 'Threshold', 0, 20, 0.01);
    f_glow.add( params_gui, 'Intensity', 1, 2, 0.01);
    // Direct light
    var f_light = gui.addFolder("Direct light");
    gui.light = f_light.addColor( params_gui, 'Light color');
    gui.light_position_x = f_light.add( params_gui, 'Light X', -15, 15.0, 0.1 );
    gui.light_position_y = f_light.add( params_gui, 'Light Y', -15, 15.0, 0.1 );
    gui.light_position_z = f_light.add( params_gui, 'Light Z', -15, 15.0, 0.1 );
    gui.light_intensity = f_light.add( params_gui, 'Light intensity', 1.0, 50.0, 0.5 );
    // Other
    var f_other = gui.addFolder("Other");
    f_other.add( params_gui, 'Reload shaders' );
    f_other.add( params_gui, 'Get skybox' );
    f_other.add( params_gui, 'Show FPS' );
    gui.samples = f_other.add( params_gui, 'PrefilteringSamples');

    f1.open();
    f_light.open(); f_glow.open();

    updateGUIBindings();
    return params_gui;
}

function getScenes()
{
    var l = [];
    for(var t in scenes)
        l.push(t);
    return l;
}

function getTextures()
{
    var l = [];
    for(var t in textures)
        l.push(t);
    return l;
}

/*
    Update div with fps counter
*/
function renderFPS( enable )
{
    var e = (enable == null) ? params_gui['Show FPS'] : enable;
    var now = getTime();
	var elapsed = now - window.last_time;

	window.frames++;

	if(elapsed > window.refresh_time)
	{
        window.last_fps = window.frames;
        $("#fps").html( window.last_fps * (1000 / window.refresh_time) + " FPS");
		window.frames = 0;
        window.last_time = now;
    }
    
    if(e)
        $("#fps").show();
    else
        $("#fps").hide();
}

/*
    
*/
function showMessage( text, duration )
{
    if(text == null)
        return;
    duration = duration || 3000;

    var id = "msg-"+(push_msgs++);

        var msg = `
            <div class="pushmessage" id="`+id+`">
                <p>` + text + `</p>
            </div>
        `;

    $("#push").prepend( msg );

    setTimeout(function(){
        $("#"+id).slideUp();
    }, duration);
}

function showLoading()
{
    $("#modal").fadeIn();
}

function removeLoading(oncomplete)
{
    $("#modal").fadeOut( 400, oncomplete );
};

/*
    
*/
function onDragDialog( file )
{   
    var filename = file.name;

    var id = "EXR Loader"
    var dialog_id = id.replace(" ", "-").toLowerCase();
        
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, close: true, width: w, scroll: true, draggable: true });
    dialog.show('fade');

    var widgets = new LiteGUI.Inspector();

    var params = {
        filename: filename,
        size: 256
    };

    widgets.on_refresh = function(){

        widgets.clear();

        widgets.addSection("Texture");
        widgets.addString( "File", filename );
        if( !filename.includes('hdre') )
        {
            widgets.addCombo( "Cubemap size", "256",{values: ["64","128","256","512","1024"], name_width: "33.33%", callback: function(v) {      
                params["size"] = parseInt(v);
            }});
        }
        
        widgets.addSeparator();
        widgets.addButton( null, "Load", {width: "100%", name_width: "50%", callback: function(){
            
            $("#"+dialog_id).remove();

            showLoading();

            var reader = new FileReader();
            reader.onprogress = (e) =>  $("#xhr-load").css("width", parseFloat( (e.loaded)/e.total * 100 ) + "%");
            reader.onload = function (event) {

                var data = event.target.result;
                var oncomplete = (() => setScene( filename ));
                
                params['data'] = data;
                params['oncomplete'] = oncomplete;

                if(filename.includes(".exr"))
                    HDRTool.prefilter( filename, params);     
                else
                    HDRTool.load( filename, params); 
            };
    
            reader.readAsArrayBuffer(file);
            return false;
        }});
    }

    widgets.on_refresh();
    dialog.add(widgets);  
    var w = 400;
    dialog.setPosition( renderer.canvas.width/2 - w/2, renderer.canvas.height/2 - renderer.canvas.height/4 );
}


