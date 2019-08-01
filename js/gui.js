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

	var skyboxSectionCollapsed = false;
	var cameraSectionCollapsed = true;

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
	this._uniform_list = [];

    // other properties
    this._allow_drop = true;
    this._enable_log = false;
    this._color_picker = true;
	this._show_layers = false;
	this._must_update_panel = false;
	this._usePrem0 = true;

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

	HDRI.add(this);

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

	// create another 2d canvas for uniforms
    var uniform_canvas = document.createElement("canvas");
    uniform_canvas.style.width = "275px";
    uniform_canvas.style.height = "200px";
    uniform_canvas.style.position = "absolute";
    uniform_canvas.style.top = "150px";
	uniform_canvas.style.left = "10px";
    uniform_canvas.style.border = "none";
    this._mainarea.content.appendChild(uniform_canvas);
    this._uniform_canvas = uniform_canvas;
	
	LiteGUI.draggable( this._uniform_canvas );

    // create right panel for main area
    this.createSidePanel();
    
    resize();
}

GUI.prototype.fillMenubar = function( mainmenu )
{
    var that = this;

    mainmenu.add("File/Save scene", { callback: function() { that.onExport() } });
    mainmenu.add("File/Load scene/From file", { callback: function() { that.onImport() } });
    mainmenu.add("File/Load scene/From server", { callback: function() { 
		CORE.FS.getFiles("scenes").then(data=>that.onImportFromServer(data));
    } });

    mainmenu.add("File/Preferences/Allow drop", { type: "checkbox", instance: this, property: "_allow_drop"});
    mainmenu.add("File/Preferences/FPS counter", { type: "checkbox", instance: this, property: "_fps_enable", callback: function() { 
        if(!that._fps_enable) that.closeFPS();
        else that.showFPS();
    }});
    mainmenu.add("File/Preferences/Color picker", { type: "checkbox", instance: this, property: "_color_picker", callback: function() { 
        if(!that._color_picker) document.querySelector(".pixelPicker").style.display = 'none';
        else document.querySelector(".pixelPicker").style.display = 'block';
    }});
    mainmenu.add("File/Preferences/Log", { type: "checkbox", instance: this, property: "_enable_log", callback: function(){ 
        $("#log").toggle();
    }});

	mainmenu.add("View/PREM/Original", { callback: function() {
		CORE.cubemap.texture = CORE._environment;
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
	mainmenu.add("View/Show PBR channels", { type: "checkbox", instance: this, property: "_show_layers", callback: function(){ 
        CORE.setUniform("show_layers", that._show_layers);
    }});
    mainmenu.separator("View");    
    mainmenu.add("View/Fullscreen", { callback: function() { gl.fullscreen() } });
    mainmenu.add("View/Low panel", { callback: function() { $(that._hdri_bottompanel.root).toggle(); } });

	var scenes = RM.scenes;

    for(let s in scenes)
        mainmenu.add("Actions/Add model/" + scenes[s].name, { callback: function() {
            CORE.parse( scenes[s].name );
            gui.updateSidePanel(null, scenes[s].name );
        }});

    mainmenu.add("Actions/Primitive/Sphere", { callback: function() { CORE.addPrimitive('sphere'); } });
    mainmenu.add("Actions/Primitive/Plane", { callback: function() { CORE.addPrimitive('plane'); } });
    mainmenu.add("Actions/Primitive/Cube", { callback: function() { CORE.addPrimitive('cube'); } });
    mainmenu.add("Actions/Add light", { callback: function() { CORE.addLight(); } });

	mainmenu.add("Actions/Component/Histogram", { callback: function() { RM.registerComponent( Histogram, 'Histogram'); gui.updateSidePanel(null, "root", {maxScroll: true}); } });
	mainmenu.add("Actions/Component/Atmos Scattering", { callback: function() { RM.registerComponent( AtmosphericScattering, 'Atmos'); gui.updateSidePanel(null, "root", {maxScroll: true}); } });
	mainmenu.add("Actions/Component/Texture Tools", { callback: function() { RM.registerComponent( TextureTools, 'TextureTools'); gui.updateSidePanel(null, "root", {maxScroll: true}); } });

    mainmenu.add("Actions/Reset scene", { callback: function() { 
        CORE.reset();
        that.updateSidePanel(that._sidepanel, 'root');
    }});
	mainmenu.separator("Actions");    
    mainmenu.add("Actions/Reload shaders", { callback: function() { CORE.reloadShaders() } });
    mainmenu.add("Actions/Fit canvas", { callback: function() { resize(); } });
	mainmenu.add("Actions/Update HDRE preview", { callback: function() { gui.createPreview( CORE._environment ) } });
	mainmenu.add("Actions/Take screenshot", { callback: function() { 
		gui.screenCapture();
	}});

    mainmenu.separator("Actions");    
    mainmenu.add("Actions/Export/Environment", { callback: function() { that.exportEnvironment(); } });
    mainmenu.add("Actions/Export/Selected Mesh (wBin)", { callback: function() {
        var picker = RM.get('NodePicker');
        var node = picker ? picker.selected : null;
        if(!node)
        return;
        var mesh = gl.meshes[ node.mesh ];
        downloadBinary( mesh, "wbin" );
    } });

	//mainmenu.add("Tools/Atmospherical scattering", { callback: function() { that.showAtmos() } });
	//mainmenu.add("Tools/Texture tools", { callback: function() { that.showTexTools() } });

    mainmenu.add("Help/Version", { callback: function() { LiteGUI.alert("APP v" + RM.version, {title: "App Info"}) } });
    mainmenu.add("Help/Github page", { callback: function() { LiteGUI.alert("<a href='https://github.com/jxarco'>@jxarco</a>", {title: "App Info"}) } });
    mainmenu.add("Help/Other demos", { callback: function() { LiteGUI.alert("<a href='https://webglstudio.org/users/arodriguez/demos/atmos'>Atmospherical scattering</a><br>"+
    "<a href='https://webglstudio.org/latest/player.html?url=fileserver%2Ffiles%2Farodriguez%2Fprojects%2FHDR4EU%2Fgreen.scene.json'>Chroma Keying</a><br>" +
	"<a href='https://webglstudio.org/users/arodriguez/demos/cr2parser'>Cr2 parser</a><br>", {title: "App Info"}) } });
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
    var hdriTab = this.createTab("Assembly", "<img src='https://webglstudio.org/latest/imgs/mini-icon-texture.png'>");

    SceneTab.id = 'maintab';
    hdriTab.id = 'assemblytab';
    
    SceneTab.dataset['target'] = '#mainarea';
    hdriTab.dataset['target'] = '#assembly';

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
        
        if(this.id == 'maintab'){

            that.editor = 0;
			CORE.controller.bindEvents();
		}
        else {
            that.editor = 1;
			HDRI.dragscale.bindEvents( HDRI.canvas );
		}

        // hide all
        $("#mainarea").hide();
        $("#assembly").hide();

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
    this._mainarea.split("horizontal",[null,350],false);
    var docked = new LiteGUI.Panel("right_panel", {title:'Scene nodes', scroll: true});
    this._mainarea.getSection(1).add( docked );
    $(docked).bind("closed", function() { this._mainarea.merge(); });
    this._sidepanel = docked;
    this.updateSidePanel( docked, 'root' );

	locations[ "#mainarea" ] = this._mainarea.getSection(0).root;
}

GUI.prototype.updateSidePanel = function( root, item_selected, options )
{
    if(!item_selected)
    return;
    root = root || this._sidepanel;
	options = options || {};
    $(root.content).empty();
    
	//side panel widget
    var widgets_pre = new LiteGUI.Inspector();
    $(root.content).append(widgets_pre.root);

	var isRoot = item_selected === "root";
	widgets_pre.addButton( null, isRoot ? "Show scene uniforms" : "Show root", {callback: function(){ that.updateSidePanel( that._sidepanel, isRoot ? "scene_options" : "root" ) }} );

    var mytree = this.updateNodeTree(scene.root);

    var litetree = new LiteGUI.Tree(mytree, {id: "tree", allow_rename:true});

    var that = this;

    litetree.root.addEventListener('item_selected', function(e){
		e.preventDefault();
        that.updateSidePanel( that._sidepanel, e.detail.data.id );
    });

	// DOES NOT WORK YET
	litetree.root.addEventListener("click", function(e){
        e.preventDefault();

		if(!e.rightButton)
			return;

		var actions = [
            {
                title: "Rename", //text to show
				callback: function() { 
					console.log("TODO");
				}
            },
          
            {
                title: "Delete", //text to show
                callback: function() { 
					CORE.getByName(e.detail.data.id).destroy();
					that.updateSidePanel(null, "root");
				}
            },
		];
		var contextmenu = new LiteGUI.ContextMenu( actions, { event: e });
    });

    litetree.root.addEventListener("item_dblclicked", function(e){
        e.preventDefault();
    });

	this.tree = litetree;

	if(isRoot)
	    $(root.content).append( litetree.root );

    //side panel widget
    var widgets = new LiteGUI.Inspector();
    $(root.content).append(widgets.root);

    var k = 0;
    for(var node in scene.root.children) if(scene.root.children[k].name == 'lines') continue; else k++; 
    widgets.root.style.height = "calc( 100% - " + (k * 25 + 15) + "px )";
    
    var camera = CORE.controller._camera, skybox = CORE.cubemap;
    var SFXComponent = RM.get('ScreenFX');
    var RenderComponent = RM.get('Render');

    if(item_selected == 'root')
    {
        var current_env = CORE._environment_set || {};

		widgets.addSection("Skybox", {collapsed: skyboxSectionCollapsed, callback: function(no_collapsed){
				skyboxSectionCollapsed = !no_collapsed;
			}});
		
		widgets.addHDRE( "Environment", CORE._environment );
        widgets.addList(null, RM.textures, {selected: current_env, height: "75px", callback: function(v){
            gui.loading();
            CORE.set( v );
        }});
        widgets.widgets_per_row = 1;
        widgets.addSeparator();
        widgets.addTitle("Properties");
        widgets.addNumber("Rotation", renderer._uniforms["u_rotation"], {min:-720*DEG2RAD,max:720*DEG2RAD,step:0.05, callback: function(v){ CORE.setUniform("rotation",v);}});
		widgets.addColor("Background color", CORE._background_color, {name_width: "50%", callback: function(color){ 
			CORE._background_color = color;
		}});
		widgets.widgets_per_row = 3;
        widgets.addCheckbox("Visible", skybox.flags.visible, {callback: function(v) { skybox.flags.visible = v; }});
		widgets.addCheckbox("Blur", this._usePrem0, {callback: function(v) { 
			that._usePrem0 = v; 
			CORE._cubemap.texture = (v ? "_prem_0_" : "") + CORE._environment;
		}});
		widgets.addCheckbox("Flip X", renderer._uniforms["u_flipX"], {callback: function(v) { CORE.setUniform("flipX", v)}});
		widgets.widgets_per_row = 1;
		widgets.addSeparator();

        widgets.addSection("Camera", {collapsed: cameraSectionCollapsed, callback: function(no_collapsed){
				cameraSectionCollapsed = !no_collapsed;
			}});

        widgets.addVector3("Position",  camera.position, {callback: function(v){
            camera.position = v;
        }});
        widgets.addVector3("Target", camera.target, {callback: function(v){
            camera.target = v;
        }});
        widgets.addSeparator();
        widgets.widgets_per_row = 2;
        widgets.addNumber("Near", camera.near, {min:0, callback: function(v){
            CORE.controller.near = v;
        }});
        widgets.addNumber("Far", camera.far, {min:0, callback: function(v){
            CORE.controller.far = v;
        }});
        widgets.addSeparator();
        widgets.addButton(null, "Get current", {callback: function() { that.updateSidePanel(that._sidepanel, 'root')}});

        widgets.widgets_per_row = 1;
        widgets.addSeparator();

		for (var c in RM.components)
		{
			var component = RM.components[c];
			if( component.mark && component.create )
				component.create( widgets, root );
		}

    }
    else if(item_selected == 'light')
    {
        var LightComponent = RM.get('Light');
        LightComponent.create( widgets );
    }
    
    else if(item_selected.includes("scale") || item_selected.includes("matrix"))
    {
        var node = CORE.getByName(item_selected);
		
		if(!node)
			return;

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
        widgets.addList(null, ["flat", "flat_deferred", "phong","pbr", "pbr_deferred"], {selected: first_child.shader, callback: function(v){ 
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

		widgets.addSection("Mesh");
        widgets.addTitle(node.mesh);
	
		var groups = gl.meshes[node.mesh].info.groups;
		var submesh_ids = ["All"];

		for(var i in groups)
			submesh_ids.push( groups[i].name );

		if(submesh_ids.length)
		{
			widgets.addCombo("Submesh", node.submesh || "All", {values: submesh_ids, callback: function(v){
			
				node.submesh = v;
				that.updateSidePanel(null, item_selected);
					
				if(v == "All") node.draw_range = null;
				else 
				{
					var index = submesh_ids.indexOf(v) - 1; // remove "All"
					node.draw_range = [groups[index].start, groups[index].length];
				}
			}});
		}

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
        widgets.addList(null, ["flat", "flat_deferred", "phong", "textured", "pbr", "pbr_deferred"], {selected: node.shader,callback: function(v){ 
			node.shader = v;

			if(v === 'textured' && !node.textures['albedo']) {
				node.textures['albedo'] = 'white';
				that.updateSidePanel(null, node.name);
			}
				
		}})
        this.addMaterial(widgets, node);
    }
	else if(item_selected == "scene_options")
    {
		for( let i in renderer._uniforms ) {

			var value = renderer._uniforms[i];

			if(value.constructor == Float32Array)
				continue;//value = "array";

			var pretitle = "<span title='Drag " + i + "' class='keyframe_icon'></span>";
			var element = widgets.addInfo(i.replace("u_",""), value.toString(), {pretitle: pretitle, name_width: "50%"});
			
			var icon = element.querySelector(".keyframe_icon");
			if(icon){
				icon.addEventListener("dragstart", function(e){
					e.dataTransfer.setData("type", "text");
					e.dataTransfer.setData("uniform", i);
				});

				icon.setAttribute("draggable", true);
			}
		}
	
		widgets.addSeparator();
		widgets.widgets_per_row = 2;
		widgets.addButton(null, "Refresh", {callback: function(){ that.updateSidePanel( that._sidepanel, "scene_options" ) }});
		widgets.addButton(null, "Remove all", {callback: function(){ gui._uniform_list.length = 0; }});
    }

    // update scroll position
	var element = root.content.querySelectorAll(".inspector")[1];
	var maxScroll = element.scrollHeight;
	element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
}

GUI.prototype.addMaterial = function(inspector, node)
{
	var that = this;

    // Parent node is abstract
    if(node.children.length)
    node = node.children[0];

	// node._uniforms['u_energy'] = 0;

    inspector.addSection("Material");
    inspector.addTitle("Basic properties");
    inspector.addColor("Base color", node._uniforms["u_albedo"], {callback: function(color){ node._uniforms["u_albedo"] = node._uniforms["u_color"] = color; }});
    inspector.addSlider("Roughness", node._uniforms['u_roughness'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_roughness'] = v }});
    inspector.addSlider("Metalness", node._uniforms['u_metalness'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_metalness'] = v }});
	inspector.addSlider("Alpha", node._uniforms['u_alpha'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_alpha'] = v }});
	/*inspector.addSeparator();
	inspector.addSlider("energy factor", node._uniforms['u_energy'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_energy'] = v }});*/
	inspector.addSeparator();
    inspector.addVector3("Reflectance", node._uniforms['u_reflectance'] ,{max: 1.0, min: 0, step: 0.01, callback: function(v){ node._uniforms['u_reflectance'] = v }});
	inspector.addSeparator();
	inspector.addButton(null, "Show flags", {callback: function(){
		that.showMaterialFlags(node);
	} })
	inspector.addTitle("Clear Coat (Multi-Layer materials)");
	inspector.addSlider("Clear coat", node._uniforms['u_clearCoat'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_clearCoat'] = v }});
	inspector.addSlider("Roughness", node._uniforms['u_clearCoatRoughness'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_clearCoatRoughness'] = v }});
	inspector.addColor("Tint color", node._uniforms["u_tintColor"], {callback: function(color){ node._uniforms["u_tintColor"] = color; }});
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
    }

	inspector.widgets_per_row = 1;
	inspector.addSeparator();
	inspector.addString("Add", "", {callback: function(v) {
			
			node.textures[v] = "notfound"; 
            node.setTextureProperties(); 
			that.updateSidePanel(null, node.name);
        }});
	
}

GUI.prototype.showMaterialFlags = function(node)
{
	var that = this;

    var id = "Node flags";
    var dialog_id = replaceAll(id, ' ', '').toLowerCase();
    var w = 250;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, close: true, width: w, draggable: true });
    dialog.show('fade');

	var widgets = new LiteGUI.Inspector();
	widgets.widgets_per_row = 1;
	widgets.addCheckbox( "Diffuse", node._uniforms["u_renderSpecular"], {name_width: "50%", callback: function(v){
	
		node._uniforms["u_renderDiffuse"] = v;
	
	}} );
	widgets.addCheckbox( "Specular", node._uniforms["u_renderSpecular"], {name_width: "50%", callback: function(v){
	
		node._uniforms["u_renderSpecular"] = v;
	
    }} );
    widgets.addCheckbox( "Use Blue for Rough", node._uniforms["u_roughnessInBlue"] || false, {name_width: "50%", callback: function(v){
	
		node._uniforms["u_roughnessInBlue"] = v;
	
	}} );
	widgets.addSeparator();

    dialog.add(widgets);  
    dialog.setPosition( renderer.canvas.width/2 - w/2, renderer.canvas.height/2 - renderer.canvas.height/4 );          
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

function getImageByName( name ){

	return HDRTool.files_loaded.find(function(e) {
	  return e.name == name;
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
 * Export environment options
 * @method exportEnvironment
 */
GUI.prototype.exportEnvironment = function()
{
    var saveSH = true;

    var inner = function(v) {

		if(v === "8 bits")
            HDRTool.getSkybox( CORE._environment, {type: Uint8Array, saveSH: saveSH} );
        if(v === "16 bits")
            HDRTool.getSkybox( CORE._environment, {type: Uint16Array, saveSH: saveSH});
        if(v === "32 bits")
            HDRTool.getSkybox( CORE._environment, {saveSH: saveSH} );
        else
            HDRTool.getSkybox( CORE._environment, {rgbe: true, saveSH: saveSH} ); // RGBE
    };
        
    var choice = LiteGUI.choice("Select bits per channel", ["8 bits","16 bits", "32 bits", "RGBE"], inner, {title: "Export environment", width: 300});
    
    var widgets = new LiteGUI.Inspector();
    widgets.addCheckbox("Save spherical harmonics", saveSH, {name_width: "75%", callback: function(v){ saveSH = v; }})

    choice.add( widgets );
    choice.setPosition( window.innerWidth/2 - 150, window.innerHeight/2 - 150 );
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

		if(v === "Local") {
			var data = "text/json;charset=utf-8," + encodeURIComponent(boo);
			var element = document.createElement('a');
			element.href = 'data:' + data;
			element.download = 'scene-'+getDate()+'.json';
			element.style.display = 'none';
			$(document.body).append(element);
			element.click();
		}
		else {
		
			LiteGUI.prompt( "", function(v){
			
				// upload data
				CORE.FS.uploadFile("scenes",new File([boo], v + ".json"), []);
				
				// upload thb
				canvas.toBlob(function(e){
					CORE.FS.uploadFile( "scenes", new File([e], v + ".png"), [] );
				});
			
			}, { title: "Save as" });
			
		}
		
    };

	var tex = CORE._fx_tex;
	var preview = new Texture(tex.width, tex.height);
	preview.drawTo( function(){
		tex.toViewport( gl.shaders["flipY"] );
	} );

	var canvas = preview.toCanvas();
	var base64 = canvas.toDataURL();

	var choice = LiteGUI.choice("<img src='" + base64 + "' width='100%'>", ["Local","Server"], inner, {title: "Save scene", width: 300});
	choice.setPosition( window.innerWidth/2 - 150, window.innerHeight/2 - 150 ); 
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

	// console.log(data)

    var id = "Load scene from server";
    var dialog_id = replaceAll(id," ", "-").toLowerCase();
    var w = 500;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');
    dialog.makeModal('fade');
    var widgets = new LiteGUI.Inspector();

	// get path : CORE.FS.root + path

	var files = {}
	data.filter( e => !e.filename.includes("png") ).forEach(e => files[e.filename] = e);
	var key0 = Object.keys(files)[0];
    var selected = files[key0];

	var oncomplete = function( data ){
		$('#'+dialog_id).remove();
		LiteGUI.showModalBackground(false);
		CORE.fromJSON( data );
	}

    widgets.on_refresh = function(){

        widgets.clear();

		widgets.widgets_per_row = 2;
        widgets.addList( null, files, {height: "150px", selected: selected, callback: function(v) {
            selected = v;
			widgets.on_refresh();
        } });

		var thb = widgets.addContainer("thb");
		thb.style.width = "50%";
		thb.style.height = "150px";
		thb.style.display = "inline-block";

		thb.innerHTML = "<img height='100%' src='https://webglstudio.org/users/hermann/files/sauce_dev/files/8efb30d54aee665af72c445acf53284b/scenes/" + selected.filename.replace(".json", ".png") + "'>"
	
		widgets.widgets_per_row = 1;
		widgets.addInfo( "Folder", selected.folder);
		widgets.addInfo( "Path", selected.fullpath);

        widgets.addButton( null, "Load", {callback: function() {

            if(!selected)
                return;
            
            LiteGUI.requestJSON( CORE.FS.root + selected.fullpath, oncomplete );
            
        } });

    }

    widgets.on_refresh();
    dialog.add(widgets);  
    var w = 400;
    dialog.setPosition( window.innerWidth/2 - w/1.5, window.innerHeight/2 - 150 );       
}

/**
 * Show atmospherical scattering options in dialog
 * @method showAtmos
 */
GUI.prototype.showAtmos = function()
{
    var id = "Atmospherical scattering";
    var dialog_id = replaceAll(id," ", "-").toLowerCase();
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');
    var widgets = new LiteGUI.Inspector();

    // Atmos Component
    var AtmosComponent = RM.get('Atmos');

    if(AtmosComponent && AtmosComponent.create)
        AtmosComponent.create( widgets );

    dialog.add(widgets);  
    dialog.setPosition( 150, 150 );          
}

/**
 * Show atmospherical scattering options in dialog
 * @method showAtmos
 */
GUI.prototype.showTexTools = function()
{
    var id = "Texture Tools";
    var dialog_id = replaceAll(id," ", "-").toLowerCase();
    var w = 300;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');
    var widgets = new LiteGUI.Inspector();

    // Atmos Component
    var TexToolsComponent = RM.get('TextureTools');
    if(TexToolsComponent && TexToolsComponent.create)
        TexToolsComponent.create( widgets );

    dialog.add(widgets);  
    dialog.setPosition( 150, 150 );       
}

/**
 * Renders some GUI things
 * @method render
 */
GUI.prototype.render = function()
{
    /*if(this._canvas2d && this._fps_enable)
        this.renderFPS();*/

	// render here the histogram
	if( RM.get("Histogram") && RM.get("Histogram").enabled )
		RM.get("Histogram").execute( CORE._fx_tex );

	if(this._uniform_canvas)
	{
		var ctx = this._uniform_canvas.getContext("2d");
		ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);

		if(!this._uniform_list.length)
			return;

		ctx.globalAlpha = 0.25;
		ctx.fillStyle = "#FFF";
		ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
		ctx.globalAlpha = 1;
		ctx.font = "12px Monospace";

		var k = 12;
		var z = 10;

		for(var i in this._uniform_list)
		{
			var name = this._uniform_list[i];
			if(k > 150) { z += 160; k = 12; }
	
			var value = renderer._uniforms[name];
			value = value.toFixed ? value.toFixed(3) : value;

			if(value.constructor === Float32Array)
				continue;

			ctx.fillText( name + " " + value, z, k );
			k += 15;
		}
	}
}

/**
 * Update GUI each frame
 * @method update
 */
GUI.prototype.update = function(dt)
{
    if(this._must_update_panel)
	{
		this.updateSidePanel(null, "root");
		this._must_update_panel = false;
	}
}

/**
 * Hide fps counter
 * @method closeFPS
 */
GUI.prototype.closeFPS = function()
{
    // this._canvas2d.style.display = "none";
	CORE.stats.dom.style.display = "none";
}

/**
 * Show fps counter
 * @method closeFPS
 */
GUI.prototype.showFPS = function()
{
    // this._canvas2d.style.display = "block";
	CORE.stats.dom.style.display = "block";
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
	
	ctx.fillStyle = "#0F0";

	if(this._fps < 50)
		ctx.fillStyle = "#ff7f00";
	if(this._fps < 30)
		ctx.fillStyle = "#F00";
    
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
		case 'wbin':
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
    var dialog_id = replaceAll(id," ", "-").toLowerCase();
        
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, close: true, width: w, draggable: true });
    dialog.show('fade');

    var widgets = new LiteGUI.Inspector();

    var params = {
        filename: filename,
        size: 256,
        max: false,
		no_free_memory: false,
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
			
			if( filename.includes(".exr") ) {
	            RM.shader_macros['EM_SIZE'] = params["size"];
		        await CORE.reloadShaders();
			}

			CORE.set( filename, params );
        };

        reader.readAsArrayBuffer(file);
    }


    widgets.on_refresh = function(){

        widgets.clear();
        widgets.addString( "File", filename );
        if( !filename.includes('hdre') )
        {
			// update: remove 64 option
            widgets.addCombo( "Cubemap size", params.size,{width: "60%", name_width: "50%", values: ["128","256","512"], callback: function(v) {      
                params["size"] = parseInt(v);
            }});
        }
		widgets.addCheckbox("Don't clear memory", params.no_free_memory, {name_width: "50%",callback: function(v) {      
                params["no_free_memory"] = v;
            }});
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
	var that = this;

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
			that.loading();
            ImporterModule.processFileList([file], {}, function(f, res){ 
				CORE.addMesh(res, f);
				that.loading(0);	
			});
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
GUI.prototype.selectResource = function(options, tex_name)
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

		if(options.node) {
			node.textures[tex_name] = path;
			that.updateSidePanel(null, node.name);
		}

		if(options.callback)
			options.callback( HDRTool.getName(path) );
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

GUI.prototype.screenCapture = function()
{
	var options = options || {};
	var that = this;

    var id = "Take screenshot";
    var dialog_id = replaceAll(id, ' ', '').toLowerCase();
    var w = gl.canvas.width / 4;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, close: true, width: w, draggable: true });
    dialog.show('fade');
	dialog.root.style.minHeight = "0px";

	var data = null;
	
	var preview = document.createElement("img");
	preview.style.width = "100%";

	var widgets_top = new LiteGUI.Inspector();
	
	widgets_top.widgets_per_row = 2;
	widgets_top.addButton( null,"Capture", {callback: function(v){
	
		that.loading();
		gl.canvas.toBlob(function(v){ data = v; preview.src = URL.createObjectURL( data ); that.loading(0); });

	}} );
	widgets_top.addButton( null,"Save", {callback: function(v){
	
		if(data)
			LiteGUI.downloadFile("screenshot.png", data);
	}} );

	dialog.add( preview );
    dialog.add(widgets_top);  
    dialog.setPosition( renderer.canvas.width/2 - w/2, renderer.canvas.height/2 - renderer.canvas.height/5 ); 
}

/* COLLABORATIVE TOOL THING */

/**
 * Shows the dialog for selecting HDRE
 * @method selectHDRE 
 */
GUI.prototype.selectHDRE = function( files, options )
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

		// if callback, do not set anything
		if(options.callback) {
			options.callback(name);
			return;
		}

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
	
	// console.log(tex_name);
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