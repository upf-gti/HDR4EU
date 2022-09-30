/*
*   author: Alex Rodriguez
*   @jxarco 
*/

(function(global){

/**
* Responsible of configuring scene, 3d nodes and its properties  
* @class Core
* @constructor
*/

global.Core = Core;

// Shading Modes
Core.MATERIAL   = 0;
Core.WIREFRAME  = 1;
Core.SOLID      = 2;
Core.ROUGHNESS  = 3;
Core.METALLIC   = 4;
Core.NORMALS    = 5;

function Core( o )
{
    if(this.constructor !== Core)
        throw("Use new to create Core");

    this._ctor();
    if(o)
        this.configure( o );

    this.setup();
}

Core.prototype._ctor = function()
{
    this._uid           = uidGen.generate(true);
    this._descriptor    = "";
    this._errors        = {};
    this._uniforms      = {};
    
    this._environment       = "no current";
    this._last_environment  = "no last";
    this._blur_samples      = RM.shader_macros['N_SAMPLES'];
    this._no_repeat         = false;
    this.selected_radius    = 1; // for wheel speed
    
    this.scene = new RD.Scene();
    this.root = this.scene.root;

	this.isFullscreen = false;
    this.context = GL.create({ width: window.innerWidth, height: window.innerHeight });

    // set param macros
	RM.shader_macros[ 'INPUT_TEX_WIDTH' ] = gl.viewport_data[2];
    RM.shader_macros[ 'INPUT_TEX_HEIGHT' ] = gl.viewport_data[3];
    RM.shader_macros[ 'LIGHT_TYPE' ] = LS.Light.OMNI;
    RM.shader_macros[ 'EM_SIZE' ] = 1; // no parsing at initialization
    
	this.renderer = new RD.Renderer( this.context, {
        autoload_assets: true,
		shaders_file: "data/shaders.glsl",
		shaders_macros: RM.shader_macros
    });

    this.renderer.current_scene = this.scene;

    var w       = (gl.canvas.width)|0;
    var h       = (gl.canvas.height)|0;
    var type    = gl.FLOAT;
    
    this._viewport_tex      = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
	this._fxaa_tex          = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    this._fx_tex            = new GL.Texture(w,h, {type: type});
    this._background_color  = vec4.fromValues(0.2, 0.2, 0.2,1);

    this.fxaa_shader = Shader.getFXAAShader();
    this.fxaa_shader.setup();

    // deferred rendering (G buffers)
    this.texture_color          = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    this.texture_normal         = new GL.Texture(w,h, { type: type, filter: gl.LINEAR });
    this.texture_lighting       = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    this.texture_depth          = new GL.Texture(w,h, { format: gl.DEPTH_COMPONENT, type: gl.UNSIGNED_INT}); 
    
    this.fx_color_buffer           = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });

    this.fbo_textures   = [ this.texture_color, this.texture_normal, this.texture_lighting ];
    this.fbo            = null;

    if(!isMobile) // mobile browser does not support FBO
    {
        this.fbo = new GL.FBO( this.fbo_textures, this.texture_depth ); // first pass
        this.fbo_fx = new GL.FBO([this.fx_color_buffer], this.texture_depth); // after fx pass
    }
    
    // this._force_render_allFrames = false;

    this.controller     = new CameraController();
    this.event_manager  = new EventManager(this.context, this.controller);
    this.gui            = new GUI();
    this.stats          = new Stats("statsDiv");
    this.graph_manager  = null;

    this.renderComposer = new RenderComposer( this.renderer, this.controller.camera );
    this.RMODE = Core.MATERIAL;
}

Core.prototype.resizeViewportTextures = function(w, h)
{
    var type    = gl.FLOAT;

    this.texture_color         = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    this.texture_normal         = new GL.Texture(w,h, { type: type, filter: gl.LINEAR });
    this.texture_lighting       = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    this.texture_depth          = new GL.Texture(w,h, { format: gl.DEPTH_COMPONENT, type: gl.UNSIGNED_INT}); 
    
    this.fx_color_buffer           = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });

    this.fbo_textures   = [ this.texture_color, this.texture_normal, this.texture_lighting  ];
    
    if(this.fbo)
    {
        this.fbo.setTextures( this.fbo_textures, this.texture_depth ); // first pass
        this.fbo_fx.setTextures( [this.fx_color_buffer], this.texture_depth ); // after fx pass
    }
}

Core.prototype.setInitScene = function()
{
    var cubemap = new RD.SceneNode();
    cubemap.name = "cubemap";
    cubemap.mesh = "cube";
    cubemap.shader = "skybox";
	cubemap.position = [-1.5, 2, 6];
    cubemap.flags.depth_test = false;
    cubemap.flags.flip_normals = true;
    cubemap.render_priority = RD.PRIORITY_BACKGROUND;
    cubemap.scaling = 100;
    cubemap._nogui = true;

    window.cmap = cubemap;

	grid = new RD.SceneNode();
    grid.name = "grid";
    grid.mesh = "grid";
	grid.primitive = GL.LINES;
	grid.scaling = 1;
    grid.shader = "grid";
    grid._nogui = true;
    
    cubemap.ready = function() { 
        var ready = (this.textures['SpecularEnvSampler'] ) ? true : false;

        return ready;
    };

    this._cubemap = cubemap;

    this.gizmo = new RD.Gizmo();
    this.gizmo.mode =  RD.Gizmo.DRAG | RD.Gizmo.MOVEAXIS;
    
    //create a node
    man = new RD.SceneNode();
    man.scaling = 0.012;
    man.mesh = "data/animations/character.mesh";
    man.shader = "pbr";
    man.name = "node-animation";
    this.setRenderUniforms(man);
    man.setTextureProperties();
    // this.root.addChild(man);

    this.root.addChild(grid);
    this.root.addChild(cubemap);
}

Core.prototype.setup = function()
{
    var that = this;
    
    var last = now = getTime();
    HDRTool.core = this;

    canvas = this.getCanvas();
	canvas.id = "webgl_canvas";

    canvas.addEventListener("webglcontextlost", function(event) {
        event.preventDefault();
        console.error('Context lost');
        console.error(event);
    }, false);

    canvas.ondragover = () => {return false};
    canvas.ondragend = () => {return false};
    canvas.ondrop = (e) => this.event_manager.onDrop(e);
    
    gui = this.gui;
    renderer = this.renderer;
    scene = this.scene;
    camera = this.controller.camera;
    
    // declare renderer uniforms
	this.setUniform({
		"u_ambient": vec3.fromValues(0.2, 0.4, 0.8),
		"u_near": camera.near,
		"u_far": camera.far,
		"u_rotation": 0.0,
		"u_exposure": 0.0,
		"u_exp": 0.0,
		"u_offset": 0.0,
        "u_GammaCorrection": true,
		"u_middleGray": 0.18,
		"u_ibl_scale": 1.0,
		"u_albedo": vec3.fromValues( 1, 1, 1),
		"u_viewport": gl.viewport_data,
		"u_show_layers": false,
		"u_flipX": false,

		// Atmospheric Scattering
		'u_SunPos': vec3.fromValues(0.0, 0.4, -1),
		'u_SunIntensity': 22.0,
		"u_MieDirection": 0.76,
		'u_originOffset': 0.0,
		'u_MieCoeff': 21
    });
    
    // Compile shaders from scripts
	for(var shader in RM.shaders) {
        if(isMobile)
            continue;
        gl.shaders[shader] = new GL.Shader(RM.shaders[shader].vs_code, RM.shaders[shader].fs_code);
    }

    renderer.context.ondraw = function(){ that.render() };
    renderer.context.onupdate = function(dt){ that.update(dt) };
    renderer.context.animate();

	this.FS = new FileSystem();
    
    // Load useful textures
    renderer.loadTexture("data/textures/2D/young-man.png", {name: "young_man"});
    renderer.loadTexture("data/textures/2D/zebra.jpg", {name: "chroma_zebra"});
    renderer.loadTexture("data/textures/2D/weatherman.png", {name: "chroma_weatherman"});

    var default_environment = "Studio";
    this.setInitScene();

    // get response from files.php and init app
    LiteGUI.request({
        url:"php/files.php", 
        success: async function(data){ 
           
            // Save textures info for the GUI - do not show low connection environments
			parseSceneTextures(data);
            
            await that.reloadShaders();

             // Init things
            Collada.init();
            HDRI.init(that, gl);
            gui.init();

            // Environment BRDFs (LUT)
			// 1st param is the path for loading from file ("assets/brdfLUT.png")
            HDRTool.brdf();	
            
            // Register default components
            RM.registerComponent( Light, 'Light'); 
		
			if( QueryString['scene'] )
			{
				window.localStorage.removeItem("_hdr4eu_recovery");
				var url = "https://webglstudio.org/users/hermann/files/sauce_dev/files/8efb30d54aee665af72c445acf53284b/scenes/" + QueryString['scene'];
				LiteGUI.requestJSON( url, function(v){ CORE.fromJSON( v ); }, 
					function(err){ console.error(err) });
            }
            else if( QueryString['hdre'] )
			{
                window.localStorage.removeItem("_hdr4eu_recovery");

                var url = that.FS.root  + "8efb30d54aee665af72c445acf53284b/hdre/" + QueryString['hdre'];
                that.set( url, {onImport: function(){}} );
			}
			else if( window.localStorage.getItem("_hdr4eu_recovery") )
			{
				var boo = JSON.parse(window.localStorage.getItem("_hdr4eu_recovery"));
				CORE.fromJSON( boo );
			}
			else
			{
				if( isMobile )
                default_environment = "Lounge_64";

				window.localStorage.removeItem("_hdr4eu_recovery");
				that.set( RM.textures[ default_environment ], {onImport: function(){

                }} );
			}

			console.log("Application loaded");
			
        },
        error: function(err){ console.error(err, "Error getting app environments") }
    });
}

Core.prototype.toFullScreen = function()
{
	this.isFullscreen = true;
	$("#webgl_canvas").css({
		"position": "absolute",
		"width": "100%",
		"top": "0px",
		"z-index": "1000"
	});
	document.body.dataset["canvas_parent"] = $("#webgl_canvas").parent()[0];
	document.body.appendChild($("#webgl_canvas")[0]);
	resize(true);
}

function parseSceneTextures(data)
{
	var scenes = JSON.parse(data);
	RM.textures = Object.keys(scenes).filter(key => !key.includes("64")).reduce((obj, key) => {
		obj[key] = scenes[key];
		return obj;
	  }, {});
}


//to be sure we dont have anything binded
Core.prototype.clearSamplers = function()
{
	for(var i = 0; i < gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS); ++i)
	{
		gl.activeTexture(gl.TEXTURE0 + i);
		gl.bindTexture( gl.TEXTURE_2D, null );
		gl.bindTexture( gl.TEXTURE_CUBE_MAP, null );
	}
}

Core.prototype.getCanvas = function ()
{
    return this.renderer.canvas;
}

/**
* Configure this Core to a state from an object (used with serialize)
* @method configure
* @param {Object} o object with the state of a Core
*/
Core.prototype.configure = function(o)
{
    //copy to attributes
    for(var i in o)
    {
        switch( i )
        {
			case "controller":
			case "uniforms":
			case "_environment":
			case "_environment_set":
                continue;
        };

        //default
        var v = this[i];
        if(v === undefined)
            continue;

        if( v && v.constructor === Float32Array )
            v.set( o[i] );
        else 
            this[i] = o[i];
    }
}

Object.defineProperty(Core.prototype, 'cubemap', {
    get: function() { return this._cubemap; },
    set: function(v) { this._cubemap = v; this.root.addChild(v); },
    enumerable: true
});

Object.defineProperty(Core.prototype, 'renderingToViewport', {
    get: function() { return this.graph_manager.isUsed(); },
    enumerable: true
});

Object.defineProperty(Core.prototype, 'blur_samples', {
    get: function() { return this._blur_samples; },
    set: function(v) { this._blur_samples = v; RM.shader_macros['N_SAMPLES'] = v; },
    enumerable: true
});

Core.prototype.getFrameOutput = function()
{
    var frame_node = this.graph_manager.graph._nodes_in_order[0];
    var viewport_node = this.graph_manager.graph._nodes_in_order[1];

    var link = viewport_node.inputs[0].link;

    if(!link)
    return null;

    for(var i in frame_node.outputs)
    {

        var frame_links = [].concat(frame_node.outputs[i].links);

        if(frame_links.includes(link))
            return frame_node.getOutputData(i);
    }
}

Core.prototype.getRenderableNodes = function()
{
    var nodes = this.scene.root.children.filter( e=> ( e.name !== "lines" && e.name !== "grid" ) );

    for(var i in nodes)
        for(var j in nodes[i].children)
            nodes.push(nodes[i].children[j]);

    return nodes;   
}

/**
* Render all the scene
* @method render
*/
Core.prototype.render = function()
{
	this.stats.begin();

	tFrame = Math.clamp(getTime() - postFrame, 0, 6);
    this.setUniform("tFrame", tFrame);
    
    if(window.show_texture) {
		gl.textures[window.show_texture].toViewport();
		return;
	}
		
	if(this.gui.editor == HDRI_TAB){ // i'm in hdri tab

		HDRI.render();
		postFrame = getTime();
		this.stats.end();
		return;
    }
    
    if(!this.cubemap.ready()) 
    return;

    // Update cubemap position
    this.cubemap.position = this.controller.getCameraPosition();

	// Pre-render
	for(var i in this.scene.root.children)
	{
		var node = this.scene.root.children[i];

		if(!node.components)
			continue;
			
		for(var j in node.components)
		{
			if(node.components[j].preRender)
				node.components[j].preRender();
		}
	}

    this.renderScene();

    // Render GUI
	this.gui.render();

	postFrame = getTime();
    this.stats.end();
}

/**
* Render all the scene using deferred rendering
* @method renderScene
*/
Core.prototype.renderScene = function()
{
    var renderer = this.renderer;
    var that = this;

    this.setUniform("u_render_mode", this.RMODE);

    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    // save work
    if(!this.renderingToViewport || this.RMODE > 1) // no fx on these modes
    {
        renderer.clear(this._background_color);
        renderer.render( this.scene, this.controller.camera );

        if(this.gizmo)
        {
            this.gizmo.renderOutline(renderer, this.scene, this.controller.camera);
            renderer.render( this.scene, this.controller.camera,  [this.gizmo] ); // render gizmo on top
        }
    }
    else
    {
        var renderer = this.renderer;
        var uniforms = {};
        if(this.GlobalLight)
        {
            this.GlobalLight.generateShadowMap();
            uniforms = this.GlobalLight.getUniforms();
        }
        this.renderComposer.render(this.fbo, uniforms);

        try
        {
            var check = GFX.info_check();

            if (check[0])
                this.getMaxLuminance();
            if (check[1])
                this.getAverageLuminance();
        }
        catch (e)
        {
            if(!this._errors[e])
                this._errors[e] = 1;
        }
    }

}

Core.prototype.onRenderFX = function( final_frame )
{
    var that = this;

    // no fx on these modes
    if (!final_frame || window.show_texture || (CORE && CORE.RMODE > 1)) {
        return;
    }

    if(isMobile)
    return;

    this.fbo_fx.bind();

    gl.clearColor( 0, 0, 0, 0 );
    gl.clear(gl.COLOR_BUFFER_BIT);

    // render grid
    renderer.render( this.scene, this.controller.camera, [this.scene.root.children[0]] );

    /*var bbox_nodes = this.scene.root.children.filter( e=> e.name === "lines" );
    if(bbox_nodes.length)
        renderer.render( this.scene, this.controller.camera, bbox_nodes );*/

    // Render editor
    for(var i in RM.components)
    {
        if(RM.components[i].renderEditor)
            RM.components[i].renderEditor();
    }

    if(this.gizmo)
        renderer.render( this.scene, this.controller.camera,  [this.gizmo] ); // render gizmo on top

    this.fbo_fx.unbind();

    final_frame.drawTo( function()
    {
        gl.enable( gl.BLEND );
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        that.fx_color_buffer.toViewport();

        gl.disable( gl.BLEND );
        gl.disable( gl.DEPTH_TEST );

        // Render deferred textures 
        if(that.gui._show_deferred_textures) {

            var textures = that.fbo_textures;
            var woffset = 0.0;
    
            for(t of textures)
            {
                gl.drawTexture(t, gl.canvas.width * woffset,0, gl.canvas.width * 0.3333, gl.canvas.height * 0.3333);
                woffset += 0.3333;
            }
        }
    });

    return true;
}

Core.prototype.convertCamera = function( ls_camera, type )
{
    var cam = new RD.Camera();
    
    cam.lookAt( ls_camera.eye, ls_camera.center, ls_camera.up );

    if(type == LS.Light.DIRECTIONAL)
    {
        // changes between LS Camera and RD Camera
        cam.orthographic( ls_camera.frustum_size * 0.5, ls_camera.near, ls_camera.far, ls_camera.aspect * 0.5);
        cam.near = ls_camera.near;
        cam.far = ls_camera.far;
    }
    else
        cam.perspective( ls_camera.fov, ls_camera.aspect, ls_camera.near, ls_camera.far);

    cam.updateMatrices();
    return cam;
}

/**
* Update all the scene
* @method update
* @param {number} dt
*/
Core.prototype.update = function(dt)
{
    _dt = dt;

    // Pre-update
	for(var i in this.scene.root.children)
	{
		var node = this.scene.root.children[i];

		if(!node.components)
			continue;
			
		for(var j in node.components)
		{
			if(node.components[j].preUpdate)
				node.components[j].preUpdate();
		}
	}

    // Update lines
    var NodePickerComponent = RM.Get('NodePicker');
    if(NodePickerComponent)
        NodePickerComponent.update();

    // Update all nodes in the scene
	this.scene.update(dt);

	// Update gui
	this.gui.update(dt);

    // Update controller bindings
    this.event_manager.update(dt);
}

/**
* Set and configure scene 
* @method set
* @param {string} env_path
* @param {Object} options
*/
Core.prototype.set = async function(env_set, options)
{
    if(!this._cubemap)
        throw("Create first a cubemap node");

    var env_path = env_set.constructor == String ? env_set : env_set.path;
    var tex_name = HDRTool.getName( env_path );
    var options = options || {};

    if(this._environment == tex_name 
        && tex_name != ":atmos"
        && !options.force_prefilter) {
        this.gui.loading(0);
		if(options.onImport)
			options.onImport();
        return;
    }

    this._last_environment = this._environment;
    this._environment = tex_name;
    this._environment_set = env_set;
            
    var that = this;
    var oncomplete = function() { 
        
		that.display( options.no_free_memory ); 
		if(options.onImport)
			options.onImport();
	};
    var params = Object.assign(options, {oncomplete: oncomplete});

    if(gl.textures[this._environment] 
        && tex_name != ":atmos"
        && !options.force_prefilter)
    {
        this.cubemap.shader = "skybox";
        this.display();
    }
    else
    {
        // Load hdre pre-processed files
        if( env_path.includes(".hdre") && !options.force_prefilter )
            HDRTool.load( env_path, params);
        else // Load and prefilter exr files
		{
			if(RM.shader_macros["EM_SIZE"] === 1)
			{
				RM.shader_macros['EM_SIZE'] = 256;
				await CORE.reloadShaders();
			}
			HDRTool.prefilter( env_path, params );
		}
            
    }

    // set this to allow perform another prefilter 
    HDRTool.FIRST_PASS = true; 
}

/**
* Display configured scene
* @method display
* @param {Boolean} no_free_memory
*/
Core.prototype.display = function( no_free_memory )
{
    // update environment in all necessary nodes
    if(gl.textures[this._environment])
        this.updateNodes();
    
    var that = this;
    
    // gui
    setTimeout(function(){
        that.gui.updateSidePanel(null, 'root');
        that.gui.loading(0);
        $("#import-loader").hide();            
        console.log("Image Based Lighting from %c" + that._environment, "color: red; font-weight: 900;" );

         // delete previous em (free memory)
        if( !no_free_memory )
        for(var t in gl.textures)
            if(t.includes( this._last_environment ))
                delete gl.textures[t];
    }, 150);
}

/**
* Parse scenes data (or JSON)
* @method parse
* @param {string} name
*/
Core.prototype.parse = function(name, callback)
{
    var toParse = RM.scenes[name];

    if(toParse.camera)
    {
        var eye = toParse.camera['eye'] || [0, 0, 5];
        var target = toParse.camera['target'] || [0, 0, 0];
        this.controller.lookAt(eye, target, RD.UP );
    }

    switch( name )
    {
        case "Matrix":
            this.createMatrix( true ); 
            return;
        case "Roughness scale":
            this.renderSphereScale( true, { property: 'roughness', aux_prop: 1.0 } );
            return;
        case "Metalness scale":
            this.renderSphereScale( true, { property: 'metalness', aux_prop: 0.0 } );
            return;
    }

	var mesh = [].concat(toParse.mesh);
	
	for(var t in mesh)
		if(mesh[t][0] != '@')
		    mesh[t] = RM.MODELS_FOLDER + mesh[t];
		else
			mesh[t] = mesh[t].slice(1);
	toParse.meshes = mesh;

    this.loadResources( toParse, name, callback );
}

/**
* Load mesh or meshes
* @method loadResources
* @param {Object} toParse
*/
Core.prototype.loadResources = async function( toParse, name, callback )
{
    var that = this;

    // Load array of meshes
    var meshes = toParse.meshes;
    var RenderComponent = RM.Get("Render");
    var render_mode = this.render_mode;

    for(var i = 0; i < meshes.length; i++)
    {
        var resource = meshes[i];

        var tokens = resource.split("."),
        extension = tokens[tokens.length-1].toLowerCase();

        // for multimesh nodes
        toParse.textures = [].concat(toParse.textures);
        if( toParse.uniforms )
            toParse.uniforms = [].concat(toParse.uniforms);

        if(extension === "dae")
        {
            var parser = RM.formats[extension];	
			if(parser)
				parser.load(resource, (function( dae_meshes ){
                    
                    for(var i in dae_meshes)
                    {
                        var node = this.getByName( dae_meshes[i] );

                        for(var t in toParse.textures[i])
                            node.textures[t] = RM.MODELS_FOLDER + toParse.textures[i][t];

                        node.setTextureProperties();

                        this.parseSceneProperties(toParse.properties, node);

                        if( toParse.uniforms ) // update model uniforms
                            node._uniforms = Object.assign(node._uniforms, toParse.uniforms[i]);
                    }

                    var newEye = null;

                    if(toParse.camera && toParse.camera.eye)
                        newEye = toParse.camera.eye;

                    // Importing dae
                    if(callback)
                        callback();
                    else
                        that.controller.onNodeLoaded( node, newEye );

				}).bind(this));
            continue;  
        }

        var node = new RD.SceneNode();
        node.mesh = resource;
        node.name = "node-" + uidGen.generate();
        
        this.parseSceneProperties(toParse.properties, node, true);

        var shader = "pbr";
        node.shader = shader;

        this.root.addChild( node );
        this.setRenderUniforms(node);
        this.setEnvironmentTextures( node );  // FIRST TEXTURES TO SET!!!
        
		if( toParse.uniforms ) // update model uniforms
        node._uniforms = Object.assign(node._uniforms, toParse.uniforms[i]);

        // load textures
        for(var t in toParse.textures[i])
            node.textures[t] = RM.MODELS_FOLDER + toParse.textures[i][t];

        // is emissive? has AO? has Alpha?
        node.setTextureProperties();

        renderer.loadMesh(resource, function(res){

            if(!res) 
            throw( "No mesh loaded" );

            var newEye = null;

            if(toParse.camera && toParse.camera.eye)
                newEye = toParse.camera.eye;

            that.controller.onNodeLoaded( node, newEye );
            that.gui.updateSidePanel(null, node.name);
        });
    }
}

Core.prototype.parseSceneProperties = function(properties, node, root)
{
    if(!properties)
    return;

    if(root && properties.scale)
        node.scaling = properties.scale;
    
    const flags = properties.flags;

    if(flags && flags[ node.name ] )
        this.parseSceneFlags( node, flags[ node.name ] );
}

Core.prototype.parseSceneFlags = function( node, flags ) {
    
    for( let f of flags ) {

        switch( f ) {
            case 'blend_alpha':
                node.blend_mode = RD.BLEND_ALPHA;
                node.render_priority = RD.PRIORITY_ALPHA;
                continue;
            default:
                node.flags[ f ] = true;
                continue;
        }
    }
}

/**
* Set node uniforms for render
* @method setRenderUniforms
*/
Core.prototype.setRenderUniforms = function(node)
{   
    node._uniforms["u_albedo"] = vec3.fromValues(1, 1, 1);
	node._uniforms["u_roughness"] = 1.0;
    node._uniforms["u_metalness"] = 0.0;
    node._uniforms["u_SpecScale"] = 1.0;
    node._uniforms["u_alpha"] = 1.0;
    node._uniforms["u_alpha_cutoff"] = 0.1;

    node._uniforms["u_isAnisotropic"] = false;
    node._uniforms["u_anisotropy"] = 0;
    node._uniforms["u_anisotropy_direction"] = vec3.fromValues(0.5, 1, 0.0);

    node._uniforms["u_clearCoat"] = 0.0;
	node._uniforms["u_clearCoatRoughness"] = 0.0;
	node._uniforms["u_tintColor"] = vec3.fromValues(1,1,1);

	node._uniforms["u_reflectance"] = 1;
	
	node._uniforms["u_renderDiffuse"] = true;
	node._uniforms["u_renderSpecular"] = true;
    node._uniforms["u_emissiveScale"] = 1.0;
    node._uniforms["u_normalFactor"] = 1.0;

    node._uniforms["u_Skinning"] = false;

    node._uniforms['u_diffuse_power'] = 0.2;
	node._uniforms['u_specular_power'] = 0.65;
	node._uniforms['u_specular_gloss'] = 0.8;
    node._uniforms['u_reflectivity'] = 0.0;
    
    // remove color_texture binding
    delete node._uniforms['u_color_texture'];
}

/**
* Update nodes with Core configuration
* @method updateNodes
*/
Core.prototype.updateNodes = function()
{   
    // update environment map textures
	var mipCount = renderer._uniforms["u_mipCount"] || 5;
    
    for (var i = 0; i < this.root.children.length; i++)
        this.setEnvironmentTextures( this.root.children[i] );
}

/**
* Update node with Core environment
* @method setEnvironmentTextures
*/
Core.prototype.setEnvironmentTextures = function( node )
{   
    // update environment map textures
	var mipCount = renderer._uniforms["u_mipCount"] || 5;
    
    if(!node) return;

    node.textures['brdf'] = "_brdf_integrator";
    node.textures['SpecularEnvSampler'] = this._environment;

    if(!node.children.length)
    return;

    for (var j = 0; j < node.children.length;  j++)
    {
        var child = node.children[j];

        child.textures['brdf'] = "_brdf_integrator";
        child.textures['SpecularEnvSampler'] = this._environment;
    }
}

/**
* Reset scene
* @method reset
*/
Core.prototype.reset = function()
{
	RM.Get('NodePicker').selected = null;
	delete gl.meshes['lines'];
	this.destroyByName('node');
    // this.controller.reset();

    this.gui.updateSidePanel(null, 'root');
}

/**
* Render current scene to cubemap texture
* @method renderToCubemap
*/
Core.prototype.renderToCubemap = function( position, size, texture, near, far, background_color )
{
	size = size || 256;
	near = near || 1;
	far = far || 1000;

	var eye = position;
	if( !texture || texture.constructor != GL.Texture)
		texture = null;

	var scene = this.scene;
	if(!scene)
		throw("No scene to render");

	var Cam = new RD.Camera();
	Cam.perspective(90, 1.0, near, far);

	texture = texture || new GL.Texture(size,size,{texture_type: gl.TEXTURE_CUBE_MAP, minFilter: gl.NEAREST});
	// this._current_target = texture;
	// texture._in_current_fbo = true; //block binding this texture during rendering of the reflection

	texture.drawTo( function(texture, side) {

		var info = GL.Texture.cubemapcamera_parameters[side];
		if(!background_color )
			gl.clearColor(0,0,0,0);
		else
			gl.clearColor( background_color[0], background_color[1], background_color[2], background_color[3] );
		
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		
		Cam.lookAt(eye, [ eye[0] + info.dir[0], eye[1] + info.dir[1], eye[2] + info.dir[2] ], info.up );

		renderer.render(scene, Cam);
	});

	// this._current_target = null;
	// texture._in_current_fbo = false;
	return texture;
}

/**
* Render current cubemap to texture
* @method cubemapToTexture
* @param {Type} oncomplete
*/
Core.prototype.cubemapToTexture = async function(oncomplete)
{
    var that = this,
        d = camera.position;

    var size = 256;

    var tex = new GL.Texture(size, size,{
        texture_type: gl.TEXTURE_CUBE_MAP,
        filter: gl.LINEAR,
        format: gl.RGB,
        type: gl.FLOAT
    });

    tex.drawTo(function(f, l) {
        var r = GL.Texture.cubemapcamera_parameters[l],
            r = new RD.Camera({
            position: d,
            target: [d[0] + r.dir[0], d[1] - r.dir[1], d[2] - r.dir[2]],
            up: r.up,
            fov: 90,
            aspect: 1,
            near: 0.1,
            far: 2E4
        });
        gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
        renderer.render(that.scene, r, [that.cubemap]);
    });

    gl.textures[":atmos"] = tex;
    RM.shader_macros['EM_SIZE'] = size;
    await CORE.reloadShaders();

    if(oncomplete)
       oncomplete();
}

/**
* reload scene shaders
* @method reloadShaders
*/
Core.prototype.reloadShaders = async function(macros, callback)
{
    var that = this;
    macros = macros || {};
    // assign default macros
    Object.assign(RM.shader_macros, macros);
    
    return new Promise( function(resolve) {
        that.renderer.loadShaders("data/shaders.glsl", function() {
            
            console.log("shaders reloaded!", {macros: RM.shader_macros});

			// now reload shaders from /shaders/js
			for(var i in RM.shaders) {

				if(RM.shaders[i].setup)
					RM.shaders[i].setup();

				var shader = gl.shaders[i];
	
                if(!shader) 
                {
                    shader = new Shader(RM.shaders[i].vs_code, RM.shaders[i].fs_code);
                    continue;
                }

				shader.updateShader(RM.shaders[i].vs_code, RM.shaders[i].fs_code);
			}

            if(callback)
                callback();
            resolve();

        }, RM.shader_macros);
    } );
}

/*
	get average luminance from rendered frame
	https://github.com/jagenjo/litegraph.js/blob/master/src/nodes/gltextures.js @jagenjo 
*/
Core.prototype.getAverageLuminance = function( input )
{
    if(!input)
        input = this.texture_color;
    
	if(!input || !LOG_MEAN_VALUES || !SMOOTH_SHIFT)
		throw('something went wrong');

    var type = gl.FLOAT;

	// var mipmap_level = 2;
	// var size = Math.pow(2, Math.floor(Math.log(input_width)/Math.log(2))) / Math.pow(2, mipmap_level);

    var temp = new GL.Texture( 16, 16, { type: type, format: gl.RGBA, minFilter: gl.LINEAR_MIPMAP_LINEAR });

	temp.drawTo(function(){
		input.toViewport();
	});

	var pixelColor = new GL.Texture( 1, 1, { type: type, format: gl.RGBA, filter: gl.NEAREST });

	var properties = { mipmap_offset: 0, low_precision: false };
	var uniforms = { u_mipmap_offset: properties.mipmap_offset };

    var shader = gl.shaders['luminance'];

	if(!shader)
		throw("no luminance shader");

	pixelColor.drawTo(function(){
		temp.toViewport( shader, uniforms );
	});

	var pixel = pixelColor.getPixels();
	// do eye adaptation
	if(pixel) 
	{
		// get time from last frame
		DTIMES.push( tFrame );
		var dt = DTIMES.reduce( function(e, r){ return e + r } ) / DTIMES.length;

		if(DTIMES.length > SMOOTH_SHIFT)
			DTIMES.shift();

		// log lum average
		var Lnew = Math.exp( pixel[1] );

        var size = LOG_MEAN_VALUES.length;
        if(size < 5) {
            // push new value 
            LOG_MEAN_VALUES.push( Lnew );
            this.setUniform('logLumAvg', Lnew);
            return;
        }

		var La = adaptiveTonemapping( Lnew );
		this.setUniform('logLumAvg', La);
		 LOG_MEAN_VALUES.push( Lnew );

		// shift in case of passing max
		if(size > MAX_LFI)
			LOG_MEAN_VALUES.shift();
		

/*		var Lavg = LOG_MEAN_VALUES.reduce( function(e, r){ return e + r } ) / size;
        var LavgNew_Log = Lavg + ( Lnew - Lavg ) * ( 1.0 - Math.exp(-dt * SMOOTH_SCALE) );  

        LOG_MEAN_VALUES.push( Lnew );

		// shift in case of passing max
		if(size > SMOOTH_SHIFT)
			LOG_MEAN_VALUES.shift();

		this.setUniform('logMean', Lnew);*/
		
		// now for lum average

		Lnew = pixel[0];
		size = MEAN_LUM_VALUES.length;

        if(!size) {
            MEAN_LUM_VALUES.push( Lnew );
            this.setUniform('LumAvg', Lnew);
            return;
        }

        MEAN_LUM_VALUES.push( Lnew );
        if(size > SMOOTH_SHIFT)
			MEAN_LUM_VALUES.shift();

        var Lavg = MEAN_LUM_VALUES.reduce( function(e, r){ return e + r } ) / size;

        var scale = 1.0;
        this.setUniform('LumAvg', Lavg * scale);

		if(size > SMOOTH_SHIFT)
			MEAN_LUM_VALUES.shift();
	}
}

function adaptiveTonemapping(Lfi)
{
	var range = 0.1 * Lfi;
	var minL = Lfi - range;
	var maxL = Lfi + range;

	var size = LOG_MEAN_VALUES.length;
	var j = size - 5;

	while(j > 0)
	{
		var Lfj = LOG_MEAN_VALUES[j];

		if(Lfj > minL && Lfj < maxL)
			j--;
		else 
			break;
	}

	var numFrames = size - j;
	var totalLog = 0;

	// console.log(numFrames)

	for(var k = size - 1; k >= size - numFrames; k--)
		totalLog += LOG_MEAN_VALUES[k];

	return Math.min(Math.exp(totalLog / numFrames), Math.pow(2, HDRI.hdr_scale));
}

/*
	get max luminance from rendered frame
	https://github.com/jagenjo/litegraph.js/blob/master/src/nodes/gltextures.js @jagenjo 
*/
Core.prototype.getMaxLuminance = function( input )
{
    var t1 = getTime();
    
    if(!input)
        input = this.texture_color;
	
	if(!input)
		throw('no valid input');

    var temp = null;
    var type = gl.FLOAT;

	var input_width = input.width;
	var input_height = input.height;

	var shader = gl.shaders['maxLum'];

	if(!shader)
		throw("no max luminance shader");

	if(!temp || temp.type != type )
		temp = new GL.Texture( 1, 1, { type: type, format: gl.RGB });

	var uniforms = {};

	temp.drawTo(function(){
		input.toViewport(shader, uniforms);
	});

	var pixel = temp.getPixels();
	if(pixel)
	{	
		// get time from last frame
		// this is done after average so do not push new value
		var dt = DTIMES.reduce( function(e, r){ return e + r } ) / DTIMES.length;

		if(DTIMES.length > SMOOTH_SHIFT)
			DTIMES.shift();

		if(!MAX_LUM_VALUES || !SMOOTH_SHIFT)
		return;

		var size = MAX_LUM_VALUES.length;
		var maxLum = pixel[0];		
		
		if(!size) {
            // push new value 
            MAX_LUM_VALUES.push( maxLum );
            var t2 = getTime();
		    this.setUniform('getmax_t', (t2 - t1).toFixed(3));
            return;
        }

		var Lavg = MAX_LUM_VALUES.reduce( function(e, r){ return e + r } ) / size;
        var LavgNew = Lavg + ( maxLum - Lavg ) * ( 1.0 - Math.exp(-dt * SMOOTH_SCALE) );  

		MAX_LUM_VALUES.push( maxLum );

		if(size > SMOOTH_SHIFT)
		MAX_LUM_VALUES.shift();
	
        this.setUniform('maxLum', LavgNew);

		var t2 = getTime();
		this.setUniform('getmax_t', (t2 - t1).toFixed(3));
	}

}

/**
* Set uniforms for scene or node
* @method uniforms
* @param {Type} uniforms
* @param {Type} node
*/
Core.prototype.uniforms = function(uniforms, node)
{
    if(!node)
    {
        this._uniforms = uniforms;
        return;
    }
    
    // ...
}

/**
* Returns nodes filtered by name
* @method getByName
* @param {string} name
*/
Core.prototype.getByName = function(name)
{
    for(var i = 0; i < this.root.children.length; i++)
    {
        var node = this.root.children[i];
        if(node.name == name)
            return node;
        if(node.children)
            for(var j = 0; j < node.children.length; j++)
                if(node.children[j].name == name)
                    return node.children[j];
    }
        
}

/**
* Returns nodes filtered by property
* @method getByProperty
* @param {string} property
*/
Core.prototype.getByProperty = function(property, value)
{
    var r = [];
    for(var i = 0; i < this.root.children.length; i++)
        if(this.root.children[i][property] == value)
            r.push(this.root.children[i]);
    return r;
}

/**
* Destroy nodes by name
* @method destroyByName
* @param {string} name
*/
Core.prototype.destroyByName = function( name )
{
    var l, that = this;
    if(name.constructor == Array)
    {
        l = [].concat(o);

        for(var i = 0; i < this.root.children.length; i++)
            if(l.indexOf( this.root.children[i].name) >= 0)
                this.root.children[i].destroy();
    }
    // destroy all nodes which includes the argument as string
    else
    {
        for(var i = 0; i < this.root.children.length; i++)
            if(this.root.children[i].name.includes( name ))
                this.root.children[i].destroy();
    }

	this.gui._must_update_panel = true;
}

/**
* Render sphere matrix
* @method createMatrix
* @param {bool} visible
*/
Core.prototype.createMatrix = function(visible, noUpdateCamera)
{
    var values = [0, 0.16666, 0.33333, 0.5, 0.66666, 0.83333, 1];
    var em = this._environment;
    var node = new RD.SceneNode();
    node.position = [-values.length + 1, 0, -values.length + 1];
    node.name = "matrix_node";
    node.flags.visible = visible;
    this.root.addChild(node);

    for(var i = 0; i < values.length; i++)
    for(var j = 0; j < values.length; j++)
    {
        let mn = new RD.SceneNode();
        mn.mesh = "sphere";
        mn.shader = "pbr";
        mn.position = [j * 2.0, 0, i * 2.0];

        this.setEnvironmentTextures( mn );

        // mn.textures["albedo"] = "white";
    
        node.addChild(mn)
    
        this.setRenderUniforms( mn );
        mn.setTextureProperties();

		// overwrite this params
		mn._uniforms["u_roughness"] = values[i];
        mn._uniforms["u_metalness"] = 1.0 - values[j];

        if(i == 3 && j == 3 && !noUpdateCamera)
        this.controller.onNodeLoaded(mn, [-6, 6, 15]);
    }

    //this.updateNodes();
    this.selected_radius = 1;
}

/**
* Render sphere matrix
* @method renderSphereScale
* @param {bool} visible
* @param {Object} options
*/
Core.prototype.renderSphereScale = function(visible, options)
{
    options = options || {};
    if(!options.property)
    throw( 'No property to make scale' );
    
    var prop = options.property;
    var name = (prop == 'roughness') ? 'roughness_scale_node' : 'metalness_scale_node';
    var aux_prop = options.aux_prop;

    var values = [1.0, 0.875, 0.75, 0.625, 0.5, 0.375, 0.25, 0.125, 0.0];
    var em = this._environment;
    var node = new RD.SceneNode();
    node.name = name;
    node.flags.visible = visible;
    this.root.addChild(node);

    for(var i = 0; i < 9; i++)
    {
        var mn = new RD.SceneNode();
        mn.name = "child" + i;
        mn.mesh = "sphere";
        mn.shader = "pbr";
        mn.position = [0,0,i*2];
        node.addChild( mn );

		this.setRenderUniforms( mn ); 

		// overwrite uniforms
        if(prop == 'roughness')
        {
            mn._uniforms["u_roughness"] = values[i];
            mn._uniforms["u_metalness"] = aux_prop != null ? aux_prop : 0.0;
        }
        else
        {
            mn._uniforms["u_roughness"] = aux_prop != null ? aux_prop : 1.0;
            mn._uniforms["u_metalness"] = values[i];
        }
    }

    this.updateNodes();
    this.selected_radius = 1;

    if(this.gui._sidepanel)
        this.gui.updateSidePanel(null, "root");
}

/**
* set uniform to core renderer
* @method setUniform
*/
Core.prototype.setUniform = function(name, value)
{
    if(!this.renderer)
        throw('no renderer');

	if( name.constructor === String && value !== undefined){
		
		if(!name.includes("u_"))
			name = "u_" + name;
		this.renderer._uniforms[name] = value;
	}
    else if( name.constructor === Object )
		Object.assign( this.renderer._uniforms, name); // name is an object with all uniforms
}

/**
* Add mesh to the scene
* @method addMesh
* @param {Mesh} mesh
* @param {String} filename
* @param {String} extension
* @param {Object} options
*/
Core.prototype.addMesh = function(mesh, extension, filename, options)
{
    var shader = shader || ( (this._environment == "no current") ? "textured" : "pbr");
    var mesh_name = filename ? filename : extension + '-' + uidGen.generate();
    gl.meshes[mesh_name] = mesh;

    options = options || {};
    
    var d = this.controller.camera.target,
        node = new RD.SceneNode({
            mesh: mesh_name,
            shader: shader
        });

    node.name = filename ? filename : "node-" + uidGen.generate();
    
    var scale = options.custom_scale || "m";

    if(scale == "cm")
    {
        // scale all
        camera.far = 10000
        grid.scaling = 100;
        CORE.cubemap.scaling = 10000;
    }

    if(options.parent)
    {
        options.parent.addChild( node );
    }else
    {
        this.root.addChild( node );
    }

    this.controller.onNodeLoaded( node, null, scale == "cm" ? 100 : 1 );

    this.setRenderUniforms(node);
    this.updateNodes();
    node.setTextureProperties();

    if(this.gui._sidepanel)
        this.gui.updateSidePanel(null, node.name);
}

/**
* Add primitive to the scene
* @method addPrimitive
* @param {String} mesh
* @param {String} shader
*/
Core.prototype.addPrimitive = function(mesh, shader, show_prem)
{
    var shader = shader || ( (this._environment == "no current") ? "textured" : "pbr");
    
    var node = new RD.SceneNode({
            mesh: mesh,
            shader: shader,
            color: [1, 1, 1, 1]
        });
    
    this.setEnvironmentTextures( node );

	node.textures["albedo"] = "white";
    node.name = show_prem ? 'show_prem' : "node-" + uidGen.generate();

    /*if(mesh == "plane")
    node.rotate(-90*DEG2RAD, RD.RIGHT);*/

    this.controller.onNodeLoaded( node );
    this.root.addChild( node );

    if(!show_prem) {
        this.setRenderUniforms(node);
        node.setTextureProperties();
    }
    
    if(this.gui._sidepanel)
        this.gui.updateSidePanel(null, node.name);

	if(RM.Get("NodePicker"))
        RM.Get("NodePicker").select(node);
        
    return node;
}

/**
* Get node properties needed when exporting
* @method getProperties
*/
Core.prototype.getProperties = function(node)
{
    var properties = {
        name: node.name,
        mesh: node.mesh,
        shader: node.shader,
        color: node.color,

        textures: node.textures,
		position: node.position,
        scaling: node.scaling,
        rotation: node.rotation,

        uniforms: node._uniforms,
        flags: node.flags,
    }

    return properties;
}

/**
* Creates an object of all the scene
* @method toJSON
*/
Core.prototype.toJSON = function()
{
    var camera = this.controller.camera;

	var componentInfo = {};

	for(var k in RM.components)
		if(RM.components[k].toJSON)
			componentInfo[k] = RM.components[k].toJSON();

    var boo = {
        _uid: this._uid,
		_descriptor: this._descriptor,
		_environment: this._environment, 
		_environment_set: this._environment_set,
        _blur_samples: this._blur_samples,
        _background_color: this._background_color,
		selected_radius: this.selected_radius,
        controller: {
			camera: JSON.stringify( this.controller.camera )
        },
        uniforms: this.renderer._uniforms,
        components: componentInfo,
        nodes: []
    }

    function node_to_json(node)
    {
        var tmp = node.clone(); // color and other
		Object.assign( tmp, node.serialize() ); // pos, rot, scale
        Object.assign( tmp.uniforms, node.uniforms ); // unforms

        // not necessary to export every child
        if(node.name === "matrix_node")
        {
            delete tmp.children;
            return JSON.stringify(tmp);
        }

        for(var i = 0; i < node.children.length; i++)
            tmp.children[i] = node_to_json(node.children[i]);

        return JSON.stringify(tmp);
    }

    // skip cubemap and grid
    for(var i = 2; i < this.root.children.length; i++)
    {
		var node = this.root.children[i]; 

		if(node.name == "lines")
            continue;
            
        boo['nodes'].push( node_to_json(node) );
    }
	
    return boo;
}

/**
* Load scene from JSON
* @method toJSON
* @param {Object} o
* @param {Boolean} only_settings
*/
Core.prototype.fromJSON = function( o, only_settings )
{
    var o = o || {};
    var gui = this.gui;
	var that = this;
	gui.loading();
    
	this.reset();
	this.configure(o);

    this.current_file = o.file_selected;
    
	// special cases
	if(o.uniforms )
	    this.renderer.setGlobalUniforms( o.uniforms );
    
	var components = o.components;

	if(components) {
		
		for( var key in components ) 
		{
			var copy = components[key];
			var component = RM.Get( key );

			if(!component)
                component = RM.registerComponent( RM.classes[key], key);

            component.fromJSON( copy );
        }
	}

	// set scene
	if ( o._environment_set )
		this.set( o._environment_set, {onImport: onLoadEnvironment } );

    function onSetScene()
    {
        // set controller
        if(o.controller) {
            var camera_props = JSON.parse( o.controller.camera );

            that.controller.configure( {
                eye: camera_props._position,
                target: camera_props._target,
                up: camera_props._up,
                near: camera_props.near,
                far: camera_props.far,
                fov: camera_props.fov
            });
        }
    }

    onSetScene();

	function onLoadEnvironment() {
		
		// no load nodes
		if(only_settings)
		{
			that.gui.updateSidePanel(null, 'root');
			return;
        }
        
        var dae_list = [];

		// load nodes info
		for(var i in o.nodes)    
		{
			var node_properties = JSON.parse(o.nodes[i]);
            var node_name = node_properties.name;
            
            if(node_name.includes(".dae"))
            {
                dae_list.push( node_properties );
                continue;
            }

			switch(node_name)
			{
				case 'lines':
				case 'light':
				case 'grid':
					continue;
				case 'cubemap':
					that.cubemap.flags = node_properties.flags;
					that.cubemap.shader = node_properties.shader;
					break;
				case 'matrix_node':
					that.createMatrix( true, true );
					break;
				default:

					// create node and apply properties
					var new_node = new RD.SceneNode();
                    new_node.name = "tmp";
                    
                    // fix import scale
                    delete node_properties.scaling;
                    delete node_properties.scale;

					new_node.configure(node_properties);
					new_node.setTextureProperties();
                    that.root.addChild(new_node);
                    
                    for(var child in node_properties.children)
                    {
                        var child_properties = JSON.parse(node_properties.children[child]);
                        var new_child = new RD.SceneNode();
                        new_child.name = "tmp";
                        // fix import scale
                        delete child_properties.scaling;
                        delete child_properties.scale;
                        new_child.configure(child_properties);
                        new_child.setTextureProperties();
                        new_node.addChild(new_child);
                    }

					break;
            }
        }
        
        // configure daes
        var parser = RM.formats["dae"];	

        if(dae_list.length && !parser)
        throw("cant parse DAE file");

        for(var i in dae_list)
        {
            var dae = dae_list[i];

            console.log(dae);

            if(!dae.name)
            throw("cant parse DAE file");

            var clean_name = dae.name.substring(0, dae.name.length - 4);
            that.parse( clean_name, function()
            {
                // set export options here
                // node info, camera, etc
                for(var child in dae.children)
                {
                    var child_properties = JSON.parse(dae.children[child]);
                    var node = CORE.getByName( child_properties.name );
                    node.configure(child_properties);
                }

                // set controller
                onSetScene();
            });

        }
            
		gui.updateSidePanel(null, 'root');
		resize();
	}
}

RD.SceneNode.prototype.setTextureProperties = async function()
{

	/*if(renderer._uniforms.u_mipCount > 5)
		RM.shader_macros[ 'MIP_COUNT' ] = renderer._uniforms.u_mipCount;*/

	/*
	Encode properties in two vec4
	vec4 properties_array0
	vec4 properties_array1
	*/
    this.isEmissive = this.textures['emissive'] ? 1 : 0; 
    this.hasAlpha = this.textures['opacity'] ? 1 : 0;
    this.hasAO = this.textures['ao'] ? 1 : 0; 
    this.hasBump = this.textures['height'] ? 1 : 0; 
    
	this.hasAlbedo = this.textures['albedo'] ? 1 : 0; 
	this.hasRoughness = this.textures['roughness'] ? 1 : 0; 
	this.hasMetalness = this.textures['metalness'] ? 1 : 0; 
	this.hasNormal = this.textures['normal'] ? 1 : 0; 

	this._uniforms["u_properties_array0"] = vec4.fromValues(
			this.hasAlbedo,
			this.hasRoughness,
			this.hasMetalness,
			this.hasNormal
	);

	this._uniforms["u_properties_array1"] = vec4.fromValues(
			this.isEmissive,
			this.hasAlpha,
			this.hasAO,
			this.hasBump
	);
}

})( typeof(window) != "undefined" ? window : (typeof(self) != "undefined" ? self : global ) );