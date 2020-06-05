/*
*   author: Alex Rodriguez
*   @jxarco 
*/

/**
* Responsible of the GUI
* @class GUI
* @constructor
*/
	
var locations = {};

var GRAPH_AREA_HEIGHT = 350;

var skyboxSectionCollapsed = false;
var cameraSectionCollapsed = false;
var graphSectionCollapsed = false;

function GUI()
{
    if(this.constructor !== GUI)
        throw("Use new to create GUI");
    
	this._ctor();
	this.setup();
	// this.importData();
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
	this._showGizmos = true;
    this._color_picker = false;
	this._show_layers = false;
	this._must_update_panel = false;
	this._usePrem0 = true;
	this._show_deferred_textures = false;

    // tabs 
	this.editor = SCENE_TAB;
	
	// temp data
	this.preview_resources = {};
	this.use_cached_resources = true;
}

GUI.prototype.setup = function()
{
	var that = this;

	$(document.querySelector(".tool-showgrid")).on('click', function(){

		if(!grid)
			return;

        grid.visible = !grid.visible;
        
        if(grid.visible)
            $(this).addClass("enabled");
        else 
            $(this).removeClass("enabled");
    });
	
	$(document.querySelector(".tool-deferredtex")).on('click', function(){

        that.show_deferred_textures = !that.show_deferred_textures;
        
        if(that.show_deferred_textures)
            $(this).addClass("enabled");
        else 
            $(this).removeClass("enabled");
	});
	
	$(document.querySelector(".tool-forcerender")).on('click', function(){

        CORE._force_render_allFrames = !CORE._force_render_allFrames;
        
        if(CORE._force_render_allFrames)
            $(this).addClass("enabled");
        else 
            $(this).removeClass("enabled");
    });
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

    // get main area root and insert all canvas buttons
    var tools = document.querySelector("#canvas-tools");
   // var picker = document.querySelector(".pixelPicker");
    this._mainarea.root.appendChild( tools );
   // this._mainarea.root.appendChild( picker );
        
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
	uniform_canvas.style.display = "none";
    this._mainarea.content.appendChild(uniform_canvas);
    this._uniform_canvas = uniform_canvas;
	
	LiteGUI.draggable( this._uniform_canvas );

    // create the rest of panels
	this.createSidePanel();
	this.createBottomPanel();

	// 
	this._allCanvasArea.merge();
    
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
	/*mainmenu.add("File/Preferences/Render PBR channels", { type: "checkbox", instance: this, property: "_show_layers", callback: function(){ 
        CORE.setUniform("show_layers", that._show_layers);
    }});*/

	mainmenu.add("View/Fullscreen", { callback: function() { gl.fullscreen() } });
	mainmenu.separator("View");    
	mainmenu.add("View/Show FPS", { type: "checkbox", instance: this, property: "_fps_enable", callback: function() { 
		if(!that._fps_enable) that.closeFPS();
        else that.showFPS();
    }});
    /*mainmenu.add("View/Log", { type: "checkbox", instance: this, property: "_enable_log", callback: function(){ 
		$("#log").toggle();
	}});*/
	mainmenu.add("View/Show helpers", {  type: "checkbox", instance: this, property: "_showGizmos"});

	var scenes = RM.scenes;

    for(let s in scenes)
        mainmenu.add("Scene/Add model/" + scenes[s].name, { callback: function() {
            CORE.parse( scenes[s].name );
            gui.updateSidePanel(null, scenes[s].name );
        }});

    mainmenu.add("Scene/Primitive/Sphere", { callback: function() { CORE.addPrimitive('sphere'); } });
    mainmenu.add("Scene/Primitive/Plane", { callback: function() { CORE.addPrimitive('plane'); } });
	mainmenu.add("Scene/Primitive/Cube", { callback: function() { CORE.addPrimitive('cube'); } });
	mainmenu.separator("Scene");    
	mainmenu.add("Scene/Smooth camera", { type: "checkbox", instance: CORE.controller, property: "smooth"});

    mainmenu.add("Actions/Fit canvas", { callback: function() { resize(); } });
    mainmenu.add("Actions/Reload shaders", { callback: function() { CORE.reloadShaders() } });
    mainmenu.add("Actions/Reset scene", { callback: function() { CORE.reset(); }});
	mainmenu.add("Actions/Take screenshot", { callback: function() { gui.screenCapture(); }});

    mainmenu.add("Actions/Export Mesh (wBin)", { callback: function() {
        var picker = RM.Get('NodePicker');
        var node = picker ? picker.selected : null;
        if(!node)
        return;
        var mesh = gl.meshes[ node.mesh ];
        downloadBinary( mesh, "wbin" );
	} });
	
	mainmenu.add("Tools/Chroma Key Tools", { callback: function() { gui.showChromaTools(); }});
	mainmenu.add("Tools/Cubemap Tools", { callback: function() { gui.showCubemapTools(); }});
	mainmenu.add("Tools/Texture Tools", { callback: function() { gui.showTextureTools(); }});

    mainmenu.add("Help/Github page", { callback: function() { LiteGUI.alert("<a href='https://github.com/upf-gti/HDR4EU'>upf-gti/HDR4EU</a>", {title: "App Info"}) } });
    mainmenu.add("Help/Other demos", { callback: function() { LiteGUI.alert("<a href='https://webglstudio.org/users/arodriguez/demos/atmos'>Atmospherical scattering</a><br>"+
    "<a href='https://webglstudio.org/latest/player.html?url=fileserver%2Ffiles%2Farodriguez%2Fprojects%2FHDR4EU%2Fgreen.scene.json'>Chroma Keying</a><br>" +
	"<a href='https://webglstudio.org/users/arodriguez/demos/cr2parser'>Cr2 parser</a><br>", {title: "App Info"}) } });
    mainmenu.add("Help/Version", { callback: function() { LiteGUI.alert("APP v" + RM.version, {title: "App Info"}) } });
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
    var hdriTab = this.createTab("Assembly", "<img src='imgs/mini-icon-texture.png'>");

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
	// tab.appendChild(iconDiv);

	tab.addEventListener('click', function(e){
		
		document.querySelector(".tab.selected").classList.remove("selected");
        this.classList.add("selected");
        
        if(this.id == 'maintab'){

			that.editor = SCENE_TAB;
			CORE.graph_manager.graph.start();
			CORE.event_manager.bind();
		}
        else {
			that.editor = HDRI_TAB;
			CORE.graph_manager.graph.stop();
			HDRI.bind();
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
	var w = "17.5%";
	w = "350px"; // fix width?

    this._mainarea.split("horizontal",[null,w],false);
    var docked = new LiteGUI.Panel("right_panel", {title:'Inspector', scroll: true});
    this._mainarea.getSection(1).add( docked );
    $(docked).bind("closed", function() { this._mainarea.merge(); });
    this._sidepanel = docked;
	this.updateSidePanel( docked, 'root' );
	
	docked.content.id = "main-inspector-content";
	docked.content.style.width = w;

	locations[ "#mainarea" ] = this._mainarea.getSection(0).root;
}

GUI.prototype.createBottomPanel = function()
{
	var that = this;
	this._allCanvasArea = this._mainarea.getSection(0);
	this._allCanvasArea.split("vertical", [null, GRAPH_AREA_HEIGHT], true);

	this._allCanvasArea.onresize = function()
	{
		var graph_area = document.querySelector("#graph_area");
        if(!graph_area)
			document.querySelector(".litesplitbar").remove();
		
	}

	var canvas = document.createElement("canvas");
	canvas.id = "graph_canvas";
	canvas.width = $("#canvasarea")[0].clientWidth 	- 8;
    canvas.height = GRAPH_AREA_HEIGHT 				- 6;
    
	this._graphpanel = this._mainarea.getSection(0).getSection(1); 
	this._graphpanel.content.appendChild(canvas);
	this._graphpanel.content.id = "graph_area";

	var button = document.createElement("button");
	button.className = "litebutton single";
	button.style.top = "4px";
	button.style.right = "4px";
	button.style.position = "absolute";
	button.style.padding = "3px";
	button.style.backgroundColor = "#eee";
	button.innerHTML = "<img src='https://webglstudio.org/latest/imgs/close-icon.png'>";

	button.addEventListener('click', function(e){

		that._allCanvasArea.merge();

	});

	this._graphpanel.content.appendChild(button);

	if(!CORE)
	throw("core not instanced");

	if(!CORE.graph_manager)
		CORE.graph_manager = new GraphManager();
	else
	{
		CORE.graph_manager.open();
	}
}

GUI.prototype.updateSidePanel = function( root, item_selected, options )
{
    if(!item_selected)
	return;

	options = options || {};
	this.item_selected = item_selected;
	this.tab_selected = options.tab ? options.tab : null;
    root = root || this._sidepanel;
    $(root.content).empty();
    
	//side panel widget

    var mytree = this.updateNodeTree(scene.root);

    var litetree = new LiteGUI.Tree(mytree, {id: "tree", allow_multiselection: true, allow_rename: true});
	litetree.setSelectedItem(item_selected);
	var that = this;

	//bg click right mouse
	litetree.onItemContextMenu = function(e, el) { 

		e.preventDefault();
		var item = el.item;
		var node_id = el.data.id;

		if(!CORE)
		return;

		var node = CORE.getByName(node_id);
		if(!node) // is root 
		return;

		var actions = [
            {
                title: node.visible ? "Hide" : "Show", //text to show
				callback: function() { 
					node.visible = !node.visible;
					node.flags.ignore_collisions = !node.flags.ignore_collisions;
					that.updateSidePanel(null, node_id);

					if(RM.Get("NodePicker"))
					{
						if(!node.visible )
							RM.Get("NodePicker").unSelect();
					}
				}
			},
			
			{
                title: "Focus",
				callback: function() { 
					CORE.controller.onNodeLoaded(node, CORE.controller.camera.position);
				}
			},
			
			{
                title: "Copy",
				callback: function() { 
					LiteGUI.toClipboard( node.name );
				}
            },
          
            {
                title: "Delete", //text to show
                callback: function() { 
					if(RM.Get('NodePicker'))
                        RM.Get('NodePicker').delete( node );
					that.updateSidePanel(null, "root");
				}
            },
		];
		var contextmenu = new LiteGUI.ContextMenu( actions, { event: e });
	};

  	litetree.onItemSelected = function(data, node){
		var selection = data.id;

		if(RM.Get("NodePicker"))
		{
			if(selection !== 'root')
			RM.Get("NodePicker").select( CORE.getByName( selection ) );
			else
			RM.Get("NodePicker").unSelect();
		} 

		that.updateSidePanel( null, selection );
	};

   	litetree.root.addEventListener("item_dblclicked", function(e){
		
		
		e.preventDefault();
    });

	this.tree = litetree;
	var isRoot = item_selected === "root";

	$(root.content).append( litetree.root );

	var widgets_pre = new LiteGUI.Inspector();
    $(root.content).append(widgets_pre.root);
	
	widgets_pre.widgets_per_row = 2;
	widgets_pre.addButton( null, "Scene uniforms", {callback: function(){ that.updateSidePanel( that._sidepanel, "scene_options" ) }} );
	widgets_pre.addButton( null, "Add component", {callback: function(){ 
		
		that.showRootComponents();
	}});
	
    var widgets = new LiteGUI.Inspector();
    $(root.content).append(widgets.root);

    if(item_selected == 'root')
    {
       this.addRootInspector( widgets, options );
    }
    
	else if(item_selected == "scene_options")
    {
		for( let i in renderer._uniforms ) {

			if(renderer._uniforms[i] === undefined)
			continue;

			var value = renderer._uniforms[i];

			if(value.constructor == Float32Array)
			{
				if(value.length > 3)
					continue;
				else
					value = "[" + value[0].toFixed(2) + ", " + value[1].toFixed(2) + ", " + value[2].toFixed(2) + "]";
			}else if(value.constructor == Number)
				value = value.toFixed(3);

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
		widgets.addButton(null, "Remove all", {callback: function(){ 
			gui._uniform_list.length = 0; 
			gui._uniform_canvas.style.display = 'none';
		}});
    }
	else
    {
		var node = CORE.getByName(item_selected);
		if(node)
			this.addNodeInspector(node, widgets, options);
		
	}

	// update scroll position
	var element = root.content.querySelectorAll(".inspector")[1];
	var maxScroll = element.scrollHeight;
	element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
}

GUI.prototype.addRootInspector = function(widgets, options)
{
	var that = this;
	var camera = CORE.controller.camera, skybox = CORE.cubemap;

	/*
		NODE INFO -> testing components in tabs
	*/

	var tree = document.querySelector("#tree");
	var pansHeight = innerHeight - tree.offsetHeight - 85;

	var container = widgets.addContainer();
	container.style.width = "100%";
	container.style.height = "100%";
	container.style.display = "flex";

	var tabContainer = document.createElement("div");
	tabContainer.style.background = "#292929";
	tabContainer.style.width = "30px";
	tabContainer.style.height = (pansHeight) + "px";

	var infoContainer = document.createElement("div");
	infoContainer.className = "data-inspector";
	infoContainer.style.height = (pansHeight) + "px";

	container.appendChild( tabContainer );
	container.appendChild( infoContainer );

	var node_widgets = new LiteGUI.Inspector();
	$(infoContainer).append(node_widgets.root);

	// ADD TABS

	// add skybox
	var icon = "https://webglstudio.org/latest/imgs/mini-icon-dome.png";
	var tab = document.createElement('span');
	tab.title = "skybox";
	tab.className = "side-tab" + (options.tab ? "" : " selected");
	tab.innerHTML = "<img src=" + icon + " style='width: 100%;'>"
	tab.addEventListener('click', function(){
		$(".side-tab").removeClass("selected")
		this.classList.add( "selected" );
		node_widgets.on_refresh(  );
	});
	tabContainer.appendChild( tab );

	// add camera
	icon = "https://webglstudio.org/latest/imgs/mini-icon-camera.png";
	tab = document.createElement('span');
	tab.title = "camera";
	tab.className = "side-tab" + (options.tab && options.tab === "camera" ? " selected" : "");
	tab.innerHTML = "<img src=" + icon + " style='width: 100%;'>"
	tab.addEventListener('click', function(){
		$(".side-tab").removeClass("selected")
		this.classList.add( "selected" );
		node_widgets.on_refresh( "camera" );
	});
	tabContainer.appendChild( tab );

	// add graph
	icon = "https://webglstudio.org/latest/imgs/mini-icon-fx.png";
	tab = document.createElement('span');
	tab.title = "graph";
	tab.className = "side-tab" + (options.tab && options.tab === "graph" ? " selected" : "");
	tab.innerHTML = "<img src=" + icon + " style='width: 100%;'>"
	tab.addEventListener('click', function(){
		$(".side-tab").removeClass("selected")
		this.classList.add( "selected" );
		node_widgets.on_refresh( "graph" );
	});
	tabContainer.appendChild( tab );

	for (let c in RM.components)
	{
		var component = RM.components[c];
		if( component.mark && component.create )
		{
			var icon = component.constructor.icon;
			var tab = document.createElement('span');
			tab.title = c;
			tab.className = "side-tab" + (options.tab && options.tab === c ? " selected" : "");
			tab.innerHTML = "<img src=" + icon + " style='width: 100%;'>";
			tab.addEventListener('click', function(){
				$(".side-tab").removeClass("selected")
				this.classList.add( "selected" );
				node_widgets.on_refresh( c );
			});
			tabContainer.appendChild( tab );
		}
	}

	// ADD INFO

	node_widgets.on_refresh = (function( name )
	{
		node_widgets.clear();
		that.tab_selected = name;

		if(!name) // show mesh and material
		{
			var current_env = CORE._environment_set || {};

			node_widgets.widgets_per_row = 1;
			node_widgets.addSection("Skybox", {collapsed: skyboxSectionCollapsed, callback: function(no_collapsed){
					skyboxSectionCollapsed = !no_collapsed;
				}});
			
			node_widgets.addHDRE( "Browse server", CORE._environment );
			node_widgets.addList("Local files", RM.textures, {/*selected: current_env, */height: "90px", callback: function(v){
				gui.loading();
				CORE.set( v );
			}});
			node_widgets.widgets_per_row = 1;
			node_widgets.addSeparator();
			node_widgets.addTitle("Properties");
			node_widgets.addSlider("IBL Scale", renderer._uniforms["u_ibl_scale"], {callback: function(v){ CORE.setUniform("ibl_scale",v);}});
			node_widgets.addSlider("Rotation", renderer._uniforms["u_rotation"], {precision: 0, min:0,max:360,step:0.05, callback: function(v){ CORE.setUniform("rotation",v*DEG2RAD);}});
			node_widgets.addColor("Background color", CORE._background_color, {name_width: "50%", callback: function(color){ 
				CORE._background_color = color;
			}});
			node_widgets.widgets_per_row = 2;
			node_widgets.addCheckbox("Visible", skybox.flags.visible, {name_width: "55%", callback: function(v) { skybox.flags.visible = v; }});
			node_widgets.addCheckbox("Blur", this._usePrem0, {name_width: "55%", callback: function(v) { 
				that._usePrem0 = v; 
			}});
			node_widgets.addCheckbox("Flip X", renderer._uniforms["u_flipX"], {name_width: "55%", callback: function(v) { CORE.setUniform("flipX", v)}});
			node_widgets.widgets_per_row = 1;
		}

		else if(name === "camera")
		{
			node_widgets.widgets_per_row = 1;
			node_widgets.addSection("Camera", {collapsed: cameraSectionCollapsed, callback: function(no_collapsed){
				cameraSectionCollapsed = !no_collapsed;
			}});

			node_widgets.addCombo("Type", RD.Camera._Types[camera.type - 1], {values: RD.Camera._Types, callback: function(v){
				camera.type = parseInt(RD.Camera._Types.indexOf(v)) + 1;

				if(camera.type == RD.Camera.ORTHOGRAPHIC)
					camera.orthographic (camera.frustum_size, camera.near, camera.far, camera.aspect);
				else
					camera.perspective (camera.fov, camera.aspect, camera.near, camera.far);

			}});
			node_widgets.addSeparator();

			node_widgets.addVector3("Position",  camera.position, {callback: function(v){
				window.destination_eye = v;
				//camera.position = v;
			}});
			node_widgets.addVector3("Target", camera.target, {callback: function(v){
				camera.target = v;
			}});
			node_widgets.addSeparator();
			node_widgets.widgets_per_row = 2;
			node_widgets.addNumber("Near", camera.near, {name_width: "30%", min:0, step: 0.05, callback: function(v){
				CORE.controller.near = v;
			}});
			node_widgets.addNumber("Far", camera.far, {name_width: "30%", min:0, step: 10, callback: function(v){
				CORE.controller.far = v;
			}});
			node_widgets.widgets_per_row = 1;
			node_widgets.addNumber("Fov", camera.fov, {name_width: "30%", callback: function(v){
				camera.fov = v;
			}});
			node_widgets.addNumber("Frustum size", camera.frustum_size, {name_width: "30%", callback: function(v){
				camera.frustum_size = v;
			}});
			node_widgets.addSeparator();
			node_widgets.addButton(null, "Get current", {callback: function() { that.updateSidePanel(that._sidepanel, 'root')}});
		}

		else if(name === "graph")
		{
			node_widgets.widgets_per_row = 1;
			if(CORE.graph_manager)
				CORE.graph_manager.onInspect(node_widgets);
		}

		else
		{
			var component = RM.components[name];
			if( component.mark && component.create )
				component.create( node_widgets );
		}

		if(options.callback)
			options.callback(node_widgets);

	}).bind(this);

	node_widgets.on_refresh( options.tab );
}

GUI.prototype.addNodeInspector = function(node, widgets, options)
{
	var that = this;

	// update rotations
	node.rots = node.rots ? node.rots : vec3.create();

	// Put button to add node component
	var add_component_node = widgets.addButton(null, "&#10010; Add node component", {callback: function(){
		
		that.showNodeComponents(node);
	
	}});
	add_component_node.querySelector("button").classList.add("section-button");
	
	/*
		NODE INFO -> testing components in tabs
	*/

	var tree = document.querySelector("#tree");
	var pansHeight = innerHeight - tree.offsetHeight - 117;

	var container = widgets.addContainer();
	container.style.width = "100%";
	container.style.height = "100%";
	container.style.display = "flex";

	var tabContainer = document.createElement("div");
	tabContainer.style.background = "#292929";
	tabContainer.style.width = "30px";
	tabContainer.style.height = (pansHeight) + "px";

	var infoContainer = document.createElement("div");
	infoContainer.className = "data-inspector";
	infoContainer.style.height = (pansHeight) + "px";

	container.appendChild( tabContainer );
	container.appendChild( infoContainer );

	var node_widgets = new LiteGUI.Inspector();
	$(infoContainer).append(node_widgets.root);

	// ADD TABS

	// add mesh/transform tab
	var icon = "https://webglstudio.org/latest/imgs/mini-icon-mesh.png";
	var tab = document.createElement('span');
	tab.className = "side-tab" + (node._lastTab ? "" : " selected");
	tab.innerHTML = "<img src=" + icon + " style='width: 100%;'>"
	tab.addEventListener('click', function(){
		$(".side-tab").removeClass("selected")
		this.classList.add( "selected" );
		node_widgets.on_refresh("geo");
	});
	tabContainer.appendChild( tab );

	// add mesh material
	if(node.mesh)
	{
		icon = "https://webglstudio.org/latest/imgs/mini-icon-materialres.png";
		tab = document.createElement('span');
		tab.className = "side-tab" + (node._lastTab && node._lastTab == "mat" ? " selected" : "");
		tab.innerHTML = "<img src=" + icon + " style='width: 100%;'>"
		tab.addEventListener('click', function(){
			$(".side-tab").removeClass("selected")
			this.classList.add( "selected" );
			node_widgets.on_refresh( "mat" );
		});
		tabContainer.appendChild( tab );
	}

	if(node.components)
		for (let c in node.components)
		{
			var component = node.components[c];
			if( component.mark && component.create )
			{
				var icon = component.constructor.icon;
				var tab = document.createElement('span');
				tab.className = "side-tab" + (node._lastTab && node._lastTab == c ? " selected" : "");
				tab.innerHTML = "<img src=" + icon + " style='width: 100%;'>";
				tab.addEventListener('click', function(){
					$(".side-tab").removeClass("selected")
					this.classList.add( "selected" );
					node_widgets.on_refresh( c );
				});
				tabContainer.appendChild( tab );
			}
				
		}

	// ADD INFO

	node_widgets.on_refresh = (function(name)
	{
		node_widgets.clear();

		name = name || node._lastTab;

		if(name == "geo" || !name) // show mesh and material
		{
			if(node.mesh)
			{
				var mesh_path = node.mesh.slice( 0, node.mesh.lastIndexOf("/") + 1 );
				var mesh_name = node.mesh.slice( node.mesh.lastIndexOf("/") + 1, node.mesh.length );
	
				node_widgets.addSection("Geometry");
				var meshes = [mesh_name, "plane", "cube", "sphere", "circle", "cylinder", "cone", "torus" , "quartertorus", "halftorus"];
				node_widgets.addCombo("Mesh", mesh_name, {values: meshes, callback: function(v){
					node.mesh = v;
					if(v === mesh_name)
						node.mesh = mesh_path + v;
				}});
		
				if(gl.meshes[node.mesh])
				{
					var groups = gl.meshes[node.mesh].info.groups;
					var submesh_ids = ["All"];
			
					for(var i in groups)
						submesh_ids.push( groups[i].name );
			
					if(submesh_ids.length)
					{
						node_widgets.addCombo("Submesh", node.submesh || "All", {values: submesh_ids, callback: function(v){
						
							node.submesh = v;
							that.updateSidePanel(null, node.name);
								
							if(v == "All") node.draw_range = null;
							else 
							{
								var index = submesh_ids.indexOf(v) - 1; // remove "All"
								node.draw_range = [groups[index].start, groups[index].length];
							}
						}});
					}
				}
				
			}

			node_widgets.addSection("Transform");
			node_widgets.addVector3("Position", node.position, {callback: function(v){ node.position = v;  CORE.gizmo.updateGizmo();}});
			node_widgets.addVector3("Rotation", node.rots, {callback: function(v){ 
				
				var dt = vec3.create();
				dt = vec3.sub(dt, node.rots, v);
	
				node.rots = v;
	
				node.rotate(dt[0] * DEG2RAD, RD.LEFT);
				node.rotate(dt[1] * DEG2RAD, RD.UP);
				node.rotate(dt[2] * DEG2RAD, RD.FRONT);
				
				CORE.gizmo.updateGizmo();
	
			}});
			node_widgets.addVector3("Scale", node.scaling, {callback: function(v){ node.scaling = v; }});
			node_widgets.addNumber("Uniform scale", node.scaling[0], {step: 0.01, callback: function(v){ node.scaling = v; }});
			node_widgets.addButton(null, "Focus", {callback: function() {
	
				CORE.controller.onNodeLoaded( node );
			}});
		}

		else if(name === "mat")
		{
			this.addMaterial(node_widgets, node);
		}
		else
		{
			var component = node.components[name];
			if( component.mark && component.create )
				component.create( node_widgets );
		}

		// Update last tab opened
		node._lastTab = name;

	}).bind(this);

	node_widgets.refresh();
}

GUI.prototype.addMaterial = function(inspector, node)
{
	var that = this;

    // Parent node is abstract
    if(node.children.length)
    node = node.children[0];

	if(node.shader == "pbr") {

		inspector.addSection("Material");
		inspector.addTitle("Shader");
		inspector.addShader(null, node.shader, {node: node});
		inspector.addTitle("Basic properties");
		inspector.addColor("Base color", node._uniforms["u_albedo"], {callback: function(color){ node._uniforms["u_albedo"] = node._uniforms["u_color"] = color; }});
		inspector.addSlider("Roughness", node._uniforms['u_roughness'],{min:0,max:2,step:0.01,callback: function(v){ node._uniforms['u_roughness'] = v }});
		inspector.addSlider("Metalness", node._uniforms['u_metalness'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_metalness'] = v }});
		inspector.addNumber("Reflectance", node._uniforms['u_reflectance'] ,{max: 1.0, min: 0, step: 0.01, callback: function(v){ node._uniforms['u_reflectance'] = v }});
		inspector.addSeparator();

		inspector.addTitle("Blending");
		inspector.addSlider("Opacity", node._uniforms['u_alpha'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_alpha'] = v }});
		inspector.addSlider("Clipping", node._uniforms['u_alpha_cutoff'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_alpha_cutoff'] = v }});
		var blend_values = ["NONE", "ALPHA", "ADD", "MULTIPLY"];
		inspector.addCombo("Blend mode", blend_values[node.blend_mode],{values: blend_values,callback: function(v){ 
			node.blend_mode = blend_values.indexOf(v);
			if(node.blend_mode == RD.BLEND_ALPHA)
				node.render_priority = RD.PRIORITY_ALPHA;
			else
				node.render_priority = RD.PRIORITY_OPAQUE;
		}});

		inspector.addSeparator();
		inspector.addButton(null, "Edit flags", {callback: function(){
			that.showMaterialFlags(node);
		} })
		inspector.addTitle("Clear Coating (Multi-Layer materials)");
		inspector.addSlider("Clear coat", node._uniforms['u_clearCoat'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_clearCoat'] = v }});
		inspector.addSlider("Roughness", node._uniforms['u_clearCoatRoughness'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_clearCoatRoughness'] = v }});
		inspector.addColor("Tint color", node._uniforms["u_tintColor"], {callback: function(color){ node._uniforms["u_tintColor"] = color; }});
		inspector.addTitle("Anisotropy");
		inspector.addCheckbox("Enable", node._uniforms['u_isAnisotropic'],{callback: function(v){ node._uniforms['u_isAnisotropic'] = v }});
		inspector.addSlider("Anisotropy", node._uniforms['u_anisotropy'],{min:-1,max:1,step:0.01,callback: function(v){ node._uniforms['u_anisotropy'] = v }});
		inspector.addVector3("Direction", node._uniforms['u_anisotropy_direction'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_anisotropy_direction'] = v }});
		

		addMaterialTexture(inspector, node, this);
	}
    
	else if(node.shader.includes("phong"))
	{
		inspector.addColor("Ambient", renderer._uniforms["u_ambient"], {callback: function(color){ renderer._uniforms["u_ambient"] = color; }});
		inspector.addSection("Material");
		inspector.addTitle("Shader");
		inspector.addShader(null, node.shader, {node: node});
		inspector.addTitle("Basic properties");
		inspector.addColor("Base color", node._uniforms["u_albedo"], {callback: function(color){ node._uniforms["u_albedo"] = node._uniforms["u_color"] = color; }});
		inspector.addSlider("Diffuse", node._uniforms['u_diffuse_power'],{min:0,max:2,step:0.05,callback: function(v){ node._uniforms['u_diffuse_power'] = v }});
		inspector.addSlider("Specular", node._uniforms['u_specular_power'],{min:0,max:2,step:0.05,callback: function(v){ node._uniforms['u_specular_power'] = v }});
		inspector.addSlider("Shininess", node._uniforms['u_specular_gloss'],{min:1,max:20,step:0.05,callback: function(v){ node._uniforms['u_specular_gloss'] = v }});
		inspector.addSlider("Reflectivity", node._uniforms['u_reflectivity'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_reflectivity'] = v }});

		if(node.shader == "textured_phong")
		addMaterialTexture(inspector, node, this);
	}

	else 
	{
		inspector.addSection("Material");
		inspector.addTitle("Shader");
		inspector.addShader(null, node.shader, {node: node});
		addMaterialTexture(inspector, node, this);
	}
	
}

function addMaterialTexture(inspector, node, gui)
{
	inspector.addTitle("Textures");
	inspector.addSlider("Normal scale", node._uniforms['u_normalFactor'],{min:-1,max:2,step:0.01, callback: function(v){ node._uniforms['u_normalFactor'] = v }});
    inspector.addSlider("Bump scale", node._uniforms['u_bumpScale'],{min:0,max:5,step:0.01, callback: function(v){ node._uniforms['u_bumpScale'] = v }});
    inspector.addNumber("Emissive scale", node._uniforms['u_emissiveScale'],{name_width: "50%", min:0,max:100,step:0.05, callback: function(v){ node._uniforms['u_emissiveScale'] = v }});

    var that = gui;

    const filtered = Object.keys(node.textures)
        .filter(function(key){ return !key.includes("EnvSampler") && !key.includes("brdf") })
        .reduce(function(obj, key){
            obj[key] = node.textures[key];
            return obj;
        }, {});


    inspector.widgets_per_row = 1;

	inspector.addTexture( "albedo" , node.textures["albedo"], {node: node});
	inspector.addTexture( "normal" , node.textures["normal"], {node: node});

    // OJO CON ESTE
    for(let t in filtered) {

		if(t == 'albedo' || t == "normal")
		continue;
		
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

    var w = 400;
	var id = "Node flags";
	var title = id + " (" + node.name + ")";
	var dialog_id = replaceAll(id, ' ', '').toLowerCase();
	document.querySelectorAll( "#" + dialog_id ).forEach( e => e.remove() );
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: title, close: true, width: w, draggable: true });
    dialog.show('fade');

	var split = new LiteGUI.Split("material-flags-split",[50,50]);
	dialog.add(split);

	var widgets0 = new LiteGUI.Inspector();
	widgets0.addCheckbox( "Metallic-Rough Map", node._uniforms["u_metallicRough"] || false, {name_width: "70%", callback: function(v){
	
		node._uniforms["u_metallicRough"] = v;
	
	}} );
	widgets0.addCheckbox( "Two sided", node.flags.two_sided, {name_width: "70%", callback: function(v){
	
		node.flags.two_sided = v;
	
	}} );

	widgets0.addCheckbox( "Depth test", node.flags.depth_test === undefined ? true : node.flags.depth_test, {name_width: "70%", callback: function(v){
	
		node.flags.depth_test = v;
	
	}} );

	widgets0.addCheckbox( "Depth write", node.flags.depth_write === undefined ? true : node.flags.depth_write, {name_width: "70%", callback: function(v){
	
		node.flags.depth_write = v;
	
	}} );

	widgets0.addCheckbox( "Flip normals", node.flags.flip_normals, {name_width: "70%", callback: function(v){
	
		node.flags.flip_normals = v;
	
	}} );


	var widgets1 = new LiteGUI.Inspector();
	widgets1.addCheckbox( "Diffuse", node._uniforms["u_renderSpecular"], {name_width: "70%", callback: function(v){
	
		node._uniforms["u_renderDiffuse"] = v;
	
	}} );
	widgets1.addCheckbox( "Specular", node._uniforms["u_renderSpecular"], {name_width: "70%", callback: function(v){
	
		node._uniforms["u_renderSpecular"] = v;
	
    }} );
   
	split.sections[0].add(widgets0);
	split.sections[1].add(widgets1);
    dialog.setPosition( renderer.canvas.width/2 - w/2, renderer.canvas.height/2 - renderer.canvas.height/4 );          
}

GUI.prototype.showNodeComponents = function(node)
{
	var that = this;
	var id = "Node components";
    var dialog_id = id.replace(" ", "-").toLowerCase();
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');
    var widgets = new LiteGUI.Inspector();

	var selected = null;
	var components = RM.node_components.sort((a, b) => a.short_name.charCodeAt(0) - b.short_name.charCodeAt(0));

    widgets.on_refresh = function(){

        widgets.clear();
		widgets.widgets_per_row = 1;
		
		widgets.addList( null, components, {callback: function(v) { 
			
			selected = v;
		} });

		widgets.addSeparator();

		widgets.addButton(null, "Add", {callback: function(){
		
			if(selected) {
				
				var base_class = selected.base_class;

				// Control that param has necessary items
				if(!base_class || !base_class.constructor)
				throw('component class needed');

				var instance = new base_class(node);

				if(instance.setup)
				instance.setup();

				if(!node.components)
					node.components = {};

				node.components[selected.short_name] = instance;
				dialog.close();

				that.updateSidePanel(null, node.name );

			}
			
		}});
    }

    widgets.on_refresh();
    dialog.add(widgets);  
    dialog.setPosition( gl.canvas.width/2 - 200, 250 );
}

GUI.prototype.showRootComponents = function()
{
	var that = this;
	var id = "Components";
    var dialog_id = id.replace(" ", "-").toLowerCase();
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');
    var widgets = new LiteGUI.Inspector();

	var selected = null;
	var components = RM.classes;

    widgets.on_refresh = function(){

        widgets.clear();
		widgets.widgets_per_row = 1;
		
		widgets.addList( null, components, {callback: function(v) { 
			
			selected = v;
		} });

		widgets.addSeparator();

		widgets.addButton(null, "Add", {callback: function(){
		
			if(selected) {
				
				var base_class = selected;

				// Control that param has necessary items
				if(!base_class || !base_class.constructor)
				throw('component class needed');

				RM.registerComponent( base_class, base_class.name); 
                that.updateSidePanel(null, "root", {tab: base_class.name});
				dialog.close();
			}
			
		}});
    }

    widgets.on_refresh();
    dialog.add(widgets);  
    dialog.setPosition( gl.canvas.width/2 - 200, 250 );
}

GUI.prototype.showRenderSetting = function()
{
	var that = this;
	var id = "Render settings";
    var dialog_id = id.replace(" ", "-").toLowerCase();
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');
    var widgets = new LiteGUI.Inspector();

	var render_modes = ["Forward", "Deferred"];

    widgets.on_refresh = function(){

        widgets.clear();
		widgets.widgets_per_row = 1;
		
		widgets.addCombo("Render mode", render_modes[CORE.render_mode], {values: render_modes, name_width: '50%', callback: function(v) { 
			that.render_mode = render_modes.indexOf(v); 
		}});
		widgets.addNumber("IBL Scale", renderer._uniforms["u_ibl_intensity"], {min:0.0, max: 10, callback: function(v){ CORE.setUniform('ibl_intensity', v); }});
		widgets.addCheckbox("Correct Albedo",  renderer._uniforms["u_gamma_albedo"], {name_width: '50%', callback: function(v){  CORE.setUniform('gamma_albedo', v); }});
	
		/*if(CORE.render_mode == RM.FORWARD) {
			
		}
		else {
			widgets.addTitle('SSAO');
			widgets.addCheckbox("Enable", true, {name_width: '50%', callback: function(v){ CORE.setUniform('enableSSAO', v); }});
			widgets.addSlider("Kernel radius", renderer._uniforms['u_radius'], {min:0.01,max:5,step:0.01,callback: function(v) { CORE.setUniform('radius', v); }});
			widgets.addSlider("Discard Z", renderer._uniforms['u_z_discard'], {min:0.01,max:1,step:0.01,callback: function(v) { CORE.setUniform('z_discard', v); }});
			widgets.addSlider("Normal Z", renderer._uniforms['u_normal_z'], {min:0.01,max:5,step:0.01,callback: function(v) { CORE.setUniform('normal_z', v); }});
			widgets.addCombo("Output", 'Default', {values: ['Default', 'SSAO', 'SSAO + Blur', 'Depth', 'Normal'], name_width: '50%', callback: function(v) { 
				var values = $(this)[0].options.values;
				CORE.setUniform('outputChannel', parseFloat(values.indexOf(v)));
			}});
			widgets.widgets_per_row = 2;
			widgets.addNumber("Min distance", 0.001.glow_threshold, {min:0.001,max:0.05,step:0.001,callback: function(v) {  }});
			widgets.addNumber("Max distance", 0.01, {min:0.01,max:0.5,step:0.01,callback: function(v) {  }});
		}*/
    }

    widgets.on_refresh();
    dialog.add(widgets);  
    dialog.setPosition( gl.canvas.width/2 - 200, 250 );
}

GUI.prototype.showSessionDialog = function()
{
	var that = this;
	var id = "Open session";
    var dialog_id = id.replace(" ", "-").toLowerCase();
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');
    var widgets = new LiteGUI.Inspector();

	var user = null;
	var pass = null;
	var user_input;
	var pass_input;

    widgets.on_refresh = function(){

        widgets.clear();
		widgets.widgets_per_row = 1;
		
		user_input = widgets.addString( "User", user || "", {focus: true, callback: function(v) { 
			
			user = v;
		} });

		widgets.addString( "Password", pass || "", {password: true, callback: function(v) { 
			
			pass = v;
		} });

		widgets.addSeparator();

		widgets.addButton(null, "Login", {callback: function(){
		
			if(user && pass) {
				CORE.FS.onReady(user, pass);
				dialog.close();
			}
			
		}});
    }

    widgets.on_refresh();
    dialog.add(widgets);  
	dialog.setPosition( gl.canvas.width/2 - 200, 250 );
	
	$(user_input.content.querySelector("input")).focus();
}	
	

GUI.prototype.updateNodeTree = function(root)
{
	var mytree = {'id': "root"};
	
    var children = [];

    for(var i = 0; i < root.children.length; i++)
    {
        var node = root.children[i];
        var child = {};
        if(node._nogui) continue;
		child['id'] = node.name;
		child['node_visible'] = node.visible;
        if(node.children.length)
        {
            var children_ = [];

            for(var j = 0; j < node.children.length; j++)
            {
                var node_ = node.children[j];
				var child_ = {};

				if(!node_.name)
				node_.name = "child" + j;

				child_['id'] = node_.name;
				child_['node_visible'] = node_.visible;
                children_.push(child_);
            }

        	child['children'] = children_;
        }

        children.push(child);
    }

	// mytree['postcontent'] = '<button href="."> test </button>';
	mytree['children'] = children;
	mytree['node_visible'] = true;

    return mytree;
}

GUI.prototype.textToCanvas = function(event)
{
	if(!event) 
	return;

	var uniform = event.dataTransfer.getData('uniform');
	this._uniform_list.push(uniform);

	if(this._uniform_list.length)
		this._uniform_canvas.style.display = 'block';
}

GUI.prototype.sectionToCanvas = function(event)
{
	if(!event) return;

	var name = event.dataTransfer.getData('component');
	let component = RM.Get( name );

	if(!component || window.node)
		component = window.node.components[name];
	
	component.mark = false;

	var options = options || {};
	var that = this;

	var toSide = function()
	{
		dialog.close();
		component.mark = true;
		that.updateSidePanel(null, window.node ? window.node.name : "root");
	}

    var id = name;
    var dialog_id = replaceAll(id, ' ', '').toLowerCase();
    var w = 350;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, width: w, draggable: true, sided: true, sideCallback: toSide });
    dialog.show('fade');

	var widgets = new LiteGUI.Inspector();
	if(component.create)
		component.create(widgets, true);

	widgets.addButton(null, "Detach window", {callback: function(){
		dialog.detachWindow(null, function(){

			component.mark = true;
			that.updateSidePanel(null, window.node ? window.node.name : "root");
		});
	}})

	dialog.add( widgets );
    dialog.setPosition( event.clientX, event.clientY );  

	// update side panel
	this.updateSidePanel(null, window.node ? window.node.name : "root");
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
	//text.innerHTML += "<br><b>" + current_image.exp_time || "" + "</b>";

	/*var buttons = document.createElement("div");
	buttons.innerHTML = "<button data-target='" + current_image.name + "' class='litebutton mini-button edit-button'><i style='font-size:12px;'class='material-icons'>edit</i></button>";
	buttons.innerHTML += "<button data-target='" + current_image.name + "' class='litebutton mini-button remove-button'>" + LiteGUI.special_codes.close + "</button>";*/
	
	container.appendChild( image );
	container.appendChild( info );
	info.appendChild( text );
	//info.appendChild( buttons );

	return container;
}

/**
 * Export environment options
 * @method exportEnvironment
 */
GUI.prototype.exportEnvironment = function()
{
	var that 			= this;
	var saveSH 			= false;
	var bits 			= "32 bits";
	var format	 		= "RGB";
	var upload_to_repo 	= false;
	var selected_tags 	= {};
	var new_filename = null;

    var inner_local = function() {

		alert.close();

		var n_channels = format.length;

		if(bits === "8 bits")
            HDRTool.getSkybox( {type: Uint8Array, saveSH: saveSH, channels: n_channels} );
        if(bits === "16 bits")
            HDRTool.getSkybox( {type: Uint16Array, saveSH: saveSH, channels: n_channels});
        if(bits === "32 bits")
            HDRTool.getSkybox( {saveSH: saveSH, channels: n_channels} );
        else
			HDRTool.getSkybox( {rgbe: true, saveSH: saveSH, channels: n_channels} ); // RGBE
	};
	
	var inner_repo = function() {

		alert.close();

		var buffer = HDRTool.getSkybox( {upload: true, saveSH: saveSH} );
		var metadata = {
			tags: Object.keys(selected_tags),
			size: buffer.byteLength / 1e6
		}

		var filename = new_filename || CORE._environment.replace(".exr", ".hdre");

		CORE.FS.uploadData("hdre", buffer, filename, metadata).then(function(){

			gui.createPreview( CORE._environment, filename )

		});
		
    };
		
	var values  = ["8 bits","16 bits", "32 bits", "RGBE"];

	var alert = LiteGUI.alert("", {title: "Export environment", width: 400, height: 350, noclose: true});

	var widgets = new LiteGUI.Inspector();
	widgets.addString("Filename", CORE._environment.replace(".exr", ".hdre"), {callback: function(v){

		new_filename = v;

	}});

	widgets.addSeparator();
	widgets.addTitle("Channel info");

	var format_values = ["RGB", "RGBA"];
	widgets.addCombo("Format", format, {name_width: "60%", values: format_values, callback: function(v){
		format = v;
	}});
	widgets.addCombo("Bits per channel", bits, {name_width: "60%", values: ["8 bits","16 bits", "32 bits", "RGBE"], callback: function(v){
		bits = v;
	}});

	widgets.addTitle("PBR info");
	widgets.addCheckbox("Save spherical harmonics", saveSH, {name_width: "75%", callback: function(v){ saveSH = v; }})

	widgets.addSeparator();

	widgets.addTags( "Tags","empty", {values: ["empty","outdoor","indoor","nature","urban","night","skies"], callback: function(v){
		
		selected_tags = {};
		Object.assign(selected_tags, v);
	}} );

	widgets.widgets_per_row = 2;
	widgets.addButton(null, "Upload to repository", {callback: inner_repo});
	widgets.addButton(null, "Save to disc", {callback: inner_local});
	widgets.widgets_per_row = 1;

    alert.add( widgets );
    alert.setPosition( window.innerWidth/2 - 200, window.innerHeight/2 - 175 );
}

/**
 * Cubemap tools
 * @method showCubemapTools
 */
GUI.prototype.showCubemapTools = function()
{
    var id = "Cubemap tools";
	var dialog_id = id.replace(" ", "-").toLowerCase();
	
	if(document.querySelector("#"+dialog_id))
	document.querySelector("#"+dialog_id).remove();

    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');
    var widgets = new LiteGUI.Inspector();

	var error = false;
	var face_data = [];
	var files_loaded = 0;
	
	var face_to_drag;
	var drop_zone;

    widgets.on_refresh = function(){

		widgets.clear();
		
		widgets.addSection("HDRE");
		widgets.addButton( "Convert EXR to HDRE", "Export", {name_width: "70%", callback: function() { gui.exportEnvironment() } });
		widgets.addButton( "Update repo preview", "Update", {name_width: "70%", callback: function() { gui.createPreview( CORE._environment ) } });
		widgets.addSeparator();

		widgets.addSection("Cubemap from Images");
		
		face_to_drag = widgets.addInfo("Drag FRONT face");
		widgets.addSeparator();

		drop_zone = widgets.addContainer("dropzone_cubemap_images", {id: "dropzone_cubemap_images"});
		drop_zone.innerText = "Drop here";
		widgets.addSeparator();

		drop_zone.ondragover = () => {return false};
		drop_zone.ondragend = () => {return false};
		drop_zone.ondrop = function(e) {
			
			e.preventDefault();
			e.stopPropagation();

			var files = ImporterModule.getFilesFromEvent(e);
			
			// sort files (faces, in fact)
			
			let file = files[0],
				name = file.name,
				tokens = name.split("."),
				extension = tokens[tokens.length-1].toLowerCase(),
				valid_extensions = [ 'png', 'jpg', "jpeg" ];

			if(valid_extensions.lastIndexOf(extension) < 0)
			{
				drop_zone.innerHTML += "<p style='color: red'>" + name + " ****** Invalid file extension ******" + "</p>";
				error = true;
			}
			else
			{
				if(files_loaded == 0)
					drop_zone.innerHTML = "";
				drop_zone.innerHTML += "<p style='color: rgb(14, 204, 30);'>" + name + "</p>";
				var reader = new FileReader();
				reader.onload = function(e) {
				
					var img = null;

					switch(extension)
					{
						case "jpg":
						case "jpeg":
							img = HDRTool.parseJPG(e.target.result);
							break;
						case "png":
							img = HDRTool.parsePNG(e.target.result);
							break;
					}

					face_data.push( img );
					files_loaded++;
					
					switch(files_loaded)
					{
						case 1:
							face_to_drag.innerText = "Drag BACK face";
							break;
						case 2:
							face_to_drag.innerText = "Drag BOTTOM face";
							break;
						case 3:
							face_to_drag.innerText = "Drag TOP face";
							break;
						case 4:
							face_to_drag.innerText = "Drag RIGHT face";
							break;
						case 5:
							face_to_drag.innerText = "Drag LEFT face";
							break;
						case 6:
							face_to_drag.innerText = "";
							break;
					}

				}
				reader.readAsArrayBuffer(file);
			}
		};

		widgets.widgets_per_row = 2;

        widgets.addButton( null, "Reset", {width: "35%", callback: function() { 
		
			files_loaded = 0;
			face_data.length = 0;

			widgets.on_refresh();

		} });

		widgets.addButton( null, "Generate", {width: "35%", callback: function() { 
		
			/*if(error || face_data.length !== 6)
				throw("Reload files please")*/
			
			HDRTool.cubemapFromImages( face_data );
		} });

		widgets.widgets_per_row = 1;
    }

    widgets.on_refresh();
    dialog.add(widgets);  
    dialog.setPosition( 100, 100 );       
}

/**
 * Chroma tools
 * @method showChromaTools
 * @param {SceneNode} node
 */
GUI.prototype.showChromaTools = function(chromaNode)
{
    var id = "Chroma Key tools";
	var dialog_id = id.replace(" ", "-").toLowerCase();
	
	if(document.querySelector("#"+dialog_id))
	document.querySelector("#"+dialog_id).remove();

	var w = 400;
	var that = this;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');

	var widgets = new LiteGUI.Inspector();
	var chroma_texture = null;
	var chromaNode = chromaNode || null;
	
	if(chromaNode)
	{
		chroma_texture = chromaNode.textures["chroma"];
	}
	
	// step to show
	var step_preview = "Original";

	var options = {

		blur: {
			iterations: 2,
			intensity: 1,
			offset: 1
		},
		color: {
			enable: true,
			factor: 1,
			blur: false
		},
		normal: {
			strength: 2.5,
			flipR: false,
			flipG: false,
			flipB: false,
			blur: true, 
			force_update: false
		}
	}

    widgets.on_refresh = function(){

        widgets.clear();
		widgets.addSection("Chroma Image");

		widgets.addTexture(null, chroma_texture, {name: "chroma", callback: function(name, tex){

			chroma_texture = name;
			widgets.on_refresh();

			if(node)
			{
				node.components["ChromaKey"].setChroma(name);
				that.updateSidePanel(null, node.name);
			}

		}});

		widgets.addButton( null, "From current node", {width: "35%", callback: function() { 

			if(node) {
				chroma_texture = node.textures["chroma"] || null;
				chromaNode = node;
			}
			
			widgets.on_refresh();
		} });

		widgets.addTitle("2D Normals");
		
		widgets.addInfo("<b>BLUR</b>");
		widgets.widgets_per_row = 3;
		widgets.addNumber("Offset", options.blur.offset, {name_width: "45%", callback: function(v){ options.blur.offset = v; }});
		widgets.addNumber("Intensity", options.blur.intensity, {name_width: "45%", callback: function(v){ options.blur.intensity = v; }});
		widgets.addNumber("Iterations", options.blur.iterations, {name_width: "45%", callback: function(v){ options.blur.iterations = v; }});
		widgets.addSeparator();

		widgets.widgets_per_row = 1;

		widgets.addInfo("<b>COLOR ADDITION</b>");
		widgets.widgets_per_row = 3;
		widgets.addCheckbox("Add color", options.color.enable, {name_width: "75%", callback: function(v){ options.color.enable = v; }});
		widgets.addCheckbox("Blur", options.color.blur, {name_width: "75%", callback: function(v){ options.color.blur = v; }});
		widgets.addNumber("Factor", options.color.factor, {name_width: "45%", callback: function(v){ options.color.factor = v; }});
		widgets.addSeparator();

		widgets.widgets_per_row = 1;

		widgets.addInfo("<b>GENERATE NORMAL<b>", null, {name_width: "100%"});
		widgets.widgets_per_row = 3;
		widgets.addNumber("Strength", options.normal.strength, {name_width: "45%", callback: function(v){ options.normal.strength = v; }});
		widgets.addCheckbox("Blur", options.normal.blur, {callback: function(v){ options.normal.blur = v; }});
		
		/*widgets.widgets_per_row = 3;
		widgets.addCheckbox("Flip R", options.normal.flipR, {name_width: "45%", callback: function(v){ options.normal.flipR = v; }});
		widgets.addCheckbox("Flip G", options.normal.flipG, {name_width: "45%", callback: function(v){ options.normal.flipG = v; }});
		widgets.addCheckbox("Flip B", options.normal.flipB, {name_width: "45%", callback: function(v){ options.normal.flipB = v; }});*/
		widgets.addSeparator();

		widgets.widgets_per_row = 1;

		widgets.addButton( null, "Generate", {callback: function() { 

			if(!GFX.generate2DNormals(chroma_texture, chromaNode, options))
			return;

			step_preview = "Normals";
			//console.log("normals generated!");
			widgets.on_refresh();
		} });

		widgets.addTitle("Preview:");

		widgets.addCombo("Show step", step_preview, {values: ["Original", "Borders", "Blur", "ColorBlur", "Normals"], callback: function(v){

			step_preview = v;
			widgets.on_refresh();
		}})

		if(!chroma_texture)
		return;

		widgets.addButton( null, "Assign to current node", {callback: function() { 

			if(node) {

				// chroma node is a video? 
				// var isVideo = node.components["Chroma Key"]._isVideo;

				node.textures["chroma"] = chroma_texture;
				node.textures["normal"] = "@Normals_" + chroma_texture;
				node._uniforms["u_hasChromaNormalTexture"] = true;

				var tex = gl.textures[chroma_texture];

				var w = tex.width,
				h = tex.height;

				var aspect = w/h;

				node.scaling = 1;
				node._scale[0] *= aspect;
				node.updateMatrices();

				that.updateSidePanel(null, node.name);
			}
		} });

		widgets.addSeparator();

		var preview_container = widgets.addContainer();
		preview_container.style.width = "100%";

		var tex_name = (step_preview === "Original" ? "" : "@" + step_preview + "_") + chroma_texture; 
		var url = that.preview_resources[tex_name] || null;

		if(true/*!url || !that.use_cached_resources*/)
		{
			var tex = gl.textures[tex_name];
			if(!tex)
			return;

			console.log("creating data url");
			var canvas = tex.toCanvas();
			url = canvas.toDataURL();
			that.preview_resources[tex_name] = url;
		}

		preview_container.innerHTML = "<img style='transform: scaleY(-1); width: 100%;' src='" + url + "'>";
    }

    widgets.on_refresh();
    dialog.add(widgets);  
    dialog.setPosition( 100, 100 );       
}

/**
 * Texture Tools -> conversions, resizings, etc
 * @method showTextureTools
 */
GUI.prototype.showTextureTools = function()
{
    var id = "Texture tools";
	var dialog_id = id.replace(" ", "-").toLowerCase();
	
	if(document.querySelector("#"+dialog_id))
	document.querySelector("#"+dialog_id).remove();

	var that = this;
    var w = 400;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
    dialog.show('fade');
    var widgets = new LiteGUI.Inspector();

	var used_textures = {"R": null, "G": null, "B": null, "A": null};
	var result_name = "tex_pack";
	var empty_channel_value = vec4.fromValues(0,0,0,1);
	var result_size = vec2.fromValues(512,512);
	var custom_size = false;

	var inner_wrap = function ()
	{
		var textures = [];
		var index = 0;

		for(var i in used_textures )
		{
			index++;
			var tex = gl.textures[ used_textures[i] ];
			if(tex)
				textures.push( {texture: tex, channel: index} );
		}

		if(!textures.length)
		return;

		// draw new texture here
		var tex0 = textures[0].texture;
		var width = tex0.width;
		var height = tex0.height;

		if(custom_size)
		{
			width = result_size[0];
			height = result_size[1];
		}

		var result = new Texture(width, height, {type: GL.UNSIGNED_BYTE, format: GL.RGB});
		var shader = gl.shaders["workflow_wrap"];

		if(!shader)
		{
			console.error("no shader");
			return;
		}

		var channels_used = vec4.fromValues(
			used_textures["R"] ? 1 : 0,
			used_textures["G"] ? 1 : 0,
			used_textures["B"] ? 1 : 0,
			used_textures["A"] ? 1 : 0,
		);

		var uniforms = {
			u_channels: channels_used,
			u_fill: empty_channel_value,
			u_textureA: 1,
			u_textureB: 2,
			u_textureC: 3,
			u_textureD: 4,
		}

		result.drawTo(function()
		{
			for(var i = 0; i < textures.length; ++i)
			{
				var tex = textures[i].texture;
				tex.bind( textures[i].channel );
			}

			shader.uniforms(uniforms).draw(Mesh.getScreenQuad(), gl.TRIANGLES);

			for(var i = 0; i < textures.length; ++i)
				textures[i].texture.unbind();

		});
		
		gl.textures[ result_name ] = result;
		widgets.on_refresh();
	}
	
    widgets.on_refresh = function(){

        widgets.clear();
		widgets.widgets_per_row = 1;

		/*widgets.addTitle("Edit texture");

		widgets.addInfo(null, "TODO: Resize, blur, POT, clone...");
		widgets.addTexture( "Texture", "", {on_delete: function(){ 
			
		}, callback: function(v, t, p){  }} );*/

		widgets.addTitle("Texture packing");
		widgets.addInfo(null, "Metal, rough and occ in one texture");

		if(used_textures["R"])
			widgets.addTexture( "R Channel", used_textures["R"], {on_delete: function(){ 
				used_textures["R"] = null;
				widgets.on_refresh();
			}, callback: function(v, t, p){ used_textures["R"] = p; widgets.on_refresh(); }} );
		if(used_textures["G"])
			widgets.addTexture( "G Channel", used_textures["G"], {on_delete: function(){ 
				used_textures["G"] = null;
				widgets.on_refresh();
			}, callback: function(v, t, p){ used_textures["G"] = p; widgets.on_refresh();}} );

		if(used_textures["B"])
			widgets.addTexture( "B Channel", used_textures["B"], {on_delete: function(){ 
				used_textures["B"] = null;
				widgets.on_refresh();
			}, callback: function(v, t, p){ used_textures["B"] = p; widgets.on_refresh();}} );
		if(used_textures["A"])
			widgets.addTexture( "Alpha", used_textures["A"], {on_delete: function(){ 
				used_textures["A"] = null;
				widgets.on_refresh();
			}, callback: function(v, t, p){ used_textures["A"] = p; widgets.on_refresh();}} );
		
		widgets.widgets_per_row = 8;
		for(let i in used_textures)
		{
			if(!used_textures[i])
				widgets.addButton( null, "+"+i, {callback: function(){
					used_textures[i] = "white";
					widgets.on_refresh();
				}});
		}
		widgets.widgets_per_row = 1;

		widgets.addSeparator();
		widgets.addString( "Name", result_name, {callback: function(v){result_name = v;}});
		widgets.addVector4( "Fill empty", empty_channel_value, {callback: function(v){empty_channel_value = v;}});
		widgets.widgets_per_row = 2;
		widgets.addCheckbox( "Custom size", custom_size, {callback: function(v){
			custom_size = v;
			widgets.on_refresh();
		}} );
		widgets.addVector2( null, result_size, {disabled: !custom_size, callback: function(v){result_size = v;}});
		widgets.widgets_per_row = 3;
		widgets.addButton( null, "View resources", {callback: that.selectResource.bind(that, {title: "Resources"}) });
		widgets.addButton( null, "Pack", {callback: inner_wrap});
		widgets.addButton( null, "Download", {callback: function(){

			HDRTool.downloadTexture( result_name );

		}});
		widgets.widgets_per_row = 1;
		widgets.addSeparator();

		var preview_container = widgets.addContainer();
		preview_container.style.width = "100%";

		var tex = gl.textures[result_name];
		if(!tex)
		return;

		var canvas = tex.toCanvas(null, null, 256);
		var url = canvas.toDataURL();
		preview_container.innerHTML = "<img title='" + tex.width + ", " + tex.height + "' style='transform: scaleY(-1); width: 100%;' src='" + url + "'>";

    }

    widgets.on_refresh();
    dialog.add(widgets);  
    dialog.setPosition( 100, 100 );       
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
		// console.log(boo);
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
			element.download = filename + '.json';
			element.style.display = 'none';
			$(document.body).append(element);
			element.click();
		}
		else {
		
			CORE.FS.uploadFile("scenes",new File([boo], filename + ".json"), []);
				
			// upload thb
			canvas.toBlob(function(e){
				CORE.FS.uploadFile( "scenes", new File([e], filename + ".png"), [] );
			});
			
		}
		
    };

	var data;
	var filename = "export";

	gl.canvas.toBlob(function(v){ 
		
		data = v;
		var url =  URL.createObjectURL( data );
		var choice = LiteGUI.choice("<img src='" + url + "' width='100%'>", ["Local","Server"], inner, {title: "Save scene", width: 400});

		var widgets = new LiteGUI.Inspector();
		widgets.addString( null, filename, {callback: function(v){ filename = v; }} );

		choice.add( widgets.root );
		choice.setPosition( window.innerWidth/2 - 200, window.innerHeight/2 - 200 ); 
	});
	
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
        widgets.addList( null, files, {height: "150px", /*selected: selected, */callback: function(v) {
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
 * Renders some GUI things
 * @method render
 */
GUI.prototype.render = function()
{
	if(this._uniform_canvas)
	{
		var ctx = this._uniform_canvas.getContext("2d");
		ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);

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
            this.onDragMesh( file, extension);
            break;
        case 'hdre':
		case 'hdrec':
        case 'exr':
		case 'hdr':	
            this.onDragEnvironment(file);
            break;
        case 'png':
        case 'jpg':
		case 'jpeg':
            var reader = new FileReader();
            reader.onprogress = function(e){  $("#xhr-load").css("width", parseFloat( (e.loaded)/e.total * 100 ) + "%") };
            reader.onload = function (event) {

                that.onDragTexture(file, extension, event.target.result);
            };
            reader.readAsArrayBuffer(file);
            return false;
			break;
		default:
			var parser = RM.formats[extension];	
			if(parser)
				parser.load(file, function( data ){

					console.log("dae loaded", data);
				});
            break;
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
        dialog.close();
    
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
			
			if( includes(filename, [".exr", ".hdr"]) ) {
	            RM.shader_macros['EM_SIZE'] = params["size"];
		        await CORE.reloadShaders();
			}
			
			CORE.set( filename, params );
        };

        reader.readAsArrayBuffer(file);
    }


    widgets.on_refresh = function(){

        widgets.clear();
        widgets.addString( "File", filename, {disabled: true} );
        if( !filename.includes('hdre') )
        {
            widgets.addCombo( "Cubemap size", params.size,{width: "60%", name_width: "50%", values: ["64", "128","256", "512"], callback: function(v) {      
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
 * @param {arraybuffer} data 
 */
GUI.prototype.onDragTexture = function(file, extension, data)
{
	var filename = file.name;

    var id = 'Import texture' ;
    var dialog_id = replaceAll(id, ' ', '').toLowerCase();
	var w = 400;
	var that = this;
    var dialog = new LiteGUI.Dialog( {id: dialog_id + uidGen.generate(), parent: "body", title: id, close: true, width: w, draggable: true });
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
    if(includes(filename, ['emissive', 'emission'])) params.texture_type = 'Emissive';
	if(includes(filename, ['height'])) params.texture_type = 'Height';
	if(includes(filename, ['alpha', 'opa'])) params.texture_type = 'Opacity';

    widgets.on_refresh = function(){

		console.log(file);

        widgets.clear();
		widgets.addString( "File", filename );
		widgets.addInfo( "Bytes", (file.size/1e6).toFixed(3) + " MBs");
		widgets.addInfo( "Type", file.type);
        widgets.addCombo( "Use as", params.texture_type,{width: "60%", name_width: "50%", values: ["Albedo","Normal","Roughness","Metalness", "AO", "Opacity","Emissive", "Height"],
            callback: function(v){ params["texture_type"] = v; }
        });
		widgets.addSeparator();
		widgets.widgets_per_row = 2;
        		
		widgets.addButton( null, "Import to memory", {callback: function(){
            
			function inner_processed(filename, texture)
			{
				gl.textures[ filename ] = texture;
			}

			if(RM.processImage(filename, extension, data, inner_processed))
				dialog.close();
		}});
		
		widgets.addButton( null, "Apply to node", {callback: function(){
            
			function inner_processed(filename, texture, options)
			{
				var node = RM.Get('NodePicker').selected;

				if(!node)
					node = CORE.getByName( that.item_selected )

				var type = params.texture_type.toLowerCase();

				// skip environment and grid
				if(!node && CORE.root.children.length >= 3)
					node = CORE.root.children[2];

				if(!node) {
					LiteGUI.showMessage("Add one node first", {title: "Error"});
					return;
				}

				gl.textures[ filename ] = texture;
				node.textures[ type ] = filename;
				node.setTextureProperties();
				that.updateSidePanel(null, node.name);
			}

			if(RM.processImage(filename, extension, data, inner_processed))
				dialog.close();
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
GUI.prototype.onDragMesh = function(file, extension)
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
            
			dialog.close();
			that.loading();

			var reader = new FileReader();
            reader.onprogress = function(e){  $("#xhr-load").css("width", parseFloat( (e.loaded)/e.total * 100 ) + "%") };
            reader.onload = function (e) {
                
					if(RM.formats[extension])
					{
						var mesh_data = RM.formats[extension].parse(e.target.result);
						var mesh = GL.Mesh.load( mesh_data );
						CORE.addMesh(mesh, extension, filename);
						
						that.loading(0);	
					}

            };
            reader.readAsText(file);
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

    var id = options.title || "Select resource";// (" + options.type + ")";
	var dialog_id = replaceAll(id, ' ', '').toLowerCase();
	document.querySelectorAll( "#" + dialog_id ).forEach( e => e.remove() );
    var w = gl.canvas.width / 3;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, close: true, width: w, draggable: true });
    dialog.show('fade');

    var area = new LiteGUI.Area(null);
	area.split("vertical");
	
	var section1 = area.getSection(0);

	var widgets_top = new LiteGUI.Inspector();
	widgets_top.widgets_per_row = 3;
	widgets_top.addString( "Filter", "", {width: "55%", callback: function(v){

		bottom.on_refresh(v);

	}} );
	widgets_top.addFile( "Import file", "", {width: "30%", callback: function(v){
	
		var name = v.name,
			tokens = name.split("."),
			extension = tokens[tokens.length-1].toLowerCase();

		function inner_processed(filename, texture, options)
		{
			gl.textures[ filename ] = texture;
			bottom.on_refresh();
		}

		var reader = new FileReader();
		reader.onload = function(e) {
			
			if(!RM.processImage(name, extension, e.target.result, inner_processed))
				console.error("something went wrong");
			
		}
		reader.readAsArrayBuffer(v);
	
	}} );
	widgets_top.addButton(null, "Refresh",{width: "15%", callback: function(){ 
		// force refresh all previews
		that.use_cached_resources = false;
		bottom.on_refresh(); 
		that.use_cached_resources = true;
	}})
	widgets_top.addSeparator();
	widgets_top.widgets_per_row = 1;
	section1.add( widgets_top );

	var section2 = area.getSection(1);
	var bottom = new LiteGUI.Inspector();
	section2.add( bottom );	

	bottom.on_refresh = (function(filter){
	
		bottom.clear();
		var container = bottom.addContainer("cont-textures");
		container.className = "cont-textures";
		container.style.boxSizing = "border-box";
		container.style.height = "390px";
		container.style.overflowY = "scroll";

		this.showResources( container, filter);
	}).bind(this);

	bottom.on_refresh();

	LiteGUI.bind( area, "resource_selected", function(e){
	
		var path = e.target.dataset['path'];
		var node = options.node;

		$("#"+dialog_id).remove();

		if(options.name)
			tex_name = options.name;
	
		if(node) {
			node.textures[tex_name] = path;
			node.setTextureProperties();
			that.updateSidePanel(null, node.name);
		}

		if(options.callback) {
			var name = path.includes("/") ? HDRTool.getName(path) : path;
			options.callback( name, gl.textures[name], path );
		}
	} );

    dialog.add(area);  
    dialog.setPosition( renderer.canvas.width/2 - w/2, renderer.canvas.height/2 - renderer.canvas.height/4 );   
	
	// console.log(dialog);
}

GUI.prototype.showResources = function(parent, filter)
{
	var that = this;

	for(var t in gl.textures)
	{
		let name = t;

		if(filter && !name.toLowerCase().includes(filter.toLowerCase()))
		continue;

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

		block.addEventListener("contextmenu", function(e) { 
			if(e.button != 2) //right button
				return false;

			var w = gl.textures[name].width;
			var h = gl.textures[name].height;

			//create the context menu
			var contextmenu = new LiteGUI.ContextMenu( [{
					title: w + "x" + h,
					disabled: true
					}, null, "Download", "Delete"], { title: "Texture", event: e, callback: function(v){
				if(v == "Download")
				{
					HDRTool.downloadTexture(name);
				}
				else // Delete
				{
					delete gl.textures[name];
					$(parent).empty();
					that.showResources( parent, filter);
				}
					
			}});
			e.preventDefault(); 
			return false;
		});

		var url = this.preview_resources[name] || null;

		if(!url || !this.use_cached_resources)
		{
			var canvas = tex.toCanvas(null, null, 128);
			url = canvas.toDataURL();
			this.preview_resources[name] = url;
		}

		let  image = document.createElement('img');
		image.style.height = "12.5vh";
		image.style.marginTop = "-30px";
		image.style.transform = "scaleY(-1)"
		image.src = url;
		image.style.width = "100%";
		image.dataset['path'] = name;

		var text = document.createElement('p');
		name = name.split("/");
		name = name[name.length-1];
		text.innerHTML = name;
		text.className = "marquee";
	
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

	gl.canvas.toBlob(function(v){ data = v; preview.src = URL.createObjectURL( data ); that.loading(0); });

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
	console.log(files);

    var options = options || {};
	var that = this;

    var id = "Select HDRE";
	var dialog_id = replaceAll(id, ' ', '').toLowerCase();
	document.querySelectorAll( "#" + dialog_id ).forEach( e => e.remove() );
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


/*GUI.prototype.createPreview = function( tex_name, filename )
{
    var options = options || {};
	var that = this;
	
	var tex = gl.textures[ tex_name ];

	if( !tex )
		throw("no texture loaded");

	var preview = new Texture(tex.width, tex.height, {type: GL.FLOAT, format: GL.RGBA, pixel_data: tex.getPixels(0)});
	var preview_tm = new Texture(tex.width, tex.height, {type: GL.FLOAT, format: GL.RGBA});

	preview_tm.drawTo( function(){
		preview.toViewport( gl.shaders["basicFx"] );
	} );

	var canvas = preview_tm.toCanvas();
	canvas.toBlob(function(e){
		CORE.FS.uploadFile( "thb", new File([e], "thb_" + (filename ? filename : tex_name) + ".png"), [] );
	});
}*/

// it was createPanningPreview before
GUI.prototype.createPreview = function( tex_name, filename )
{
    var options = options || {};
	var that = this;
	
	var tex = gl.textures[ tex_name ];

	if( !tex )
        throw("no texture loaded");
        
    var w = tex.width;
    var h = tex.height;

    var nFaces = 3;
    var pixel_data = new Float32Array(w * nFaces * h * 4);
    var row_width = w * nFaces * 4;
    var row_width_single = w * 4;
    var numCols = h;
    var itr = 0;

    var pixels0 = tex.getPixels(1);
    var pixels1 = tex.getPixels(4);
    var pixels2 = tex.getPixels(0);

    var preview = new Texture(w * nFaces, h, {type: GL.FLOAT, format: GL.RGBA, pixel_data: pixel_data});

    var color_step = 1 / (pixel_data.length/4);
    var color = 1;

    for(var j = 0; j < numCols; j++){

        for(var i = 0; i < row_width_single; i+=4)
        {
            var pos = j * row_width + i;
            var posPix = j * row_width_single + i;

            pixel_data[pos++] = pixels0[posPix++];
            pixel_data[pos++] = pixels0[posPix++];
            pixel_data[pos++] = pixels0[posPix++];
            pixel_data[pos++] = pixels0[posPix++];
        }
    }

    for(var j = 0; j < numCols; j++){

        for(var i = row_width_single; i < row_width_single*2; i+=4)
        {
            var pos = j * row_width + i;
            var posPix = (j-1) * row_width_single + i;

            pixel_data[pos++] = pixels1[posPix++];
            pixel_data[pos++] = pixels1[posPix++];
            pixel_data[pos++] = pixels1[posPix++];
            pixel_data[pos++] = pixels1[posPix++];
        }
    }

    for(var j = 0; j < numCols; j++){

        for(var i = row_width_single*2; i < row_width; i+=4)
        {
            var pos = j * row_width + i;
            var posPix = (j-2) * row_width_single + i;

            pixel_data[pos++] = pixels2[posPix++];
            pixel_data[pos++] = pixels2[posPix++];
            pixel_data[pos++] = pixels2[posPix++];
            pixel_data[pos++] = pixels2[posPix++];
        }
    }

	Texture.setUploadOptions( {no_flip: true} );

	var preview = new Texture(w * nFaces, h, {type: GL.FLOAT, format: GL.RGBA, pixel_data: pixel_data});
	var preview_tm = new Texture(w * nFaces, h, {type: GL.FLOAT, format: GL.RGBA});

	preview_tm.drawTo( function(){
		preview.toViewport( gl.shaders["basicFx"] );
	} );

    var canvas = preview_tm.toCanvas();
	canvas.toBlob(function(e){
		CORE.FS.uploadFile( "thb", new File([e], "thb_" + (filename ? filename : tex_name) + ".png"), [] );
	});

	Texture.setUploadOptions( {no_flip: false} );
}

LiteGUI.Inspector.prototype.addTexture = function( name, value, options )
{
	options = options || {};
	value = value || "";
	var that = this;

	var error_color = "#F43";
	var modified_color = "#E4E";

	var resource_classname = "Texture";

	if(value.constructor !== String)
		value = "@Object";

	this.values[name] = value;

	var element = this.createWidget(name,"<span class='inputfield button hdre' style='width: calc(100% - 52px);'><input type='text' tabIndex='"+this.tab_index+"' class='text string' value='"+ (value == "notfound" ? "" : value) +"' "+(options.disabled?"disabled":"")+"/></span>" + 
	"<button title='select textures' class='micro resources'>"+(options.button || LiteGUI.special_codes.open_folder )+"</button>" + 
	"<button title='delete' class='micro delete' style='color:red;'>"+(options.button || LiteGUI.special_codes.close )+"</button>", options);

	//INPUT
	var input = element.querySelector(".wcontent input");

	//resource missing
	if(value && value.constructor === String && value[0] != ":" && value[0] != "@")
	{
		var res = gl.textures[ value ];
		if( !res )
			input.style.color = error_color;
		else if( res._modified )
			input.style.color = modified_color;
	}

	if( options.align && options.align == "right" )
		input.style.direction = "rtl";

	if( options.placeHolder )
		input.setAttribute( "placeHolder", options.placeHolder );
	else if(resource_classname)
		input.setAttribute( "placeHolder", resource_classname );

	input.addEventListener( "change", function(e) { 
		var v = e.target.value;

		var node = options.node;

		if(!v.length && node) {
			
			node.textures[name] = "";
			node.setTextureProperties();
			return;
		}

		if(v && v[0] != "@" && v[0] != ":" && !options.skip_load)
		{
			input.style.color = "#EA8";
			
			CORE.renderer.loadTexture(v, {}, function(t, n){

				if(!t) {
					input.style.color = error_color;
					return;
				}
	
				input.style.color = "";
                
				if(node){
					node.textures[name] = n;
					node.setTextureProperties();
				}
			});
        }

        if(!v || !gl.textures[ v ])
        input.style.color = error_color;
		
	});

	//INPUT ICON
	element.setIcon = function(img)
	{
		if(!img)
		{
			input.style.background = "";
			input.style.paddingLeft = "";
		}
		else
		{
			input.style.background = "transparent url('"+img+"') no-repeat left 4px center";
			input.style.paddingLeft = "1.7em";
		}
	}
	if(options.icon)
		element.setIcon( options.icon );
	else
		element.setIcon( "imgs/mini-icon-texture.png" );
	
	//BUTTON select resource
	element.querySelector(".wcontent button.resources").addEventListener( "click", function(e) { 

		gui.selectResource( options, name );
	});

	//BUTTON select resource
	element.querySelector(".wcontent button.delete").addEventListener( "click", function(e) { 

		input.value = "";
		var node = options.node;
		if(node) {
			node.textures[name] = "";
			node.setTextureProperties();
		}

		if(options.on_delete)
		options.on_delete();
	});

	this.tab_index += 1;
    this.append(element, options);
    
	return element;
}

LiteGUI.Inspector.prototype.addShader = function( name, value, options )
{
	options = options || {};
	value = value || "";
	var that = this;

	var error_color = "#F43";
	var modified_color = "#E4E";

	var resource_classname = "Shader";

	if(value.constructor !== String)
		value = "@Object";

	this.values[name] = value;

	var element = this.createWidget(name,"<span class='inputfield button shader'><input type='text' tabIndex='"+this.tab_index+"' class='text string' value='"+ (value == "notfound" ? "" : value) +"' "+(options.disabled?"disabled":"")+"/></span><button title='show folders' class='micro'>"+(options.button || LiteGUI.special_codes.open_folder )+"</button>", options);

	//INPUT
	var input = element.querySelector(".wcontent input");

	//resource missing
	if(value && value.constructor === String && value[0] != ":" && value[0] != "@")
	{
		var res = gl.shaders[ value ];
		if( !res )
			input.style.color = error_color;
		else if( res._modified )
			input.style.color = modified_color;
	}

	if( options.align && options.align == "right" )
		input.style.direction = "rtl";

	if( options.placeHolder )
		input.setAttribute( "placeHolder", options.placeHolder );
	else if(resource_classname)
		input.setAttribute( "placeHolder", resource_classname );

	input.addEventListener( "change", function(e) { 
		var v = e.target.value;

		if(!v.length && options.node) {
			
			options.node.shader = "";
			return;
		}

		if(v && v[0] != "@" && v[0] != ":" && !options.skip_load)
		{
			input.style.color = "#EA8";
			
			var s = gl.shaders[v];

			if(!s) {
				input.style.color = error_color;
				return;
			}

			input.style.color = "";
			
			var node = options.node;

			if(node) {
				if((v === 'textured' && !node.textures['albedo']) || 
				(v === 'textured_phong' && !node.textures['albedo']))
				node.textures['albedo'] = 'white';
			
				node.shader = v;

				if(CORE.gui)
					CORE.gui.updateSidePanel(null, node.name);
			}
        }

        if(!v || !gl.shaders[ v ])
        input.style.color = error_color;
		
	});

	//INPUT ICON
	element.setIcon = function(img)
	{
		if(!img)
		{
			input.style.background = "";
			input.style.paddingLeft = "";
		}
		else
		{
			input.style.background = "transparent url('"+img+"') no-repeat left 4px center";
			input.style.paddingLeft = "2em";
		}
	}
	if(options.icon)
		element.setIcon( options.icon );
	else
		element.setIcon( "https://webglstudio.org/latest/imgs/mini-icon-teapot.png" );
	
	//BUTTON select resource
	element.querySelector(".wcontent button").addEventListener( "click", function(e) { 

		var dialog = LiteGUI.Dialog.getDialog("dialog_show_shaders");
		if(dialog)
			dialog.clear();
		else
			dialog = new LiteGUI.Dialog({ id: "dialog_show_shaders", title:"Shaders", close: true, width: 360, scroll: false, draggable: true});

		dialog.show();

		//left side
		var widgets_left = new LiteGUI.Inspector();
		dialog.add( widgets_left );
	
		var available_shaders = ["textured_phong", "mirror", "textured", "pbr", "pbr_sh"];
		available_shaders = available_shaders.sort();	

		var selected_available_shader = "";
		var available_list = widgets_left.addList( null, available_shaders, {callback: function(v) {
			selected_available_shader = v;
		}});
		widgets_left.addButton(null,"Select", { callback: function(){
			
			var v = selected_available_shader;

			var node = options.node;

			if((v === 'textured' && !node.textures['albedo']) || 
			(v === 'textured_phong' && !node.textures['albedo']))
			node.textures['albedo'] = 'white';

			node.shader = v;

			if(CORE.gui)
			CORE.gui.updateSidePanel(null, node.name);

			dialog.close();
		}});

		dialog.adjustSize();
	});

	this.tab_index += 1;
    this.append(element, options);
    
	return element;
}

// Add methods to LiteGUI here

LiteGUI.Inspector.prototype.addHDRE = function( name, value, options )
{
	options = options || {};
	value = value || "";
	var that = this;

	var error_color = "#F43";
	var modified_color = "#E4E";

	var resource_classname = "Skybox";

	if(value.constructor !== String)
		value = "@Object";

	this.values[name] = value;

	var element = this.createWidget(name,"<span class='inputfield button hdre'><input type='text' tabIndex='"+this.tab_index+"' class='text string' value='"+value+"' "+(options.disabled?"disabled":"")+"/></span><button title='show folders' class='micro'>"+(options.button || LiteGUI.special_codes.open_folder )+"</button>", options);

	//INPUT
	var input = element.querySelector(".wcontent input");

	if( options.align && options.align == "right" )
		input.style.direction = "rtl";

	if( options.placeHolder )
		input.setAttribute( "placeHolder", options.placeHolder );
	else if(resource_classname)
		input.setAttribute( "placeHolder", resource_classname );

	input.addEventListener( "change", function(e) { 
		
	});

	//INPUT ICON
	element.setIcon = function(img)
	{
		if(!img)
		{
			input.style.background = "";
			input.style.paddingLeft = "";
		}
		else
		{
			input.style.background = "transparent url('"+img+"') no-repeat left 4px center";
			input.style.paddingLeft = "1.7em";
		}
	}
	if(options.icon)
		element.setIcon( options.icon );
	else
		element.setIcon( "imgs/mini-icon-texture.png" );
	
	//BUTTON select resource
	element.querySelector(".wcontent button").addEventListener( "click", function(e) { 

		if(CORE.FS.session)
			CORE.FS.getFiles( "hdre" ).then( function(e) { gui.selectHDRE( e, options ); } )
		else {
			if(gui)
				gui.showSessionDialog();
		}
	});

	this.tab_index += 1;
    this.append(element, options);
    
	return element;
}

Inspector.prototype.addDataTree = function(name, value, options)
{
	options = this.processOptions(options);

	value = value || "";
	var element = this.createWidget(name,"<div class='wtree'></div>", options);
	
	var node = element.querySelector(".wtree");
	var current = value;

	inner_recursive(node,value);
	var k = 0;

	function inner_recursive( root_node, value)
	{
		for(var i in value)
		{
			if(options.exclude && options.exclude[i])
			continue;

			var e = document.createElement("div");
			e.className = "treenode " + (k%2 == 0) ? "even" : "";
			if( value[i].constructor == Array && value[i].length == 1)
				e.innerHTML = "<span class='itemname'>" + i + "</span><span class='itemvalue'>" + value[i][0] + "</span>";
			if( value[i].constructor == Array && value[i].length > 1)
				continue;
			else if( typeof( value[i] ) != "object" )
				e.innerHTML = "<span class='itemname'>" + i + "</span><span class='itemvalue'>" + value[i] + "</span>";
			else if( value[i].constructor === Object )
			{
				e.innerHTML = "<span class='itemname'>" + i + "</span><span class='itemcontent'></span>";
				inner_recursive( e.querySelector(".itemcontent"), value[i] );
			}
			root_node.appendChild(e);
			k++;
		}
	}

	this.append(element,options);
	return element;
}

// overwrite method
Inspector.prototype.addSlider = function(name, value, options)
{
	options = this.processOptions(options);

	if(options.min === undefined)
		options.min = 0;

	if(options.max === undefined)
		options.max = 1;

	if(options.step === undefined)
		options.step = 0.01;

	if(options.precision === undefined)
		options.precision = 3;

	var that = this;
	if(value === undefined || value === null)
		value = 0;
	this.values[name] = value;

	var element = this.createWidget(name,"<span class='inputfield full'>\
				<input tabIndex='"+this.tab_index+"' style='font-weight: bolder; color: white; display: none; position: absolute; z-index: 1000; margin-left: 10px; margin-top: 1px;' class='slider-text fixed' value='"+value+"' /><span class='slider-container'></span></span>", options);

	var slider_container = element.querySelector(".slider-container");

	var slider = new LiteGUI.Slider(value,options);
	slider_container.appendChild(slider.root);

	slider.root.addEventListener('dblclick', function(e) {
		
		text_input.value = parseFloat(text_input.value).toFixed(3);
		text_input.style.display = "block";
		text_input.focus();
	});

	//Text change -> update slider
	var skip_change = false; //used to avoid recursive loops
	var text_input = element.querySelector(".slider-text");
	text_input.addEventListener('change', function(e) {
		if(skip_change)
			return;
		var v = parseFloat( this.value ).toFixed(options.precision);
		value = v;
		slider.setValue( v );
		Inspector.onWidgetChange.call( that,element,name,v, options );
	});

	text_input.addEventListener('keyup', function(e) {

		if(e.keyCode == 27){
			text_input.style.display = "none";
		}
		
	});

	text_input.addEventListener('blur', function(e) {

		text_input.style.display = "none";
		
	});

	//Slider change -> update Text
	slider.onChange = function(value) {
		text_input.value = value;
		text_input.style.display = "none";
		Inspector.onWidgetChange.call( that, element, name, value, options);
	};

	this.append(element,options);

	element.setValue = function(v,skip_event) { 
		if(v === undefined)
			return;

		value = v;
		slider.setValue(parseFloat( v ),skip_event);
	};
	element.getValue = function() { 
		return value;
	};

	this.processElement(element, options);
	return element;
}

function Slider(value, options)
{
	options = options || {};
	var canvas = document.createElement("canvas");
	canvas.className = "slider " + (options.extraclass ? options.extraclass : "");

	canvas.width = 300;
	canvas.height = 25; 	

	this.root = canvas;
	var that = this;
	this.value = value;

	this.ready = true;

	this.setValue = function(value, skip_event)
	{
		if(options.integer)
			value = parseInt(value);
		else
			value = parseFloat(value);

		var ctx = canvas.getContext("2d");
		var min = options.min || 0.0;
		var max = options.max || 1.0;
		if(value < min) value = min;
		else if(value > max) value = max;
		var range = max - min;
		var norm = (value - min) / range;
		ctx.clearRect(0,0,canvas.width,canvas.height);
		ctx.fillStyle = "#5f88c9";
		ctx.fillRect(0,0, canvas.width * norm, canvas.height);

		ctx.fillStyle = "#EEE";
		ctx.font = "16px Arial";

		var text = value.toFixed(options.precision);
		ctx.fillText(text, canvas.width - 20 - text.length * 8, 18);

		if(value != this.value)
		{
			this.value = value;
			if(!skip_event)
			{
				LiteGUI.trigger(this.root, "change", value );
				if(this.onChange)
					this.onChange( value );
			}
		}
	}

	function setFromX(x)
	{
		var width = canvas.getClientRects()[0].width;
		var norm = x / width;
		var min = options.min || 0.0;
		var max = options.max || 1.0;
		var range = max - min;
		that.setValue( range * norm + min );
	}

	var doc_binded = null;

	canvas.addEventListener("mousedown", function(e) {
		var mouseX, mouseY;
		if(e.offsetX) { mouseX = e.offsetX; mouseY = e.offsetY; }
		else if(e.layerX) { mouseX = e.layerX; mouseY = e.layerY; }	
		setFromX(mouseX);
		doc_binded = canvas.ownerDocument;
		doc_binded.addEventListener("mousemove", onMouseMove );
		doc_binded.addEventListener("mouseup", onMouseUp );

		doc_binded.body.style.cursor = "none";
	});

	function onMouseMove(e)
	{
		var rect = canvas.getClientRects()[0];
		var x = e.x === undefined ? e.pageX : e.x;
		var mouseX = x - rect.left;
		setFromX(mouseX);
		e.preventDefault();
		return false;
	}

	function onMouseUp(e)
	{
		var doc = doc_binded || document;
		doc_binded = null;
		doc.removeEventListener("mousemove", onMouseMove );
		doc.removeEventListener("mouseup", onMouseUp );
		e.preventDefault();
		
		doc.body.style.cursor = "default";

		return false;
	}

	this.setValue(value);
}

LiteGUI.Slider = Slider;

Inspector.prototype.addCounter = function(name, value, options)
{
	options = this.processOptions(options);

	if(options.min === undefined)
		options.min = 0;

	if(options.max === undefined)
		options.max = 5;

	if(options.step === undefined)
		options.step = 1;

	if(value === undefined)
		value = "";
	var that = this;
	this.values[name] = value;
	
	var element = this.createWidget( name, "<button class='micro less'>"+("-")+"</button><span class='inputfield button'><input type='text' tabIndex='"+this.tab_index+"' class='text string' value='"+value+"' "+(options.disabled?"disabled":"")+"/></span><button class='micro more'>"+("+")+"</button>", options);
	var input = element.querySelector(".wcontent input");
	input.style.textAlign = "center";
	input.addEventListener("change", function(e) { 
		var r = Inspector.onWidgetChange.call(that,element,name,parseInt(e.target.value), options);
		if(r !== undefined)
			this.value = r;
	});

	// get space for the second button
	element.querySelector(".wcontent .inputfield.button").style.width = "calc(100% - 48px)";

	var button1 = element.querySelector(".wcontent button.less");
	button1.addEventListener("click", function(e) { 
		input.value = Math.max(options.min, parseInt(input.value) - options.step);
		var r = Inspector.onWidgetChange.call(that,element,name,parseInt(input.value), options);
		if(r !== undefined)
			this.value = r;
	});

	button1.style.margin = "0 4px 0px 0px";

	var button2 = element.querySelector(".wcontent button.more");
	button2.addEventListener("click", function(e) { 
		input.value = Math.min(options.max, parseInt(input.value) + options.step);
		var r = Inspector.onWidgetChange.call(that,element,name,parseInt(input.value), options);
		if(r !== undefined)
			this.value = r;
	});


	this.tab_index += 1;
	this.append(element,options);
	element.wchange = function(callback) { $(this).wchange(callback); }
	element.wclick = function(callback) { $(this).wclick(callback); }
	element.setValue = function(v, skip_event) { 
		input.value = v;
		if(!skip_event)
			LiteGUI.trigger(input, "change" );
	};
	element.getValue = function() { return input.value; };
	element.focus = function() { LiteGUI.focus(input); };
	this.processElement(element, options);
	return element;
}

LiteGUI.Dialog.prototype._ctor = function( options )
{
	options = options || {};

	var that = this;
	this.width = options.width;
	this.height = options.height;
	this.minWidth = options.minWidth || 150;
	this.minHeight = options.minHeight || 100;
	this.content = options.content || "";

	var panel = document.createElement("div");
	if(options.id)
		panel.id = options.id;

	panel.className = "litedialog " + (options.className || "");
	panel.data = this;
	panel.dialog = this;

	var code = "";
	if(options.title)
	{
		code += "<div class='panel-header'>"+options.title+"</div><div class='buttons'>";
		if(options.minimize){
			code += "<button class='litebutton mini-button minimize-button'>-</button>";
			code += "<button class='litebutton mini-button maximize-button' style='display:none'></button>";
		}
		if(options.hide)
			code += "<button class='litebutton mini-button hide-button'></button>";
		
		if(options.detachable)
			code += "<button class='litebutton mini-button detach-button'></button>";

		//
		else if(options.sided)
			code += "<button class='litebutton mini-button detach-button'></button>";
		//
		
		if(options.close || options.closable)
			code += "<button class='litebutton mini-button close-button'>"+ LiteGUI.special_codes.close +"</button>";
		code += "</div>";
	}

	code += "<div class='content'>"+this.content+"</div>";
	code += "<div class='panel-footer'></div>";
	panel.innerHTML = code;

	this.root = panel;
	this.content = panel.querySelector(".content");
	this.footer = panel.querySelector(".panel-footer");

	if(options.fullcontent)
	{
		this.content.style.width = "100%";		
		this.content.style.height = options.title ? "calc( 100% - "+Dialog.title_height+" )" : "100%";
	}

	if(options.buttons)
	{
		for(var i in options.buttons)
			this.addButton(options.buttons[i].name, options.buttons[i]);
	}

	//if(options.scroll == false)	this.content.style.overflow = "hidden";
	if(options.scroll == true)
		this.content.style.overflow = "auto";

	//buttons *********************************
	var close_button = panel.querySelector(".close-button");
	if(close_button)
		close_button.addEventListener("click", this.close.bind(this) );

	var maximize_button = panel.querySelector(".maximize-button");
	if(maximize_button)
		maximize_button.addEventListener("click", this.maximize.bind(this) );

	var minimize_button = panel.querySelector(".minimize-button");
	if(minimize_button)
		minimize_button.addEventListener("click", this.minimize.bind(this) );

	var hide_button = panel.querySelector(".hide-button");
	if(hide_button)
		hide_button.addEventListener("click", this.hide.bind(this) );

	var detach_button = panel.querySelector(".detach-button");
	if(detach_button && options.sided)
		detach_button.addEventListener("click", options.sideCallback || function(){  });
	else if(detach_button)
		detach_button.addEventListener("click", function() { that.detachWindow(); });

	//size, draggable, resizable, etc
	this.enableProperties(options);

	this.root.addEventListener("DOMNodeInsertedIntoDocument", function(){ 
		if( that.on_attached_to_DOM )
			that.on_attached_to_DOM();
		if( that.on_resize )
			that.on_resize();
	});
	this.root.addEventListener("DOMNodeRemovedFromDocument", function(){ 
		if( that.on_detached_from_DOM )
			that.on_detached_from_DOM();
	});


	//attach
	if(options.attach || options.parent)
	{
		var parent = null;
		if(options.parent)
			parent = typeof(options.parent) == "string" ? document.querySelector(options.parent) : options.parent;
		if(!parent)
			parent = LiteGUI.root;
		parent.appendChild( this.root );
		this.center();
	}

	//if(options.position) //not docked
	//	this.setPosition( options.position[0], options.position[1] );
}


Inspector.prototype.addSection = function( name, options )
{
	options = this.processOptions(options);
	var that = this;

	if(this.current_section)
		this.current_section.end();

	var element = document.createElement("DIV");
	element.className = "wsection";
	if(!name) 
		element.className += " notitle";
	if(options.className)
		element.className += " " + options.className;
	if(options.collapsed)
		element.className += " collapsed";

	if(options.id)
		element.id = options.id;
	if(options.instance)
		element.instance = options.instance;

	var code = "";
	if(name)
		code += "<div class='wsectiontitle'>"+(options.no_collapse ? "" : "<span class='switch-section-button'></span>")+name+"</div>";
	code += "<div class='wsectioncontent'></div>";
	element.innerHTML = code;

	if(options.detachable)
	{
		element.addEventListener("dragstart", function(e){
				// e.dataTransfer.setData("component", "ScreenFX");
		});

		element.setAttribute("draggable", true);
	}

	//append to inspector
	element._last_container_stack = this._current_container_stack.concat();
	//this.append( element ); //sections are added to the root, not to the current container
	this.root.appendChild( element );
	this.sections.push( element );

	element.sectiontitle = element.querySelector(".wsectiontitle");

	if(name)
		element.sectiontitle.addEventListener("click",function(e) {
			if(e.target.localName == "button") 
				return;
			element.classList.toggle("collapsed");
			var seccont = element.querySelector(".wsectioncontent");
			seccont.style.display = seccont.style.display === "none" ? null : "none";
			if(options.callback)
				options.callback.call( element, !element.classList.contains("collapsed") );
		});

	if(options.collapsed)
		element.querySelector(".wsectioncontent").style.display = "none";

	this.setCurrentSection( element );

	if(options.widgets_per_row)
		this.widgets_per_row = options.widgets_per_row;

	element.refresh = function()
	{
		if(element.on_refresh)
			element.on_refresh.call(this, element);
	}

	element.end = function()
	{
		if(that.current_section != this)
			return;

		that._current_container_stack = this._last_container_stack;
		that._current_container = null;

		var content = this.querySelector(".wsectioncontent");
		if(!content)
			return;
		if( that.isContainerInStack( content ) )
			that.popContainer( content );
		that.current_section = null;
	}

	return element;
}

LiteGUI.Inspector.prototype.addVector = function( name, value, options, length )
{
	switch(length)
	{
		case 2:
			this.addVector2(name, value, options);
			break;
		case 3:
			this.addVector3(name, value, options);
			break;
		case 4:
			this.addVector4(name, value, options);
			break;
		default:
			console.warn("Only vec2, vec3, vec4");
			break;
	}
}

LS.FXStack.prototype.inspect = function( inspector, component )
{
	var that = this;

	var title = inspector.addTitle("Active FX");
	title.addEventListener("contextmenu", function(e) { 
        if(e.button != 2) //right button
            return false;
		//create the context menu
		var contextmenu = new LiteGUI.ContextMenu( ["Copy","Paste"], { title: "FX List", event: e, callback: function(v){
			if(v == "Copy")
				LiteGUI.toClipboard( JSON.stringify( that.serialize() ) );
			else //Paste
			{
				var data = LiteGUI.getLocalClipboard();
				if(data)
					that.configure( data );
				inspector.refresh();
			}
			LS.GlobalScene.refresh();
		}});
        e.preventDefault(); 
        return false;
    });

	var enabled_fx = this.fx;

	for(var i = 0; i < enabled_fx.length; i++)
	{
		var fx = enabled_fx[i];
		var fx_info = LS.FXStack.available_fx[ fx.name ];
		if(!fx_info)
		{
			console.warn("Unknown FX: " + fx.name);
			continue;
		}
		if(fx_info.uniforms)
			for(var j in fx_info.uniforms)
			{
				var uniform = fx_info.uniforms[j];
				if(uniform.type == "float")
					inspector.addNumber( j, fx[j] !== undefined ? fx[j] : uniform.value, {
						pretitle: component ? AnimationModule.getKeyframeCode( component, "fx/"+i+"/"+j ) : "",
						min: uniform.min,
						max: uniform.max,
						step: uniform.step,
						fx_name: j,
						fx: fx,
						callback: function(v){
							this.options.fx[ this.options.fx_name ] = v;
						}				
					});
				else if(uniform.type == "color3")
					inspector.addColor( j, fx[j] !== undefined ? fx[j] : uniform.value, {
						pretitle: component ? AnimationModule.getKeyframeCode( component, "fx/"+i+"/"+j ) : "",
						fx_name: j,
						fx: fx,
						callback: function(v){
							this.options.fx[ this.options.fx_name ] = v;
						}				
					});
				else if(uniform.type == "sampler2D")
					inspector.addTexture( j, fx[j] !== undefined ? fx[j] : uniform.value, {
						pretitle: component ? AnimationModule.getKeyframeCode( component, "fx/"+i+"/"+j ) : "",
						fx_name: j,
						fx: fx,
						callback: function(v){
							this.options.fx[ this.options.fx_name ] = v;
						}				
					});
				else //for vec2, vec3, vec4
					inspector.add( uniform.type, j, fx[j] !== undefined ? fx[j] : uniform.value, {
						pretitle: component ? AnimationModule.getKeyframeCode( component, "fx/"+i+"/"+j ) : "",
						fx_name: j,
						fx: fx,
						callback: function(v){
							if( this.options.fx[ this.options.fx_name ] && this.options.fx[ this.options.fx_name ].set )
								this.options.fx[ this.options.fx_name ].set( v );
							else
								this.options.fx[ this.options.fx_name ] = v;
						}				
					});
			}
	}

	inspector.addButton(null,"Edit FX", { callback: inner });
	//inspector.addButton(null,"Remove FX", {});

	var selected_enabled_fx = "";

	//show camera fx dialog
	function inner()
	{
		var dialog = LiteGUI.Dialog.getDialog("dialog_show_fx");
		if(dialog)
			dialog.clear();
		else
			dialog = new LiteGUI.Dialog({ id: "dialog_show_fx", title:"FX Settings", close: true, width: 360, height: 370, scroll: false, draggable: true});

		dialog.show();

		var split = new LiteGUI.Split("load_scene_split",[50,50]);
		dialog.add(split);

		//left side
		var widgets_left = new LiteGUI.Inspector();
		widgets_left.addTitle("Available FX");
		split.getSection(0).add( widgets_left );
		var fx = LS.FXStack.available_fx;
		var available_fx = [];
		for(var i in fx)
			available_fx.push(i);
		available_fx = available_fx.sort();		
		var selected_available_fx = "";
		var available_list = widgets_left.addList( null, available_fx, { height: 240, callback: function(v) {
			selected_available_fx = v;
		}});
		widgets_left.addButton(null,"Add FX", { callback: function(){
			that.addFX( selected_available_fx );
			inspector.refresh();
			LS.GlobalScene.refresh();
			inner();
		}});

		var widgets_right = new LiteGUI.Inspector();
		widgets_right.addTitle("Current FX");
		var enabled_list = widgets_right.addList(null, enabled_fx, { selected: selected_enabled_fx, height: 240, callback: function(v) {
			selected_enabled_fx = v;
		}});
		split.getSection(1).add(widgets_right);
		widgets_right.addButtons(null,["Up","Down","Delete"], { callback: function(v){
			if(v == "Delete")
			{
				that.removeFX( selected_enabled_fx );
			}
			else if(v == "Up")
			{
				that.moveFX( selected_enabled_fx );
			}
			else if(v == "Down")
			{
				that.moveFX( selected_enabled_fx, 1 );
			}
			inspector.refresh();
			LS.GlobalScene.refresh();
			inner();
		}});

		dialog.adjustSize();
	}
}