//
// wShade.js 

//main namespace
(function(global){

    /**
     * Main namespace
     * @namespace WS
     */
    
    /**
     * the global namespace, access it using WS.
     * @class .
     */
    
    var WS = global.WS = {
        version: 1.0,

			FORWARD:	00,
			DEFERRED:	01,
    };

    WS.setup = function(o)
    {
        o = o || {};
        if(WS.configuration)
            throw("setup already called");
        WS.configuration = o;
    }

    // Add properties to Rendeer

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
            if(this.textures[ value ]) default_shader_macros[ macro ] = true;
            else delete default_shader_macros[ macro ];
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

    /**
    * Responsible of configuring scene, 3d nodes and its properties  
    * @class Core
    * @constructor
    */
    function Core( o )
    {
        if(this.constructor !== WS.Core)
            throw("Use new to create WS.Core");

		this.browser = this.browser();

		
		this.setup();
        this._ctor();
        if(o)
            this.configure( o );
    }
    
    WS.Core = Core;
    
    Core.prototype._ctor = function()
    {
        this._uid = guidGenerator();
        this._descriptor = "";
		this._errors = {};
        
        this._uniforms = {};
        this._environment = "no current";
        this._last_environment = "no last";
        this._blur_samples = default_shader_macros['N_SAMPLES'];
        this._no_repeat = false;
        this.selected_radius = 1; // for wheel speed
        
        this._scene = new RD.Scene();
        this._root = this._scene.root;

        light = null;

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
            // alpha: true, premultipliedAlpha: false
        });

        this._renderer = new RD.Renderer( this._context, {
            autoload_assets: true
        });

        var w = (gl.canvas.width)|0;
        var h = (gl.canvas.height)|0;
        var type = gl.FLOAT;
        
        this._viewport_tex = new GL.Texture(w,h, { texture_type: GL.TEXTURE_2D, type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
		this._fx_tex = new GL.Texture(w,h, { texture_type: GL.TEXTURE_2D, type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
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
        this.fbo = new GL.FBO( this.fbo_textures, this.texture_depth );

		this.show_deferred_textures = false;
		
        this._controller = new WS.Controller( this._context );
        this._gui = new WS.GUI();

        // list of objects (uniforms and all that the tonemapper needs)
        this._tonemappers = {};
        this._components = {};
    }

	Core.prototype.setup = function()
	{
		var that = this;

		// Init Canvas tools (which are not in component)
		var button = $(document.querySelector(".tool-sphereprem"));
		button.on('click', function(){

			if(window.prem_sphere) {
				window.prem_sphere.destroy(true);
				this._gui.updateSidePanel(null, 'root');
				window.prem_sphere = undefined;
				$(this).removeClass("enabled");
				return;
			}
			window.prem_sphere = that.addPrimitive('sphere', 'mirror', true);
			$(this).addClass("enabled");
		});

		button = $(document.querySelector(".tool-deferredtex"));
		button.on('click', function(){

			that.show_deferred_textures = !that.show_deferred_textures;
			
			if(that.show_deferred_textures)
				$(this).addClass("enabled");
			else 
				$(this).removeClass("enabled");
		});
	}

	// Get component
    Core.prototype.get = function( component_name )
    {
		var c = this._components[component_name];
		if(!c) throw('no component called ' + component_name);
        return c;
    }

    Core.prototype.getCanvas = function ()
    {
        return this._renderer.canvas;
    }

    Core.prototype.registerTonemapper = function( base_class, name )
    {
        // Control that param has necessary items
        if(!base_class || !base_class.constructor)
        throw('tonemapper class needed');

        //extend class
		if(base_class.prototype) //is a class
            for(var i in Tonemapper.prototype)
                if(!base_class.prototype[i])
                    base_class.prototype[i] = Tonemapper.prototype[i];

        var instance = new base_class();
        var fs_code = instance.injectCode( base_class );
		var name = name || base_class.name;

		instance.shader = new GL.Shader( Shader.SCREEN_VERTEX_SHADER, fs_code );
        //gl.shaders[name] = new GL.Shader( Shader.SCREEN_VERTEX_SHADER, fs_code );
        
        this._tonemappers[name] = instance;
    } 

	Core.prototype.registerComponent = function( base_class, name )
    {
        // Control that param has necessary items
        if(!base_class || !base_class.constructor)
        throw('component class needed');

        var instance = new base_class();

		if(instance.setup)
		instance.setup();

		var name = name || base_class.name;
        this._components[name] = instance;
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
                case "somecase": //special case
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
        set: function(v) { this._blur_samples = v; default_shader_macros['N_SAMPLES'] = v; },
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

		var mode = this.get('Render').render_mode;

		// Update cubemap position
        this.cubemap.position = this.controller.getCameraPosition();

		if( mode == WS.FORWARD )
			this.forwardRender();
		else if( mode == WS.DEFERRED )
			this.deferredRender();

        // Render GUI
        this._gui.render();
        
        // Render node selected
		this.get('NodePicker').render();
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
		var SFXComponent = this.get("ScreenFX");

		if( SFXComponent.glow_enable )
			render_texture = createGlow( this._viewport_tex );

		// Get tonemapper and apply ********************
		// (exposure, offset, tonemapping, degamma)
		var myToneMapper = this._tonemappers[ SFXComponent.tonemapping ];
		myToneMapper.apply( render_texture, this._fx_tex ); 

		// Apply antialiasing (FXAA)
		if( SFXComponent.fxaa )
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

		if(!gl.shaders['finalDeferred'])
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

		
		var inv_p = mat4.create(),
			inv_v = mat4.create(),
			camera = this.controller._camera;

		mat4.invert(inv_p, camera._projection_matrix);
		mat4.invert(inv_v, camera._view_matrix);

		this.setUniform('invv', inv_v);
		this.setUniform('invp', inv_p);
		this.setUniform('projection', camera._projection_matrix);
		this.setUniform('view', camera._view_matrix);

		this.texture_final.drawTo( () => {
			
			renderer.clear( this._background_color );
			gl.disable( gl.DEPTH_TEST );
			gl.disable( gl.BLEND );
			
			gl.shaders['finalDeferred'].uniforms(renderer._uniforms).draw(Mesh.getScreenQuad());
		});

		// Apply (or not) bloom effect
        var render_texture = this.texture_final; 
		var SFXComponent = this.get("ScreenFX");

		if( SFXComponent.glow_enable )
			render_texture = createGlow( this.texture_albedo );

		// Get tonemapper and apply ********************
		// (exposure, offset, tonemapping, degamma)
		var myToneMapper = this._tonemappers[ SFXComponent.tonemapping ];
		myToneMapper.apply( render_texture, this._fx_tex ); 

		// Apply antialiasing (FXAA)
		if( SFXComponent.fxaa )
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
            return;
        }

        this._last_environment = this._environment;
        this._environment = tex_name;
		this._environment_set = env_set;
                
        var that = this;
        var oncomplete = function() { that.display( options.no_free_memory ); if(options.onImport) options.onImport(); };
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
        
		// gui
        this._gui.loading(0);
        console.log("%c" + this._environment, 'font-weight: bold;');
    }
    
    /**
    * Parse scenes data (or JSON)
    * @method parse
    * @param {string} name
    */
    Core.prototype.parse = function(name)
    {
        var toParse = scenes[name];

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
                this.renderMatrix( true ); break;
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
        var meshes = [].concat(toParse.mesh);

        for(var i = 0; i < meshes.length; i++)
        {
            var resource = meshes[i];

            var node = new RD.SceneNode();
            node.mesh = resource;
            node.shader = (this._environment == "no current") ? "phong" : toParse.shader;
            node.name = "node-" + simple_guidGenerator();
            node.render_priority = RD.PRIORITY_ALPHA;
            node.blend_mode = RD.BLEND_ALPHA;
            that._root.addChild( node );

            if( toParse.uniforms )
                node._uniforms = toParse.uniforms;
            
            if(toParse.shader != "pbr")
                continue;

            // for multimesh nodes
            toParse.textures = [].concat(toParse.textures);

            // load zero-metalness texture to avoid strange artifacts (can be sub later)
            node.textures["metalness"] = "data/zero-metal.png";
            
            // load textures
            for(var t in toParse.textures[i])
                node.textures[t] = toParse.textures[i][t];

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
		default_shader_macros['EM_SIZE'] = size;
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
        Object.assign(default_shader_macros, macros);
        
        return new Promise( function(resolve) {
            that._renderer.loadShaders("data/shaders.glsl", function() {
                
                console.log("Shaders reloaded!", default_shader_macros);
                if(callback)
                    callback();
                resolve();

            }, default_shader_macros);
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
    * @method renderMatrix
    * @param {bool} visible
    */
    Core.prototype.renderMatrix = function(visible)
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
            mn.position = [j * 2.5, 0, i * 2.5];
            mn._uniforms["u_roughness"] = values[i];
            mn._uniforms["u_metalness"] = values[j];
            node.addChild(mn);
        }

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
    Core.prototype.addLight = function()
    {
        var LightComponent = CORE.get('Light');
		
		if(light || !LightComponent ) {
            LiteGUI.alert("Error (Only one light supported, No light component)");
            return;
        }

        light = new RD.SceneNode();
        light.mesh = "sphere";
        light.name = "light";
        light.position = LightComponent.position = [0, this._controller._camera.position[1]/2 + this.selected_radius, this.selected_radius ];
        light.visible = true;
        light.color = [1, 1, 1, 1];
        light.scaling = 0.05;
        this._root.addChild(light);
        this._light = light;

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
        var shader = (this._environment == "no current") ? "phong" : "pbr";
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
        var shader = shader || ( (this._environment == "no current") ? "phong" : "pbr");
        
        var node = new RD.SceneNode({
                mesh: mesh,
                shader: shader
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
		    node._uniforms["u_metalness"] = 1.0;

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
            position: node.position,
            mesh: node.mesh,
            shader: node.shader,

            color: node.color,
            textures: node.textures,
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

        var boo = {
            uid: this._uid,
            e: this._environment, 
            blur_samples: this._blur_samples,
            selected_radius: 1,
            background: this._background_color,
            controller: {
                eye: camera.position,
                target: camera.target,
                far: this.controller._far,
                near: this.controller._near,
                m_speed: this.controller._mouse_speed,
                w_speed: this.controller._wheel_speed,
            },
            descriptor: this._descriptor,
            uniforms: this._renderer._uniforms,
            components: {'ScreenFX': this.get('ScreenFX'), 'Light': this.get('Light')},
            hasLight: (light) ? true : false,
            nodes: []
        }

        // export cubemap without textures
        var cubemap = this._root.children[0].clone();
        cubemap.textures = {};
        boo['nodes'].push( JSON.stringify(cubemap) );

        // skip cubemap
        for(var i = 0; i < this._root.children.length; i++) {
            // boo['nodes'].push( this.getProperties(this._root.children[i]) );
            var tmp = this._root.children[i].clone();
			tmp.uniforms = this._root.children[i].uniforms;
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
        var o = o || {};

        gui.loading();
        
        this._uid = o.uid;
        this._background_color = o.background;
        this._blur_samples = o.blur_samples;
        this._descriptor = o.descriptor;
        this.selected_radius = o.selected_radius;
        this._renderer.setGlobalUniforms( o.uniforms );

        this.controller._mouse_speed = o.controller.m_speed;
        this.controller._wheel_speed = o.controller.w_speed;

        this.controller.configure({
            eye: o.controller.eye,
            target: o.controller.target,
            near: o.controller.near,
            far: o.controller.far,
            aspect: gl.canvas.width/gl.canvas.height
        });

        // // add scene nodes
        if(o.hasLight && !light)
            this.addLight();

        // configure settings
        for(var key in o.components)
        {
            var copy = o.components[key];
			var component = this.get( key );

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

        if(only_settings)
        {
            gui.updateSidePanel(null, 'root');
            return;
        }
        
            
        for(var i in o.nodes)    
        {
            var node_properties = JSON.parse(o.nodes[i]);
			console.log(node_properties );
            
            switch(node_properties.name)
            {
                case 'lines':
                case 'light':
                    continue;
                case 'cubemap':
                    this.cubemap.flags = node_properties.flags;
                    break;
                case 'matrix_node':
                    this.renderMatrix( true );
                    break;
                default:
                    // create node and apply properties
                    var new_node = new RD.SceneNode();
                    new_node.name = "tmp";
                    new_node.configure(node_properties);
                    new_node.setTextureProperties();
					//new_node.uniforms = node_properties.uniforms;
                    this._root.addChild(new_node);
                    break;
            }
        }

        // set scene
        this.set( textures_folder + o.e );
        gui.updateSidePanel(null, 'root');
    }
    
    /**
    * Responsible of the GUI
    * @class GUI
    * @constructor
    */
    function GUI()
    {
        if(this.constructor !== WS.GUI)
            throw("Use new to create WS.GUI");
        
        this._ctor();
    }
    
    WS.GUI = GUI;
    
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

        var mainmenu = new LiteGUI.Menubar("mainmenubar");
        LiteGUI.add( mainmenu );

        this._mainarea = new LiteGUI.Area({id: "mainarea", content_id:"canvasarea", height: "calc( 100% - 26px )", main:true});
        LiteGUI.add( this._mainarea );

		var that = this;

        var canvas = renderer.canvas;
        this._mainarea.onresize = function() {
            var w = that._mainarea.root.clientWidth - that._sidepanel.root.clientWidth - 3;
            var h = that._mainarea.root.clientHeight;
            resize(renderer, [w, h], camera);
        };
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
        canvas.style.borderBottom = "2px solid  rgb(30, 211, 111)";
        
        this._canvas2d = canvas;

        //split mainarea
        this.createSidePanel();

        var that = this;

        mainmenu.add("File/Save scene", { callback: function() { that.onExport() } });
        mainmenu.add("File/Load scene/From file", { callback: function() { that.onImport() } });
		mainmenu.add("File/Load scene/From server", { callback: function() { 
			$.get("saved_scenes.php", function(data){ that.onImportFromServer(data)  });
		} });

		mainmenu.add("File/Preferences/Allow drop", { type: "checkbox", instance: this, property: "_allow_drop"});

		for(let s in scenes)
			mainmenu.add("Scene/Shade Model/"+scenes[s].name, { callback: function() {
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
				node.texture = "ssao_noise";
			}});

        mainmenu.add("View/FPS counter", { type: "checkbox", instance: this, property: "_fps_enable", callback: function() { 
            if(!that._fps_enable) that.closeFPS();
            else that._canvas2d.style.display = "block";
        }});
		mainmenu.add("View/Color picker", { type: "checkbox", instance: this, property: "_color_picker", callback: function() { 
            if(!that._color_picker) document.querySelector(".pixelPicker").style.display = 'none';
            else document.querySelector(".pixelPicker").style.display = 'block';
        }});
        mainmenu.add("View/Log", { type: "checkbox", instance: this, property: "_enable_log", callback: function(){ 
            if(that._enable_log) $("#log").show();
            else $("#log").hide();
        }});
        mainmenu.add("View/Fullscreen", { callback: function() { gl.fullscreen() } });

        mainmenu.add("Actions/Reset scene", { callback: function() { 
            CORE.reset();
            that.updateSidePanel(that._sidepanel, 'root');
        }});
        
        mainmenu.add("Actions/Reload shaders", { callback: function() { CORE.reloadShaders() } });
        mainmenu.add("Actions/Get Environment/HDRE (8 bits)", { callback: function() { HDRTool.getSkybox( CORE._environment, GL.UNSIGNED_BYTE ) } });
		mainmenu.add("Actions/Get Environment/HDRE (32 bits)", { callback: function() { HDRTool.getSkybox( CORE._environment, GL.FLOAT ) } });
        mainmenu.add("Actions/Get Mesh (wBin)", { callback: function() {
            var node = CORE.get('NodePicker').selected;

            if(!node)
            return;

            var mesh = gl.meshes[ node.mesh ];
            downloadBinary( mesh, "wbin" );
        } });

        mainmenu.add("Help/Version", { callback: function() { LiteGUI.showMessage("wShade v" + WS.version, {title: "App Info"}) } });
        mainmenu.add("Help/Github page", { callback: function() { LiteGUI.showMessage("<a href='https://github.com/jxarco'>@jxarco</a>", {title: "App Info"}) } });
		mainmenu.add("Help/Other demos", { callback: function() { LiteGUI.showMessage("<a href='https://webglstudio.org/users/arodriguez/demos/atmos'>Atmospherical scattering</a><br>"+
		"<a href='https://webglstudio.org/latest/player.html?url=fileserver%2Ffiles%2Farodriguez%2Fprojects%2FHDR4EU%2Fgreen.scene.json'>Chroma Keying</a><br>", {title: "App Info"}) } });
        
        var w = this._mainarea.root.clientWidth - this._sidepanel.root.clientWidth - 4;
        var h = this._mainarea.root.clientHeight;
        resize(renderer, [w, h], camera);
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
		var SFXComponent = CORE.get('ScreenFX');
		var RenderComponent = CORE.get('Render');

        if(item_selected == 'root')
        {
			var current_env = CORE._environment_set || {};

            widgets.addSection("Skybox");
            widgets.addList("Environment", textures, {selected: current_env, height: "125px", callback: function(v){
                gui.loading();
				CORE.set( v);
            }});
            widgets.widgets_per_row = 1;
            widgets.addSeparator();
            widgets.addTitle("Properties");
            widgets.addNumber("Rotation", renderer._uniforms["u_rotation"], {min:-720*DEG2RAD,max:720*DEG2RAD,step:0.05, callback: function(v){ CORE.setUniform("rotation",v);}});
            widgets.addCheckbox("Visible", skybox.flags.visible, {callback: function(v) { skybox.visible = v}});
            widgets.addSeparator();
            widgets.addTitle("Atmospheric scattering");
            widgets.widgets_per_row = 2;
            widgets.addButton(null, "Apply",{width: "85%", name_width: "40%", callback: function(v) {

                if(!gl.shaders['atmos']) LiteGUI.showMessage("Error: shader missing", {title: "App info"});
                else
                {
					var old_shader = CORE.cubemap.shader;
                    CORE.cubemap.shader = "atmos";
                    CORE.cubemapToTexture( function() { CORE.set(":atmos", {no_free_memory: true}) });
					CORE.cubemap.shader = old_shader;
                }
            }});
            widgets.addButton(null, '<i style="font-size: 16px;" class="material-icons">refresh</i>', {width: "15%", callback: function(){
               
                if(!gl.shaders['atmos']) LiteGUI.showMessage("Error: shader missing", {title: "App info"});
                else CORE.cubemapToTexture( function() { CORE.set(":atmos", {no_free_memory: true}) });
            }});
            widgets.addSeparator();
            widgets.addNumber("Sun Position", renderer._uniforms['u_SunPos'], {min: 0,step:0.01, callback: function(v){ CORE.setUniform('SunPos', v); }});
            widgets.addNumber("Mie Direction", renderer._uniforms['u_MieDirection'], {min:0, max:1,step:0.01,callback: function(v){ CORE.setUniform('MieDirection', v); }});
            widgets.addNumber("Sun Intensity", renderer._uniforms['u_SunIntensity'], {min:0, max:50,step:0.05,callback: function(v){ CORE.setUniform('SunIntensity', v); }});
            widgets.addNumber("Mie Coefficient", renderer._uniforms['u_MieCoeff'], {min:0, max:50,step:0.05,callback: function(v){ CORE.setUniform('MieCoeff', v); }});
            widgets.widgets_per_row = 1;
            widgets.addNumber("Origin Offset", renderer._uniforms['u_originOffset'], {step: 50, min: 0,max: 7000, callback: function(v){ CORE.setUniform('originOffset', v); }});

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
			RenderComponent.create( widgets, root );

			// Screen FX Component
			SFXComponent.create( widgets, root );

        }
        else if(item_selected == 'light')
        {
			var LightComponent = CORE.get('Light');
			LightComponent.create( widgets );
        }
        
        else if(item_selected.includes("scale") || item_selected.includes("matrix"))
        {
            var node = CORE.getByName(item_selected);
            widgets.addSection("Transform");
            widgets.addVector3("Position", node.position, {callback: function(v){ node.position = v; }});
            widgets.addNumber("Uniform scale", node.scaling[0], {min: 0.1, callback: function(v){ node.scaling = v; }});
            widgets.widgets_per_row = 3;
            widgets.addButton(null, "Reset", {callback: function(v){
                node.scaling = 1; 
                node.position = [0, 0, 0];
                that.updateSidePanel(that._sidepanel, item_selected);
            }});
            widgets.widgets_per_row = 1;
            widgets.addSection("Properties");
            widgets.addColor("Base color", renderer._uniforms["u_albedo"], {callback: function(color){ CORE.setUniform('albedo', color); }});
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
			widgets.addList(null, ["flat", "phong", "textured_phong", "pbr", "DeferredPBR"], {selected: node.shader,callback: function(v){ node.shader = v; }})
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
        inspector.addTitle("PBR properties");
        inspector.addColor("Base color", node._uniforms["u_albedo"], {callback: function(color){ node._uniforms["u_albedo"] = node._uniforms["u_color"] = color; }});
        inspector.addSlider("Roughness", node._uniforms['u_roughness'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_roughness'] = v }});
        inspector.addSlider("Metalness", node._uniforms['u_metalness'],{min:0,max:1,step:0.01,callback: function(v){ node._uniforms['u_metalness'] = v }});
        
        inspector.addTitle("Textures")
        inspector.addNumber("Bump scale", node._uniforms['u_bumpScale'],{name_width: "50%", min:0,max:5,step:0.01, callback: function(v){ node._uniforms['u_bumpScale'] = v }});
        inspector.addNumber("Emissive scale", node._uniforms['u_emissiveScale'],{name_width: "50%", min:0,max:100,step:0.05, callback: function(v){ node._uniforms['u_emissiveScale'] = v }});
        inspector.addSeparator();

        var that = this;

        const filtered = Object.keys(node.textures)
            .filter(function(key){ return !key.includes("env") && !key.includes("brdf") })
            .reduce(function(obj, key){
                obj[key] = node.textures[key];
                return obj;
            }, {});


        inspector.widgets_per_row = 2;

		// OJO CON ESTE
        for(var t in filtered) {
            inspector.addString( t, node.textures[t], {width: "85%"});
            inspector.addButton( null, '<i data-texture='+ t +' style="font-size: 16px;" class="material-icons">delete_forever</i>', {micro: true, width: "15%", callback: function(v) { 

				var t = $(v).data('texture');

                delete gl.textures[ node.textures[t] ]; 
                delete node.textures[t]; 
                node.setTextureProperties();              
                that.updateSidePanel(null, node.name);
			}});
        }
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
		LiteGUI.alert("Not available (updates on the way)");
        return;

        const isInServer = Object.keys(textures).filter(function(key){ return textures[key].path.includes( CORE._environment )}).length;

        // is not in server
        if(!isInServer) {
            LiteGUI.alert("Files not in server");
            return;
        }
        
		var boo = CORE.toJSON ? CORE.toJSON() : {};

        var inner = function(v) {
            var data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(boo));
            var element = document.createElement('a');
            element.href = 'data:' + data;
            element.download = v !== "" ? v+'.json' : 'noname-'+getDate()+'.json';
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
        var id = "Load scene from server"
        var dialog_id = id.replace(" ", "-").toLowerCase();
        var w = 400;
        var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
        dialog.show('fade');
        dialog.makeModal('fade');
        var widgets = new LiteGUI.Inspector();

		var saved_scenes = JSON.parse(data);
		var selected = null;

        widgets.on_refresh = function(){

            widgets.clear();
            widgets.addList( null, Object.keys(saved_scenes), {callback: function(v) {
                
                selected = v;
            } });

			widgets.addButton( null, "Load", {callback: function() {

				if(!selected)
					return;
				// gui
				$('#'+dialog_id).remove();
				LiteGUI.showModalBackground(false);
				//
                CORE.fromJSON( saved_scenes[selected].data );
            } });

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
			$("#modal").hide( function(){
			
				$(".pbar").css('width', "0%");
				$("#xhr-load").css('width', "0%");

				if(oncomplete)
					oncomplete();
			} );        
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
	
		var inner = function()
		{
			$("#"+dialog_id).remove();
        
			var reader = new FileReader();
			reader.onprogress = function(e){ $("#xhr-load").css("width", parseFloat( (e.loaded)/e.total * 100 ) + "%") };
			reader.onload = async function (event) {
				var data = event.target.result;
				params['data'] = data;
				params['oncomplete'] = function(){
					CORE.set( filename );
				};

				default_shader_macros['EM_SIZE'] = params["size"];
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
                
                var node = CORE.get('NodePicker').selected;

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
    * Responsible for camera movement and event bindings
    * @class Controller
    * @constructor
    */
    function Controller(context, o)
    {
        if(this.constructor !== WS.Controller)
            throw("Use new to create WS.Controller");
        this._ctor(context);
        if(o)
            this.configure(o);
    }
    
    WS.Controller = Controller;
    
    Controller.prototype._ctor = function( context )
    {
        this._fov = 45;
        this._near = 0.35;
        this._far = 10000;
        this._aspect = gl.canvas.width / gl.canvas.height;

        
        this._eye = [0, 5, 5];
        this._target = [0, 5, 0];
        this._up = [0, 1, 0];
        
        this._camera = new RD.Camera();
        this._camera.perspective( this._fov, this._aspect, this._near, this._far);
        this._camera.lookAt( this._eye, this._target, this._up );

        // events
        this._context = context;
        this._mouse_speed = 0.25;
        this._wheel_speed = 0.5;
        this.setBindings();
    }

    Controller.prototype.reset = function()
    {
        this._fov = 45;
        this._near = 0.35;
        this._far = 10000;
        this._aspect = gl.canvas.width / gl.canvas.height;
        
        this._eye = [0, 5, 5];
        this._target = [0, 5, 0];
        this._up = [0, 1, 0];
        
        this._camera.perspective( this._fov, this._aspect, this._near, this._far);
        this._camera.lookAt( this._eye, this._target, this._up );

        // events
        this._mouse_speed = 0.25;

        gui.updateSidePanel(null, 'root');
    }
    
    Controller.prototype.configure = function(o)
    {
        o = o || {};
        this._camera.perspective( o.fov || this._fov, o.aspect || this._aspect , o.near || this._near, o.far || this._far);
        this._camera.lookAt( o.eye || this._eye, o.target || this._target, o.up || this._up );
    }
    
    /**
    * Performs camera lookAt
    * @method lookAt
    * @param {vec3} eye
    * @param {vec3} center
    * @param {vec3} up
    */
    Controller.prototype.lookAt = function(eye, center, up)
    {
        this._camera.lookAt( eye, center, up );
    }

    /**
    * Returns controller's camera position
    * @method getCameraPosition
    */
    Controller.prototype.getCameraPosition = function()
    {
        return this._camera.position;
    }

    /**
    * Set key bindings
    * @method setBindings
    * @param {WebGLRenderingContext} ctx
    */
    Controller.prototype.setBindings = function()
    {
        var ctx = this._context;
        if(!ctx)
            throw('no WebGLRenderingContext');

        var camera = this._camera;
        var s = this._mouse_speed;

        ctx.captureKeys(true);
        ctx.onkeydown = function(e)
        {
            if(e.keyCode === 82) // R
                CORE.reloadShaders(); 
            if(e.keyCode === 46) // SUPR
            {
                CORE.get('NodePicker').delete();
                gui.updateSidePanel(null, "root");
            }
            if(e.keyCode === 8) // DELETE
            {
                CORE.get('NodePicker').delete();
				gui.updateSidePanel(null, "root");
            }
            if(e.keyCode === 27) // ESC
            {
                CORE.get('NodePicker').selected = null;
                delete gl.meshes['lines'];
                gui.updateSidePanel(null, "root");
            }
        }
        ctx.captureMouse(true);

        ctx.onmousemove = function(e)
        {
            var mouse = [e.canvasx, gl.canvas.height - e.canvasy];
            var x = parseInt(mouse[0]), y = parseInt(mouse[1]);


            if(!e.dragging) return;

            if (e.leftButton) {

				orbitCamera(camera, e.deltax * _dt * s, -e.deltay * _dt * s);
//                camera.orbit(-e.deltax * _dt * s, RD.UP);
  //              camera.orbit(-e.deltay * _dt * s, camera._right);
            }
            
            if (e.rightButton && ctx.keys["L"]) {
                camera.moveLocal([-e.deltax * s * 0.75 * _dt, e.deltay * _dt, 0]);
            }
        }

		ctx.captureTouch(true);


        ctx.onmousewheel = function(e)
        {
            if(!e.wheel)
                return;

			var w = this._wheel_speed / 10;

            var amount =  (1 + e.delta * -0.05);
            changeCameraDistance(amount, camera);
        }

        ctx.onmousedown = function(e){
        
			var colorpicker = CORE.get('ColorPicker');
			var pickerEnabled = colorpicker && colorpicker.enabled;

			if(e.leftButton && pickerEnabled)
			{
				colorpicker.getColor(e);
			}

            if(e.leftButton )
            {
                var result = vec3.create();
                var ray = camera.getRay( e.canvasx, e.canvasy );
                var node = CORE.scene.testRay( ray, result, undefined, 0x1, true );
                
                if(node) 
                {
                    CORE.get('NodePicker').select(node);
                    // parent is not the scene root
                    var name = node.name;
                    if(!name)
                        name = node.parentNode.name;
                    gui.updateSidePanel(null, name);
                }
            }

            if(e.rightButton && !ctx.keys["L"])
            {

                var shaded_models = [];

				// OJO CON ESTE
                for(var s in scenes)
                    shaded_models.push( {title: scenes[s].name, callback: function(v) {
						CORE.parse( v.title );
                        gui.updateSidePanel(null, v.title );
                    }});

                var actions = [
                {
                    title: "Shade model", //text to show
                    has_submenu: true,
                    submenu: {
                        options: shaded_models
                    }
                },
                {
                    title: "Add primitive", //text to show
                    has_submenu: true,
                    submenu: {
                        options: 
                        [{
                            title: "Sphere",
                            callback: function() { CORE.addPrimitive("sphere") }
                        },{
                            title: "Plane",
                            callback: function() { CORE.addPrimitive("plane") }
                        },{
                            title: "Cube",
                            callback: function() { CORE.addPrimitive("cube") }
                        }]
                    }
                    
                },
                {
                    title: "Add light", //text to show
                    callback: function() { CORE.addLight() }
                }
                ];
                var contextmenu = new LiteGUI.ContextMenu( actions, { event: e });
            }
        }
    }
    
    /**
    * Update key bindings
    * @method update
    * @param {number} dt
    * @param {WebGLRenderingContext} ctx
    */
    Controller.prototype.update = function(dt, ctx)
    {
        if(!ctx)
            throw('no WebGLRenderingContext');

		var camera = this._camera;
		if(window.destination_eye)
			vec3.lerp(camera.position, camera.position, window.destination_eye, 0.3);

        var w = this._wheel_speed * 25;
        var s = CORE.selected_radius ? CORE.selected_radius * w : w;

        if(ctx.keys["UP"] || ctx.keys["W"]){            this._camera.moveLocal([0,0,-dt * s]);}
        else if(ctx.keys["DOWN"] || ctx.keys["S"]){     this._camera.moveLocal([0,0,dt * s]);}

        if(ctx.keys["RIGHT"] || ctx.keys["D"]){         this._camera.moveLocal([dt * s,0,0]);}
        else if(ctx.keys["LEFT"] || ctx.keys["A"]){     this._camera.moveLocal([dt * -s,0,0]);}

        if(ctx.keys["SPACE"]){                              this._camera.moveLocal([0,dt * s,0]);}
        else if(ctx.keys["SHIFT"]){                         this._camera.moveLocal([0,dt * -s,0]);}
    }
    
    //footer
    
    })( typeof(window) != "undefined" ? window : (typeof(self) != "undefined" ? self : global ) );
    
    
    