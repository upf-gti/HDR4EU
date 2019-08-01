/*
*   Alex Rodríguez
*   @jxarco 
*/

/**
* Responsible of configuring scene, 3d nodes and its properties  
* @class Core
* @constructor
*/



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
    this._uid = guidGenerator();
    this._descriptor = "";
    this._errors = {};
    this.browser = this.browser();
    
    this._uniforms = {};
    this._environment = "no current";
    this._last_environment = "no last";
    this._blur_samples = RM.shader_macros['N_SAMPLES'];
    this._no_repeat = false;
    this.selected_radius = 1; // for wheel speed
    
    this._scene = new RD.Scene();
    this._root = this._scene.root;

	this.isFullscreen = false;

    // important nodes
    var cubemap = new RD.SceneNode();
    cubemap.name = "cubemap";
    cubemap.mesh = "cube";
    cubemap.shader = "skybox";
	cubemap.position = [-1.5, 2, 6];
    cubemap.flags.depth_test = false;
    cubemap.flags.flip_normals = true;
    cubemap.render_priority = RD.PRIORITY_BACKGROUND;

	grid = new RD.SceneNode();
    grid.name = "grid";
    grid.mesh = "grid";
	grid.primitive = GL.LINES;
	grid.blend_mode = RD.BLEND_ALPHA;
	grid.opacity = 0.75;
	grid.scaling = 1;
    grid.shader = "grid";
    
    cubemap.ready = function() { 
        var ready = (this.textures['env'] && this.textures['env_1']
        && this.textures['env_2'] && this.textures['env_3']
        && this.textures['env_4'] && this.textures['env_5'] ) ? true : false;

        return ready;
    };

    this._cubemap = cubemap;
    
    this._root.addChild(grid);
	this._root.addChild(cubemap);

    this._context = GL.create({width: window.innerWidth, height: window.innerHeight, 
		// version: 2,
        // alpha: true, 
        //premultipliedAlpha: false
    });

    this._renderer = new RD.Renderer( this._context, {
        autoload_assets: true
    });

    var w = (gl.canvas.width)|0;
    var h = (gl.canvas.height)|0;
    var type = gl.FLOAT;
    
    this._viewport_tex = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
	this._fxaa_tex = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    this._fx_tex = new GL.Texture(w,h, {type: type});
    this._background_color = vec4.fromValues(0.2, 0.2, 0.2,1);

    this.fxaa_shader = Shader.getFXAAShader();
    this.fxaa_shader.setup();

    // deferred rendering (G buffers)
    this.texture_albedo = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    this.texture_normal = new GL.Texture(w,h, { type: type, filter: gl.LINEAR });
    this.texture_roughness = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    this.texture_depth = new GL.Texture(w,h, { format: gl.DEPTH_COMPONENT, type: gl.UNSIGNED_INT}); 
	this.texture_linear_depth = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    this.texture_final = new GL.Texture(w,h, { texture_type: gl.TEXTURE_2D, type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });

    this.fbo_textures = [ this.texture_albedo, this.texture_normal, this.texture_roughness ];
    this.fbo = null;

    if(!this.mobile()) { // mobile browser does not support FBO
        
        this.fbo = new GL.FBO( this.fbo_textures, this.texture_depth );
    }

    this.show_deferred_textures = false;
    
    this._controller = new Controller( this._context );
    this._gui = new GUI();
	this.stats = new Stats();

	this.stats.dom.id = "statsDiv";
	$(this.stats.dom).css({
		"top": LiteGUI.sizeToCSS(window.innerHeight - 48),
	})
	document.body.append( this.stats.dom );
	//this.maxLumPanelStat = this.stats.addPanel( new Stats.Panel( 'MaxLum', '#ff0', '#220' ) );

	// i only want FPS
	if(this.stats.dom.children.length > 2) {
		this.stats.dom.children[2].remove();
		this.stats.dom.children[1].remove();
	}

	LiteGUI.draggable( this.stats.dom );

	this.table_components = {
		"Atmos" : AtmosphericScattering
	}
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

Core.prototype.setup = function()
{
    var that = this;
    
    var last = now = getTime();

    canvas = this.getCanvas();
	canvas.id = "webgl_canvas";

    canvas.addEventListener("webglcontextlost", function(event) {
        event.preventDefault();
        console.error('Context lost');
        console.error(event);
    }, false);

    canvas.ondragover = () => {return false};
    canvas.ondragend = () => {return false};
    canvas.ondrop = (e) => processDrop(e);
    
    gui = this._gui;
    renderer = this._renderer;
    scene = this.scene;
    camera = this.controller._camera;
    
    // declare renderer uniforms
	this.setUniform({
		"u_ambient": vec3.fromValues(0.2, 0.4, 0.8),
		"u_near": camera.near,
		"u_far": camera.far,
		"u_rotation": 0.0,
		"u_exposure": 0.0,
		"u_exp": 0.0,
		"u_offset": 0.0,
		"u_channel": 0.0,
		"u_enable_ao": true,
		"u_correctAlbedo": true,
		"u_EC": false,
		"u_applyGamma": true,
		"u_middleGray": 0.18,
		"u_ibl_intensity": 1.0,
		"u_albedo": vec3.fromValues( 1, 1, 1),
		"u_viewport": gl.viewport_data,
		"u_show_layers": false,
		"u_flipX": false,

		// Atmospheric Scattering
		'u_SunPos': 0.4,
		'u_SunIntensity': 22.0,
		"u_MieDirection": 0.76,
		'u_originOffset': 0.0,
		'u_MieCoeff': 21
	});

    // set param macros
    RM.shader_macros[ 'INPUT_TEX_WIDTH' ] = gl.viewport_data[2];
    RM.shader_macros[ 'INPUT_TEX_HEIGHT' ] = gl.viewport_data[3];
    RM.shader_macros[ 'EM_SIZE' ] = 1; // no parsing at initialization

	// Compile shaders from scripts
	for(var shader in RM.shaders) {
        if(this.mobile() && (shader === "pbr_deferred" || shader === "flat_deferred"))
            continue;
		// console.log(shader);
        gl.shaders[shader] = new GL.Shader(RM.shaders[shader].vs_code, RM.shaders[shader].fs_code);
    }
	
    renderer.context.ondraw = function(){ that.render() };
    renderer.context.onupdate = function(dt){ that.update(dt) };
    renderer.context.animate();

	this.FS = new FileSystem();
	this.ssao = ssao;

    // get response from files.php and init app
    LiteGUI.request({
        url:"php/files.php", 
        success: async function(data){ 
            // Save textures info for the GUI
			RM.textures = JSON.parse(data);
            
            await that.reloadShaders();
        
            // Environment BRDFs (LUT) - true for getting also the multi-brdf
			HDRTool.brdf(true);	

			var tex_name = '_brdf_integrator';
			gl.textures[tex_name] = renderer.loadTexture("assets/brdfLUT.png", { type: gl.FLOAT, texture_type: gl.TEXTURE_2D, filter: gl.LINEAR});
            
				// Set environment 
				that.set( RM.textures['Studio'], {onImport: function(){
			
			}} );

            // Init things
            ssao.init();
			HDRI.init(that, gl);
            gui.init(); 
			// HDRI
			

			var url = "exports/";
			// query string params
			if( QueryString['scene'] ) {
				url += QueryString['scene'];
				LiteGUI.requestJSON( url, function(v){ CORE.fromJSON( v ); } );
			}
        },
        error: function(err){ console.error(err, "Error getting app environments") }
    });

    // Init Canvas tools (which are not in component)
    $(document.querySelector(".tool-sphereprem")).on('click', function(){

        if(window.prem_sphere) {
            window.prem_sphere.destroy(true);
            that._gui.updateSidePanel(null, 'root');
            window.prem_sphere = undefined;
            $(this).removeClass("enabled");
            return;
        }
        window.prem_sphere = that.addPrimitive('sphere', 'mirror', true);
        $(this).addClass("enabled");
    });

    $(document.querySelector(".tool-deferredtex")).on('click', function(){

        that.show_deferred_textures = !that.show_deferred_textures;
        
        if(that.show_deferred_textures)
            $(this).addClass("enabled");
        else 
            $(this).removeClass("enabled");
    });

	$(document.querySelector(".tool-showgrid")).on('click', function(){

		if(!grid)
			return;

        grid.visible = !grid.visible;
        
        if(grid.visible)
            $(this).addClass("enabled");
        else 
            $(this).removeClass("enabled");
    });
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
    return this._renderer.canvas;
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

Core.prototype.browser = function()
{
    if(isSafari && isSafari())
        return 'safari';
    if(isOpera && isOpera())
        return 'opera';
    if(isChrome && isChrome())
        return 'chrome';
    if(isFirefox && isFirefox())
        return 'firefox';
	if(isEdge && isEdge())
        return 'edge';
}

Core.prototype.mobile = function()
{
    if(isMobile)
        return isMobile();
}

window.browser = Core.prototype.browser;

var userAgent = (navigator && navigator.userAgent || '').toLowerCase();
var vendor = (navigator && navigator.vendor || '').toLowerCase();

var isSafari = function()
{
    var match = userAgent.match(/version\/(\d+).+?safari/);
    return match !== null;
}

var isEdge = function()
{
    var match = userAgent.includes("edge");
    return match;
}

var isOpera = function()
{
    var match = userAgent.match(/(?:^opera.+?version|opr)\/(\d+)/);
    return match !== null;
}

var isChrome = function()
{
    var match = /google inc/.test(vendor) ? userAgent.match(/(?:chrome|crios)\/(\d+)/) : null;
    return match !== null && !isOpera();
}

var isFirefox = function()
{
    var match = userAgent.match(/(?:firefox|fxios)\/(\d+)/);
    return match !== null;
}

var isMobile = function()
{
    return /android/.test(userAgent) || /mobile/.test(userAgent);
}

Object.defineProperty(Core.prototype, 'cubemap', {
    get: function() { return this._cubemap; },
    set: function(v) { this._cubemap = v; this._root.addChild(v); },
    enumerable: true
});

Object.defineProperty(Core.prototype, 'scene', {
    get: function() { return this._scene; },
    set: function(v) { this._scene = v; },
    enumerable: true
});

Object.defineProperty(Core.prototype, 'controller', {
    get: function() { return this._controller; },
    set: function(v) { this._controller = v; },
    enumerable: true
});

Object.defineProperty(Core.prototype, 'blur_samples', {
    get: function() { return this._blur_samples; },
    set: function(v) { this._blur_samples = v; RM.shader_macros['N_SAMPLES'] = v; },
    enumerable: true
});

/**
* Render all the scene
* @method render
*/
Core.prototype.render = function()
{
	if(window.show_texture) {
		gl.textures[window.show_texture].toViewport();
		return;
	}

	this.stats.begin();

	tFrame = Math.clamp(getTime() - postFrame, 0, 6);
	this.setUniform("tFrame", tFrame);
		
	if(this._gui.editor == 1){ // i'm in hdri tab

		HDRI.render();
		postFrame = getTime();
		this.stats.end();
		return;
	}

    if(!this.cubemap.ready()) 
    return;

    // Update cubemap position
    this.cubemap.position = this.controller.getCameraPosition();

    var RenderComponent = RM.get('Render');
    if( (RenderComponent && RenderComponent.render_mode == RM.FORWARD) || !this.fbo)
        this.forwardRender();
    else
        this.deferredRender();

    // Render node selected
    var NodePickerComponent = RM.get('NodePicker');
    if(NodePickerComponent)
        NodePickerComponent.render();

    // Render GUI
	this._gui.render();

	//this.maxLumPanelStat.update(renderer._uniforms.u_maxLum * 100 || 0, 10000);
	postFrame = getTime();
	this.stats.end();
}

/**
* Render all the scene using forward rendering
* @method forwardRender
*/
Core.prototype.forwardRender = function()
{
    var renderer = this._renderer;
    var that = this;
	var SFXComponent = RM.get("ScreenFX");

    // gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

	renderer.clear(that._background_color);
	renderer.render( that.scene, that.controller._camera );

	if(!SFXComponent.enable) {
		renderer.clear(that._background_color);
		renderer.render( that.scene, that.controller._camera );
		return;
	}

    // Render scene to texture
    this._viewport_tex.drawTo( function() {
		renderer.clear(that._background_color);
        renderer.render( that.scene, that.controller._camera );
    });
    
    //  automatic exposure
	if(SFXComponent)
		SFXComponent.setProgramAuto( this.getAverageLuminance() );

    try
    {
		var check = info_check();

        if (check[0])
			this.getMaxLuminance();
		// if (check[1])
		// 	this.getAverageLuminance();
    }
    catch (e)
    {
        if(!this._errors[e])
            this._errors[e] = 1;
    }

	var render_texture;

	if( SFXComponent && SFXComponent.fxaa )
	{
		this._fxaa_tex.drawTo(function(){
		
			that._viewport_tex.toViewport( that.fxaa_shader );
		});

		render_texture = this._fxaa_tex;
	}
		
	else {
	
		render_texture = this._viewport_tex;
	}

	// Apply (or not) bloom effect
    if( SFXComponent && SFXComponent.glow_enable )
        render_texture = createGlow( render_texture );

    // Get tonemapper and apply (exposure, offset, tonemapping, degamma)
    if(SFXComponent) {
        var myToneMapper = RM.tonemappers[ SFXComponent.tonemapping ];
        myToneMapper.apply( render_texture, this._fx_tex ); 
    }else{
        this._fx_tex = render_texture;
    }

	this._fx_tex.toViewport();
}

/**
* Render all the scene using deferred rendering
* @method deferredRender
*/
Core.prototype.deferredRender = function()
{
    var renderer = this._renderer;
    var that = this;
	var w = gl.canvas.width;
    var h = gl.canvas.height;

    if(!gl.shaders['finalDeferred'] || !gl.shaders['ssao'])
        return;

    // PRE PASS: fill G buffers
    this.fbo.bind(true);
    
    gl.enable( gl.DEPTH_TEST );
    gl.disable( gl.BLEND );

    // render geometry and capture info
    renderer.clear( this._background_color );
    renderer.render( this.scene, this.controller._camera, null, 3 );

    this.fbo.unbind();
    gl.disable( gl.DEPTH_TEST );
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

	// Linearize depth before doing anything
	this.texture_depth.bind(0);
	this.texture_linear_depth.drawTo( () => {
        gl.shaders['linearDepth'].uniforms(renderer._uniforms).draw(Mesh.getScreenQuad());
    });
	this.texture_depth.unbind(0);

    // FINAL PASS
	
    this.texture_normal.bind(5);
    this.texture_depth.bind(6);
    this.ssao.noiseTexture.bind(7);
	
	this.setUniform('fbo_normal_texture', 5);
    this.setUniform('fbo_depth_texture', 6);
	this.setUniform('noise_texture', 7);

    var inv_p = mat4.create(),
        inv_v = mat4.create(),
        camera = this.controller._camera;

    mat4.invert(inv_p, camera._projection_matrix);
    mat4.invert(inv_v, camera._view_matrix);

    this.setUniform('invv', inv_v);
    this.setUniform('invp', inv_p);
    this.setUniform('projection', camera._projection_matrix);
    this.setUniform('view', camera._view_matrix);


	// Draw SSAO to texture
	this.ssao.texture.drawTo( () => {
        gl.shaders['ssao'].uniforms(renderer._uniforms).draw(Mesh.getScreenQuad());
    });

	// blur SSAO texture
	for(var i = 0; i < 2; i++){
		this.ssao.texture.applyBlur( i,i, 1, this.ssao.blurTexture );
	}
	
	this.texture_normal.unbind();
    this.texture_depth.unbind();
    this.ssao.noiseTexture.unbind();

    // Fill renderer uniforms with average, max lum, etc.
    /*try
    {
        if (info_check())
        {
            perblock_getmax( this.texture_albedo );
            downsampled_getaverage( this.texture_albedo );
        }
    }
    catch (e)
    {
        if(!this._errors[e])
        this._errors[e] = 1;
    }*/

	// combine SSAO with rendered frame
	// rebind this bc something happens if not
	this.texture_albedo.bind(5); 
    this.texture_normal.bind(6);
    this.texture_depth.bind(7);
	this.texture_roughness.bind(8);
    this.ssao.texture.bind(9);
	this.ssao.blurTexture.bind(10);

	this.setUniform('fbo_color_texture', 5);
	this.setUniform('fbo_normal_texture', 6);
	this.setUniform('u_fbo_depth_texture', 7);
    this.setUniform('fbo_roughness_texture', 8);
	this.setUniform('ssao_texture', 9);
	this.setUniform('ssao_texture_blur', 10);

	this.texture_final.drawTo( () => {
        gl.shaders['finalDeferred'].uniforms(renderer._uniforms).draw(Mesh.getScreenQuad());
    });

	if(this.show_deferred_textures) {
        var w = gl.canvas.width;
        var h = gl.canvas.height;
        gl.drawTexture( this.texture_albedo, 0, 0, w/2,  h/2 );  
		gl.drawTexture( this.ssao.blurTexture, w/2, 0, w/2,  h/2 );
        gl.drawTexture( this.texture_normal, 0, h/2, w/2,  h/2 );
		gl.drawTexture( this.texture_linear_depth, w/2, h/2, w/2,  h/2 );
    }else
	{
		gl.drawTexture( this.texture_final, 0, 0, w,  h );
	}
	
	return;

    // Apply (or not) bloom effect
    var render_texture = this.texture_final; 
    var SFXComponent = RM.get("ScreenFX");

    if( SFXComponent && SFXComponent.glow_enable )
        render_texture = createGlow( this.texture_albedo );

    // Get tonemapper and apply (exposure, offset, tonemapping, degamma)
    if(SFXComponent) {
        var myToneMapper = RM.tonemappers[ SFXComponent.tonemapping ];
        myToneMapper.apply( render_texture, this._fx_tex ); 
    }else{
        this._fx_tex = render_texture;
    }

    if(this.show_deferred_textures) {
        var w = gl.canvas.width;
        var h = gl.canvas.height;
        gl.drawTexture( this.texture_albedo, 0, 0, w/2,  h/2 );  
		gl.drawTexture( this.texture_roughness, w/2, 0, w/2,  h/2 );
        gl.drawTexture( this.texture_normal, 0, h/2, w/2,  h/2 );
		gl.drawTexture( this.texture_linear_depth, w/2, h/2, w/2,  h/2 );
    }else
	{
		 // Apply antialiasing (FXAA)
		if( SFXComponent && SFXComponent.fxaa )
			this._fx_tex.toViewport( this.fxaa_shader );
		else
			this._fx_tex.toViewport();
	}
}

/**
* Update all the scene
* @method update
* @param {number} dt
*/
Core.prototype.update = function(dt)
{
    _dt = dt;

    // Update all nodes in the scene
	this.scene.update(dt);

	// Update gui
	this._gui.update(dt);

    // Update controller bindings
    this.controller.update(dt, this._renderer.context);
}

/**
* Set and configure scene 
* @method set
* @param {string} env_path
* @param {Object} options
*/
Core.prototype.set = function(env_set, options)
{
    if(!this._cubemap)
        throw("Create first a cubemap node");

    var env_path = env_set.constructor == String ? env_set : env_set.path;
    var tex_name = HDRTool.getName( env_path );
    var options = options || {};

    if(this._environment == tex_name && tex_name != ":atmos") {
        this._gui.loading(0);
		if(options.onImport)
			options.onImport();
        return;
    }

    this._last_environment = this._environment;
    this._environment = tex_name;
    this._environment_set = env_set;
            
    var that = this;
    var oncomplete = function() { 
		// console.log( options );
		that.display( options.no_free_memory ); 
		if(options.onImport)
			options.onImport();
	};
    var params = Object.assign(options, {oncomplete: oncomplete});

    if(tex_name != ":atmos")
        this.cubemap.shader = "skybox";

    if(gl.textures[ "_prem_0_" + this._environment ] && tex_name != ":atmos")
        this.display();
    else
    {
        // Load hdre pre-processed files
        if( env_path.includes(".hdre") )
            HDRTool.load( env_path, params);
        else // Load and prefilter exr files
            HDRTool.prefilter( env_path, params );
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
    // delete previous em (free memory)
    if( !no_free_memory )
        for(var t in gl.textures)
            if(t.includes( this._last_environment ))
                delete gl.textures[t];

    // update environment in all necessary nodes
    if(gl.textures[this._environment])
        this.updateNodes();
    
    // config scene
    this._cubemap.texture = (this._gui._usePrem0 ? "_prem_0_" : "") + this._environment;
    
    var that = this;
    // gui
    setTimeout(function(){
        that._gui.updateSidePanel(null, 'root');
        that._gui.loading(0);
        $("#import-loader").hide();            
        console.log("%c" + that._environment, 'font-weight: bold;');
    }, 250);
}

/**
* Parse scenes data (or JSON)
* @method parse
* @param {string} name
*/
Core.prototype.parse = function(name)
{
    // clean scene
    this.destroyByName('node');

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
	toParse.mesh = mesh;

    this.loadResources( toParse, name );
}

/**
* Load mesh or meshes
* @method loadResources
* @param {Object} toParse
*/
Core.prototype.loadResources = async function( toParse, name )
{
    var that = this;

    // Load array of meshes
    var meshes = toParse.mesh;
    var RenderComponent = RM.get("Render");
    var render_mode = 0;
    if(RenderComponent && RenderComponent.render_mode)
        render_mode = RenderComponent.mode;

    for(var i = 0; i < meshes.length; i++)
    {
        var resource = meshes[i];

        var node = new RD.SceneNode();
        node.mesh = resource;
        node.name = "node-" + simple_guidGenerator();
        node.render_priority = RD.PRIORITY_ALPHA;

        var shader = (render_mode === 0) ? "pbr" : "pbr_deferred";
        node.shader = shader;

        node.blend_mode = RD.BLEND_ALPHA;
        that._root.addChild( node );

        if( toParse.uniforms )
            node._uniforms = Object.assign(node._uniforms, toParse.uniforms);

		node._uniforms["u_roughness"] = 0.0;
		node._uniforms["u_metalness"] = 0.0;
		node._uniforms["u_alpha"] = 1.0;
		node._uniforms["u_reflectance"] = vec3.fromValues(0.5,0.5,0.5);
		node._uniforms["u_tintColor"] = vec3.fromValues(1,1,1);
		node._uniforms["u_clearCoat"] = 0.0;
		node._uniforms["u_clearCoatRoughness"] = 0.0;
		node._uniforms["u_renderDiffuse"] = true;
		node._uniforms["u_renderSpecular"] = true;
        
        // for multimesh nodes
        toParse.textures = [].concat(toParse.textures);

        // load zero-metalness texture to avoid strange artifacts (can be sub later)
        // node.textures["metalness"] = "assets/zero-metal.png";
        
        // load textures
        for(var t in toParse.textures[i])
            node.textures[t] = RM.MODELS_FOLDER + toParse.textures[i][t];

        // is emissive? has AO? has Alpha?
        node.setTextureProperties();

        renderer.loadMesh(resource, function(res){

            if(!res) 
            throw( "No mesh loaded" );

            var bb = gl.meshes[resource].getBoundingBox();
            var center = BBox.getCenter(bb);
            that.selected_radius = BBox.getRadius(bb);

            var globalMat = node.getGlobalMatrix();
            var result = vec3.create();
            vec3.transformMat4( result, center, globalMat );

            /*if(toParse.camera && toParse.camera.target)
                result = toParse.camera.target;*/
            
            var eye = [0, that.selected_radius, that.selected_radius * 3];

            if(toParse.camera && toParse.camera.eye)
                eye = toParse.camera.eye;

            camera.lookAt(eye, result, RD.UP);
            that._gui.updateSidePanel(null, node.name);
        });
    }

    // update node textures from the current environment
    this.updateNodes();
}

/**
* Update nodes with Core configuration
* @method update
*/
Core.prototype.updateNodes = function()
{   
    // update environment map textures
    
    for (var i = 0; i < this._root.children.length; i++)
    {
        var node = this._root.children[i];

        if(!node) continue;

        node.textures['brdf'] = "_brdf_integrator";
		node.textures['brdf_multi'] = "_brdf_integrator_multi";
        node.textures['env'] = this._environment;
        node.textures['env_1'] = "_prem_0_" + this._environment;
        node.textures['env_2'] = "_prem_1_" + this._environment;
        node.textures['env_3'] = "_prem_2_" + this._environment;
        node.textures['env_4'] = "_prem_3_" + this._environment;
        node.textures['env_5'] = "_prem_4_" + this._environment;
		/*node.textures['env_6'] = "_prem_5_" + this._environment;
		node.textures['env_7'] = "_prem_6_" + this._environment;*/

        if(!node.children.length)
            continue;

        for (var j = 0; j < node.children.length;  j++)
        {
            var child = node.children[j];

            child.textures['brdf'] = "_brdf_integrator";
			child.textures['brdf_multi'] = "_brdf_integrator_multi";
            child.textures['env'] = this._environment;
            child.textures['env_1'] = "_prem_0_" + this._environment;
            child.textures['env_2'] = "_prem_1_" + this._environment;
            child.textures['env_3'] = "_prem_2_" + this._environment;
            child.textures['env_4'] = "_prem_3_" + this._environment;
            child.textures['env_5'] = "_prem_4_" + this._environment;
			/*child.textures['env_6'] = "_prem_5_" + this._environment;
			child.textures['env_7'] = "_prem_6_" + this._environment;*/
        }
    }
}

/**
* Reset scene
* @method reset
*/
Core.prototype.reset = function()
{
	RM.get('NodePicker').selected = null;
	delete gl.meshes['lines'];
	this.destroyByName('node');
    // this.controller.reset();
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

		var info = GL.Texture.cubemap_camera_parameters[side];
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
        var r = GL.Texture.cubemap_camera_parameters[l],
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
        that._renderer.loadShaders("assets/shaders.glsl", function() {
            
            console.log("shaders reloaded!", {macros: RM.shader_macros});

			// now reload shaders from /shaders/js
			for(var i in RM.shaders) {

				if(RM.shaders[i].setup)
					RM.shaders[i].setup();

				var shader = gl.shaders[i];
	
				if(!shader) 
					continue;

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
	var t1 = getTime();

    if(!input)
        input = this._viewport_tex;
    
	if(!input || !LOG_MEAN_VALUES || !SMOOTH_SHIFT)
		throw('something went wrong');

    var type = gl.FLOAT;

	// var mipmap_level = 2;
	// var size = Math.pow(2, Math.floor(Math.log(input_width)/Math.log(2))) / Math.pow(2, mipmap_level);

	var shader = gl.shaders['luminance'];

	if(!shader)
		throw("no luminance shader");

    var temp = new GL.Texture( 16, 16, { type: type, format: gl.RGBA, minFilter: gl.LINEAR_MIPMAP_LINEAR });

	temp.drawTo(function(){
		input.toViewport();
	});

	var pixelColor = new GL.Texture( 1, 1, { type: type, format: gl.RGBA, filter: gl.NEAREST });

	var properties = { mipmap_offset: 0, low_precision: false };
	var uniforms = { u_mipmap_offset: properties.mipmap_offset };

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
            // this.setUniform('logMean', Lnew);
            var t2 = getTime();
		    this.setUniform('getaverage_t', (t2 - t1).toFixed(3));
            return;
        }

		var La = adaptiveTonemapping( Lnew );
		this.setUniform('logMean', La);
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
            var t2 = getTime();
		    this.setUniform('getaverage_t', (t2 - t1).toFixed(3));
            return;
        }

        Lavg = MEAN_LUM_VALUES.reduce( function(e, r){ return e + r } ) / size;
        var LavgNew = Lavg + ( Lnew - Lavg ) * ( 1.0 - Math.exp(-dt * SMOOTH_SCALE) );  

        MEAN_LUM_VALUES.push( Lnew );

		if(size > SMOOTH_SHIFT)
			MEAN_LUM_VALUES.shift();

		var t2 = getTime();
		this.setUniform('getaverage_t', (t2 - t1).toFixed(3));

		return LavgNew;
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

	return Math.exp(totalLog / numFrames);
}

/*
	get max luminance from rendered frame
	https://github.com/jagenjo/litegraph.js/blob/master/src/nodes/gltextures.js @jagenjo 
*/
Core.prototype.getMaxLuminance = function( input )
{
	var t1 = getTime();

    if(!input)
        input = this._viewport_tex;
	
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
    for(var i = 0; i < this._root.children.length; i++)
        if(this._root.children[i].name == name)
            return this._root.children[i];
}

/**
* Returns nodes filtered by property
* @method getByProperty
* @param {string} property
*/
Core.prototype.getByProperty = function(property, value)
{
    var r = [];
    for(var i = 0; i < this._root.children.length; i++)
        if(this._root.children[i][property] == value)
            r.push(this._root.children[i]);
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

        for(var i = 0; i < this._root.children.length; i++)
            if(l.indexOf( this._root.children[i].name) >= 0)
                this._root.children[i].destroy();
    }
    // destroy all nodes which includes the argument as string
    else
    {
        for(var i = 0; i < this._root.children.length; i++)
            if(this._root.children[i].name.includes( name ))
                this._root.children[i].destroy();
    }

	this._gui._must_update_panel = true;
}

/**
* Render sphere matrix
* @method createMatrix
* @param {bool} visible
*/
Core.prototype.createMatrix = function(visible)
{
    var values = [0, 0.16666, 0.33333, 0.5, 0.66666, 0.83333, 1];
    // var values = [0, 0.11111, 0.22222, 0.33333, 0.44444, 0.55555,0.66666,0.7777,0.8888,0.999999];
    var em = this._environment;
    var node = new RD.SceneNode();
    node.name = "matrix_node";
    node.flags.visible = visible;
    this._root.addChild(node);

    for(var i = 0; i < values.length; i++)
    for(var j = 0; j < values.length; j++)
    {
        var mn = new RD.SceneNode();
        mn.mesh = "sphere";
        mn.shader = "pbr";
        mn.position = [j * 2.0, 0, i * 2.0];
        mn._uniforms["u_roughness"] = values[i];
        mn._uniforms["u_metalness"] = 1.0 - values[j];
		mn._uniforms["u_alpha"] = 1.0;
		mn._uniforms["u_clearCoat"] = 0.0;
		mn._uniforms["u_clearCoatRoughness"] = 0.0;
		mn._uniforms["u_reflectance"] = vec3.fromValues(0.5,0.5,0.5);
		mn._uniforms["u_renderDiffuse"] = true;
		mn._uniforms["u_renderSpecular"] = true;
		mn._uniforms["u_albedo"] = vec3.fromValues(1, 1, 1);
		mn._uniforms["u_tintColor"] = vec3.fromValues(1,1,1);
        // mn.setTextureProperties();
        node.addChild(mn);
    }

	/*var floor = new RD.SceneNode();
	floor.mesh = "planeXZ";
	floor.shader = "pbr";
	floor.position = [3 * 2.0, 0, 3 * 2.0];
	floor.scaling = 14;
	floor._uniforms["u_roughness"] = 1;
	floor._uniforms["u_metalness"] = 1;
    floor.flags.visible = visible;
    node.addChild(floor);*/

    this.updateNodes();
    this.selected_radius = 1;

    if(this._gui._sidepanel)
        this._gui.updateSidePanel(null, "root");
}

/**
* Render sphere matrix
* @method createSSAOScene
*/
Core.prototype.createSSAOScene = function()
{
    var em = this._environment;
    var node = new RD.SceneNode();
    node.name = "ssao_scene_node";
    this._root.addChild(node);

    for(var i = 0; i < 30; i++)
    {
        var mn = new RD.SceneNode();
        mn.mesh = "cube";
        mn.shader = "pbr_deferred";
        mn.position = [Math.random() * 3, Math.random() * 3, Math.random() * 3];
        mn._uniforms["u_roughness"] = 1.0;
        mn._uniforms["u_metalness"] = 1.0;
		mn._uniforms["u_alpha"] = 1.0;
		mn._uniforms["u_clearCoat"] = 0.0;
		mn._uniforms["u_clearCoatRoughness"] = 0.0;
		mn._uniforms["u_reflectance"] = vec3.fromValues(0.5,0.5,0.5);
		mn._uniforms["u_renderDiffuse"] = true;
		mn._uniforms["u_renderSpecular"] = true;
		mn._uniforms["u_albedo"] = vec3.fromValues(1, 1, 1);
		mn._uniforms["u_tintColor"] = vec3.fromValues(1,1,1);
        mn.rotate(Math.random(), RD.UP);
		mn.rotate(Math.random(), RD.RIGHT);
		node.addChild(mn);
    }

    this.updateNodes();
    this.selected_radius = 1;
	camera.target = node.children[0].position;
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
    this._root.addChild(node);

    for(var i = 0; i < 9; i++)
    {
        var mn = new RD.SceneNode();
        mn.name = "child" + i;
        mn.mesh = "sphere";
        mn.shader = "pbr";
        mn.position = [0,0,i*2];
        node.addChild( mn );

		mn._uniforms["u_alpha"] = 1.0;
		mn._uniforms["u_clearCoat"] = 0.0;
		mn._uniforms["u_clearCoatRoughness"] = 0.0;
		mn._uniforms["u_reflectance"] = vec3.fromValues(0.5,0.5,0.5);
		mn._uniforms["u_renderDiffuse"] = true;
		mn._uniforms["u_renderSpecular"] = true;
		mn._uniforms["u_albedo"] = vec3.fromValues(1, 1, 1);
		mn._uniforms["u_tintColor"] = vec3.fromValues(1,1,1);

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

    if(this._gui._sidepanel)
        this._gui.updateSidePanel(null, "root");
}

/**
* set uniform to core renderer
* @method setUniform
*/
Core.prototype.setUniform = function(name, value)
{
    if(!this._renderer)
        throw('no renderer');

	if( name.constructor === String && value !== undefined){
		
		if(!name.includes("u_"))
			name = "u_" + name;
		this._renderer._uniforms[name] = value;
	}
    else if( name.constructor === Object )
		Object.assign( this._renderer._uniforms, name); // name is an object with all uniforms
}

/**
* Add light to the scene
* @method addLight
*/
Core.prototype.addLight = function( o )
{
	var o = o || {};
    var LightComponent = RM.get('Light');
    
    if(!LightComponent || LightComponent.node) {
        LiteGUI.alert("Error (Only one light supported, No light component)");
        return;
    }

    var light = new RD.SceneNode();
    light.mesh = "sphere";
    light.name = "light";
    light.position = o.position || [0, this._controller._camera.position[1]/2 + this.selected_radius, this.selected_radius ];
    light.visible = true;
    light.color = o.color || [1, 1, 1, 1];
    light.scaling = 0.05;
    this._root.addChild(light);

    LightComponent.node = light;
	LightComponent.position = light.position;
	LightComponent.color = o.color || RD.WHITE;
	LightComponent.intensity = o.intensity || 1;

    this.updateNodes();

    if(this._gui._sidepanel)
        this._gui.updateSidePanel(null, "light");
}

/**
* Add mesh to the scene
* @method addMesh
* @param {Mesh} mesh
*/
Core.prototype.addMesh = function(mesh, resource)
{
     var shader = shader || ( (this._environment == "no current") ? "textured" : "pbr");
    var mesh_name = resource+'-'+simple_guidGenerator();
    gl.meshes[mesh_name] = mesh;
    
    var d = this.controller._camera.target,
        node = new RD.SceneNode({
            mesh: mesh_name,
            shader: shader
        });

    node.name = "node-" + simple_guidGenerator();
    node._uniforms["u_roughness"] = 0.0;
    node._uniforms["u_metalness"] = 0.0;
	node._uniforms["u_alpha"] = 1.0;
	node._uniforms["u_reflectance"] = vec3.fromValues(0.5,0.5,0.5);
	node._uniforms["u_tintColor"] = vec3.fromValues(1,1,1);
	node._uniforms["u_clearCoat"] = 0.0;
	node._uniforms["u_clearCoatRoughness"] = 0.0;
	node._uniforms["u_renderDiffuse"] = true;
	node._uniforms["u_renderSpecular"] = true;

    var bb = mesh.getBoundingBox();
    var center = BBox.getCenter(bb);
    this.selected_radius = radius = BBox.getRadius(bb);

    var globalMat = node.getGlobalMatrix();
    var result = vec3.create();
    vec3.transformMat4( result, center, globalMat );

    this.controller._camera.lookAt([ 0, radius * 0.5, radius * 3 ], result, RD.UP);
    this._root.addChild( node );
    this.updateNodes();

    if(this._gui._sidepanel)
        this._gui.updateSidePanel(null, node.name);
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

	node.blend_mode = RD.BLEND_ALPHA;

    var bb = gl.meshes[node.mesh].getBoundingBox();
    var center = BBox.getCenter(bb);
    var radius = BBox.getRadius(bb);

    var globalMat = node.getGlobalMatrix();
    var result = vec3.create();
    vec3.transformMat4( result, center, globalMat );

    this.controller._camera.lookAt([ 0, radius * 0.5, radius * 2.5 ], result, RD.UP);

    node.name = show_prem ? 'show_prem' : "node-" + simple_guidGenerator();

    if(!show_prem) {
        node._uniforms["u_roughness"] = 0.0;
        node._uniforms["u_metalness"] = 0.0;
		node._uniforms["u_alpha"] = 1.0;
		node._uniforms["u_clearCoat"] = 0.0;
		node._uniforms["u_clearCoatRoughness"] = 0.0;
		node._uniforms["u_reflectance"] = vec3.fromValues(0.5,0.5,0.5);
		node._uniforms["u_renderDiffuse"] = true;
		node._uniforms["u_renderSpecular"] = true;
		node._uniforms["u_albedo"] = vec3.fromValues(1, 1, 1);
		node._uniforms["u_tintColor"] = vec3.fromValues(1,1,1);
        node.setTextureProperties();
    }
    
    if(mesh == "plane") 
        node.flags.two_sided = true;
    
    this._root.addChild( node );
    this.updateNodes();


    if(this._gui._sidepanel)
        this._gui.updateSidePanel(null, node.name);

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
    var camera = this.controller._camera;

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
			camera: JSON.stringify( this.controller._camera ),
            m_speed: this.controller._mouse_speed,
            w_speed: this.controller._wheel_speed,
        },
        uniforms: this._renderer._uniforms,
        components: componentInfo,
        nodes: []
    }

    // export cubemap without textures
    var cubemap = this._root.children[0].clone();
    cubemap.textures = {}; // remove texture to avoid errors at import
    boo['nodes'].push( JSON.stringify(cubemap) );

    // skip cubemap
    for(var i = 1; i < this._root.children.length; i++) {
		var node = this._root.children[i]; 

		if(node.name == "light")
			continue;

        var tmp = node.clone(); // color and other
		Object.assign( tmp, node.serialize() ); // pos, rot, scale
        Object.assign( tmp.uniforms, node.uniforms ); // unforms
        boo['nodes'].push( JSON.stringify(tmp) );
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
    var gui = this._gui;
	var that = this;
	gui.loading();
    var o = o || {};
    
	this.reset();
	this.configure(o);
    
	// special cases
	if(o.uniforms )
	    this._renderer.setGlobalUniforms( o.uniforms );

	// set controller
	if(o.controller) {
		this.controller._mouse_speed = o.controller.m_speed;
		this.controller._wheel_speed = o.controller.w_speed;

		var camera_props = JSON.parse( o.controller.camera );

		this.controller.configure( {
			eye: camera_props._position,
			target: camera_props._target,
			up: camera_props._up,
			near: camera_props.near,
			far: camera_props.far,
			fov: camera_props.fov
		});
	}
    
	var components = o.components;

	if(components) {
		
		for( var key in components ) 
		{
			switch(key) {
				case 'Light':
					continue;
			}

			var copy = components[key];
			var component = RM.get( key );

			if(!component) {
				RM.registerComponent(this.table_components[key], key);
				component = RM.get( key );
			}

			//copy to attributes
			for(var i in copy)
			{
				var v = component[i];
				if(v === undefined)
					continue;

				if( v && v.constructor === Float32Array )
					v.set( copy[i] );
				else 
					component[i] = copy[i];
			}
		}

		// set light
	    if(components['Light'] && components['Light'].intensity != 0)// && components['Light'].node)
		    this.addLight( components['Light'] );
	}

	// set scene
	if ( o._environment_set )
		this.set( o._environment_set, {onImport: onLoadEnvironment } );

	function onLoadEnvironment() {
		
		// no load nodes
		if(only_settings)
		{
			that._gui.updateSidePanel(null, 'root');
			return;
		}
		  // load nodes info
		for(var i in o.nodes)    
		{
			var node_properties = JSON.parse(o.nodes[i]);
			
			switch(node_properties.name)
			{
				case 'lines':
				case 'light':
					continue;
				case 'cubemap':
					that.cubemap.flags = node_properties.flags;
					that.cubemap.shader = node_properties.shader;
					break;
				case 'matrix_node':
					that.createMatrix( true );
					break;
				default:
					// create node and apply properties
					var new_node = new RD.SceneNode();
					new_node.name = "tmp";
					new_node.configure(node_properties);
					new_node.setTextureProperties();
					that._root.addChild(new_node);
					break;
			}
		}
			
		gui.updateSidePanel(null, 'root');
		resize();
		
	}
	
}

/////// ****** ////// ******* /////// ******* /////// ******* ///// 

Object.defineProperty(RD.SceneNode.prototype, 'isEmissive', {
    get: function() { return this._isEmissive; },
    set: function(v) { this._isEmissive = v; this._uniforms["u_isEmissive"] = v; },
    enumerable: true //avoid problems
});

Object.defineProperty(RD.SceneNode.prototype, 'hasAlpha', {
    get: function() { return this._hasAlpha; },
    set: function(v) { this._hasAlpha = v; this._uniforms["u_hasAlpha"] = v; },
    enumerable: true 
});

Object.defineProperty(RD.SceneNode.prototype, 'hasAO', {
    get: function() { return this._hasAO; },
    set: function(v) { this._hasAO = v; this._uniforms["u_hasAO"] = v; },
    enumerable: true 
});

Object.defineProperty(RD.SceneNode.prototype, 'hasBump', {
    get: function() { return this._hasBump; },
    set: function(v) { this._hasBump = v; this._uniforms["u_hasBump"] = v; },
    enumerable: true 
});

Object.defineProperty(RD.SceneNode.prototype, 'hasNormal', {
    get: function() { return this._hasNormal; },
    set: function(v) { this._hasNormal = v; this._uniforms["u_hasNormal"] = v; },
    enumerable: true
});

RD.SceneNode.prototype.setTextureProperties = function()
{
    var values = ['albedo', 'roughness', 'metalness', 'normal'];

    for( v in values )
    {
        var value = values[v];
        var macro = 'HAS_'+value.toUpperCase()+'_MAP';
        if(this.textures[ value ]) RM.shader_macros[ macro ] = true;
        else delete RM.shader_macros[ macro ];
    }

    // Uncommon properties

    this.isEmissive = this.textures['emissive'] ? true : false; 
    this.hasAlpha = this.textures['opacity'] ? true : false;
    this.hasAO = this.textures['ao'] ? true : false; 
    this.hasBump = this.textures['height'] ? true : false; 
    // this.hasNormal = this.textures['normal'] ? true : false; 

    if(CORE)
    CORE.reloadShaders();
}