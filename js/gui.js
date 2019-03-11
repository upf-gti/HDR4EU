/*
*   Alex Rodriguez
*   @jxarco 
*/

/**
* Responsible of the GUI
* @class GUI
* @constructor
*/
	
	locations = {};

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
	this._show_layers = false;

    // tabs 
    this.editor = 0;
}

/**
 * Initialize gui and split areas
 * @method init
 */
GUI.prototype.init = function()
{
	this.createTabPanel();

	LiteGUI.init(); 
	
	var log = document.createElement('div');
    log.id = "log";
	document.body.appendChild(log);

    // create main area
    this._mainarea = new LiteGUI.Area({id: "mainarea", content_id:"canvasarea", height: "calc( 100% - 31px )", main:true});
    LiteGUI.add( this._mainarea );

    // create second area for HDRI
    this.boo = new LiteGUI.Area({id: "boo", content_id:"booarea", height: "calc( 100% - 31px )", main:true});
    this.boo.root.style.display = "none";
    LiteGUI.add( this.boo );

    // by now fill here boo area

    this.boo.root.ondragover = () => {return false};
    this.boo.root.ondragend = () => {return false};
    this.boo.root.ondrop = (e) => processDrop(e);

	this.fillHDRIArea();
	locations[ "#boo" ] = this.boo.content;

    // *****

    // get main area root and insert all canvas buttons
    var tools = document.querySelector("#canvas-tools");
    var picker = document.querySelector(".pixelPicker");
    this._mainarea.root.appendChild( tools );
    this._mainarea.root.appendChild( picker );
        
    // create menu bar
	var mainmenu = new LiteGUI.Menubar("mainmenubar");
    this._mainarea.add( mainmenu );
    this.fillMenubar( mainmenu );

    this._mainarea.onresize = resize;
    this._mainarea.content.appendChild(renderer.canvas);
    
    // create 2d canvas 
    var canvas = document.createElement("canvas");
    canvas.style.width = "60px";
    canvas.style.height = "30px";
    canvas.style.position = "absolute";
    canvas.style.bottom = "4px";
	canvas.style.left = "0px";
    canvas.style.border = "none";
    this._mainarea.content.appendChild(canvas);
    this._canvas2d = canvas;

    // create right panel for main area
    // if( !CORE.mobile() )
        this.createSidePanel();
    
    resize();
}

GUI.prototype.fillMenubar = function( mainmenu )
{
    var that = this;

    mainmenu.add("File/Save scene", { callback: function() { that.onExport() } });
    mainmenu.add("File/Load scene/From file", { callback: function() { that.onImport() } });
    mainmenu.add("File/Load scene/From server", { callback: function() { 
        $.get("php/saved_scenes.php", function(data){ that.onImportFromServer(data)  });
    } });

    mainmenu.add("File/Preferences/Allow drop", { type: "checkbox", instance: this, property: "_allow_drop"});
    mainmenu.add("File/Preferences/FPS counter", { type: "checkbox", instance: this, property: "_fps_enable", callback: function() { 
        if(!that._fps_enable) that.closeFPS();
        else that._canvas2d.style.display = "block";
    }});
    mainmenu.add("File/Preferences/Color picker", { type: "checkbox", instance: this, property: "_color_picker", callback: function() { 
        if(!that._color_picker) document.querySelector(".pixelPicker").style.display = 'none';
        else document.querySelector(".pixelPicker").style.display = 'block';
    }});
    mainmenu.add("File/Preferences/Log", { type: "checkbox", instance: this, property: "_enable_log", callback: function(){ 
        $("#log").toggle();
    }});
	mainmenu.add("File/Preferences/Show channels", { type: "checkbox", instance: this, property: "_show_layers", callback: function(){ 
        CORE.setUniform("show_layers", that._show_layers);
    }});

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
    mainmenu.add("View/Atmospherical scattering", { callback: function() { that.showAtmos() } });
    mainmenu.separator("View");    
    mainmenu.add("View/Fullscreen", { callback: function() { gl.fullscreen() } });
    mainmenu.add("View/Low panel", { callback: function() { $(that._hdri_bottompanel.root).toggle(); } });

	var scenes = RM.scenes;

    for(let s in scenes)
        mainmenu.add("Actions/Add model/" + scenes[s].name, { callback: function() {
            CORE.parse( scenes[s].name );
            gui.updateSidePanel(null, scenes[s].name );
        }});

    mainmenu.add("Actions/Add primitive/Sphere", { callback: function() { CORE.addPrimitive('sphere'); } });
    mainmenu.add("Actions/Add primitive/Plane", { callback: function() { CORE.addPrimitive('plane'); } });
    mainmenu.add("Actions/Add primitive/Cube", { callback: function() { CORE.addPrimitive('cube'); } });
    mainmenu.add("Actions/Add light", { callback: function() { CORE.addLight(); } });

    mainmenu.add("Actions/Reset scene", { callback: function() { 
        CORE.reset();
        that.updateSidePanel(that._sidepanel, 'root');
    }});
	mainmenu.separator("Actions");    
    mainmenu.add("Actions/Reload shaders", { callback: function() { CORE.reloadShaders() } });
    mainmenu.add("Actions/Fit canvas", { callback: function() { resize(); } });
	mainmenu.add("Actions/Update HDRE preview", { callback: function() { gui.createPreview( CORE._environment ) } });
    mainmenu.separator("Actions");    
    mainmenu.add("Actions/Get Environment/HDRE (8 bits)", { callback: function() { HDRTool.getSkybox( CORE._environment, Uint8Array ) } });
    mainmenu.add("Actions/Get Environment/HDRE (16 bits)", { callback: function() { HDRTool.getSkybox( CORE._environment, Uint16Array ) } });
    mainmenu.add("Actions/Get Environment/HDRE (32 bits)", { callback: function() { HDRTool.getSkybox( CORE._environment, Float32Array ) } });
    mainmenu.add("Actions/Get Mesh (wBin)", { callback: function() {
        var picker = RM.get('NodePicker');
        var node = picker ? picker.selected : null;
        if(!node)
        return;
        var mesh = gl.meshes[ node.mesh ];
        downloadBinary( mesh, "wbin" );
    } });

    mainmenu.add("Help/Version", { callback: function() { LiteGUI.alert("APP v" + RM.version, {title: "App Info"}) } });
    mainmenu.add("Help/Github page", { callback: function() { LiteGUI.alert("<a href='https://github.com/jxarco'>@jxarco</a>", {title: "App Info"}) } });
    mainmenu.add("Help/Other demos", { callback: function() { LiteGUI.alert("<a href='https://webglstudio.org/users/arodriguez/demos/atmos'>Atmospherical scattering</a><br>"+
    "<a href='https://webglstudio.org/latest/player.html?url=fileserver%2Ffiles%2Farodriguez%2Fprojects%2FHDR4EU%2Fgreen.scene.json'>Chroma Keying</a><br>" +
	"<a href='https://webglstudio.org/users/arodriguez/projects/cr2parser'>HDRE Exporter</a><br>", {title: "App Info"}) } });
}

GUI.prototype.createTabPanel = function()
{
    var tabs = document.createElement('div');
    tabs.id = "tabs";
	document.body.appendChild(tabs);
	var panelIcon = document.createElement('div');
	panelIcon.id = "tabicon";
	var content = document.createElement('div');
	content.id = "tabcontent";
	tabs.appendChild(panelIcon);
    tabs.appendChild(content);
    
    var SceneTab = this.createTab("Scene", "<img src='https://webglstudio.org/latest/imgs/mini-icon-cube.png'>", true);
    var hdriTab = this.createTab("HDRI", "<img src='https://webglstudio.org/latest/imgs/mini-icon-texture.png'>");

    SceneTab.id = 'maintab';
    hdriTab.id = 'bootab';
    
    SceneTab.dataset['target'] = '#mainarea';
    hdriTab.dataset['target'] = '#boo';

	// create each tab
	content.appendChild( SceneTab );
	content.appendChild( hdriTab );
}

GUI.prototype.createTab = function(name, icon, selected)
{
    var that = this;
	var tab = document.createElement('div');
	tab.className = "tab" + (selected ? " selected" : "");

	var nameDiv = document.createElement('div');
	nameDiv.className = "tabname";
	var iconDiv = document.createElement('div');
	iconDiv.className = "tabicon";

	nameDiv.innerHTML = name;
	iconDiv.innerHTML = icon;

	tab.appendChild(nameDiv);
	tab.appendChild(iconDiv);

	tab.addEventListener('click', function(e){
		
		document.querySelector(".tab.selected").classList.remove("selected");
        this.classList.add("selected");
        
        if(this.id == 'maintab')
            that.editor = 0;
        else
            that.editor = 1;

        // hide all
        $("#mainarea").hide();
        $("#boo").hide();

        // show selected
        $(this.dataset['target']).show();

		// put canvas there
		var root = locations[ this.dataset['target'] ];

		root.appendChild( $("#canvasarea")[0] );
		resize();
	})

	return tab;
}

GUI.prototype.createSidePanel = function()
{
    this._mainarea.split("horizontal",[null,350],true);
    var docked = new LiteGUI.Panel("right_panel", {title:'Scene nodes', scroll: true});
    this._mainarea.getSection(1).add( docked );
    $(docked).bind("closed", function() { this._mainarea.merge(); });
    this._sidepanel = docked;
    this.updateSidePanel( docked, 'root' );

	locations[ "#mainarea" ] = this._mainarea.getSection(0).root;
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

    if(item_selected == 'root')
    {
        var current_env = CORE._environment_set || {};

        widgets.addSection("Skybox");
		widgets.addHDRE( "Environment", CORE._environment );
        widgets.addList(null, RM.textures, {selected: current_env, height: "75px", callback: function(v){
            gui.loading();
            CORE.set( v );
        }});
        widgets.widgets_per_row = 1;
        widgets.addSeparator();
        widgets.addTitle("Properties");
        widgets.addNumber("Rotation", renderer._uniforms["u_rotation"], {min:-720*DEG2RAD,max:720*DEG2RAD,step:0.05, callback: function(v){ CORE.setUniform("rotation",v);}});
        widgets.addCheckbox("Visible", skybox.flags.visible, {callback: function(v) { skybox.visible = v}});
        widgets.addSeparator();

        widgets.addSection("Camera");
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
        
        // useful???? put into a future preferences dialog
        /*widgets.addSlider("Mouse Speed", CORE.controller._mouse_speed, {min: 0.01, max: 1, step: 0.01, callback: function(v){
            CORE.controller._mouse_speed = v;
            CORE.controller.setBindings(renderer.context);
        }});*/
        
        // Render Component
        // Leave this until de meeting is done
        /*if(RenderComponent && RenderComponent.create)
            RenderComponent.create( widgets, root );*/

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


    inspector.widgets_per_row = 1;

    // OJO CON ESTE
    for(let t in filtered) {

        inspector.addTexture(t == "notfound" ? "" : t, node.textures[t], {node: node});

        /*inspector.addButton( null, '<i data-texture='+ t +' style="font-size: 16px;" class="material-icons">delete_forever</i>', {micro: true, width: "10%", callback: function(v) { 

            var t = $(v).data('texture');

            delete gl.textures[ node.textures[t] ]; 
            delete node.textures[t]; 
            node.setTextureProperties();              
            that.updateSidePanel(null, node.name);
        }});*/

    }

	inspector.widgets_per_row = 1;
	inspector.addSeparator();
	inspector.addString("Add", "", {callback: function(v) {
			
			node.textures[v] = "notfound"; 
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

GUI.prototype.fillHDRIArea = function()
{
	this.boo.split("horizontal",[null,400],true);
	this.boo.onresize = function(){ resize() };
    var docked = new LiteGUI.Panel("hdri_right_panel", {title:'Detailed HDRI', scroll: true});
    this.boo.getSection(1).add( docked );
    $(docked).bind("closed", function() { this.boo.merge(); });
    this._hdri_sidepanel = docked;
	this.boo.root.style.background = "#3D3D3D";

	var left = this.boo.getSection(0);
	// left.split("vertical",[null,300],false);
    // var bottom = new LiteGUI.Panel("hdri_bottom_panel", {scroll: false});
    // left.getSection(1).add( bottom );
    // $(bottom).bind("closed", function() { left.merge(); });

    var id = "bottom_panel_dialog";
    var dialog_id = id.replace(" ", "-").toLowerCase();
    var bottom = new LiteGUI.Dialog( {id: dialog_id, title: "Resource drop", parent: this.boo.getSection(0).content});

    $("#bottom_panel_dialog .buttons").append( "<button class='litebutton mini-button close-button'>"+ LiteGUI.special_codes.close +"</button>" );
    $("#bottom_panel_dialog .close-button")[0].addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        $(bottom.root).toggle();
    });
	$("#bottom_panel_dialog .content")[0].style.height = "100%";

    bottom.show('fade');
    bottom.root.style.width = "100%";
    bottom.root.style.height = "30%";
    bottom.root.style.top = "70%";

    this._hdri_bottompanel = bottom;

	var widgets = new LiteGUI.Inspector();
    $(bottom.content).append(widgets.root);
	widgets.root.style.height = "100%";
	
	var panel_content = widgets.addContainer("content");
	panel_content.className = "low_panel_content";
    bottom.panel_content = panel_content;
    // panel_content.style.overflow = "hidden";
	// panel_content.style.overflowX = "scroll";

	this.updateHDRIArea();
}

function getImageByName( name ){

	return HDRTool.files_loaded.find(function(e) {
	  return e.name == name;
	});
	
}

GUI.prototype.updateHDRIArea = function(right, bottom)
{
	var right = this._hdri_sidepanel;
    var bottom = this._hdri_bottompanel;
    var that = this;
	
	// empty containers
	$(right.content).empty();
	$(bottom.panel_content).empty();

	// right
	var widgets = new LiteGUI.Inspector();
    $(right.content).append(widgets.root);
    
    var options = {disabled: true, name_width: "40%", precision:6};

    widgets.addTitle("Averages per RGB");
    widgets.addVector3("Final image", HDRTool.hdr_avg, options);
    widgets.addVector3("Template", HDRTool.tmp_avg, options);
    widgets.addSeparator();
    widgets.addTitle("Luminance");
    widgets.widgets_per_row = 2;
    widgets.addNumber("Max", HDRTool.max_lum, options);
    widgets.addNumber("Min", HDRTool.min_lum, options);
    widgets.widgets_per_row = 1;
    widgets.addVector3("Max. Pixel", HDRTool.max_lum_pixel, options);
    widgets.addVector3("Min. Pixel", HDRTool.min_lum_pixel, options);
    
    widgets.addSection("Tonemapping");

    var SFX = RM.get("ScreenFX");
    var tonemapper_names = Object.keys(RM.tonemappers);
    var name = SFX.tonemapping;
    var tonemapper = RM.tonemappers[ name ];

    widgets.addCombo(null, name, {values: tonemapper_names, callback: function(v){
        SFX.tonemapping = v;
    }});
    
    if(tonemapper && tonemapper.params)
        for( let p in tonemapper.params ) // important let!!
        {
            var tm = tonemapper.params[p];
            var options = tm.options || {};

            CORE.setUniform(p, tm.value); 

            widgets.addSlider(p, tm.value, {min:options.min || 0,max:options.max||1,step:options.step||0.1,name_width: '50%', callback: function(v) {  
                CORE.setUniform(p, v); 
                tonemapper.setParam(p, v);
            }});
        }
	
	if(!gl.textures["combined_scaled"]) {
	
		widgets.addSection("HDR control");
		widgets.addSlider("Exposure", renderer._uniforms["u_exp"], {min:-10,max:10,step:0.1, callback: function(v) {  
			CORE.setUniform('exp', v);
		}});
		widgets.addSlider("Max. Radiance", HDRTool.max_radiance, {min:1,max:250,step:1, callback: function(v) {  
			HDRTool.max_radiance = v;
		}});
	}


	// bottom
	widgets = new LiteGUI.Inspector();
    $(bottom.panel_content).append(widgets.root);
	widgets.root.style.height = "100%";

	var image_content = widgets.addContainer("images");
	image_content.className = "low_panel_images";

	// add images loaded

	var images = HDRTool.files_loaded;

	for(var i = 0; i < images.length; i++)
		image_content.appendChild( this._generateLDRIThumb(images[i]) );
    
    if(!images.length)
    return;

	widgets.addSeparator();
	widgets.widgets_per_row = 5;
	widgets.addButton(null, "Compute HDR", {callback: function(){ 
        HDRTool.computeOutput();
        that.updateHDRIArea();
     }});
	 widgets.addButton(null, "Download", {callback: function(){ 
	
		if(true) {
			
			var tex = HDRTool._CPU_downloadHDR(); 
			var data = {
				width: tex.width,
				height: tex.height,
				rgba: tex.getPixels(),
				numChannels: 4
			};

			LiteGUI.prompt("Environment name", function(v){
			
				gl.textures[v] = HDRTool.toTexture(data, 256, {no_flip: true});

				HDRTool.prefilter(v, {oncomplete: function(){
					
					CORE.set(v);
				
				}});

			}, {title: "Download HDRE"})
		}
		else
		 {
			// HDRTool._GPU_downloadHDR(); 
		}
		 
	}});
	widgets.addButton(null, "Upload", {callback: function(){ 
	
		console.warn("TODO");
		 
	}});
//	widgets.addButton(null, "Export (CPU)", {callback: function(){ HDRTool._CPU_downloadHDR(); }});
//	widgets.addButton(null, "Export (GPU)", {callback: function(){ HDRTool._GPU_downloadHDR(); }});

	$(".low_panel_image .edit-button").click(function(e){
        e.preventDefault();
        e.stopPropagation();
        
		var target_name = $(this).data("target");
		var img = getImageByName(target_name);
		var index = HDRTool.files_loaded.indexOf(img);

		var dialog = new LiteGUI.Dialog({id: "edit-mode", parent: "body", title: "Edit "+img.name, close: true});
		var widgets = new LiteGUI.Inspector();
		$(dialog.root).append(widgets.root);

		widgets.addString( "Shutter speed", img.exp_time, {callback: function(v){ 

			var tkns = v.split("/"), f;

			if(tkns.length == 2)
				f = parseFloat(tkns[0]) / parseFloat(tkns[1]);
			else
				f = parseFloat(tkns[0]);
			HDRTool.files_loaded[index].exp_time = f;
			HDRTool._sortFiles();
			that.updateHDRIArea();
			dialog.close();
		}});

    });

	$(".low_panel_image .remove-button").click(function(e){
        e.preventDefault();
        e.stopPropagation();
        
		var target_name = $(this).data("target");

		HDRTool.files_loaded = HDRTool.files_loaded.filter( function(e){
			return e.name != target_name;
		} );

		that.updateHDRIArea();

    });
	
}

GUI.prototype._generateLDRIThumb = function( img )
{
	// save image
	let current_image = img;

	var container = document.createElement("div");
	container.className = "low_panel_image";

	var image = new Image();
	image.src = current_image.url || "";

	var info = document.createElement("div");
	info.style.display = "flex";

	var text = document.createElement("div");
	text.className = "low_panel_image info_text";
	text.innerHTML = current_image.name || "resource";
	text.innerHTML += "<br><b>" + current_image.exp_time || "" + "</b>";

	var buttons = document.createElement("div");
	buttons.innerHTML = "<button data-target='" + current_image.name + "' class='litebutton mini-button edit-button'><i style='font-size:12px;'class='material-icons'>edit</i></button>";
	buttons.innerHTML += "<button data-target='" + current_image.name + "' class='litebutton mini-button remove-button'>" + LiteGUI.special_codes.close + "</button>";
	
	container.appendChild( image );
	container.appendChild( info );
	info.appendChild( text );
	info.appendChild( buttons );

	return container;
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
        console.warn("Save Files in server");
    }

	var boo;

	try
	{
		boo = CORE.toJSON();
		console.log(boo);
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
 * Show atmospherical scattering options in dialog
 * @method showAtmos
 */
GUI.prototype.showAtmos = function(data)
{
    var id = "Atmospherical scattering";
    var dialog_id = id.replace(" ", "-").toLowerCase();
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');
    var widgets = new LiteGUI.Inspector();

    // Atmos Component
    var AtmosComponent = RM.get('Atmos');

    if(AtmosComponent && AtmosComponent.create)
        AtmosComponent.create( widgets );

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
			break;
		case 'cr2':
            var reader = new FileReader();
            reader.onprogress = function(e){  $("#xhr-load").css("width", parseFloat( (e.loaded)/e.total * 100 ) + "%") };
            reader.onload = function (e) {
                
				var ifds = UTIF.decode(e.target.result);
				var img = ifds[0];

				UTIF.decodeImage(e.target.result, img)
				var rgb_data = UTIF.toRGBA8( img );
				window.img_cr2 = img;

				var tex = new Texture(img.width, img.height, { format: gl.RGB, pixel_data: img.data});
				gl.textures['cr2'] = tex;

            };
            reader.readAsArrayBuffer(file);
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
	area.split("vertical");
	
	var section1 = area.getSection(0);

	var widgets_top = new LiteGUI.Inspector();
	widgets_top.widgets_per_row = 2;
	widgets_top.addString( "Filter", "", {width: "80%"} );
	widgets_top.addButton( null, "Import", {width: "20%", callback: function(){
	
		console.log("TODO");
	
	}} );
	widgets_top.addSeparator();
	widgets_top.widgets_per_row = 1;
	section1.add( widgets_top );

	var section2 = area.getSection(1);
	var bottom = new LiteGUI.Inspector();
	section2.add( bottom );	

	bottom.on_refresh = function(){
	
		var container = bottom.addContainer("cont-textures");
		container.className = "cont-textures";
		container.style.boxSizing = "border-box";
		container.style.height = "390px";
		container.style.overflowY = "scroll";

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

		let  image = document.createElement('img');
		image.style.height = "12.5vh";
		image.style.marginTop = "-30px";
		image.src = url;
		image.style.width = "100%";
		image.dataset['path'] = name;

		var text = document.createElement('p');
		name = name.split("/");
		name = name[name.length-1];
		text.innerHTML = name;
	
		block.appendChild(text);
		block.appendChild(image);
		responsive.appendChild( block );
		parent.appendChild( responsive );
	
	}
}


/* COLLABORATIVE TOOL THING */

/**
 * Shows the dialog for selecting HDRE
 * @method selectHDRE 
 */
GUI.prototype.selectHDRE = function( files )
{
    var options = options || {};
	var that = this;

    var id = "Select HDRE";
    var dialog_id = replaceAll(id, ' ', '').toLowerCase();
    var w = gl.canvas.width / 2.5;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, close: true, width: w, draggable: true });
    dialog.show('fade');

    var area = new LiteGUI.Area(null);
	area.split("vertical");
	
	var section1 = area.getSection(0);

	var widgets_top = new LiteGUI.Inspector();
	widgets_top.widgets_per_row = 2;

	let filtered_files = [].concat(files);
	tags = [];
	filter = "";

	var filter_input = widgets_top.addString( "Filter", "", {width: "80%", callback: function(v){
	
		var input = filter_input.children[1].children[0].children[0];
		filter = v.toLowerCase();

		filtered_files = files.filter( function(e){
		
			if(!tags.length)
				return true;

			if(!e.metadata.tags)
				return false;

			for(var i in tags)
				if( e.metadata.tags.indexOf( tags[i] ) < 0 )
					return false;
			return true;
		} ).filter(e=> e.filename.toLowerCase().includes(filter));

		if(!filtered_files.length)
			input.style.color = "red";
		else
			input.style.color = "";
		
		bottom.on_refresh();

	}} );
	
	/*widgets_top.addButton( null, "Download", {width: "20%", callback: function(){
	
		console.log("TODO");
	
	}} );*/
	widgets_top.addButton( null, "Import", {width: "20%", callback: function(){
	
		that.uploadHDRE( bottom );
	
	}} );
	widgets_top.addSeparator();
	widgets_top.widgets_per_row = 1;
		
	

	widgets_top.addTags( "Tags","empty", {values: ["empty", "outdoor","indoor","nature","urban","night","skies"], callback: function(e){
	
		tags = Object.keys(e);

		filtered_files = files.filter( function(e){
		
			if(!tags.length)
				return true;

			if(!e.metadata.tags)
				return false;

			for(var i in tags)
				if( e.metadata.tags.indexOf( tags[i] ) < 0 )
					return false;
			return true;
		} ).filter(e=> e.filename.toLowerCase().includes(filter));

		bottom.on_refresh();
	
	}} );

	section1.add( widgets_top );

	var section2 = area.getSection(1);
	var bottom = new LiteGUI.Inspector();
	section2.add( bottom );	

	bottom.on_refresh = function(){
	
		$(bottom.root).empty();

		var container = bottom.addContainer("cont-hdre");
		container.className = "cont-hdre";
		container.style.boxSizing = "border-box";
		container.style.height = "390px";
		container.style.overflowY = "scroll";

		that.showHDRES( container, filtered_files );
	}

	bottom.on_refresh();

	LiteGUI.bind( area, "resource_selected", function(e){
		
		let path = e.target.dataset['path'];
		let name = e.target.dataset['name'];
		$("#"+dialog_id).remove();

		// set environment
		that.loading();
        CORE.set( CORE.FS.root + path, {onImport: function(){
			
			if(e.target.src == "")
				that.createPreview( CORE._environment )

		}} );
		that.updateSidePanel(null, 'root');
	} );

    dialog.add(area);  
    dialog.setPosition( renderer.canvas.width/2 - w/2, renderer.canvas.height/2 - renderer.canvas.height/4 );                  
}

GUI.prototype.uploadHDRE = function( root )
{
    var options = options || {};
	var that = this;

    var id = "Upload HDRE";
    var dialog_id = replaceAll(id, ' ', '').toLowerCase();
    var w = gl.canvas.width / 4;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, close: true, width: w, draggable: true });
    dialog.show('fade');

    var area = new LiteGUI.Area(null);
	var widgets_top = new LiteGUI.Inspector();
	var selected_tags = {};
	var file = null;

	widgets_top.addFile( "File", "", {callback: function(v){
	
		file = v.files[0];


	}} );

	widgets_top.addSeparator();

	widgets_top.addTags( "Tags","empty", {values: ["empty","outdoor","indoor","nature","urban","night","skies"], callback: function(v){

		selected_tags = {};
		Object.assign(selected_tags, v);
	
	}} );
	
	widgets_top.addButton( null,"Upload", {callback: function(v){
	
		if(file)
			CORE.FS.uploadFile("hdre", file, Object.keys(selected_tags)).then( function(){ $("#"+dialog_id).remove(); root.on_refresh();  } );
	}} );

	area.add( widgets_top );
    dialog.add(area);  
    dialog.setPosition( renderer.canvas.width/2 - w/2, renderer.canvas.height/2 - renderer.canvas.height/5 );                  
}

GUI.prototype.showHDRES = function(parent, files)
{
	for(var f in files)
	{
		let name = files[f].filename;
		// console.log(files[f]);

		var responsive = document.createElement('div');
		responsive.className = "responsive";

		var block = document.createElement('div');
		block.className = "resource-block";

		let  image = document.createElement('img');
		image.style.width = "100%";
		image.style.height = "12.5vh";
		image.style.marginTop = "-30px";
		image.dataset['path'] = files[f].fullpath;
		image.dataset['name'] = name;
		
		LiteGUI.requestBinary("https://webglstudio.org/users/hermann/files/sauce_dev/files/8efb30d54aee665af72c445acf53284b/thb/thb_" + name + ".png", function(e){
		
			image.src = "https://webglstudio.org/users/hermann/files/sauce_dev/files/8efb30d54aee665af72c445acf53284b/thb/thb_" + name + ".png";
	
		} );

		image.addEventListener( 'click', function(e){ 
		
			LiteGUI.trigger( e.target, "resource_selected");
		} );

		var text = document.createElement('p');
		text.innerHTML = name.replace(".hdre", "");
	
		block.appendChild(text);
		block.appendChild(image);
		responsive.appendChild( block );
		parent.appendChild( responsive );
	
	}
		
}

GUI.prototype.createPreview = function( tex_name )
{
    var options = options || {};
	var that = this;
	
	console.log(tex_name);
	var tex = gl.textures[ tex_name ];

	if( !tex )
		throw("no texture loaded");

	var preview = new Texture(tex.width, tex.height);
	preview.drawTo( function(){
		tex.toViewport( gl.shaders["flipY"] );
	} );

	var canvas = preview.toCanvas();
	var base64 = canvas.toDataURL();
	
	canvas.toBlob(function(e){
		CORE.FS.uploadFile( "thb", new File([e], "thb_" + tex_name + ".png"), [] );
	});

}