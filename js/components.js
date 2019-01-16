
	/*
		List of components to use in the app
		global components or gui components
	*/

	function Tonemapper()
	{
		if(this.constructor !== Tonemapper)
			throw("Use new");

		this.uniforms = {};
	}

	Tonemapper.prototype.apply = function(input, output)
	{
		var shader = this.shader;

		if(!shader)
		throw('Shader missing');	

		if(!input)
		throw('Input texture missing');	

		// Join renderer uniforms with own uniforms
		var uniforms = Object.assign(renderer._uniforms, this.uniforms);

		output.drawTo(function(){
			input.bind(0);
			shader.toViewport( uniforms );
		});
	}

	Tonemapper.prototype.injectCode = function( base_class )
	{
		var fs_code = `

			precision highp float;
			varying vec2 v_coord;
			uniform float u_exposure;
			uniform float u_offset;
			uniform sampler2D u_color_texture;

			` + base_class.Uniforms + `

			float C_GAMMA = 2.2;

			void main() {

				vec3 color = texture2D(u_color_texture, v_coord).rgb;

				color *= pow( 2.0, u_exposure );
				color += vec3(u_offset);

				` + base_class.Code + `

				#ifdef GAMMA
					C_GAMMA = GAMMA;
				#endif

				color = pow(color, vec3(1.0/C_GAMMA));

				gl_FragColor = vec4(color, 1.0);
			}

		`;

		return fs_code;
	}

	Tonemapper.prototype.setParam = function ( name, value )
	{
		
		this.params[name].value = value;

	}

// *****************************************************************************
//				Tool components
// *****************************************************************************


	function NodePicker()
	{
		if(this.constructor !== NodePicker)
			throw("Use new");
		
		this.selected = null;
	}

	NodePicker.prototype.setup = function()
	{
		
	}

	NodePicker.prototype.select = function(node)
	{
		if(node.constructor !== RD.SceneNode)
		throw("bad param");

		this.selected = node;
	}

	NodePicker.prototype.delete = function()
	{
		if(!this.selected)
			return;

		if(this.selected.name === 'light') {
			WS.Components.LIGHT.color = [0, 0, 0];
			light = null;
		}

		this.selected.destroy();
		this.selected = null;
		delete gl.meshes['lines'];

		for(var t in gl.textures)
			if(t.includes( this._last_environment ))
				delete gl.textures[t];

		setTimeout( function(){
		
			gui.updateSidePanel(null, "root");
		}, 10 );
	}

	NodePicker.prototype.render = function()
	{
		var node = this.selected;
		var root = CORE._root;

		if(!node)
		return;

		var bb = gl.meshes[node.mesh].bounding,
			globalMat = node.getGlobalMatrix();
			
		// Get points
		var corners = getBBCorners(bb);

		// Transform points
		for(var i = 0; i < corners.length; i++)
		{
			var res = vec3.create(),
				p = corners[i];

			vec3.transformMat4( res, p, globalMat );
			corners[i] = res;
		}

		// Create list for mesh
		var points = [];
		points.push(

				corners[0], corners[1],
				corners[1], corners[3],
				corners[3], corners[2],
				corners[2], corners[0],

				corners[4], corners[5],
				corners[5], corners[7],
				corners[7], corners[6],
				corners[6], corners[4],

				corners[0], corners[4],
				corners[1], corners[5],
				corners[2], corners[6],
				corners[3], corners[7]
		);

		var vertices = [];

		for(var i = 0; i < points.length; ++i)
				vertices.push(points[i][0], points[i][1], points[i][2]);

		if(!gl.meshes["lines"])
		{
			var mesh = GL.Mesh.load({ vertices: vertices });
			gl.meshes["lines"] = mesh;
			var l = new RD.SceneNode();
			l.flags.ignore_collisions = true;
			l.primitive = gl.LINES;
			l.mesh = "lines";
			l.name = "lines";
			l.color = [1,1,1,1];
			root.addChild(l);
		}
		else
		{
			var mesh = gl.meshes["lines"];
			mesh.getBuffer("vertices").data.set( vertices );
			mesh.getBuffer("vertices").upload( GL.STREAM_DRAW );
		}
	}

	CORE.registerComponent( NodePicker, 'NodePicker');


	function ColorPicker()
	{
		if(this.constructor !== ColorPicker)
			throw("Use new");

		this.button = null;
		this.enabled = false;
	}

	ColorPicker.prototype.setup = function()
	{
		var button = document.querySelector(".tool-colorpicker");
		if(!button)
			console.error('something missing :(');

		this.button = $(button);

		var that = this;

		this.button.on('click', function(){
		
			$(this).addClass("enabled");
			CORE.getCanvas().style.cursor = 'crosshair';
			that.enabled = true;
		});
	}

	// @param e: mouse event
	ColorPicker.prototype.getColor = function( e )
	{
		var mouse = [e.canvasx, gl.canvas.height - e.canvasy];
		var x = parseInt(mouse[0]), y = parseInt(mouse[1]);

		if(x == null || y == null) throw('No mouse'); 

		var WIDTH = CORE._viewport_tex.width;
		var HEIGHT = CORE._viewport_tex.height;

		y = HEIGHT - y;

		var pixel = 4 * (y * WIDTH + x);

		var pixelColor = [
			CORE._viewport_tex.getPixels()[pixel],
			CORE._viewport_tex.getPixels()[pixel+1],
			CORE._viewport_tex.getPixels()[pixel+2],
			CORE._viewport_tex.getPixels()[pixel+3],
		];

		document.querySelector("#pixelPickerText").innerHTML = 'R: '+pixelColor[0].toFixed(4)+' G: '+pixelColor[1].toFixed(4)+' B: '+pixelColor[2].toFixed(4);

		this.enabled = false;
		this.button.removeClass("enabled");
		CORE.getCanvas().style.cursor = 'default';
	}

	CORE.registerComponent( ColorPicker, 'ColorPicker');

// *****************************************************************************
//				GUI components
// *****************************************************************************

	function Light()
	{
		if(this.constructor !== Light)
			throw("Use new");
		

		this.position = vec3.fromValues(1, 5, 1);
		this.color = [1, 1, 1];
		this.intensity = 0;
	}

	Object.defineProperty(Light.prototype, 'color', {
		get: function() { return this._color; },
		set: function(v) { 
			this._color = v; 
			CORE.setUniform('light_color', v);
			if(!light)
				return;
			var i = this.intensity;
			light.color = [v[0]*i, v[1]*i, v[2]*i];
		},
		enumerable: true
	});

	Object.defineProperty(Light.prototype, 'position', {
		get: function() { return this._position; },
		set: function(v) { 
			this._position = v; 
			CORE.setUniform('light_position', v); 
			if(!light)
				return;
			light.position = v;
		},
		enumerable: true
	});

	Object.defineProperty(Light.prototype, 'intensity', {
		get: function() { return this._intensity; },
		set: function(v) { 
			this._intensity = v;
			CORE.setUniform('light_intensity', v);
			if(!light)
				return;
			var color = this.color;
			light.color = [color[0]*v, color[1]*v, color[2]*v];
		},
		enumerable: true
	});

	Light.prototype.create = function( widgets )
	{
		var that = this;

		widgets.addSection("Light");
		widgets.addVector3("Position", this.position, { callback: function(v){ that.position = v }});
		widgets.addNumber("Size", light.scaling[0], {step: 0.01, callback: function(v){ light.scaling = v }});
		widgets.addColor("Color", this.color, {callback: function(color){ 
			that.color = color;
		}});
		widgets.widgets_per_row = 2;
		widgets.addSlider("Scale", this.intensity, {min:0,max:10,step:0.1,callback: function(v) {  
			that.intensity = v; 
		}});
		widgets.addCheckbox("Show node", light.visible, {callback: function(v){ light.visible = v }});
		widgets.widgets_per_row = 1;
		widgets.addButton(null, "Get position", {callback: function(){ that.updateSidePanel(that._sidepanel, 'light')}});
	}

	CORE.registerComponent( Light, 'Light');

	function SFX()
	{
		if(this.constructor !== SFX)
			throw("Use new");
		
		this._exposure = 0;
		this._offset= 0;

		this.glow_enable = false;
		this.glow_intensity = 1;
		this.glow_threshold = 25;
		this.glow_iterations = 8;

		this.fxaa = true;
		this.tonemapping = "Reinhard";
		
	}

	Object.defineProperty(SFX.prototype, 'exposure', {
		get: function() { return this._exposure; },
		set: function(v) { this._exposure = v; CORE.setUniform("exposure", v); },
		enumerable: true
	});

	Object.defineProperty(SFX.prototype, 'offset', {
		get: function() { return this._offset; },
		set: function(v) { this._offset = v; CORE.setUniform("offset", v); },
		enumerable: true
	});

	SFX.prototype.create = function( widgets, root )
	{
		var that = this;
		
		widgets.addSection("FX");
		widgets.addTitle("Frame");
		widgets.addNumber("Exposure", this.exposure,{min:-10,max:10,step:0.1,callback: function(v) { that.exposure = v; }});
		widgets.addNumber("Offset", this.offset,{min:-0.5,max:0.5,step:0.01,callback: function(v) { that.offset = v; }});
		widgets.addCheckbox("FXAA",  this.fxaa, {name_width: '50%', callback: function(v){ that.fxaa = v; }});

		if(CORE.browser !== 'safari')
		{
			widgets.addTitle("Tonemapping");

			var tonemappers = Object.keys(CORE._tonemappers);
			var selected_tonemapper_name = this.tonemapping;
			var selected_tonemapper = CORE._tonemappers[ selected_tonemapper_name ];

			widgets.addCombo(null, selected_tonemapper_name, {values: tonemappers, callback: function(v){
				that.tonemapping = v;
				window.last_scroll = root.content.getElementsByClassName("inspector")[0].scrollTop;
				that.updateSidePanel( that._sidepanel, 'root' );
			}});
			
			if(selected_tonemapper && selected_tonemapper.params)
				for( let p in selected_tonemapper.params ) // important let!!
				{
					var tm = selected_tonemapper.params[p];
					var options = tm.options || {};

					CORE.setUniform(p, tm.value); 

					widgets.addSlider(p, tm.value, {min:options.min || 0,max:options.max||1,step:options.step||0.1,name_width: '50%', callback: function(v) {  
						CORE.setUniform(p, v); 
						selected_tonemapper.setParam(p, v);
					}});
				}
			
			widgets.addSeparator();
		}
		
		//widgets.widgets_per_row = 1;
		widgets.addTitle("Glow");
		widgets.widgets_per_row = 2;
		widgets.addCheckbox("Enable", this.glow_enable, {width:"35%",callback: function(v) { that.glow_enable = v; } });
		widgets.addSlider("Intensity", this.glow_intensity, {width:"65%",min:1,max:2,step:0.1,callback: function(v) {  that.glow_intensity = v; }});
		widgets.addNumber("Threshold", this.glow_threshold, {min:0,max:500000,step:0.1,callback: function(v) { that.glow_threshold = v; }});
		widgets.addCombo("Iterations", this.glow_iterations, {values: [4, 8, 16],callback: function(v) { that.glow_iterations = v; }});
		widgets.widgets_per_row = 1;
		widgets.addSeparator();
		widgets.addSeparator();
	}

	CORE.registerComponent( SFX, 'ScreenFX');