/*
*   Alex Rodriguez
*   @jxarco 
*/

/**
* Responsible of the GUI
* @class GUI
* @constructor
*/
function GUI()
{
    if(this.constructor !== GUI)
        throw("Use new to create GUI");
    
    this._ctor();
}

GUI.prototype._ctor = function()
{
    // FPS
    this._fps_enable = true;
    this._fps = 0;
    this._refresh_time = 250;
    this._last_fps = 0;
    this._last_time = 0;
    this._frames = 0;

    this._mainarea = null;

    // other properties
    this._allow_drop = true;
    this._enable_log = false;
    this._color_picker = true;
}

/**
 * Initialize gui and split areas
 * @method init
 */
GUI.prototype.init = function()
{
    LiteGUI.init(); 

    var log = document.createElement('div');
    log.id = "log";
	document.body.appendChild(log);

    var mainmenu = new LiteGUI.Menubar("mainmenubar");
    LiteGUI.add( mainmenu );

    this._mainarea = new LiteGUI.Area({id: "mainarea", content_id:"canvasarea", height: "calc( 100% - 26px )", main:true});
    LiteGUI.add( this._mainarea );

    var that = this;

    var canvas = renderer.canvas;
    this._mainarea.onresize = resize;
    this._mainarea.content.appendChild(canvas);
    
    var push = document.createElement('div');
    push.id = "push";
    push.style.position = "absolute";

    this._mainarea.content.appendChild(push);

    // create 2d canvas 

    var canvas = document.createElement("canvas");
    canvas.style.position = "relative";
    canvas.style.width = "60px";
    canvas.style.height = "30px";
    this._mainarea.content.appendChild(canvas);
    canvas.style.position = "absolute";
    canvas.style.bottom = "10px";
    // canvas.style.borderBottom = "2px solid  rgb(30, 211, 111)";

    // create variable visualzation canvas

    var canvas2 = document.createElement("canvas");
    canvas2.style.position = "relative";
    canvas2.style.border = "2px solid  rgb(30, 211, 111)";
    canvas2.style.width = "100px";
    canvas2.style.height = "50px";
    // this._mainarea.content.appendChild(canvas2);
    canvas2.style.position = "absolute";
    canvas2.style.bottom = "100px";
    
    this._canvas2d = canvas;

    //split mainarea
    this.createSidePanel();

    var that = this;

    mainmenu.add("File/Save scene", { callback: function() { that.onExport() } });
    mainmenu.add("File/Load scene/From file", { callback: function() { that.onImport() } });
    mainmenu.add("File/Load scene/From server", { callback: function() { 
        $.get("php/saved_scenes.php", function(data){ that.onImportFromServer(data)  });
    } });

    mainmenu.add("File/Preferences/Allow drop", { type: "checkbox", instance: this, property: "_allow_drop"});

    var scenes = RM.scenes;

    for(let s in scenes)
        mainmenu.add("Scene/Shade Model/" + scenes[s].name, { callback: function() {
            CORE.parse( scenes[s].name );
            gui.updateSidePanel(null, scenes[s].name );
        }});

    mainmenu.add("Scene/Add Primitive/Sphere", { callback: function() { CORE.addPrimitive('sphere'); } });
    mainmenu.add("Scene/Add Primitive/Plane", { callback: function() { CORE.addPrimitive('plane'); } });
    mainmenu.add("Scene/Add Primitive/Cube", { callback: function() { CORE.addPrimitive('cube'); } });
    mainmenu.add("Scene/Add Light", { callback: function() { CORE.addLight(); } });

    for(let i = 0; i < 5; i++)
        mainmenu.add("View/PREM/Level "+i, { callback: function() {
            var env = CORE._environment;
            CORE.cubemap.texture = '_prem_' + i + '_' + env;
        }});
    
    mainmenu.add("View/SSAO Noise tex", { callback: function() {
            var node = CORE.addPrimitive('plane');
            node.shader = "textured";
            node.textures['albedo'] = "ssao_noise";
        }});
    mainmenu.separator("View");     
    mainmenu.add("View/FPS counter", { type: "checkbox", instance: this, property: "_fps_enable", callback: function() { 
        if(!that._fps_enable) that.closeFPS();
        else that._canvas2d.style.display = "block";
    }});
    mainmenu.add("View/Color picker", { type: "checkbox", instance: this, property: "_color_picker", callback: function() { 
        if(!that._color_picker) document.querySelector(".pixelPicker").style.display = 'none';
        else document.querySelector(".pixelPicker").style.display = 'block';
    }});
    mainmenu.add("View/Log", { type: "checkbox", instance: this, property: "_enable_log", callback: function(){ 
        $("#log").toggle();
    }});
    mainmenu.separator("View");    
    mainmenu.add("View/Fullscreen", { callback: function() { gl.fullscreen() } });

    mainmenu.add("Actions/Reset scene", { callback: function() { 
        CORE.reset();
        that.updateSidePanel(that._sidepanel, 'root');
    }});
    mainmenu.add("Actions/Reload shaders", { callback: function() { CORE.reloadShaders() } });
    mainmenu.separator("Actions");    
    mainmenu.add("Actions/Get Environment/HDRE (8 bits)", { callback: function() { HDRTool.getSkybox( CORE._environment, GL.UNSIGNED_BYTE ) } });
    mainmenu.add("Actions/Get Environment/HDRE (32 bits)", { callback: function() { HDRTool.getSkybox( CORE._environment, GL.FLOAT ) } });
    mainmenu.add("Actions/Get Mesh (wBin)", { callback: function() {
        var picker = RM.get('NodePicker');
        var node = picker ? picker.selected : null;
        if(!node)
        return;
        var mesh = gl.meshes[ node.mesh ];
        downloadBinary( mesh, "wbin" );
    } });

    mainmenu.add("Help/Version", { callback: function() { LiteGUI.showMessage("APP v" + RM.version, {title: "App Info"}) } });
    mainmenu.add("Help/Github page", { callback: function() { LiteGUI.showMessage("<a href='https://github.com/jxarco'>@jxarco</a>", {title: "App Info"}) } });
    mainmenu.add("Help/Other demos", { callback: function() { LiteGUI.showMessage("<a href='https://webglstudio.org/users/arodriguez/demos/atmos'>Atmospherical scattering</a><br>"+
    "<a href='https://webglstudio.org/latest/player.html?url=fileserver%2Ffiles%2Farodriguez%2Fprojects%2FHDR4EU%2Fgreen.scene.json'>Chroma Keying</a><br>", {title: "App Info"}) } });
    
    resize();
}

GUI.prototype.createSidePanel = function()
{
    this._mainarea.split("horizontal",[null,350],true);
    var docked = new LiteGUI.Panel("right_panel", {title:'Scene nodes', scroll: true});
    this._mainarea.getSection(1).add( docked );
    $(docked).bind("closed", function() { this._mainarea.merge(); });
    this._sidepanel = docked;

    this.updateSidePanel( docked, 'root' );
}

GUI.prototype.updateSidePanel = function( root, item_selected )
{
    if(!item_selected)
    return;
    root = root || this._sidepanel;
    $(root.content).empty();
    
    var mytree = this.updateNodeTree(scene.root);

    var litetree = new LiteGUI.Tree(mytree, {id: "tree", allow_rename:true});

    var that = this;

    litetree.root.addEventListener('item_selected', function(e){
        e.preventDefault();
        that.updateSidePanel( that._sidepanel, e.detail.data.id );
    });

    litetree.root.addEventListener("item_dblclicked", function(e){
        e.preventDefault();
        
    });

    $(root.content).append( litetree.root );

    //side panel widget
    var widgets = new LiteGUI.Inspector();
    $(root.content).append(widgets.root);

    var k = 0;
    for(var node in scene.root.children) if(scene.root.children[k].name == 'lines') continue; else k++; 
    widgets.root.style.height = "calc( 100% - " + k * 25 + "px )";
    
    var camera = CORE.controller._camera, skybox = CORE.cubemap;
    var SFXComponent = RM.get('ScreenFX');
    var RenderComponent = RM.get('Render');
    var AtmosComponent = RM.get('Atmos');

    if(item_selected == 'root')
    {
        var current_env = CORE._environment_set || {};

        widgets.addSection("Skybox");
        widgets.addList("Environment", RM.textures, {selected: current_env, height: "125px", callback: function(v){
            gui.loading();
            CORE.set( v);
        }});
        widgets.widgets_per_row = 1;
        widgets.addSeparator();
        widgets.addTitle("Properties");
        widgets.addNumber("Rotation", renderer._uniforms["u_rotation"], {min:-720*DEG2RAD,max:720*DEG2RAD,step:0.05, callback: function(v){ CORE.setUniform("rotation",v);}});
        widgets.addCheckbox("Visible", skybox.flags.visible, {callback: function(v) { skybox.visible = v}});
        widgets.addSeparator();
        
        // Atmos Component
        if(AtmosComponent && AtmosComponent.create)
            AtmosComponent.create( widgets, root );

        widgets.addSection("Controller");

        widgets.addVector3("Position",  camera.position, {callback: function(v){
            camera.position = v;
        }});
        widgets.addVector3("Target", camera.target, {callback: function(v){
            camera.target = v;
        }});
        widgets.addSeparator();
        widgets.widgets_per_row = 2;
        widgets.addNumber("Near", camera.near, {min:0, callback: function(v){
            camera.near = v;
        }});
        widgets.addNumber("Far", camera.far, {min:100, callback: function(v){
            camera.far = v;
        }});
        widgets.addSeparator();
        widgets.addButton(null, "Get current", {callback: function() { that.updateSidePanel(that._sidepanel, 'root')}});

        widgets.widgets_per_row = 1;
        widgets.addSeparator();
        widgets.addSlider("Mouse Speed", CORE.controller._mouse_speed, {min: 0.01, max: 1, step: 0.01, callback: function(v){
            CORE.controller._mouse_speed = v;
            CORE.controller.setBindings(renderer.context);
        }});
        /*widgets.addSlider("Wheel Speed", CORE.controller._wheel_speed, {min: 0.1, max: 1, step: 0.05, callback: function(v){
            CORE.controller._wheel_speed = v;
            CORE.controller.setBindings(renderer.context);
        }});*/
        
        // Render Component
        if(RenderComponent && RenderComponent.create)
            RenderComponent.create( widgets, root );

        // Screen FX Component
        if(SFXComponent && SFXComponent.create)
            SFXComponent.create( widgets, root );

    }
    else if(item_selected == 'light')
    {
        var LightComponent = RM.get('Light');
        LightComponent.create( widgets );
    }
    
    else if(item_selected.includes("scale") || item_selected.includes("matrix"))
    {
        var node = CORE.getByName(item_selected);
		var first_child = node.children[0];

		// update rotations
        node.rots = node.rots ? node.rots : vec3.create();

        widgets.addSection("Transform");
        widgets.addVector3("Position", node.position, {callback: function(v){ node.position = v; }});
		widgets.addVector3("Rotation", node.rots, {callback: function(v){ 
            
            var dt = vec3.create();
            dt = vec3.sub(dt, node.rots, v);

            node.rots = v;

            node.rotate(dt[0] * DEG2RAD, RD.LEFT);
            node.rotate(dt[1] * DEG2RAD, RD.UP);
            node.rotate(dt[2] * DEG2RAD, RD.FRONT);

        }});
        widgets.addNumber("Uniform scale", node.scaling[0], {min: 0.1, callback: function(v){ node.scaling = v; }});
		widgets.addSection("Shader");
        widgets.addList(null, ["flat", "phong","pbr", "pbr_deferred"], {selected: first_child.shader, callback: function(v){ 
			for(var i in node.children)
				node.children[i].shader = v;
		}})
        widgets.addSection("Properties");
        widgets.addColor("Base color", renderer._uniforms["u_albedo"], {callback: function(color){ 
			CORE.setUniform('albedo', color);
			for(var i in node.children)
				node.children[i].uniforms['u_color'] = color;
		}});
    }
    else if(item_selected.includes("-")) // is a primitive uid
    {
        var node = CORE.getByName(item_selected);
        
        // update rotations
        node.rots = node.rots ? node.rots : vec3.create();

        widgets.addTitle(node.mesh);
        widgets.addSection("Transform");
        widgets.addVector3("Position", node.position, {callback: function(v){ node.position = v; }});
        widgets.addVector3("Rotation", node.rots, {callback: function(v){ 
            
            var dt = vec3.create();
            dt = vec3.sub(dt, node.rots, v);

            node.rots = v;

            node.rotate(dt[0] * DEG2RAD, RD.LEFT);
            node.rotate(dt[1] * DEG2RAD, RD.UP);
            node.rotate(dt[2] * DEG2RAD, RD.FRONT);

        }});
        widgets.addNumber("Uniform scale", node.scaling[0], {step: 0.01, min: 0.1, callback: function(v){ node.scaling = v; }});
        widgets.addButton(null, "Set camera", {callback: function() {

            var bb = gl.meshes[node.mesh].getBoundingBox();
            var center = BBox.getCenter(bb);
            var radius = BBox.getRadius(bb);

            var globalMat = node.getGlobalMatrix();
            var result = vec3.create();
            vec3.transformMat4( result, center, globalMat );

            CORE.controller._camera.lookAt([ 0, radius * 0.5, radius * 2.5 ], result, RD.UP);
        }});
        widgets.addSection("Shader");
        widgets.addList(null, ["flat", "phong", "textured", "pbr", "pbr_deferred"], {selected: node.shader,callback: function(v){ 
			node.shader = v;

			if(v === 'textured' && !node.textures['albedo']) {
				node.textures['albedo'] = 'white';
				that.updateSidePanel(null, node.name);
			}
				
		}})
        this.addMaterial(widgets, node);
    }

    // update scroll position
    root.content.getElementsByClassName("inspector")[0].scrollTop = window.last_scroll || 0;
    window.last_scroll = 0;
}

GUI.prototype.addMaterial = function(inspector, node)
{
    // Parent node is abstract
    if(node.children.length)
    node = node.children[0];

    inspector.addSection("Material");
    inspector.addTitle("Basic properties");
    inspector.addColor("Base color", node._uniforms["u_albedo"], {callback: function(color){ node._uniforms["u_albedo"] = node._uniforms["u_color"] = color; }});
    inspector.addSlider("Roughness", node._uniforms['u_roughness'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_roughness'] = v }});
    inspector.addSlider("Metalness", node._uniforms['u_metalness'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_metalness'] = v }});
	inspector.addSeparator();
    inspector.addNumber("Reflectance", node._uniforms['u_reflectance'] ,{name_width: "50%", min:0,max:1,step:0.01, callback: function(v){ node._uniforms['u_reflectance'] = v }});
	inspector.addTitle("Clear Coat (Multi-Layer materials)");
	inspector.widgets_per_row = 2;
	inspector.addSlider("Clear coat", node._uniforms['u_clearCoat'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_clearCoat'] = v }});
	inspector.addSlider("Roughness", node._uniforms['u_clearCoatRoughness'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_clearCoatRoughness'] = v }});
	inspector.widgets_per_row = 1;
    inspector.addTitle("Textures")
    inspector.addNumber("Bump scale", node._uniforms['u_bumpScale'],{name_width: "50%", min:0,max:5,step:0.01, callback: function(v){ node._uniforms['u_bumpScale'] = v }});
    inspector.addNumber("Emissive scale", node._uniforms['u_emissiveScale'],{name_width: "50%", min:0,max:100,step:0.05, callback: function(v){ node._uniforms['u_emissiveScale'] = v }});
    //inspector.addSeparator();

    var that = this;

    const filtered = Object.keys(node.textures)
        .filter(function(key){ return !key.includes("env") && !key.includes("brdf") })
        .reduce(function(obj, key){
            obj[key] = node.textures[key];
            return obj;
        }, {});


    inspector.widgets_per_row = 3;

    // OJO CON ESTE
    for(let t in filtered) {
        inspector.addString( t, node.textures[t], {width: "80%", callback: function(v){

			if(gl.textures[v])
				node.textures[t] = v;
			else
				node.textures[t] = "";

			node.setTextureProperties(); 
		}});
        inspector.addButton( null, '<i data-texture='+ t +' style="font-size: 16px;" class="material-icons">delete_forever</i>', {micro: true, width: "10%", callback: function(v) { 

            var t = $(v).data('texture');

            delete gl.textures[ node.textures[t] ]; 
            delete node.textures[t]; 
            node.setTextureProperties();              
            that.updateSidePanel(null, node.name);
        }});
		inspector.addButton( null, '<i data-texture='+ t +' style="font-size: 16px;" class="material-icons">folder_open</i>', {micro: true, width: "10%", callback: function(v) { 

            that.selectResource( node, t );
			
        }});
    }

	inspector.widgets_per_row = 1;
	inspector.addSeparator();
	inspector.addString("Add", "", {callback: function(v) {
			
			node.textures[v] = ""; 
            node.setTextureProperties(); 
			that.updateSidePanel(null, node.name);
        }});
	
}

GUI.prototype.updateNodeTree = function(root)
{
    var mytree = {'id': "root"};
    var children = [];

    for(var i = 1; i < root.children.length; i++)
    {
        var node = root.children[i];
        var child = {};
        if(node.name == "lines") continue;
        child['id'] = node.name;
        if(node.children.length)
        {
            var children_ = [];

            for(var j = 0; j < node.children.length; j++)
            {
                var node_ = node.children[j];
                var child_ = {};
                child_['id'] = node_.name;
                children_.push(child_);
            }

            // child['children'] = children_;
        }

        children.push(child);
    }

    mytree['children'] = children;
    return mytree;
}

/**
 * Export scene dialog
 * @method onExport
 */
GUI.prototype.onExport = function()
{
    const isInServer = Object.keys(RM.textures).filter(function(key){ return RM.textures[key].path.includes( CORE._environment )}).length;

    // is not in server
    if(!isInServer) {
        LiteGUI.alert("Files not in server");
        return;
    }

	var boo;

	try
	{
		boo = CORE.toJSON();
		boo = JSON.stringify(boo);
	}
	catch (e)
	{
		console.error("Error creating json", e);
		LiteGUI.alert("Something went wrong");
		return;
	}

    var inner = function(v) {
        var data = "text/json;charset=utf-8," + encodeURIComponent(boo);
        var element = document.createElement('a');
        element.href = 'data:' + data;
        element.download = v !== "" ? v+'.json' : 'scene-'+getDate()+'.json';
        element.style.display = 'none';
        $(document.body).append(element);
        element.click();
    };

    LiteGUI.prompt("Save as:", inner, {title: "Save scene", width: 270});
}

/**
 * Import scene dialog
 * @method onImport
 * @param {File} file
 */
GUI.prototype.onImport = function(file)
{
    var id = "Load scene"
    var dialog_id = id.replace(" ", "-").toLowerCase();
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');
    dialog.makeModal('fade');
    var widgets = new LiteGUI.Inspector();

    var json = null;
    var only_settings = false;

    widgets.on_refresh = function(){

        widgets.clear();
        if(!file) {
            widgets.addFile( "Scene", "", {callback: function(v){ json = v }});
            widgets.addSeparator();
        }else
            widgets.addTitle( file.name );
        widgets.widgets_per_row = 2;
        widgets.addCheckbox("Only settings", only_settings, {width: "65%", name_width: "50%", callback: function(v){only_settings = v}});
        widgets.addButton( null, "Import all scene", {width: "35%", callback: function() {
            
            if(!json && !file) 
                return;
            var reader = new FileReader();
            reader.onload = function (e) {
                // gui
                $('#'+dialog_id).remove();
                LiteGUI.showModalBackground(false);
                //
                var res = JSON.parse(e.target.result);
                CORE.fromJSON(res, only_settings);
            };
            reader.readAsText(file ? file : json.file);
            return false;
        } });

    }

    widgets.on_refresh();
    dialog.add(widgets);  
    var w = 400;
    dialog.setPosition( window.innerWidth/2 - w/2, window.innerHeight/2 - 50 );       
}

/**
 * Import scene from server dialogg
 * @method onImportFromServer
 * @param {File} file
 */
GUI.prototype.onImportFromServer = function(data)
{
	if(!data.length){
		LiteGUI.alert("No scenes saved");
		return;
	}

    var id = "Load scene from server";
    var dialog_id = id.replace(" ", "-").toLowerCase();
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');
    dialog.makeModal('fade');
    var widgets = new LiteGUI.Inspector();

    var saved_scenes = JSON.parse(data);
	var key0 = Object.keys(saved_scenes)[0];
    var selected = saved_scenes[key0];

    widgets.on_refresh = function(){

        widgets.clear();
		widgets.widgets_per_row = 2;
        widgets.addList( null, saved_scenes, {selected: selected, callback: function(v) {
            selected = v;
			widgets.on_refresh();
        } });
		var text = selected ? selected.size : "";
		text += " KB";
		widgets.addInfo( "File size", text);

        widgets.addButton( null, "Load", {callback: function() {

            if(!selected)
                return;
            // gui
            $('#'+dialog_id).remove();
            LiteGUI.showModalBackground(false);
            //
            CORE.fromJSON( selected.data );
        } });
		widgets.widgets_per_row = 1;

    }

    widgets.on_refresh();
    dialog.add(widgets);  
    var w = 400;
    dialog.setPosition( window.innerWidth/2 - w/2, window.innerHeight/2 - 50 );       
}

/**
 * Renders some GUI things
 * @method render
 */
GUI.prototype.render = function()
{
    if(this._canvas2d && this._fps_enable)
        this.renderFPS();
}

/**
 * Hide fps counter
 * @method closeFPS
 */
GUI.prototype.closeFPS = function()
{
    this._canvas2d.style.display = "none";
}

/**
 * Renders FPS on screen
 * @method renderFPS
 * @param {number} padding
 */
GUI.prototype.renderFPS = function(padding)
{
    var now = getTime();
    var elapsed = now - this._last_time;

    this._frames++;

    if(elapsed > this._refresh_time)
    {
        this._last_fps = this._frames;
        this._frames = 0;
        this._last_time = now;

        this._fps = this._last_fps * (1000 / this._refresh_time);
    }

    var ctx = this._canvas2d.getContext("2d");
    // ctx.globalAlpha = 0.65;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "#FFF";
    ctx.font = "70px Monospace";
    ctx.fillText( "FPS:" + this._fps, 35, 95 );
}

/**
 * Register log message
 * @method log
 * @param {string} text
 */
GUI.prototype.log = function(text)
{
    if(text == null)
        return;

    $("#log").append( "<br>" + text );
}

/**
 * Shows message on canvas
 * @method canvasMessage 
 * @param {string} text
 */
GUI.prototype.canvasMessage = function(text, options)
{
    var element = document.createElement('div');
    element.className = "canvas-message";
    element.innerHTML = text;
    document.body.appendChild( element );

    if(options && options.load_bar) {
        
        var sub = document.createElement('div');
        sub.className = "canvas-message-bar";
        // sub text location
        element.style.padding = "0px";
        element.innerHTML = '';
        sub.innerHTML = text;
        // 
        element.appendChild( sub );
    }

    setTimeout( function(){
        
        $(element).remove();
            
    }, 2000 );
    
    return element;
}

/**
 * Shows loading image on screen
 * @method loading
 * @param {bool} active
 * @param {Function} oncomplete
 */
GUI.prototype.loading = function(disable, oncomplete)
{
    if(disable == null)
        $("#modal").show();
    else
    {
        $("#modal").hide( {duration: 10, complete: function(){
        
            $(".pbar").css('width', "0%");
            $("#xhr-load").css('width', "0%");

            if(oncomplete)
                oncomplete();
        }} );        
    }
        
}

/**
 * @method onDragFile
 * @param {File} file
 * @param {String} extension
 */
GUI.prototype.onDragFile = function(file, extension)
{
    if(!extension)
        throw('file not valid: missing extension');
    
    var that = this;

    switch(extension)
    {
        case 'json':
            this.onImport(file);
            break;
        case 'obj':
            this.onDragMesh( file );
            break;
        case 'hdre':
		case 'hdrec':
        case 'exr':
            this.onDragEnvironment(file);
            break;
        case 'png':
        case 'jpg':
            var reader = new FileReader();
            reader.onprogress = function(e){  $("#xhr-load").css("width", parseFloat( (e.loaded)/e.total * 100 ) + "%") };
            reader.onload = function (event) {
                that.onDragTexture(file, event.target.result);
            };
            reader.readAsDataURL(file);
            return false;
    }
}

/**
 * Environment dialog
 * @method onDragEnvironment
 * @param {File} file 
 */
GUI.prototype.onDragEnvironment = function(file)
{
    var filename = file.name;

    var id = "Environment Drop"
    var dialog_id = id.replace(" ", "-").toLowerCase();
        
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, close: true, width: w, draggable: true });
    dialog.show('fade');

    var widgets = new LiteGUI.Inspector();

    var params = {
        filename: filename,
        size: 256,
        max: false,
    };

	var isCompressed = filename.includes(".hdrec");

    var inner = function()
    {
        $("#"+dialog_id).remove();
    
        var reader = new FileReader();
        reader.onprogress = function(e){ $("#xhr-load").css("width", parseFloat( (e.loaded)/e.total * 100 ) + "%") };
        reader.onload = async function (event) {
            var data = event.target.result;


			if(isCompressed) {
			
				// decompress data
				var decom = pako.inflate( data );

				// Get arraybuffer
				data = decom.buffer;
			}


            params['data'] = data;
            params['oncomplete'] = function(){
                CORE.set( filename );
            };

            RM.shader_macros['EM_SIZE'] = params["size"];
            await CORE.reloadShaders();

            if(filename.includes(".exr"))
                HDRTool.prefilter( filename, params);     
            else
                HDRTool.load( filename, params); 
        };

        reader.readAsArrayBuffer(file);
    }


    widgets.on_refresh = function(){

        widgets.clear();
        widgets.addString( "File", filename );
        if( !filename.includes('hdre') )
        {
            widgets.addCombo( "Cubemap size", params.size,{width: "60%", name_width: "50%", values: ["64","128","256","512"], callback: function(v) {      
                params["size"] = parseInt(v);
            }});
        }
        widgets.addSeparator();
        widgets.addButton( null, "Load", {width: "100%", name_width: "50%", callback: function(){
            
            gui.loading();
            inner();
            return false;
        }});
    }

    widgets.on_refresh();
    dialog.add(widgets);  
    var w = 400;
    dialog.setPosition( renderer.canvas.width/2 - w/2, renderer.canvas.height/2 - renderer.canvas.height/4 );       
}

/**
 * Texture dialog
 * @method onDragTexture
 * @param {File} file 
 * @param {base64 string} data 
 */
GUI.prototype.onDragTexture = function(file, data)
{
    var filename = file.name;

    var id = 'Texture Drop '+simple_guidGenerator();
    var dialog_id = replaceAll(id, ' ', '').toLowerCase();
    var w = 400, that = this;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, close: true, width: w, draggable: true });
    dialog.show('fade');

    var widgets = new LiteGUI.Inspector();

    var params = {
        texture_type: "Albedo"
    };

    if(includes(filename, ['albedo', 'color', 'dif'])) params.texture_type = 'Albedo';
    if(includes(filename, ['normal'])) params.texture_type = 'Normal';
    if(includes(filename, ['roughness', 'rough'])) params.texture_type = 'Roughness';
    if(includes(filename, ['metalness', 'metallic'])) params.texture_type = 'Metalness';
    if(includes(filename, ['ao', 'occlusion'])) params.texture_type = 'AO';
    if(includes(filename, ['emissive'])) params.texture_type = 'Emissive';
    if(includes(filename, ['height'])) params.texture_type = 'Height';

    widgets.on_refresh = function(){

        widgets.clear();
        widgets.addString( "File", filename );
        widgets.addCombo( "Use as", params.texture_type,{width: "60%", name_width: "50%", values: ["Albedo","Normal","Roughness","Metalness", "AO", "Emissive", "Height"],
            callback: function(v){ params["texture_type"] = v; }
        });
        widgets.addSeparator();
        widgets.addButton( null, "Apply", {width: "100%", name_width: "50%", callback: function(){
            
            var node = RM.get('NodePicker').selected;

            if(!node && CORE._root.children.length == 2)
                node = CORE._root.children[1];

            if(!node) {
                LiteGUI.showMessage("select node", {title: "Error"});
                return;
            }

            var texture_name = filename;
            var texture = new Texture.fromURL(data, {}, async function(tex, url) {
                gl.textures[ texture_name ] = tex;
                node.textures[ type ] = texture_name;
                node.setTextureProperties();
                that.updateSidePanel(null, node.name);
            });

            var type = params.texture_type.toLowerCase();

            if(!texture)
            console.error('texture not loaded!!');
            
            $('#'+dialog_id).remove();
        }});
    }

    widgets.on_refresh();
    dialog.add(widgets);  
    var w = 400;
    dialog.setPosition( renderer.canvas.width/2 - w/2, renderer.canvas.height/2 - renderer.canvas.height/4 );               
}

/**
 * OBJ dialog
 * @method onDragMesh
 * @param {string} filename
 * @param {..} resource
 */
GUI.prototype.onDragMesh = function(file, resource)
{
    var filename = file.name;

    var id = "Mesh Drop";
    var dialog_id = replaceAll(id, ' ', '').toLowerCase();
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, close: true, width: w, draggable: true });
    dialog.show('fade');

    var widgets = new LiteGUI.Inspector();
    widgets.on_refresh = function(){

        widgets.clear();
        widgets.addString( "File", filename );
        widgets.addSeparator();
        widgets.addTitle("Select textures", {collapsed: true});
        widgets.widgets_per_row = 2;
        widgets.addFile( "Albedo", ""  );
        widgets.addFile( "Normal", "" );
        widgets.addFile( "Roughness", "" );
        widgets.addFile( "Metalness", "" );
        widgets.widgets_per_row = 1;
        widgets.addSeparator();
        widgets.addButton( null, "Load", {width: "100%", name_width: "50%", callback: function(){
            $("#"+dialog_id).remove();
            ImporterModule.processFileList([file], {}, function(f, res){ CORE.addMesh(res, f)});
        }});
    }

    widgets.on_refresh();
    dialog.add(widgets);  
    var w = 400;
    dialog.setPosition( renderer.canvas.width/2 - w/2, renderer.canvas.height/2 - renderer.canvas.height/4 );                  
}

/**
 * Shows the dialog for selecting any resource
 * @method selectResource
 * @param {Object} options
 */
GUI.prototype.selectResource = function(node, tex_name)
{
    var options = options || {};
	var that = this;

    var id = "Select resource";// (" + options.type + ")";
    var dialog_id = replaceAll(id, ' ', '').toLowerCase();
    var w = gl.canvas.width / 3;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, close: true, width: w, draggable: true });
    dialog.show('fade');

    var area = new LiteGUI.Area(null);
	area.split("vertical",[50, null]);
	
	var section1 = area.getSection(0);

	var widgets_top = new LiteGUI.Inspector();
	widgets_top.addString( "Filter", "" );
	widgets_top.addSeparator();
	section1.add( widgets_top );

	var section2 = area.getSection(1);
	var bottom = new LiteGUI.Inspector();
	section2.add( bottom );	

	bottom.on_refresh = function(){
	
		var container = bottom.addContainer("cont-textures");
		container.style.boxSizing = "border-box";
		//container.style.overflowWrap = "break-word";

		that.showResources( container );
	}

	bottom.on_refresh();

	LiteGUI.bind( area, "resource_selected", function(e){
	
		var path = e.target.dataset['path'];
		$("#"+dialog_id).remove();

		node.textures[tex_name] = path;
		that.updateSidePanel(null, node.name);
	} );

    dialog.add(area);  
    dialog.setPosition( renderer.canvas.width/2 - w/2, renderer.canvas.height/2 - renderer.canvas.height/4 );                  
}

GUI.prototype.showResources = function(parent)
{
	for(var t in gl.textures)
	{
		var name = t;
		var tex = gl.textures[t];
		var type = tex.type;
		var texture_type = tex.texture_type;

		if(texture_type !== GL.TEXTURE_2D || type !== GL.UNSIGNED_BYTE)
			continue;

		var responsive = document.createElement('div');
		responsive.className = "responsive";

		responsive.addEventListener( 'click', function(e){ 
		
			var image = e.path[0]; // last bounce
			LiteGUI.trigger( image, "resource_selected");

		} )

		var block = document.createElement('div');
		block.className = "resource-block";

		var url = name;

		if( !url.includes('.') ) {// it is not a file

			var canvas = tex.toCanvas();
			url = canvas.toDataURL();
		}

		var image = document.createElement('img');
		image.src = url;
		image.style.width = "100%";
		image.style.height = "auto";
		image.dataset['path'] = name;

		var text = document.createElement('p');
		text.style.width = "120px";
		text.style.overflow = "hidden";
		name = name.split("/");
		name = name[name.length-1];
		text.innerHTML = name;
	
		block.appendChild(image);
		block.appendChild(text);
		responsive.appendChild( block );
		parent.appendChild( responsive );
	
	}

		
}