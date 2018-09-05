/*
*   Alex Rodríguez
*   @jxarco 
*/

/*
    
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
        'Roughness': 0,
        'Metalness': 0,
        'Channel': 'All',
        'Apply AO': renderer._uniforms["u_enable_ao"],
      
        'Light color': [0, 0, 0],
        'Light position': "2 2 2",
        'Light intensity': 1.0,

        'Draw skybox': true,
        'Tone mapping': 'Uncharted2',
        'Glow': window.glow,
        'Iterations': window.iterations,
        'Threshold': window.threshold,
        'Intensity': window.intensity,

        'Show FPS': true,
        'PrefilteringSamples': "" + default_shader_macros['N_SAMPLES'],

        'Reload shaders': function() {
            renderer.loadShaders("data/shaders.glsl", function(){
                showMessage("Shaders reloaded");
            }, default_shader_macros); 
        },
        'Get skybox': function() {
            var tex = rt[ current_em ];
            for(var i = 0; i < 6; i++)
                LiteGUI.downloadFile("EM"+(i+1)+".raw", tex.getPixels(i));
        }
    };

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
    gui.tonemapping = f_render.add( params_gui, 'Tone mapping', gui.tmp["tonemapping"]);
    f_render.add( params_gui, 'Apply AO' );
    gui.cubemap = f_render.add( params_gui, 'Draw skybox' );
    // Glow
    var f_glow = gui.addFolder( "FX" );
    gui.glow = f_glow.add( params_gui, 'Glow' );
    f_glow.add( params_gui, 'Iterations', 0, 16, 1 );
    f_glow.add( params_gui, 'Threshold', 0, 20, 0.01);
    f_glow.add( params_gui, 'Intensity', 1, 2, 0.01);
    // Direct light
    /* var f_light = gui.addFolder("Direct light");
    gui.light = f_light.addColor( params_gui, 'Light color');
    gui.light_position = f_light.add( params_gui, 'Light position');
    gui.light_intensity = f_light.add( params_gui, 'Light intensity', 1.0, 5.0, 0.1 );
    */ // Other
    var f_other = gui.addFolder("Other");
    f_other.add( params_gui, 'Reload shaders' );
    f_other.add( params_gui, 'Get skybox' );
    f_other.add( params_gui, 'Show FPS' );
    gui.samples = f_other.add( params_gui, 'PrefilteringSamples');
    // gui.show_texture = f_other.add( params_gui, 'Show texture');

    f1.open();

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
    
*/
function showMessage( text, duration )
{
  if(text == null)
    return;
  duration = duration || 3000;

  var id = "msg-"+(push_msgs++);

    var msg = `
        <div id="`+id+`" style="padding: 20px; margin: 35px; height: 60px; background-color: rgba(85, 85, 85, 0.75);">
			<p style="color: white; font-size: 16px; ">
				` + text + `
			</p>
		</div>
    `;

  $("#push").prepend( msg );

  setTimeout(function(){
    $("#"+id).fadeOut();
  }, duration);
}

function showLoading()
{
//   $("#modal").html(`
    
//     `);
  $("#modal").fadeIn();
}

function removeLoading()
{
    $("#progress").css("width", "0%");
    $("#modal").fadeOut();
};

var q = removeLoading;

/*
    
*/
function onDragDialog( id, options )
{   
    id = id || "EXR Loader"
    options = options || {};
    
    var dialog_id = id.replace(" ", "-").toLowerCase();
    // remove old dialogs
    if( document.getElementById( dialog_id ) )
        $("#"+dialog_id).remove();
        
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, close: true, width: w, scroll: true, draggable: true });
    dialog.show('fade');

    var widgets = new LiteGUI.Inspector();
    
    window._vars_dialog = {
        data: options.data,
        filename: options.filename,
        to_cubemap: true,
        show_texture: false,
        gen_cubemap_size: 512
    };

    widgets.on_refresh = function(){

        widgets.clear();

        widgets.addSection("Texture");
        widgets.addString( "File", options.filename );
        widgets.addCheckbox( "Convert to cube map", true,{name_width: "33.33%", callback: function(v) {      
            window._vars_dialog["to_cubemap"] = v;
        }});
        widgets.addCombo( "Cubemap size", "512",{values: ["64","128","256","512","1024"], name_width: "33.33%", callback: function(v) {      
            window._vars_dialog["gen_cubemap_size"] = parseInt(v);
        }});
        widgets.addSeparator();
        widgets.addButton( null, "Load", {width: "100%", name_width: "50%", callback: function(){
            $("#"+dialog_id).remove();
            showMessage("Processing scene...");
            loadEXRTexture(options.filename, window._vars_dialog, function(){
                setScene( options.filename, true );
            });
        }});
    }

    widgets.on_refresh();
    dialog.add(widgets);  
    var w = 400;
    dialog.setPosition( renderer.canvas.width/2 - w/2, renderer.canvas.height/2 - renderer.canvas.height/4 );
}

