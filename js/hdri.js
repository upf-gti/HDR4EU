// HDR imaging component for the app

/* 

It has to be responsible for 

- HDRI GUI (not for now)
- HDRI Render calls

*/

var HDRI = {

	core: null, 
	ctx: null,
	canvas: null,

	cropOrigin: [0, 0],
	cropSize: [0, 0],

	restrictProportions: false,

	init: function(core, gl)
	{
		this.core = core;

		this.canvas = gl.canvas;

		enableWebGLCanvas( this.canvas );

		this.dragscale = new DragAndScale();
        this.dragscale.max_scale = 64;
		this.dragscale.min_scale = 0.1;

		var that = this;

		this.originCaptured = false;
		this.cropFocus = false;
		this.shifting = false;
		this.resizing = false;
		this.currentSpot = -1;

		this.shader = new GL.Shader( GL.Shader.QUAD_VERTEX_SHADER, gl.shaders["assemblyQuadViewer"].fs_shader );
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
		gui.assemblyarea.split("horizontal",[null,350],true);
		gui.assemblyarea.onresize = function(){ resize() };
		var docked = new LiteGUI.Panel("hdri_right_panel", {title:'HDRI View', scroll: true});
		gui.assemblyarea.getSection(1).add( docked );
		$(docked).bind("closed", function() { gui.assemblyarea.merge(); });
		gui._hdri_sidepanel = docked;
		gui.assemblyarea.root.style.background = "#3D3D3D";

		var left = gui.assemblyarea.getSection(0);

		var id = "bottom_panel_dialog";
		var dialog_id = id.replace(" ", "-").toLowerCase();
		var bottom = new LiteGUI.Dialog( {id: dialog_id, title: "Resource drop", parent: gui.assemblyarea.getSection(0).content});

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

		gui._hdri_bottompanel = bottom;

		var widgets = new LiteGUI.Inspector();
		$(bottom.content).append(widgets.root);
		widgets.root.style.height = "100%";
		
		var panel_content = widgets.addContainer("content");
		panel_content.className = "low_panel_content";
		bottom.panel_content = panel_content;
		// panel_content.style.overflow = "hidden";
		// panel_content.style.overflowX = "scroll";

		this.updateArea(true);
	},

	updateArea: function(update_thb)
	{
		var right = gui._hdri_sidepanel;
		var bottom = gui._hdri_bottompanel;
		var that = this;
		
		// empty containers
		$(right.content).empty();

		if(update_thb)
			$(bottom.panel_content).empty();

		// right
		var widgets = new LiteGUI.Inspector();
		$(right.content).append(widgets.root);
		
		if(gl.textures["CROPPED"])
		{
			widgets.addSection("Tonemapping");

			var SFX = RM.get("ScreenFX");
			var tonemapper_names = Object.keys(RM.tonemappers).filter((v)=> RM.tonemappers[v].assembling); // get only those who are prepared to use with assembling;
			var name = SFX.tonemapping = "ExponentialHDRI";
			var tonemapper = RM.tonemappers[ name ];

			widgets.addCombo(null, name, {values: ["ExponentialHDRI"]/*.concat(tonemapper_names)*/, callback: function(v){
				SFX.tonemapping = v;
				that.updateArea();
			}});
			
			if(tonemapper && tonemapper.params)
				for( let p in tonemapper.params ) // important let!!
				{
					var tm = tonemapper.params[p];
					var options = tm.options || {};

					CORE.setUniform(p, tm.value); 

					widgets.addSlider(p, tm.value, {min:options.min || 0,max:options.max||1,step:options.step||0.1, callback: function(v) {  
						CORE.setUniform(p, v); 
						tonemapper.setParam(p, v);
					}});
				}

			widgets.addSeparator();
		}


		widgets.widgets_per_row = 1;
		widgets.addInfo("Create HDR from sequence", null, {name_width: "100%"});
		widgets.addButton(null, "Assemble", {callback: function(){ 

			if(!HDRTool.files_loaded.length)
			{
				console.error("no files loaded");
				return;
			}

			HDRTool.assembleHDR();
			that.updateArea();
		 }});

		widgets.addSeparator();
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
		widgets.widgets_per_row = 1;

		widgets.addSeparator();
		widgets.addInfo("Use result as a 3D environment", null, {name_width: "100%"});
		widgets.addButton(null, "Export", {callback: function(){ 
		
			// CORE.set("CROPPED");

			that.toCubemap();
			 
		}});

		widgets.widgets_per_row = 1;

		// bottom
		if(!update_thb)
			return;

		widgets = new LiteGUI.Inspector();
		$(bottom.panel_content).append(widgets.root);
		widgets.root.style.height = "100%";

		var image_content = widgets.addContainer("images");
		image_content.className = "low_panel_images";

		// add images loaded

		var images = HDRTool.files_loaded;

		for(var i = 0; i < images.length; i++)
			image_content.appendChild( gui._generateLDRIThumb(images[i]) );
		
		if(!images.length)
		return;

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
				that.updateArea(true);
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

			that.updateArea(true);

		});
	},

	onmouseup: function()
	{
		if(this.originCaptured)
			this.cropFocus = true;

		
		// be careful with negative sizes
		if(this.cropSize[0] < 0) {
			this.cropSize[0] *= -1;
			this.cropOrigin[0] -= this.cropSize[0];
		}

		if(this.cropSize[1] < 0) {
			this.cropSize[1] *= -1;
			this.cropOrigin[1] -= this.cropSize[1];
		}
		
		
		this.originCaptured = false;
		this.resizing = false;
		this.currentSpot = -1;

		this.updateArea();
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

	toOffset: function(x, y, withSpot)
	{
		var mouse = [x, y]; // this.dragscale.last_mouse;
		var spotSize = parseInt(this.texture.width/150);

		
		if(withSpot)
			mouse = [x + spotSize, y + spotSize];

		var offsetx = (gl.canvas.width - this.texture.width) * 0.5;
		var offsety = (gl.canvas.height - this.texture.height) * 0.5;
		var local = this.dragscale.convertCanvasToOffset([ mouse[0] - offsetx * this.dragscale.scale, mouse[1] - offsety * this.dragscale.scale] );
		
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

		ctx.beginPath();
		ctx.arc(posx, posy, size * 1.1, 0, 2 * Math.PI, false);
		if(!filled)
			ctx.stroke();
		else
			ctx.fill();

		ctx.fillStyle = "rgb(85, 170, 255)";

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
		
		var spotSize = parseInt(this.texture.width/160);// / this.dragscale.scale;
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
		var mouse = this.dragscale.last_mouse;
		
		is_inside = false;

		var rect = canvas.parentNode.getBoundingClientRect();
		canvas.width = rect.width;
		canvas.height = rect.height;
		gl.viewport(0,0,canvas.width,canvas.height);
		gl.clearColor(0.2,0.2,0.2,1);
		gl.clear( gl.COLOR_BUFFER_BIT );
		
		this.texture = gl.textures["CROPPED"] || gl.textures["ASSEMBLED"];
		// Object.assign( renderer._uniforms, HDRTool.getUniforms() );

		if(0)
		{
			if(gl.textures["ASSEMBLED"]) {
			
				core._viewport_tex.drawTo( function() {
					
					//renderer.clear( core._background_color );
					Object.assign( renderer._uniforms, HDRTool.getUniforms() );
					
					if(gl.textures["CROPPED"])
						gl.textures["CROPPED"].toViewport( gl.shaders["assemblyViewer"], renderer._uniforms  );
					else
						gl.textures["ASSEMBLED"].toViewport( gl.shaders["assemblyViewer"], renderer._uniforms  );
				});

				this.texture = core._viewport_tex;
			}
				
			var SFXComponent = RM.get("ScreenFX");

			if(SFXComponent && gl.textures["ASSEMBLED"]) {
				var myToneMapper = RM.tonemappers[ SFXComponent.tonemapping ];
				myToneMapper.apply( gl.textures["ASSEMBLED"], core._fx_tex ); 
				
				if(gl.textures["ASSEMBLED"] || gl.textures["CROPPED"])
					this.texture = core._fx_tex;
			}else{

				if(gl.textures["ASSEMBLED"] || gl.textures["CROPPED"])
				this.texture = core._viewport_tex;
			}
		}

		ctx.start2D();

		if(!this.texture)
		{
			ctx.font = "20px monospace";
			ctx.fillStyle = "white";
			ctx.fillText("Drag some LDR photos", canvas.width/2 - 120, canvas.height/2 - 50);
		}
		else
		{
            var offsetx = (gl.canvas.width - this.texture.width) * 0.5;
            var offsety = (gl.canvas.height - this.texture.height) * 0.5;
			var local = this.dragscale.convertCanvasToOffset([ mouse[0] - offsetx * this.dragscale.scale, mouse[1] - offsety * this.dragscale.scale] );
			var pixelx = (local[0]|0);
			var pixely = (local[1]|0);

			ctx.save();

			is_inside = pixelx >= 0 && pixelx < this.texture.width && pixely >= 0 && pixely < this.texture.height;
			this.dragscale.toCanvasContext( ctx );
            ctx.translate(offsetx, offsety);
			ctx.strokeStyle = "white";
			ctx.strokeRect(-2,-2, this.texture.width + 4, this.texture.height + 4);
			ctx.strokeRect(-1,-1, this.texture.width + 2, this.texture.height + 2);
			ctx.fillStyle = "white";
			gl.disable( gl.BLEND );

			var uniforms = {
				u_is_cropped: gl.textures["CROPPED"] ? true : false,
				u_texture_mip: 1
			};

			for(param in RM.tonemappers[RM.get("ScreenFX").tonemapping].params)
				uniforms[param] = RM.tonemappers[RM.get("ScreenFX").tonemapping].params[param].value;
			
			if(gl.textures["CROPPED_MIP"])
				gl.textures["CROPPED_MIP"].bind(1);
			ctx.drawImage( this.texture, 0,0, this.texture.width, this.texture.height, this.shader, uniforms);

			if(gl.textures["CROPPED_MIP"])
				gl.textures["CROPPED_MIP"].unbind();

			gl.enable( gl.BLEND );

			ctx.strokeStyle = "white";
			ctx.strokeRect(this.cropOrigin[0] , this.cropOrigin[1], this.cropSize[0], this.cropSize[1]);

			ctx.globalAlpha = 0.5;
			if(is_inside && this.shifting)
				this.renderGuides(pixelx, pixely, ctx);

			ctx.globalAlpha = 1;

			if(this.cropFocus)
				this.renderSpots(pixelx, pixely, ctx);

			ctx.font = parseInt(this.texture.width/40) + "px monospace";
			ctx.strokeStyle = "white";
			ctx.textAlign = "center";
			ctx.fillText( String(this.texture.width) + "px", this.texture.width * 0.5, - 12 );
			ctx.textAlign = "left";
			ctx.fillText( String(this.texture.height) + "px", this.texture.width + 6, this.texture.height * 0.5 );

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

		ctx.finish2D();

		// Render GUI
		core._gui.render();
		
	},

	resizeSection: function(selected_spot, dx, dy)
	{
		this.resizing = true;

		// left
		if(selected_spot == 3) {

			this.cropOrigin[0] += dx;
			
			

			/*if(this.cropOrigin[0] < 0) {
				// add rest of pixels before setting to 0
				this.cropSize[0] -= this.cropOrigin[0]; 
				this.cropOrigin[0] = 0;
				return;
			}*/
			
			this.cropSize[0] -= dx;
		}
		
		// top
		else if(selected_spot == 1) {
			this.cropOrigin[1] += dy;

			/*if(this.cropOrigin[1] < 0) {
				this.cropSize[1] -= this.cropOrigin[1]; 
				this.cropOrigin[1] = 0;
				return;
			}*/

			this.cropSize[1] -= dy;
		}

		// right
		else if(selected_spot == 2) {
			this.cropSize[0] += dx;

			/*if(this.cropSize[0] + (this.texture.width - this.cropSize[0]) > this.texture.width) {
				this.cropOrigin[0] = 0;
				return;
			}*/
		}
		
		// bottom
		else if(selected_spot == 4)
			this.cropSize[1] += dy;

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

	toCubemap: function()
	{
		var texture = gl.textures["CROPPED"];

		var temp = HDRTool.toCubemap(texture, 256);
		gl.textures["@environment_CROPPED"] = temp;

		HDRTool.prefilter(temp, {name: "@environment_CROPPED", oncomplete: function(){
		
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