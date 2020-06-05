/*
*   Alex Rodríguez
*   @jxarco 
*/


/* 

HDR imaging component for the app-
It has to be responsible for 

- HDRI GUI
- HDRI Render calls

*/

const MAX_SCALE = 25;
const MIN_SCALE = 0.1;

var HDRI = {

	HDR_GPU: 0,
	DEBEVEC: 1,
	IP4EC: 2,

	core: null, 
	ctx: null,
	canvas: null,

	cropOrigin: [0, 0],
	cropSize: [0, 0],
	restrictProportions: false,
	hdr_scale: 16,

	settings: {
		render_frame: true,
		show_name: true,
		show_exposures: true,
		useGamma: true,
		white_balance: true,
	},

	TM: {
		Exposure: 1,
		P_Exposure: 1,
		Saturation: 1,
		Ywhite: 2.5,
		Key: 0.36
	},

	_keys: {},
	last_mouse: vec2.create(),
	offset: vec2.create(),
	scale: 1,
	_last_mouseup: 0,
	channels: "RGBA",

	init: function(core, gl)
	{
		console.time('HDRI init');
		this.core = core;

		this.canvas = gl.canvas;
		this.items = [];

		enableWebGLCanvas( this.canvas );

		var that = this;

		this.originCaptured = false;
		this.cropFocus = false;
		this.shifting = false;
		this.resizing = false;
		this.currentSpot = -1;

		this.assemble_mode = HDRI.HDR_GPU;
		this.sort_type = "NORMAL";
		this.shader = gl.shaders["PTR_HDRI"];
		this.shader_name = "PTR_";

		this._channel_shader = new GL.Shader('\
			precision mediump float;\n\
			attribute vec3 a_vertex;\n\
			attribute vec2 a_coord;\n\
			varying vec2 v_coord;\n\
			uniform mat4 u_mvp;\n\
			void main() {\n\
				v_coord = a_coord;\n\
				gl_Position = u_mvp * vec4(a_vertex,1.0);\n\
			}\
			','\
			precision mediump float;\n\
			varying vec2 v_coord;\n\
			uniform vec4 u_color;\n\
			uniform vec4 u_white_balance_values;\n\
			uniform float u_channel;\n\
			uniform bool u_gamma;\n\
			uniform bool u_white_balance;\n\
			uniform sampler2D u_texture;\n\
			void main() {\n\
			  vec2 coord = v_coord;\n\
			  vec4 channels = texture2D( u_texture, coord );\n\
			  if(!u_white_balance)\n\
			  	channels *= u_white_balance_values;\n\
			  vec4 color;\n\
			  if( u_channel == 0.0 )\n\
				color = vec4( channels[0], channels[0], channels[0], 1.0);\n\
			  else if( u_channel == 1.0 )\n\
				color = vec4( channels[1], channels[1], channels[1], 1.0);\n\
			  else if( u_channel == 2.0 )\n\
				color = vec4( channels[2], channels[2], channels[2], 1.0);\n\
			  else if( u_channel == 3.0 )\n\
				color = vec4( channels[3], channels[3], channels[3], 1.0);\n\
			  else\n\
				color = channels;\n\
				if(u_gamma)\n\
					color = pow(color, vec4(1./2.2));\n\
			  gl_FragColor = color;\n\
			}\
		');

		this._uv_shader = new GL.Shader('\
			precision mediump float;\n\
			attribute vec3 a_vertex;\n\
			attribute vec2 a_coord;\n\
			varying vec3 v_pos;\n\
			uniform mat4 u_model;\n\
			uniform mat4 u_mvp;\n\
			void main() {\n\
				v_pos = (u_model * vec4(a_vertex,1.0)).xyz;\n\
				gl_Position = vec4(a_coord * 2.0 - vec2(1.0),0.0,1.0);\n\
			}\
			','\
			precision mediump float;\n\
			uniform vec4 u_color;\n\
			void main() {\n\
			  gl_FragColor = u_color;\n\
			}\
		');

		this._cubemap_shader = new GL.Shader('\
			precision mediump float;\n\
			attribute vec3 a_vertex;\n\
			attribute vec2 a_coord;\n\
			varying vec2 v_coord;\n\
			uniform mat4 u_mvp;\n\
			void main() {\n\
				v_coord = a_coord;\n\
				gl_Position = u_mvp * vec4(a_vertex,1.0);\n\
			}\
			','\
			precision mediump float;\n\
			varying vec2 v_coord;\n\
			uniform vec4 u_color;\n\
			uniform float u_rotation;\n\
			uniform samplerCube u_texture;\n\
			void main() {\n\
			  vec2 coord = v_coord * 2.0 - vec2(1.0);\n\
			  float dist = length(coord);\n\
			  if(dist > 1.1)\n\
			  {\n\
			  	gl_FragColor = vec4(0.0,0.0,0.0,1.0);\n\
			  	return;\n\
			  }\n\
			  if(dist > 0.99)\n\
			  	discard;\n\
			  vec3 dir = normalize(vec3( coord, 0.5 ));\n\
			  float c = cos(u_rotation);\n\
			  float s = sin(u_rotation);\n\
			  dir = vec3(dir.x * c - dir.z * s, dir.y, dir.x * s + dir.z * c);\n\
			  vec4 tex = textureCube(u_texture, dir);\n\
			  if(tex.a < 0.1)\n\
				discard;\n\
			  gl_FragColor = u_color * tex;\n\
			}\
		');

		//for shadowmaps
		this._depth_shader = new GL.Shader('\
			precision highp float;\n\
			attribute vec3 a_vertex;\n\
			attribute vec2 a_coord;\n\
			varying vec2 v_coord;\n\
			uniform mat4 u_mvp;\n\
			void main() {\n\
				v_coord = a_coord;\n\
				gl_Position = u_mvp * vec4(a_vertex,1.0);\n\
			}\
			','\
			precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform vec2 u_near_far;\n\
			uniform float u_exposure;\n\
			uniform sampler2D u_texture;\n\
			void main() {\n\
				vec2 coord = v_coord;\n\
				float depth = texture2D( u_texture, coord ).x;\n\
				float zNear = u_near_far.x;\n\
				float zFar = u_near_far.y;\n\
				float z = (2.0 * zNear) / (zFar + zNear - depth * (zFar - zNear));\n\
				z *= u_exposure;\n\
			  gl_FragColor = vec4(z,z,z,1.0);\n\
			}\
		');

		this.camera = new LS.Camera();
		this.camera.lookAt([0,0,0],[0,0,-1],[0,1,0]);
		LS.Draw.init();
	},

	bind: function()
	{
		var ctx = gl;
		if(!ctx)
			throw('no WebGLRenderingContext');

		var keys = this._keys;
		var canvas = gl.canvas;
		var rect = canvas.getBoundingClientRect();
		var that = this;

		ctx.captureKeys(true);
		ctx.onkeydown = function(e)
		{
			keys[e.keyCode] = true;

			if(e.keyCode === 82) // R
				CORE.reloadShaders(); 
			if(e.keyCode === 49)
				$("#maintab").click();
			if(e.keyCode === 50)
				$("#assemblytab").click();
			if(e.keyCode === 27)
				HDRI.resetCrop();
		}
		ctx.onkeyup = function(e)
		{
			keys[e.keyCode] = false;
		}
		ctx.captureMouse(true);

		ctx.onmousemove = function(e)
		{
			var x = e.clientX - rect.left;
			var y = e.clientY - rect.top;
			e.canvasx = x;
			e.canvasy = y;

			if(e.shiftKey)
					that.shifting = true;
			else
				that.shifting = false;

			var deltax = x - that.last_mouse[0];
			var deltay = y - that.last_mouse[1];

			if( that.dragging ){

				if(!that.texture)
				{

					that.offset[0] += e.deltax / that.scale;
					that.offset[1] += e.deltay / that.scale;

					that.last_mouse[0] = x;
					that.last_mouse[1] = y;

					e.preventDefault();
					e.stopPropagation();
					return false;
				}

				var pos = that.convertCanvasToOffset([x, y]);
				var spot = that.spotToOffset([x, y]);

				if(e.shiftKey){

					if(!that.originCaptured) {
						that.cropOrigin = pos;
						that.originCaptured = true;
					}
					else
					{
						that.cropSize = numeric.sub(pos, that.cropOrigin);
					}
				}
				else{

					var pixelx = pos[0];
					var pixely = pos[1];

					if(that.currentSpot > 0)
					{
						that.resizeSection(that.currentSpot, deltax / that.scale, deltay / that.scale);
					}
					else
					{
						var whichSpot = that.inSpot(pos[0], pos[1], spot);
						that.currentSpot = whichSpot;

						if(whichSpot < 0)
						{
							that.offset[0] += deltax / that.scale;
							that.offset[1] += deltay / that.scale;
						}
						else
							that.resizeSection(whichSpot, deltax / that.scale, deltay / that.scale);
					}
				}
					
			}

			that.last_mouse[0] = x;
			that.last_mouse[1] = y;

			e.preventDefault();
			e.stopPropagation();
			return false;
		}

		ctx.captureTouch(true);

		ctx.onmousewheel = function(e)
		{
			e.eventType = "mousewheel";
			if(e.type == "wheel")
				e.wheel = -e.deltaY;
			else
				e.wheel = (e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60);

			//from stack overflow
			e.delta = e.wheelDelta ? e.wheelDelta/40 : e.deltaY ? -e.deltaY/3 : 0;
			
			that.changeDeltaScale(1.0 + e.delta * 0.05, [e.canvasx, gl.canvas.height - e.canvasy]);

			var x = e.clientX - rect.left;
			var y = e.clientY - rect.top;
			e.canvasx = x;
			e.canvasy = y;

			that.last_mouse[0] = x;
			that.last_mouse[1] = y;

			e.preventDefault();
			e.stopPropagation();
			return false;
		}

		ctx.onmousedown = function(e){
		
			that.dragging = true;

			var x = e.clientX - rect.left;
			var y = e.clientY - rect.top;
			e.canvasx = x;
			e.canvasy = y;

			that.last_mouse[0] = x;
			that.last_mouse[1] = y;

			if(	(getTime() - that._last_mouseup) < 200 && that.selected_item ) //dblclick
				console.log(that.selected_item);

			e.preventDefault();
			e.stopPropagation();
			return false;
		}

		ctx.onmouseup = function(e){
		
			that.dragging = false;

			if(that.originCaptured)
			that.cropFocus = true;

			// be careful with negative sizes
			if(that.cropSize[0] < 0) {
				that.cropSize[0] *= -1;
				that.cropOrigin[0] -= that.cropSize[0];
			}

			if(that.cropSize[1] < 0) {
				that.cropSize[1] *= -1;
				that.cropOrigin[1] -= that.cropSize[1];
			}
			
			
			that.originCaptured = false;
			that.resizing = false;
			that.currentSpot = -1;

			that.updateArea();

			var x = e.clientX - rect.left;
			var y = e.clientY - rect.top;
			e.canvasx = x;
			e.canvasy = y;

			that.last_mouse[0] = x;
			that.last_mouse[1] = y;

			if(e.click_time < 200)
			{
				that.selected_item = that.getItemAtPos(e.mousex, e.mousey);
				that._last_mouseup = getTime(); //for dblclick
			}

			e.preventDefault();
			e.stopPropagation();
			return false;

		}
	},

	getItemAtPos: function(x,y)
	{
		var pos = this.convertCanvasToOffset([x,y]);
		x = pos[0];
		y = pos[1];

		for( var i = 0; i < this.items.length; ++i)
		{
			var item = this.items[i];
			if( item.x < x && item.y < y && 
				x < (item.x + item.w) && y < (item.y + item.h))
				return item;
		}
		return null;
	},
	
	changeDeltaScale: function( value, zooming_center )
	{
		this.changeScale( this.scale * value, zooming_center );
	},

	changeScale: function( value, zooming_center )
	{
		if(value < this.min_scale)
		value = this.min_scale;
		else if(value > this.max_scale)
			value = this.max_scale;

		if(value == this.scale)
			return;

		var rect = this.canvas.getBoundingClientRect();
		if(!rect)
			return;

		zooming_center = zooming_center || [rect.width * 0.5,rect.height * 0.5];
		var center = this.convertCanvasToOffset( zooming_center );
		this.scale = value;//Math.max(MIN_SCALE, Math.min(value, MAX_SCALE));

		var new_center = this.convertCanvasToOffset( zooming_center );
		var delta_offset = [new_center[0] - center[0], new_center[1] - center[1]];

		this.offset[0] += delta_offset[0];
		this.offset[1] += delta_offset[1];

		if(	this.onredraw )
			this.onredraw( this );
	},

	add: function(gui)
	{
		this.gui = gui;

		// create second area for HDRI
		gui.assemblyarea = new LiteGUI.Area({id: "assembly", content_id:"assemblycanvasarea", height: "calc( 100% - 31px )", main:true});
		gui.assemblyarea.root.style.display = "none";
		LiteGUI.add( gui.assemblyarea );

		// by now fill here assemblyarea

		gui.assemblyarea.root.ondragover = () => {return false};
		gui.assemblyarea.root.ondragend = () => {return false};
		gui.assemblyarea.root.ondrop = (e) => processDrop(e);

		this.fillArea();
		var root = locations[ "#assembly" ] = gui.assemblyarea.content;
		root.appendChild( this.canvas );
	},

	fillArea: function()
	{
		gui.assemblyarea.split("horizontal",[null,"17.5%"]);
		gui.assemblyarea.onresize = function(){ console.log("qefwef") };
		var docked = new LiteGUI.Panel("hdri_right_panel", {title:'HDRI View', scroll: true});
		gui.assemblyarea.getSection(1).add( docked );
		$(docked).bind("closed", function() { gui.assemblyarea.merge(); });
		gui._hdri_sidepanel = docked;
		gui.assemblyarea.root.style.background = "#3D3D3D";
		this.updateArea();
	},

	updateArea: function()
	{
		var right = gui._hdri_sidepanel;
		var bottom = gui._hdri_bottompanel;
		var that = this;
		
		// empty containers
		$(right.content).empty();

		// right
		var widgets = new LiteGUI.Inspector();
		$(right.content).append(widgets.root);
		
		if(!gl.textures["ASSEMBLED"])
		{
			widgets.addSection("Resources");

			widgets.widgets_per_row = 1;
	
			widgets.addTitle("Show info");	
			widgets.addCheckbox("Name", this.settings.show_name, {callback: function(v){ 
				that.settings.show_name = v;
			}, name_width: "70%"});
			widgets.addCheckbox("Exposures", this.settings.show_exposures, {callback: function(v){ 
				that.settings.show_exposures = v;
			}, name_width: "70%"});
			widgets.addCheckbox("Frame", this.settings.render_frame, {callback: function(v){ 
				that.settings.render_frame = v;
			}, name_width: "70%"});

			widgets.addTitle("Display");	
			widgets.addCheckbox("Apply Gamma", this.settings.useGamma, {callback: function(v){ 
				that.settings.useGamma = v;
			}, name_width: "70%"});
			
			widgets.addCheckbox("White Balance", this.settings.white_balance, {callback: function(v){ 
				that.settings.white_balance = v;
			}, name_width: "70%"});
	
			widgets.addCombo("Channel", this.channels, {values: ["RGBA", "R", "G", "B", "A"], callback: function(v){
				that.channels = v;
			}, name_width: "50%"});
	
			widgets.addCombo("Sort images", this.sort_type, {values: ["NORMAL", "INVERSE"], callback: function(v){
				
				var sort_higher = (v === "INVERSE") ? true : false;
				HDRTool._sortFiles(sort_higher);
				that.sort_type = v;
				
			}, name_width: "50%"});
			
			widgets.addSeparator();

			widgets.addButton(null, "&#10008; Empty", {callback: function(){
				HDRTool.files_loaded.length = 0;
			}});

			if(this.selected_item)
			{
				widgets.addSeparator();
				widgets.addTitle("Selected item");

				file = HDRTool.files_loaded.find( e=> e.name.includes(that.selected_item.name) );

				widgets.addString("Filename", file.name, {callback: function(v){

					var i0 = HDRTool.files_loaded.findIndex( e=> e.name.includes(that.selected_item.name) );
					HDRTool.files_loaded[i0].name = v;
					that.selected_item.name = v;
				}});

				widgets.addVector4("Multipliers", file.verbose.multipliers, {callback: function(v){

					var index = HDRTool.files_loaded.findIndex( e=> e.name.includes(that.selected_item.name) );
					HDRTool.files_loaded[index].verbose.multipliers = v;
				}});
				
				//widgets.addDataTree(null, file, {exclude: {url: true, name: true}});

				for(var i = 1; i < file.metadata.length - 2; i++)
				{
					var ab = file.metadata[i].split(":");
					widgets.addInfo(ab[0], ab[1].slice(1, ab[1].length), {name_width: "40%"});
				}

				widgets.addSeparator();

				widgets.addButton(null, "&#10008; Delete", {callback: function(){

					var index = HDRTool.files_loaded.findIndex( e=> e.name.includes(that.selected_item.name) );
					if (index > -1) {
						HDRTool.files_loaded.splice(index, 1);
						that.selected_item = null;
						that.updateArea();
					}
				}})
			}
		}else
		{
			widgets.addButton(null, "Back to resources", {callback: function(){
		
				that.offset[0] = that.offset[1] = 0;
				that.scale = 1;
				
				delete gl.textures["CROPPED"];
				delete gl.textures["ASSEMBLED"];

				that.updateArea();
			}});

			widgets.addSection("Tonemapping");

			var SFX = RM.Get("ScreenFX");
			var values = ["None", "Test", "Exponential", "PTR_"];

			widgets.addCombo(null, that.shader_name, {values: values, callback: function(v){
				
				that.shader_name = v;
				that.shader = gl.shaders[ that.shader_name  + "HDRI"];
				that.updateArea();
			}});

			widgets.addSlider("PreExposure", that.TM.Exposure, {min: 0, step: 0.01, max: 5,callback: function(v){
				
				that.TM.Exposure = v;
			}});

			widgets.addSlider("PostExposure", that.TM.P_Exposure, {min: 0, step: 0.01, max: 5,callback: function(v){
				
				that.TM.P_Exposure = v;
			}});

			widgets.addSlider("Key", that.TM.Key, {min: 0, step: 0.01, max: 1,callback: function(v){
				
				that.TM.Key = v;
			}});

			widgets.addSlider("Saturation", that.TM.Saturation, {min: 0, step: 0.01, max: 5,callback: function(v){
				
				that.TM.Saturation = v;
			}});

			widgets.addSlider("Lum White", that.TM.Ywhite, {min: 0, step: 0.01, max: 5,callback: function(v){
				
				that.TM.Ywhite = v;
			}});
			
			/*if(tonemapper && tonemapper.params)
				for( let p in tonemapper.params ) // important let!!
				{
					var tm = tonemapper.params[p];
					var options = tm.options || {};

					CORE.setUniform(p, tm.value); 

					widgets.addSlider(p, tm.value, {min:options.min || 0,max:options.max||1,step:options.step||0.1, callback: function(v) {  
						CORE.setUniform(p, v); 
						tonemapper.setParam(p, v);
					}});
				}*/

			widgets.addSeparator();

			if(!gl.textures["CROPPED"])
			{
				widgets.addInfo("Delete non necessary parts of the image to tonemap", null, {name_width: "100%"});
				widgets.addInfo("the result", null, {name_width: "100%"});
				widgets.addButton(null, "Reset crop", {callback: function(){ 
				
					if(!HDRTool.files_loaded.length)
					{
						console.error("no files loaded");
						return;
					}
					
					that.resetCrop();
					that.updateArea();
				}});
		
				widgets.addVector2("Position", this.cropOrigin, {min: 0, step: 10, precision: 0, callback: function(v){ that.cropOrigin = v; }});
				widgets.addVector2("Size", this.cropSize, {min: 0, step: 10, precision: 0, callback: function(v){ 
					
					if(!that.restrictProportions)
						that.cropSize = v; 
					else
					{
						that.cropSize[0] = v[0];
						that.cropSize[1] = v[0];
					}
					
				}});
				widgets.widgets_per_row = 3;
				widgets.addCheckbox("Restrict", this.restrictProportions, {callback: function(v){ that.restrictProportions = v; }});
				widgets.addButton(null, "Crop", {callback: function(){ 
				
					that.cropSection();
					that.updateArea();
				}});
				widgets.addButton(null, "Select all", {callback: function(){ 
				
					that.selectAll();
					that.updateArea();
				}});

				widgets.addSeparator();
			}

			widgets.widgets_per_row = 1;
			widgets.addInfo("Use result as a 3D environment", null, {name_width: "100%"});
	
			widgets.widgets_per_row = 2;
			widgets.addButton(null, "Download", {callback: function(){ 
			
				var tex = gl.textures["ASSEMBLED"];
				var tex_mip = gl.textures["ASSEMBLED_MIP"];

				var png = new GL.Texture( tex.width, tex.height, tex.getProperties() );
				var shader = new Shader(Shader.SCREEN_VERTEX_SHADER, that.shader.fs_shader);

				tex_mip.bind(1);

				png.drawTo( function() {

					HDRI.render_uniforms.u_texture_mip = 1;
					tex.toViewport(shader, HDRI.render_uniforms);
				});

				tex_mip.unbind();

				HDRTool.downloadTexture(png);
			}});
	
			widgets.addButton(null, "Export", {callback: function(){ 
			
				that.toCubemap();
				
			}});
		}

		widgets.addSection("Create HDR from sequence");
	
			widgets.widgets_per_row = 1;
	
			var values = ["HDR_GPU", "DEBEVEC", "IP4EC"];
			widgets.addCombo("Assemble mode", values[that.assemble_mode], { values: values, callback: function(v){
				
				switch(v)
				{
					case "HDR_GPU":
						that.assemble_mode = HDRI.HDR_GPU;
						break;
					case "DEBEVEC":
						that.assemble_mode = HDRI.DEBEVEC;
						break;
					case "IP4EC":
						that.assemble_mode = HDRI.IP4EC;
						break;
				}
			} });
	
			async function _assemble()
			{
				await CORE.reloadShaders(null, function()
				{
					switch(that.assemble_mode)
					{
						case HDRI.HDR_GPU:
							HDRTool.assembleHDR_HDRGPU( that.hdr_scale );
							break;
						case HDRI.DEBEVEC:
							HDRTool.assembleHDR_DEBEVEC();
							break;
						case HDRI.IP4EC:
							console.log("to do");
							break;
					}
					that.updateArea();
				});
			}

			widgets.addCombo("HDR Scale", this.hdr_scale, { values: [8, 16,32], callback: function(v){
				
				that.hdr_scale = v;

				if(HDRTool.files_loaded.length)
					_assemble();

			} });

			widgets.addButton(null, "Assemble", {callback: async function(){ 
	
				if(HDRTool.files_loaded.length)
					_assemble();
			 }});


	},

	onDrag: function(e, file, extension, name)
	{
		gui.loading();
		HDRTool.files_to_load = e.dataTransfer.files.length;

		console.log(name + " loaded");

		// don't empty
		// HDRTool.files_loaded.length = 0;

		HDRTool.loadLDRI( file, extension, name, {event: e, callback: function(){
			HDRI.selected_item = null;
			HDRI.updateArea();
			gui.loading(0);
		}});
	},

	resize: function(w, h)
	{
		if(!this.canvas)
			return;

		this.canvas.style.width = w + "px";
		this.canvas.height = h + "px";
		this.canvas.width = w;
		this.canvas.height = h;
	},

	convertCanvasToOffset: function(pos)
	{
		return [pos[0] / this.scale - this.offset[0] , 
			pos[1] / this.scale - this.offset[1]  ];
	},

	convertOffsetToCanvas: function(pos)
	{
		return [ (pos[0] + this.offset[0]) * this.scale, 
			(pos[1] + this.offset[1]) * this.scale ];
	},

	spotToOffset: function(pos)
	{
		var spotSize = parseInt(this.texture.width/150);

		pos[0] += spotSize;
		pos[1] += spotSize;

		var local = this.convertCanvasToOffset( pos );
		
		var pixelx = (local[0]|0);
		var pixely = (local[1]|0);

		return [pixelx, pixely];

		// is_inside = pixelx >= 0 && pixelx < this.texture.width && pixely >= 0 && pixely < this.texture.height;
	},

	inSpot: function(x, y, spot)
	{
		var spotSize = this.texture.width / 64;
	
		if(x >= this.cropOrigin[0] + this.cropSize[0] / 2 - spotSize / 2 && 
			x < this.cropOrigin[0] + this.cropSize[0] / 2 + spotSize / 2 &&
			y >= this.cropOrigin[1] - spotSize / 2 &&
			y < this.cropOrigin[1] + spotSize / 2)
			return 1;

		if(x >= this.cropOrigin[0] + this.cropSize[0] / 2 - spotSize / 2 && 
			x < this.cropOrigin[0] + this.cropSize[0] / 2 + spotSize / 2 &&
			y >= this.cropOrigin[1] + this.cropSize[1] - spotSize / 2 &&
			y < this.cropOrigin[1] + this.cropSize[1] + spotSize / 2)
			return 4;

		if(x >= this.cropOrigin[0] - spotSize / 2 && 
			x < this.cropOrigin[0] + spotSize / 2 &&
			y >= this.cropOrigin[1] + this.cropSize[1] / 2 - spotSize / 2 &&
			y < this.cropOrigin[1] + this.cropSize[1] / 2 + spotSize / 2)
			return 3;

		if(x >= this.cropOrigin[0] + this.cropSize[0] - spotSize / 2 && 
			x < this.cropOrigin[0] + this.cropSize[0] + spotSize / 2 &&
			y >= this.cropOrigin[1] + this.cropSize[1] / 2 - spotSize / 2 &&
			y < this.cropOrigin[1] + this.cropSize[1] / 2 + spotSize / 2)
			return 2;

		return -1;
	},
	
	renderCircle: function(spot, posx, posy, size, filled, ctx)
	{

		ctx.fillStyle = "white";

        /*if(this.resizing && spot == this.currentSpot)
        ctx.globalAlpha = 0.25;

		var w = size * ((spot === 2 || spot === 3) ? 0.5 : 4);
		var h = size * ((spot === 2 || spot === 3) ? 4 : 0.5);

		ctx.fillRect(posx - w/2, posy - h/2, w, h);*/


		ctx.beginPath();
		ctx.arc(posx, posy, size * 1.1, 0, 2 * Math.PI, false);
		if(!filled)
			ctx.stroke();
		else
			ctx.fill();

		ctx.fillStyle = "rgb(85, 200, 215)";

		if(this.resizing && spot == this.currentSpot)
			ctx.fillStyle = "white";

		ctx.beginPath();
		ctx.arc(posx, posy, size * 0.8, 0, 2 * Math.PI, false);
		if(!filled)
			ctx.stroke();
		else
			ctx.fill();
	},

	renderGuides: function(pixelx, pixely, ctx)
	{
		ctx.strokeStyle = "white";
		ctx.beginPath();
		ctx.moveTo(pixelx, 0);   // Begin first sub-path
		ctx.lineTo(pixelx, this.texture.height);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(0, pixely);   // Begin second sub-path
		ctx.lineTo(this.texture.width, pixely);
		ctx.stroke();
	},

	renderSpots: function(pixelx, pixely, ctx)
	{
		
		var spotSize = parseInt(this.texture.width/160);
		this.renderCircle(3, this.cropOrigin[0], this.cropOrigin[1] + this.cropSize[1] / 2, spotSize, true, ctx);
		this.renderCircle(1, this.cropOrigin[0] + this.cropSize[0] / 2, this.cropOrigin[1], spotSize, true, ctx);

		this.renderCircle(2, this.cropOrigin[0] + this.cropSize[0], this.cropOrigin[1] + this.cropSize[1] / 2, spotSize, true, ctx);
		this.renderCircle(4, this.cropOrigin[0] + this.cropSize[0] / 2, this.cropOrigin[1] + this.cropSize[1], spotSize, true, ctx);

		ctx.fillStyle = "white";
	},

	render: function()
	{
		var core = this.core;
		var canvas = this.canvas;
		var ctx = gl;
		var mouse = this.last_mouse;

		/*if(!this.shader && RM.Get("ScreenFX"))
			this.shader = gl.shaders[RM.Get("ScreenFX").tonemapping];*/

		if(!this.shader)
			this.shader = gl.shaders["PTR_HDRI"];

		is_inside = false;

		this.texture = gl.textures["CROPPED"] || gl.textures["ASSEMBLED"];
		// Object.assign( renderer._uniforms, HDRTool.getUniforms() );

		ctx.start2D(); //WebGLtoCanvas2D

		gl.clearColor(0.1,0.1,0.1,1.0);
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

		this.camera.setOrthographic(0, gl.canvas.width, gl.canvas.height, 0, -1, 1 );
		this.camera.updateMatrices();

		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);

		ctx.save();
		ctx.scale( this.scale, this.scale );
		ctx.translate( this.offset[0], this.offset[1] );

		if(!this.texture)
		{
			LS.Draw.push();
			LS.Draw.setCamera( this.camera );
			LS.Draw.setColor([1,1,1,1]);

			ctx.fillStyle = "#555";
			ctx.font = "70px Arial";
			ctx.fillText( "Resources", 20, 80 );

			var total = this.renderTextures();

			ctx.fillStyle = "#444";
			ctx.font = "40px Arial";
			ctx.fillText( total + " item" + ((!total || total > 1) ? "s" : ""), 400, 80 );

			LS.Draw.pop();
		}
		else
		{
			var local = this.convertCanvasToOffset( mouse );
			var pixelx = (local[0]|0);
			var pixely = (local[1]|0);

			is_inside = pixelx >= 0 && pixelx < this.texture.width && pixely >= 0 && pixely < this.texture.height;
			
			ctx.strokeStyle = "white";
			ctx.strokeRect(-2,-2, this.texture.width + 4, this.texture.height + 4);
			ctx.strokeRect(-1,-1, this.texture.width + 2, this.texture.height + 2);
			ctx.fillStyle = "white";
			gl.disable( gl.BLEND );

			// Fill uniforms

			const numImages = HDRTool.files_loaded.length;

			var uniforms = {
				u_texture_mip: 1,
				u_hdr_scale: this.hdr_scale,
				u_numImages: numImages,
				u_WhiteBalance: [],
				u_PreExposure: this.TM.Exposure,
				u_PostExposure: this.TM.P_Exposure,
				u_Saturation: this.TM.Saturation,
				u_Ywhite: this.TM.Ywhite,
				u_Key: this.TM.Key,
			};

			for(var i = 0; i < numImages; i++)
				if(HDRTool.files_loaded[i].verbose)
				uniforms["u_WhiteBalance"].push( new Float32Array( HDRTool.files_loaded[i].verbose.multipliers ) );
			
			if(HDRTool.files_loaded[0].verbose)
			uniforms["u_WhiteBalance"] = GL.linearizeArray( uniforms["u_WhiteBalance"] );

			if(gl.textures["CROPPED_MIP"])
				gl.textures["CROPPED_MIP"].bind(1);
			else
				gl.textures["ASSEMBLED_MIP"].bind(1);


			HDRI.render_uniforms = uniforms;
			ctx.drawImage( this.texture, 0,0, this.texture.width, this.texture.height, this.shader, uniforms);

			if(gl.textures["CROPPED_MIP"])
				gl.textures["CROPPED_MIP"].unbind();
			else
				gl.textures["ASSEMBLED_MIP"].unbind();

			gl.enable( gl.BLEND );

			if(!gl.textures["CROPPED"])
			{
				ctx.strokeStyle = "white";
				ctx.strokeRect(this.cropOrigin[0] , this.cropOrigin[1], this.cropSize[0], this.cropSize[1]);
	
				ctx.globalAlpha = 0.6;
				if(is_inside && this.shifting)
					this.renderGuides(pixelx, pixely, ctx);
	
				ctx.globalAlpha = 1;
	
				if(this.cropFocus)
					this.renderSpots(pixelx, pixely, ctx);
			}

			ctx.font = parseInt(this.texture.width/40) + "px monospace";
			ctx.strokeStyle = "white";
			ctx.textAlign = "center";
			ctx.fillText( String(this.texture.width) + "px", this.texture.width * 0.5, - 22 );
			ctx.textAlign = "left";
			ctx.fillText( String(this.texture.height) + "px", this.texture.width + 16, this.texture.height * 0.5 );

			ctx.restore();

			ctx.textAlign = "left";
			if(is_inside)
            {
                ctx.fillStyle = "white";
		    	ctx.font = "20px monospace";
                ctx.fillText( "X: " + pixelx, 5, 20 );
                ctx.fillText( "Y: " + pixely, 5, 40 );
			}
		}

		gl.restore();
		gl.finish2D(); //WebGLtoCanvas2D

		// Render GUI
		core.gui.render();
		
	},

	renderTextures: function()
	{
		var posx = 20;
		var posy = 120;
		var size = 250;
		var margin = 20;
		gl.strokeStyle = "white";
		gl.fillStyle = "white";
		gl.textAlign = "left";
		gl.font = "14px Arial";

		this.items.length = 0;

		var num = 0;

		var channel = 1;
		switch( this.channels )
		{
			case "R": channel = 0; break;
			case "G": channel = 1; break;
			case "B": channel = 2; break;
			case "A": channel = 3; break;
			default: channel = -1; break;
		}

		this._channel_shader.uniforms({ 
			u_channel: channel, 
			u_gamma: this.settings.useGamma,
			u_white_balance: this.settings.white_balance,
			u_white_balance_values: vec4.fromValues(1, 1, 1, 1)
		});

		for(var i = 0; i < HDRTool.files_loaded.length; ++i)
		{
			var item =  HDRTool.files_loaded[i];
			if(!item)
				continue;

			var filename = item.name;

			var tex = item.texture;
			var w = size * tex.width / tex.height;
			var h = size;

			var startx = gl._matrix[6] + (posx) * gl._matrix[0];
			var starty = gl.canvas.height - gl._matrix[7] + (-posy - h) * gl._matrix[4];
			var sizex = w * gl._matrix[0];
			var sizey = h * gl._matrix[4];

			var white = [1,1,1,1];
			var black = [0,0,0,1];

			if(item.verbose)
				this._channel_shader.setUniform("u_white_balance_values", item.verbose.multipliers);

			//inside camera
			if(startx <= gl.canvas.width && starty <= gl.canvas.height && 
				startx + sizex > 0 && starty + sizey > 0 )
			{
				if(tex.texture_type == gl.TEXTURE_2D)
				{
					if( tex.format == GL.DEPTH_COMPONENT )
						continue;
					else //color
					{
						if(this.channels == "RGBA")
							gl.enable( gl.BLEND );
						else 
							gl.disable( gl.BLEND );
						LS.Draw.renderPlane([ gl._matrix[6] + (posx + w*0.5) * gl._matrix[0], gl._matrix[7] + (posy + h*0.5) * gl._matrix[4], 0], [ w*0.5 * gl._matrix[0], -h*0.5 * gl._matrix[4] ], tex, this._channel_shader );
					}
					gl.enable( gl.BLEND );
				}
				else 
					continue;

				if(this.settings.show_name)
				{
					var shorter = filename.substr(0, 28);

					if(filename.length > 28)
					shorter += "...";

					gl.font = "14px Arial";
					gl.fillColor = black;
					gl.fillText(shorter,posx + 6,posy + 16);
					gl.fillColor = white;
					gl.fillText(shorter,posx + 5,posy + 15);
				}
				
				if(this.settings.show_exposures)
				{
					gl.font = "24px Arial";
					gl.fillColor = black;
					gl.fillText(item.ExposureTime,posx + 6,posy + h - 6);
					gl.fillColor = white;
					gl.fillText(item.ExposureTime,posx + 5,posy + h - 7);
				}
				
				if(this.settings.render_frame)
				{
					gl.globalAlpha = (this.selected_item && this.selected_item.item == tex) ? 1 : 0.4;
					gl.strokeRect( posx, posy, w, h );
					gl.globalAlpha = 1;
				}

				this.items.push({id:i,name: filename,type:"Texture",item: tex, x:posx,y:posy,w:w,h:h});
			}

			posx += w + margin;
			if(posx > gl.canvas.width - size + margin)
			{
				posx = 20;
				posy += h + margin;
			}

			num++;
		}
		
		return num;

	},

	resizeSection: function(selected_spot, dx, dy)
	{
		this.resizing = true;
		var xmargin = this.texture.width / 50;
		var ymargin = this.texture.height / 50;

		// left
		if(selected_spot == 3) {

			var maxResize = this.cropOrigin[0] + this.cropSize[0];
			var offset = this.convertCanvasToOffset(this.last_mouse)[0];

			if(dx > 0 && offset > this.cropOrigin[0] && this.cropOrigin[0] < (maxResize - xmargin))
			{
				this.cropOrigin[0] += dx;
				this.cropSize[0] -= dx;
			}
			else if(dx < 0 && offset <= this.cropOrigin[0])
			{
				var ndx = (this.cropOrigin[0] + dx);

				if(ndx < 0)
				{
					this.cropSize[0] += this.cropOrigin[0];
					this.cropOrigin[0] = 0;
				}else
				{
					this.cropOrigin[0] += dx;
					this.cropSize[0] -= dx;
				}
			}
		}
		
		// top 
		else if(selected_spot == 1) {
			
			var maxResize = this.cropOrigin[1] + this.cropSize[1];
			var offset = this.convertCanvasToOffset(this.last_mouse)[1];

			if(dy > 0 && offset > this.cropOrigin[1] && this.cropOrigin[1] < (maxResize - ymargin))
			{
				this.cropOrigin[1] += dy;
				this.cropSize[1] -= dy;
			}
			else if(dy < 0 && offset <= this.cropOrigin[1])
			{
				var ndy = (this.cropOrigin[1] + dy);

				if(ndy < 0)
				{
					this.cropSize[1] += this.cropOrigin[1];
					this.cropOrigin[1] = 0;
				}else
				{
					this.cropOrigin[1] += dy;
					this.cropSize[1] -= dy;
				}
			}
		}

		// right
		if(selected_spot == 2) {
			
			var offset = this.convertCanvasToOffset(this.last_mouse)[0];

			if(offset > this.texture.width)
				this.cropSize[0] = this.texture.width - this.cropOrigin[0]; // limit
			else
				this.cropSize[0] += dx;
		}
		
		// bottom
		else if(selected_spot == 4) {
		
			var offset = this.convertCanvasToOffset(this.last_mouse)[1];

			if(offset > this.texture.height)
				this.cropSize[1] = this.texture.height - this.cropOrigin[1]; // limit
			else
				this.cropSize[1] += dy;
		}
			

	},

	selectAll: function()
	{
		var tex = gl.textures["ASSEMBLED"];

		var w = tex.width,
			h = tex.height;

		this.generateCropped(w, h, null, tex); // null: no data selected --> select all
		this.resetCrop();
	},

	cropSection: function()
	{
		var tex = gl.textures["ASSEMBLED"];
		var pixelData = tex.getPixels();

		var w = tex.width,
			h = tex.height;

		var canvas_width = gl.canvas.width,
			canvas_height = gl.canvas.height;

		var cropWidth = (this.cropSize[0]|0);//Math.floor( (this.cropSize[0] / canvas_width) * w);
		var cropHeight = (this.cropSize[1]|0);//this.restrictProportions ? cropWidth : Math.floor( (this.cropSize[1] / canvas_height) * h);

		var	size = w * h * 4,
			newSize = cropWidth * cropHeight * 4,
			data = new Float32Array(newSize);

		var xOri = this.cropOrigin[0],//Math.floor( (this.cropOrigin[0] / canvas_width) * w),
			yOri = this.cropOrigin[1];//Math.floor( (this.cropOrigin[1] / canvas_height) * h);

		var xEnd = xOri + cropWidth,
			yEnd = yOri + cropHeight;

		var k = 0;

		for(var i = 0; i < size; i+=4)
		{
			var x = (i/4 % w);
			var y = (i/4 / w);
			y = Math.floor(y);
			// flip y 
			y = h - y;

			if(x < xOri || x >= xEnd || y < yOri || y >= yEnd)
				continue;
			
			var index = i;

			data[k] = pixelData[index];
			data[k+1] = pixelData[index+1];
			data[k+2] = pixelData[index+2];
			data[k+3] = pixelData[index+3];
			k += 4;
		}

		this.generateCropped(cropWidth, cropHeight, data);
		this.resetCrop();
	},

	resetCrop: function()
	{
		this.cropSize[0] = this.cropSize[1] = this.cropOrigin[0] = this.cropOrigin[1] = 0;
		this.cropFocus = false;
		this.updateArea();
	},

	generateCropped: function(w, h, data, tex)
	{
		Texture.setUploadOptions( {no_flip: true} );
		var cropped = new GL.Texture( w, h, { pixel_data: data, type: GL.FLOAT, format: GL.RGBA} );
		Texture.setUploadOptions();

		if(!data && tex)
			cropped.drawTo( function() {
				renderer.clear( CORE._background_color );
				Object.assign( renderer._uniforms, HDRTool.getUniforms() );
				tex.toViewport();
			});

		var mipmaps_cropped = new GL.Texture( nearestPowerOfTwo(w), nearestPowerOfTwo(h), { type: GL.FLOAT, format: GL.RGBA, minFilter: GL.LINEAR_MIPMAP_LINEAR} );

		mipmaps_cropped.drawTo( function() {
			renderer.clear( CORE._background_color );
			Object.assign( renderer._uniforms, HDRTool.getUniforms() );
			cropped.toViewport();
		});

		mipmaps_cropped.bind(0);
		gl.generateMipmap(gl.TEXTURE_2D);
		mipmaps_cropped.unbind();

		gl.textures["CROPPED"] = cropped;
		gl.textures["CROPPED_MIP"] = mipmaps_cropped;
	},

	toCubemap: async function()
	{
		var cropped = gl.textures["CROPPED"];

		if(!cropped) {
			this.selectAll();
			this.updateArea();
			cropped = gl.textures["CROPPED"];
		}

		var cropped_mip = gl.textures["CROPPED_MIP"];
		var pre_cubemap = new GL.Texture( cropped.width, cropped.height, { type: GL.FLOAT, format: GL.RGBA} );
		
		// texture properties
        pre_cubemap.wrapS = gl.CLAMP_TO_EDGE;
        pre_cubemap.wrapT = gl.CLAMP_TO_EDGE;

		var size = 512;
		RM.shader_macros['EM_SIZE'] = size;
		await CORE.reloadShaders();

		pre_cubemap.drawTo( function() {

			var uniforms = {
				//u_is_cropped: true,
				u_texture_mip: 1
			};
			
			// Object.assign(uniforms, renderer._uniforms );

			var tm = "None";//RM.Get("ScreenFX").tonemapping;

			/*for(param in RM.tonemappers[tm].params)
				uniforms[param] = RM.tonemappers[tm].params[param].value;*/

			cropped_mip.bind(1);
			cropped.toViewport(tm === "None" ? null : new Shader(GL.Shader.SCREEN_VERTEX_SHADER, gl.shaders[tm].fs_shader), uniforms);
			cropped_mip.unbind();
		});

		gl.textures["TONEMAPPED"] = pre_cubemap; 
		
		var temp = HDRTool.toCubemap(pre_cubemap, size);
		gl.textures["@environment_CROPPED"] = temp; 

		HDRTool.prefilter(temp, {name: "@environment_CROPPED", oncomplete: function(){
		
			$("#maintab").click();
			CORE.set("@environment_CROPPED");

		}});
	}

};

Object.defineProperty(HDRI, 'restrictProportions', {
	
	get: function() { return this._restrictProportions; },
    set: function(v) { 
		this._restrictProportions = v; 
		this.cropSize[1] = this.cropSize[0];
		HDRI.updateArea();
	},
    enumerable: true

});