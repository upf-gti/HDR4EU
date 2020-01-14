// HDR imaging component for the app

/* 

It has to be responsible for 

- HDRI GUI (not for now)
- HDRI Render calls

*/

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

	init: function(core, gl)
	{
		console.time('HDRI init');
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

		this.assemble_mode = HDRI.HDR_GPU;
		this.sort_type = "NORMAL";

		// console.timeEnd('HDRI init');
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
		gui.assemblyarea.split("horizontal",[null,350]);
		gui.assemblyarea.onresize = function(){ console.log("qefwef") };
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
		
		if(gl.textures["ASSEMBLED"])
		{
			widgets.addSection("Tonemapping");

			var SFX = RM.Get("ScreenFX");
			var tonemapper_names = Object.keys(RM.tonemappers).filter((v)=> RM.tonemappers[v].assembling); // get only those who are prepared to use with assembling;
			var name = SFX.tonemapping;
			var tonemapper = RM.tonemappers[ name ];

			widgets.addCombo(null, name, {values: ["None"].concat(tonemapper_names), callback: function(v){
				
				if(v !== "None")
					that.shader = gl.shaders[v];
				else
					that.shader = null;

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

		widgets.addSection("Create HDR from sequence");

		widgets.widgets_per_row = 1;
		//widgets.addInfo("Create HDR from sequence", null, {name_width: "100%"});

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
		} })

		widgets.addButton(null, "Assemble", {callback: function(){ 

			if(!HDRTool.files_loaded.length)
			{
				console.error("no files loaded");
				return;
			}

			switch(that.assemble_mode)
			{
				case HDRI.HDR_GPU:
					HDRTool.assembleHDR_HDRGPU();
				break;
				case HDRI.DEBEVEC:
					HDRTool.assembleHDR_DEBEVEC();
					break;
				case HDRI.IP4EC:
					console.log("to do");
					break;
			}

			RM.Get("ScreenFX").tonemapping = "None";
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

		widgets.widgets_per_row = 2;
		widgets.addButton(null, "Download", {callback: function(){ 
		
			var tex = that.texture;
			var png_texture = new Texture(tex.width, tex.height);
			png_texture.drawTo(function(){
			
				tex.toViewport();
			});

			HDRTool.downloadTexture(png_texture);
			 
		}});

		widgets.addButton(null, "Export", {callback: function(){ 
		
			// CORE.set("CROPPED");

			that.toCubemap();
			 
		}});

		// bottom
		if(!update_thb)
			return;

		widgets = new LiteGUI.Inspector();
		$(bottom.panel_content).append(widgets.root);
		widgets.root.style.height = "100%";

		widgets.widgets_per_row = 5;

		widgets.addFile("Image list", "", { callback: function(v){
		
				// read and parse exposures
				var fr = new FileReader();
				fr.onload = function(data){
					var text = data.currentTarget.result;
					var lines = text.split("\n");

					for(var i in lines)
					{
						let params = lines[i].split(" ");
						params = params.filter( function(e){ return e.length; } );

						if(!params.length || params[0] == "#")
							continue;

						var NAME = 0;
						var EXPOSURE = 1;
						var INV_SHUTTER_SPPED = 2;

						HDRTool.log_exposure_times.push(parseFloat( params[ EXPOSURE ] ));
					}

					console.log(HDRTool.log_exposure_times);

				}

				fr.readAsText(v);
		} });
		
		widgets.addButton(null, "Show exposure times", {width: "10%", callback: function(){
		
			var times = "";
			for(var i in HDRTool.log_exposure_times)
				times += HDRTool.log_exposure_times[i] + " ";
			LiteGUI.alert(times, {title: "Exposure times"});
		}});

		widgets.addCombo("Sort", this.sort_type, {values: ["NORMAL", "INVERSE"], callback: function(v){
				
				var sort_higher = (v === "INVERSE") ? true : false;
				

				HDRTool._sortFiles(sort_higher);
				that.sort_type = v;
				that.updateArea(true);
		}});

		widgets.widgets_per_row = 1;

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

	onDrag: function(e, file, extension, name)
	{
		gui.loading();
		HDRTool.files_to_load = e.dataTransfer.files.length;
		HDRTool.files_loaded.length = 0;
		HDRTool.loadLDRI( file, extension, name, function(){
			HDRI.updateArea(true);
			gui.loading(0);
		} );
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
		if(!this.texture)
			return;

		var mouse = (x.constructor === Float32Array) ? x : [x, y]; // this.dragscale.last_mouse;
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
		//this.renderCircle(3, this.cropOrigin[0], this.cropOrigin[1] + this.cropSize[1] / 2, spotSize, true, ctx);
		//this.renderCircle(1, this.cropOrigin[0] + this.cropSize[0] / 2, this.cropOrigin[1], spotSize, true, ctx);

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

		if(!this.shader)
			this.shader = gl.shaders[RM.Get("ScreenFX").tonemapping];
		
		is_inside = false;

		var rect = canvas.parentNode.getBoundingClientRect();
		canvas.width = rect.width;
		canvas.height = rect.height;
		gl.viewport(0,0,canvas.width,canvas.height);
		gl.clearColor(0.2,0.2,0.2,1);
		gl.clear( gl.COLOR_BUFFER_BIT );
		
		this.texture = gl.textures["CROPPED"] || gl.textures["ASSEMBLED"];
		// Object.assign( renderer._uniforms, HDRTool.getUniforms() );

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
				//u_is_cropped: gl.textures["CROPPED"] ? true : false,
				u_texture_mip: 1
			};

			for(param in RM.tonemappers[RM.Get("ScreenFX").tonemapping].params)
				uniforms[param] = RM.tonemappers[RM.Get("ScreenFX").tonemapping].params[param].value;

			
			if(gl.textures["CROPPED_MIP"])
				gl.textures["CROPPED_MIP"].bind(1);
			else
				gl.textures["ASSEMBLED_MIP"].bind(1);

			ctx.drawImage( this.texture, 0,0, this.texture.width, this.texture.height, this.shader, uniforms);

			if(gl.textures["CROPPED_MIP"])
				gl.textures["CROPPED_MIP"].unbind();
			else
				gl.textures["ASSEMBLED_MIP"].unbind();

			gl.enable( gl.BLEND );

			ctx.strokeStyle = "white";
			ctx.strokeRect(this.cropOrigin[0] , this.cropOrigin[1], this.cropSize[0], this.cropSize[1]);

			ctx.globalAlpha = 0.6;
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

		// left // fix this
		/*if(selected_spot == 3) {

			var offset = this.toOffset(this.dragscale.last_mouse)[0];

			if(offset > 0){

				this.cropOrigin[0] += dx;
				this.cropSize[0] -= dx;
			}
			else{
				this.cropOrigin[0] = 0; // fix this
			}
			
		}*/
		
		// top // fix this
		/*else if(selected_spot == 1) {
			
			var offset = this.toOffset(this.dragscale.last_mouse)[1];

			if(offset < 0){
				this.cropOrigin[1] = 0; 
			}
			else{
				this.cropOrigin[1] += dy;
				this.cropSize[1] -= dy;
			}
		}*/

		// right
		if(selected_spot == 2) {
			
			var offset = this.toOffset(this.dragscale.last_mouse)[0];

			if(offset > this.texture.width)
				this.cropSize[0] = this.texture.width - this.cropOrigin[0]; // limit
			else
				this.cropSize[0] += dx;
		}
		
		// bottom
		else if(selected_spot == 4) {
		
			var offset = this.toOffset(this.dragscale.last_mouse)[1];

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

			var tm = RM.Get("ScreenFX").tonemapping;

			for(param in RM.tonemappers[tm].params)
				uniforms[param] = RM.tonemappers[tm].params[param].value;

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
			RM.Get("ScreenFX").tonemapping = "Exponential";

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