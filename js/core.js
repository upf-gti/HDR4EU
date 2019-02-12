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

    // important nodes
    var cubemap = new RD.SceneNode();
    cubemap.name = "cubemap";
    cubemap.mesh = "cube";
    cubemap.shader = "skybox";
    cubemap.flags.depth_test = false;
    cubemap.flags.flip_normals = true;
    cubemap.render_priority = RD.PRIORITY_BACKGROUND;
    
    cubemap.ready = function() { 
        var ready = (this.textures['env'] && this.textures['env_1']
        && this.textures['env_2'] && this.textures['env_3']
        && this.textures['env_4'] && this.textures['env_5'] ) ? true : false;

        return ready;
    };

    this._cubemap = cubemap;
    
    this._root.addChild(cubemap);

    this._context = GL.create({width: window.innerWidth, height: window.innerHeight, 
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
    this._fx_tex = new GL.Texture(w,h, {type: gl.HALF_FLOAT_OES});
    this._background_color = vec4.fromValues(0.2, 0.2, 0.2,1);

    this.fxaa_shader = Shader.getFXAAShader();
    this.fxaa_shader.setup();

    // deferred rendering (G buffers)
    this.texture_albedo = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    this.texture_roughness = new GL.Texture(w,h, { type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    this.texture_normal = new GL.Texture(w,h, { type: type, filter: gl.LINEAR });
    this.texture_depth = new GL.Texture(w,h, { format: gl.DEPTH_COMPONENT, type: gl.UNSIGNED_INT}); 
    this.texture_final = new GL.Texture(w,h, { texture_type: gl.TEXTURE_2D, type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });

    this.fbo_textures = [ this.texture_albedo, this.texture_normal, this.texture_roughness ];
    this.fbo = null;

    if(!this.mobile()) { // mobile browser does not support FBO
        
        this.fbo = new GL.FBO( this.fbo_textures, this.texture_depth );
    }

    this.show_deferred_textures = false;
    
    this._controller = new Controller( this._context );
    this._gui = new GUI();
}

Core.prototype.setup = function()
{
    var that = this;
    
    var last = now = getTime();

    canvas = this.getCanvas();

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
    this.setUniform("near", camera.near);
    this.setUniform("far", camera.far);
    this.setUniform("rotation", 0.0);
    this.setUniform("exposure", 0.0);
    this.setUniform("offset", 0.0);
    this.setUniform("channel", 0.0);
    this.setUniform("enable_ao", true);
    this.setUniform("correctAlbedo", true);
	this.setUniform("EC", false);
    this.setUniform("ibl_intensity", 1.0);
    this.setUniform("albedo", vec3.fromValues( 1, 1, 1));
    
    // SSAO
    this.setUniform("radius", 16.0);
    this.setUniform("enableSSAO", true);
    this.setUniform("outputChannel", 0.0);

    // Atmospheric Scattering
    this.setUniform('SunPos', 0.4);
    this.setUniform('SunIntensity', 22.0);
    this.setUniform("MieDirection", 0.76);
    this.setUniform('originOffset', 0.0);
    this.setUniform('MieCoeff', 21);

    // set param macros
    RM.shader_macros[ 'INPUT_TEX_WIDTH' ] = gl.viewport_data[2];
    RM.shader_macros[ 'INPUT_TEX_HEIGHT' ] = gl.viewport_data[3];
    RM.shader_macros[ 'EM_SIZE' ] = 1; // no parsing at initialization

	for(var shader in RM.shaders) {
        /*if(shader === "pbr_deferred")
            continue;*/
        gl.shaders[shader] = new GL.Shader(RM.shaders[shader].vs_code, RM.shaders[shader].fs_code);
    }
	
    
    renderer.context.ondraw = function(){ that.render() };
    renderer.context.onupdate = function(dt){ that.update(dt) };

    renderer.context.animate();
    window.onresize = resize;

    // get response from files.php and init app
    LiteGUI.request({
        url:"php/files.php", 
        success: async function(data){ 
            // Save textures info for the GUI
			RM.textures = JSON.parse(data);
            
            await that.reloadShaders();
        
            // Environment BRDFs (LUT)
			HDRTool.brdf("brdfIntegrator");
			HDRTool.brdf("multibrdfIntegrator", 1);
            
            // Set environment 
            that.set( RM.textures['Pillars'] );
            
            // Init things
            ssao.init();
            gui.init(); 

			var url = "exports/";
			// query string params
			/*if( QueryString['scene'] ) {
				url += QueryString['scene'];
				LiteGUI.requestJSON( url, function(v){ CORE.fromJSON( v ); } );
			}*/
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
    if(!this.cubemap.ready())
    return;

    var RenderComponent = RM.get('Render');

    // Update cubemap position
    this.cubemap.position = this.controller.getCameraPosition();

    if( (RenderComponent && RenderComponent.render_mode == RM.FORWARD) || !this.fbo)
        this.forwardRender();
    else
        this.deferredRender();

    // Render GUI
    this._gui.render();
    
    // Render node selected
    var NodePickerComponent = RM.get('NodePicker');
    if(NodePickerComponent && NodePickerComponent.render)
        NodePickerComponent.render();
}

/**
* Render all the scene using forward rendering
* @method forwardRender
*/
Core.prototype.forwardRender = function()
{
    var renderer = this._renderer;
    var that = this;

    // Render scene to texture
    this._viewport_tex.drawTo( function() {
        renderer.clear( that._background_color );
        renderer.render( that.scene, that.controller._camera );
    });
    
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    // Fill renderer uniforms with average, max lum, etc.
    try
    {
        if (info_check())
        {
            perblock_getmax();
            downsampled_getaverage();
        }
    }
    catch (e)
    {
        if(!this._errors[e])
        this._errors[e] = 1;
    }

    // Apply (or not) bloom effect
    var render_texture = this._viewport_tex; 
    var SFXComponent = RM.get("ScreenFX");

    if( SFXComponent && SFXComponent.glow_enable )
        render_texture = createGlow( this._viewport_tex );

    // Get tonemapper and apply (exposure, offset, tonemapping, degamma)
    if(SFXComponent) {
        var myToneMapper = RM.tonemappers[ SFXComponent.tonemapping ];
        myToneMapper.apply( render_texture, this._fx_tex ); 
    }else{
        this._fx_tex = render_texture;
    }

    // Apply antialiasing (FXAA)
    if( SFXComponent && SFXComponent.fxaa )
        this._fx_tex.toViewport( this.fxaa_shader );
    else
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

    if(!gl.shaders['finalDeferred'] || !gl.shaders['ssao'])
        return;

    // PRE PASS: fill G buffers
    this.fbo.bind(true);
    
    gl.enable( gl.DEPTH_TEST );
    gl.disable( gl.BLEND );

    // render geometry and capture info
    renderer.clear( this._background_color );
    renderer.render( this.scene, this.controller._camera );

    this.fbo.unbind();
    gl.disable( gl.DEPTH_TEST );
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    // FINAL PASS

    this.texture_albedo.bind(0);
    this.texture_normal.bind(1);
    this.texture_roughness.bind(2);
    this.texture_depth.bind(3);
    ssao.noiseTexture.bind(4);
    
    this.setUniform('fbo_color_texture', 0);
    this.setUniform('fbo_normal_texture', 1);
    this.setUniform('fbo_roughness_texture', 2);
    this.setUniform('fbo_depth_texture', 3);
	this.setUniform('noise_texture', 4);
    
    var inv_p = mat4.create(),
        inv_v = mat4.create(),
        camera = this.controller._camera;

    mat4.invert(inv_p, camera._projection_matrix);
    mat4.invert(inv_v, camera._view_matrix);

    this.setUniform('invv', inv_v);
    this.setUniform('invp', inv_p);
    this.setUniform('projection', camera._projection_matrix);
    this.setUniform('view', camera._view_matrix);

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

	// TODO

	// draw SSAO to texture
	ssao.texture.drawTo( () => {
        
        gl.shaders['ssao'].uniforms(renderer._uniforms).draw(Mesh.getScreenQuad());
    });

	// blur SSAO texture
	for(var i = 0; i < 3; i++)
	{
		ssao.texture.applyBlur( i,i, 1, ssao.blurTexture );
	}

	// combine SSAO with rendered frame
	// rebind this bc something happens if not
	this.texture_albedo.bind(0); 
    this.texture_normal.bind(1);
    this.texture_roughness.bind(2);
    this.texture_depth.bind(3);
    ssao.noiseTexture.bind(4);
	ssao.blurTexture.bind(5);
	this.setUniform('noise_texture_blur', 5);

	this.texture_final.drawTo( () => {
        
        /*renderer.clear( this._background_color );
        gl.disable( gl.DEPTH_TEST );
        gl.disable( gl.BLEND );*/
        
        gl.shaders['finalDeferred'].uniforms(renderer._uniforms).draw(Mesh.getScreenQuad());
    });

	// .....

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

    // Apply antialiasing (FXAA)
    if( SFXComponent && SFXComponent.fxaa )
        this._fx_tex.toViewport( this.fxaa_shader );
    else
        this._fx_tex.toViewport();

    if(this.show_deferred_textures) {
        var w = gl.canvas.width / 4;
        var h = gl.canvas.height / 4;
        gl.drawTexture( this.texture_albedo, 0, gl.canvas.height - h, w,  h );
        gl.drawTexture( this.texture_roughness, w, gl.canvas.height - h, w,  h );
        gl.drawTexture( this.texture_normal, w*2, gl.canvas.height - h, w,  h );
        gl.drawTexture( this.texture_depth, w*3, gl.canvas.height - h, w,  h );
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
		that.display( options.no_free_memory ); 
		if(options.onImport)
			options.onImport();
	};
    var params = {oncomplete: oncomplete};

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
    this._cubemap.texture = this._environment;
    
    var that = this;
    // gui
    setTimeout(function(){
        that._gui.loading(0);
        $("#import-loader").hide();            
        console.log("%c" + that._environment, 'font-weight: bold;');
    }, 1000);
}

/**
* Parse scenes data (or JSON)
* @method parse
* @param {string} name
*/
Core.prototype.parse = function(name)
{
    var toParse = RM.scenes[name];

	var meshes = [].concat(toParse.mesh);
	for(var t in meshes)
    meshes[t] = RM.MODELS_FOLDER + meshes[t];
	toParse.mesh = meshes;

    // clean scene
    this.destroyByName('node');

    if(toParse.camera)
    {
        var eye = toParse.camera['eye'] || [0, 0, 5];
        var target = toParse.camera['target'] || [0, 0, 0];
        this.controller.lookAt(eye, target, RD.UP );
    }

    switch( name )
    {
        case "Matrix":
            this.createMatrix( true ); break;
        case "Roughness scale":
            this.renderSphereScale( true, { property: 'roughness', aux_prop: 1.0 } ); break;
        case "Metalness scale":
            this.renderSphereScale( true, { property: 'metalness', aux_prop: 0.5 } ); break;
        default:
            this.loadResources( toParse, name ); break;
    }
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
            node._uniforms = toParse.uniforms;
        
        // for multimesh nodes
        toParse.textures = [].concat(toParse.textures);

        // load zero-metalness texture to avoid strange artifacts (can be sub later)
        node.textures["metalness"] = "assets/zero-metal.png";
        
        // load textures
        for(var t in toParse.textures[i])
            node.textures[t] = RM.MODELS_FOLDER + toParse.textures[i][t];

        // is emissive? has AO? has Alpha?
        node.setTextureProperties();

        renderer.loadMesh(resource, function(res){

            if(!res) 
            throw( "No mesh loaded" );

            // update target from bb
            var bb = gl.meshes[resource].getBoundingBox();
            var center = BBox.getCenter(bb);
            that.selected_radius = BBox.getRadius(bb);

            var globalMat = node.getGlobalMatrix();
            var result = vec3.create();
            vec3.transformMat4( result, center, globalMat );

            if(toParse.camera && toParse.camera.target)
                result = toParse.camera.target;
            
            var eye = [0, that.selected_radius * 0.5, that.selected_radius * 2.5];

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

        if(!node.children.length)
            continue;

        for (var j = 0; j < node.children.length;  j++)
        {
            var child = node.children[j];

            child.textures['brdf'] = "_brdf_integrator";
            child.textures['env'] = this._environment;
            child.textures['env_1'] = "_prem_0_" + this._environment;
            child.textures['env_2'] = "_prem_1_" + this._environment;
            child.textures['env_3'] = "_prem_2_" + this._environment;
            child.textures['env_4'] = "_prem_3_" + this._environment;
            child.textures['env_5'] = "_prem_4_" + this._environment;
        }
    }
}

/**
* Reset scene
* @method reset
*/
Core.prototype.reset = function()
{
    this.destroyByName('node');
    this.controller.reset();
}

/**
* Render current cubemap to texture
* @method cubemapToTexture
* @param {Type} oncomplete
*/
Core.prototype.cubemapToTexture = async function(oncomplete)
{
    var that = this,
        d = this._renderer._camera.position;

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
            
            console.log("Shaders reloaded!", {macros: RM.shader_macros});

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
Core.prototype.destroyByName = function( o )
{
    var l, that = this;
    if(name.constructor == Array)
    {
        l = [].concat(o);

        for(var i = 0; i < this._root.children.length; i++)
            if(l.indexOf( this._root.children[i].name) >= 0)
                this._root.children[i].destroy(true);
    }
    // destroy all nodes which includes the argument as string
    else
    {
        for(var i = 0; i < this._root.children.length; i++)
            if(this._root.children[i].name.includes( o ))
                this._root.children[i].destroy(true);

        /*setTimeout( function(){
            that._gui.updateSidePanel(null, 'root');
        }, 10 );*/
    }
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
        node.addChild(mn);
    }

	var floor = new RD.SceneNode();
	floor.mesh = "planeXZ";
	floor.shader = "pbr";
	floor.position = [3 * 2.0, 0, 3 * 2.0];
	floor.scaling = 14;
	floor._uniforms["u_roughness"] = 1;
	floor._uniforms["u_metalness"] = 1;
    floor.flags.visible = visible;
    node.addChild(floor);

    this.updateNodes();
    this.selected_radius = 1;

    if(this._gui._sidepanel)
        this._gui.updateSidePanel(null, name);
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
        this._gui.updateSidePanel(null, name);
}

/**
* set uniform to core renderer
* @method setUniform
*/
Core.prototype.setUniform = function(name, value)
{
    if(!this._renderer)
        throw('no renderer');
    
    this._renderer._uniforms['u_' + name] = value;
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
    node._uniforms["u_roughness"] = 0.5;
    node._uniforms["u_metalness"] = 0.75;
	node._uniforms["u_reflectance"] = 0.5;

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
		node._uniforms["u_reflectance"] = 0.5;
		node._uniforms["u_clearCoat"] = 0.0;
		node._uniforms["u_clearCoatRoughness"] = 0.0;
		node._uniforms["u_albedo"] = vec3.fromValues(1, 1, 1);
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

	var components = {};
	for(var k in RM.components) {

		switch(k) {
			case 'NodePicker':
			case 'Light':
			case 'ColorPicker':
				continue;
		}

		components[k] = RM.components[k];
	}

	// get light info
	components['Light'] = {};
	for(var k in RM.components['Light']) {

		switch(k) {
			case 'node':
				continue;
		}

		components['Light'][k] = RM.components['Light'][k];
	}

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
        components: components,
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