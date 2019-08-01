/*
*   Alex Rodríguez
*   @jxarco 
*/

var MAX_LUM_VALUES = [];
var MEAN_LUM_VALUES = [];
var LOG_MEAN_VALUES = [];
var DTIMES = [];

var MAX_LFI = 60;

var SMOOTH_SHIFT = 200;
var SMOOTH_SCALE = 0.01;

var LAST_FRAME_INFO = {};

var identity_mat4 = mat4.create();
var temp_mat3 = mat3.create();
var temp_mat4 = mat4.create();
var temp_vec2 = vec2.create();
var temp_vec3 = vec3.create();
var temp_vec3b = vec3.create();
var temp_vec4 = vec4.create();
var temp_quat = quat.create();

function SET_TEXTURE(file)
{
		var reader = new FileReader();
        // reader.onprogress = function(e){ $("#xhr-load").css("width", parseFloat( (e.loaded)/e.total * 100 ) + "%") };
        reader.onload = async function (event) {
           
			var data = event.target.result;

			var texture = new GL.Texture(300, 200, {format: GL.RGB, type: GL.FLOAT, pixel_data: new Float32Array(data)});

			gl.textures["hdr_issues"] = texture;
        };

        reader.readAsArrayBuffer(file);
	
	
}

function processDrop(e)
{
    e.preventDefault();
    e.stopPropagation();

    var type = e.dataTransfer.getData("type");

    if(type == "text") {
        textInCanvas( e );
        return;
    }

	 if(type == "gui") {
        guiInCanvas( e );
        return;
    }

    if(!gui._allow_drop || !e.dataTransfer.files.length)
        return;

    for(var i = 0; i < e.dataTransfer.files.length; i++)
    {
        var files = ImporterModule.getFilesFromEvent(e), 
        file = files[i],
        name = file.name,
        tokens = name.split("."),
        extension = tokens[tokens.length-1].toLowerCase(),
        valid_extensions = [ 'exr', 'hdre', 'png', 'jpg', 'obj', 'wbin', 'json', 'hdrec', "cr2" ];

		// ADDON FOR TESTING IP4EC'S PAPER
		if(extension == "issues")
		{
			SET_TEXTURE(file);
			return;
		}
		//
		
        if(valid_extensions.lastIndexOf(extension) < 0)
        {
            LiteGUI.showMessage("Invalid file extension", {title: "Error"});
            return;
        }
        
        if(gui.editor == 1){
            
			gui.loading();
            HDRTool.files_to_load = e.dataTransfer.files.length;
            HDRTool.files_loaded.length = 0;
            HDRTool.loadLDRI( file, extension, name, function(){
				HDRI.updateArea(true);
				gui.loading(0);
			} );
        }
        else
            gui.onDragFile( file, extension, name );
    }
}

function textInCanvas(e)
{
    if(!e || !gui) return;

	var uniform = e.dataTransfer.getData('uniform');
	gui._uniform_list.push(uniform);
}

function guiInCanvas(e)
{
    if(!e || !gui) return;

	var name = e.dataTransfer.getData('component');
	let component = RM.get( name );

	component.mark = false;

	// crear dialogo y poner create() del component dentro
	var options = options || {};
	var that = this;

	var toSide = function()
	{
		dialog.close();
		component.mark = true;
		// update side panel
		gui.updateSidePanel(null, "root");
	}

    var id = name;
    var dialog_id = replaceAll(id, ' ', '').toLowerCase();
    var w = 350;
    var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", title: id, width: w, draggable: true, sided: true, sideCallback: toSide });
    dialog.show('fade');

	var widgets = new LiteGUI.Inspector();
	if(component.create)
		component.create(widgets);

	widgets.addButton(null, "Detach window", {callback: function(){
		dialog.detachWindow();
	}})

	dialog.add( widgets );
    dialog.setPosition( e.clientX, e.clientY );  

	// update side panel
	gui.updateSidePanel(null, "root");
}

function arrayBufferToBase64( buffer ) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}

function includes(str, find)
{
    find = [].concat(find);

    for(var i = 0; i < find.length; i++)
        if( str.toLowerCase().includes(find[i]) )
            return true;
}

var rtime;
var timeout = false;
var delta = 500;

$(window).resize(function() {
    rtime = new Date();
    if (timeout === false) {
        timeout = true;
        setTimeout(resizeend, delta);
    }
});

function resizeend() {
    if (new Date() - rtime < delta) {
        setTimeout(resizeend, delta);
    } else {
        timeout = false;
        resize()
    }               
}

async function resize( fullscreen )
{
   // console.log("resizing");
    if(!renderer)
    throw("no renderer: cannot set new dimensions");

    if(!camera)
    throw("no camera: cannot apply new perspective");

    var w = nearestPowerOfTwo(window.innerWidth), h = nearestPowerOfTwo(window.innerHeight);

    if(gui && !fullscreen)
    {
		switch(gui.editor){
		
			case 0:
				w = gui._mainarea.root.clientWidth - (gui._sidepanel ? gui._sidepanel.root.clientWidth - 4 : 0);
				h = gui._mainarea.root.clientHeight - 20;

				// resize sliders
				var sliders = document.querySelectorAll(".slider");

				for(var i = 0; i < sliders.length; i++)
					sliders[0].width = gui._sidepanel.root.offsetWidth;
				break;
			case 1:
				h = gui.assemblyarea.getSection(0).root.clientHeight - 20;
				w = gui.assemblyarea.getSection(0).root.clientWidth;
				break;
		}
    }

    renderer.canvas.width = w;
    renderer.canvas.height = h;
    renderer.context.viewport(0, 0, w, h);

	HDRI.resize(w, h);

    // change viewport texture properties
	CORE._viewport_tex = new GL.Texture(w,h, { texture_type: GL.TEXTURE_2D, type: gl.FLOAT, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
	CORE._fx_tex = new GL.Texture(w,h, { texture_type: GL.TEXTURE_2D, type: gl.FLOAT, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
	CORE.texture_linear_depth = new GL.Texture(w,h, { texture_type: GL.TEXTURE_2D, type: gl.FLOAT, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    camera.perspective(camera.fov, w / h, camera.near, camera.far);
	
	CORE.setUniform('viewport', gl.viewport_data);
	RM.shader_macros[ 'INPUT_TEX_WIDTH' ] = gl.viewport_data[2];
    RM.shader_macros[ 'INPUT_TEX_HEIGHT' ] = gl.viewport_data[3];
}

function guidGenerator( more ) {
    var S4 = function() {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4());
}

function simple_guidGenerator() {
    var S4 = function() {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+"-"+S4());
  }

    // editor.js at webglstudio @javiagenjo
function changeCameraDistance(dt, camera)
{
    if(!camera) throw('no camera');

	if(window.destination_eye === undefined)
		window.destination_eye = vec3.fromValues(camera.position[0], camera.position[1], camera.position[2]);

    //var eye = camera.position;
    var center = camera.target;
    var dist = vec3.sub( vec3.create(), window.destination_eye, center );
    vec3.scale( dist, dist, dt );

    if(camera.type == LS.Camera.ORTHOGRAPHIC)
        camera.frustum_size = vec3.length(dist);

    var new_eye = vec3.create();

    vec3.add( window.destination_eye, dist, center );
}

function orbitCamera (camera, yaw, pitch)
{
	var problem_angle = vec3.dot( camera.getFront(), camera.up );
	
	var center = camera._target;
	var right = camera.getLocalVector(LS.RIGHT);
	var up = camera.up;
	//var eye = window.destination_eye;

	if(window.destination_eye === undefined)
		window.destination_eye = vec3.fromValues(camera.position[0], camera.position[1], camera.position[2]);
	
	var dist = vec3.sub( vec3.create(), window.destination_eye, center );
	//yaw
	var R = quat.fromAxisAngle( up, -yaw );
	vec3.transformQuat( dist, dist, R );

	if( !(problem_angle > 0.99 && pitch > 0 || problem_angle < -0.99 && pitch < 0)) 
			quat.setAxisAngle( R, right, pitch );
	vec3.transformQuat(dist, dist, R );

	vec3.add(window.destination_eye, dist, center);
	//window.destination_eye = eye;
	camera._must_update_matrix = true;
}

  // litegl.js @javiagenjo
function getBBCorners(bb)
{
    var _corners = [ vec3.fromValues(1,1,1), vec3.fromValues(1,1,-1), vec3.fromValues(1,-1,1), vec3.fromValues(1,-1,-1), vec3.fromValues(-1,1,1), vec3.fromValues(-1,1,-1), vec3.fromValues(-1,-1,1), vec3.fromValues(-1,-1,-1) ];
    var center = BBox.getCenter(bb);
    var halfsize = BBox.getHalfsize(bb);

    for(var i = 0; i < 8; ++i)		
    {
        var corner = _corners[i];//corners.subarray(i*3, i*3+3);
        vec3.multiply( corner, halfsize, corner );
        vec3.add( corner, corner, center );
    }

    return _corners;
}


function downloadBinary ( mesh, format )
{
    var file = null;
    if(format == "wbin")
        file = mesh.encode("wbin");
    else
        file = mesh.encode("obj");
    
    var url = URL.createObjectURL( new Blob([file]) );
    var element = document.createElement("a");
    element.setAttribute('href', url);
    element.setAttribute('download', "mesh." + format );
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function lerp (start, end, amt){
  return (1-amt)*start+amt*end;
}

function nearestMult(num, mult) 
{ 
    var rem = num % mult; 
    return rem >= 5 ? (num - rem + mult) : (num - rem); 
} 

function nearestPowerOfTwo(v)
{
	v -= 1;
	v |= v >> 1;
	v |= v >> 2;
	v |= v >> 4;
	v |= v >> 8;
	v |= v >> 16;
	v += 1;
	return v;
}

function tendTo(v, f)
{
    if(!f)
        return;

	if(v == null)
        v = 0;
        
	return (v * (1 - f) + v * f);
}

var QueryString = function() {
    // the return value is assigned to QueryString!
    var query_string = {};
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i=0;i<vars.length;i++) {
      var pair = vars[i].split("=");
          // If first entry with this name
      if (typeof query_string[pair[0]] === "undefined") {
        query_string[pair[0]] = decodeURIComponent(pair[1]);
          // If second entry with this name
      } else if (typeof query_string[pair[0]] === "string") {
        var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
        query_string[pair[0]] = arr;
          // If third or later entry with this name
      } else {
        query_string[pair[0]].push(decodeURIComponent(pair[1]));
      }
    } 
      return query_string;
  }();

// (importer.js @javiagenjo at webglstudio.org)
function getFilesFromEvent( e, options )
{
    var files = [];
    var that = this;

    //first the files
    for(var i=0; i < e.dataTransfer.files.length; i++)
    {
        var file = e.dataTransfer.files[i];
        if(!file.size)
            continue; //folders are files with 0 size
        files.push( file );
    }

    //then the items (they may be folders)
    for(var i=0; i < e.dataTransfer.items.length; i++)
    {
        var item = e.dataTransfer.items[i];
        var func = item.webkitGetAsEntry || item.mozGetAsEntry || item.getAsEntry; //experimental
        if(!func)
            break;
        var entry = func.call( item );
        if(!entry || !entry.isDirectory)
            continue; //not a folder
        traverseFileTree(entry);
    }

    function traverseFileTree( item, path ) {
        path = path || "";
        if (item.isFile) {
            // Get file
            item.file(function(file) {
                //files.push( file );
                that.processFileList([file],options,true);
            });
        } else if (item.isDirectory) {
            // Get folder contents
            var dirReader = item.createReader();
            dirReader.readEntries(function(entries) {
                for (var i=0; i<entries.length; i++) {
                    traverseFileTree(entries[i], path + item.name + "/");
                }
            });
        }
    }

    return files;
}

function getDate()
{
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1; //January is 0!
    var h = today.getHours();
    var mins = today.getMinutes();

    if(dd<10) dd = '0'+dd
    if(mm<10) mm = '0'+mm
    if(h<10) h = '0'+h
    if(mins<10) mins = '0'+mins

    today = h+'a'+mins;
    return today;
}

function getDiffTexture( textureA, textureB, options) {

	textureA = textureA.constructor === String ? gl.textures[textureA] : textureA;
	textureB = textureB.constructor === String ? gl.textures[textureB] : textureB;

	if(!textureA || !textureB)
		throw("texture missing");

	var width = textureA.width;
	var height = textureA.height;
	var temp = new Texture( width, height, {type: textureA.type, texture_type: GL.TEXTURE_CUBE_MAP} );
	var shader = gl.shaders["diffCubemap"];
	
	//save state
	var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
	var viewport = gl.getViewport();
	var fb = gl.createFramebuffer();
	gl.bindFramebuffer( gl.FRAMEBUFFER, fb );
	gl.viewport(0,0, width, height);

	var mesh = Mesh.getScreenQuad();
	
	// Bind original texture
	textureA.bind(0);
	textureB.bind(1);
	mesh.bindBuffers( shader );
	shader.bind();

	var rot_matrix = GL.temp_mat3;
	var cams = GL.Texture.cubemap_camera_parameters;

	for(var i = 0; i < 6; i++)
	{
		gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, temp.handler, 0);
		var face_info = cams[i];

		mat3.identity( rot_matrix );
		rot_matrix.set( face_info.right, 0 );
		rot_matrix.set( face_info.up, 3 );
		rot_matrix.set( face_info.dir, 6 );
		shader._setUniform( "u_rotation", rot_matrix );
		shader._setUniform( "u_color_texture0", 0);
		shader._setUniform( "u_color_texture1", 1);
		shader._setUniform( "u_scale", options.scale);
		gl.drawArrays( gl.TRIANGLES, 0, 6 );
	}

	mesh.unbindBuffers( shader );
	//restore previous state
	gl.setViewport(viewport); //restore viewport
	gl.bindFramebuffer( gl.FRAMEBUFFER, current_fbo ); //restore fbo
	gl.bindTexture(temp.texture_type, null); //disable

	textureA.unbind();
	textureB.unbind();

	gl.textures["diffTex"] = temp;
	return temp;
}


// glow effect (litegraph.js @javiagenjo) (https://github.com/jagenjo/litegraph.js/blob/master/src/nodes/gltextures.js )
function createGlow( tex, options )
{
    if(!tex || !gl.shaders["glow"])
        return;	

	var SFXComponent = RM.get('ScreenFX');

    options = options || {
        iterations: SFXComponent.glow_iterations,
        threshold: SFXComponent.glow_threshold,
        intensity: SFXComponent.glow_intensity
    };

    var LGraphTextureGlow = LiteGraph.Nodes.LGraphTextureGlow;
    var properties = {
        intensity: options.intensity || 1,
        persistence: options.persistence || 0.99,
        iterations: options.iterations == undefined ? 8 : options.iterations,
        threshold: options.threshold == undefined ? 1 : options.threshold,
        scale: options.scale || 1,
        precision: options.precision || LGraphTexture.DEFAULT
    };

    var width = tex.width;
    var height = tex.height;

    var texture_info = { format: tex.format, type: tex.type, minFilter: GL.LINEAR, magFilter: GL.LINEAR, wrap: gl.CLAMP_TO_EDGE	};
    var type = LGraphTexture.getTextureType( properties.precision, tex );

    var uniforms = { u_intensity: 1, u_texture: 0, u_glow_texture: 1, u_threshold: 0, u_texel_size: vec2.create() };
    var textures = [];

    //cut
    var shader = LGraphTextureGlow._cut_shader;
    if(!shader)
        shader = LGraphTextureGlow._cut_shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphTextureGlow.cut_pixel_shader );

    gl.disable( gl.DEPTH_TEST );
    gl.disable( gl.BLEND );

    uniforms.u_threshold = properties.threshold;
    var currentDestination = textures[0] = GL.Texture.getTemporary( width, height, texture_info );
    tex.blit( currentDestination, shader.uniforms(uniforms) );
    var currentSource = currentDestination;

    var iterations = properties.iterations;
    iterations = Math.clamp( iterations, 1, 16) | 0;
    var texel_size = uniforms.u_texel_size;
    var intensity = properties.intensity;

    uniforms.u_intensity = 1;
    uniforms.u_delta = properties.scale; //1

    //downscale upscale shader
    var shader = LGraphTextureGlow._shader;
    if(!shader)
        shader = LGraphTextureGlow._shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphTextureGlow.scale_pixel_shader );

    var i = 1;
    //downscale
    for (;i < iterations; i++) {
        width = width>>1;
        if( (height|0) > 1 )
            height = height>>1;
        if( width < 2 )
            break;
        currentDestination = textures[i] = GL.Texture.getTemporary( width, height, texture_info );
        texel_size[0] = 1 / currentSource.width; texel_size[1] = 1 / currentSource.height;
        currentSource.blit( currentDestination, shader.uniforms(uniforms) );
        currentSource = currentDestination;
    }

    //average

    var average_texture = this._average_texture;
    if(!average_texture || average_texture.type != tex.type || average_texture.format != tex.format )
        average_texture = this._average_texture = new GL.Texture( 1, 1, { type: tex.type, format: tex.format, filter: gl.LINEAR });
    texel_size[0] = 1 / currentSource.width; texel_size[1] = 1 / currentSource.height;
    uniforms.u_intensity = intensity;
    uniforms.u_delta = 1;
    currentSource.blit( average_texture, shader.uniforms(uniforms) );
    window.average_texture = average_texture;// ?Â¿?Â¿?Â¿? 

    //upscale and blend 
    gl.enable( gl.BLEND );
    gl.blendFunc( gl.ONE, gl.ONE );
    uniforms.u_intensity = properties.intensity;
    uniforms.u_delta = 0.5;

    for (i -= 2; i >= 0; i--) // i-=2 =>  -1 to point to last element in array, -1 to go to texture above
    { 
        currentDestination = textures[i];
        textures[i] = null;
        texel_size[0] = 1 / currentSource.width; texel_size[1] = 1 / currentSource.height;
        currentSource.blit( currentDestination, shader.uniforms(uniforms) );
        GL.Texture.releaseTemporary( currentSource );
        currentSource = currentDestination;
    }
    gl.disable( gl.BLEND );

    //glow
    var glow_texture = this._glow_texture;
    if(!glow_texture || glow_texture.width != tex.width || glow_texture.height != tex.height || glow_texture.type != type || glow_texture.format != tex.format )
        glow_texture = this._glow_texture = new GL.Texture( tex.width,  tex.height, { type: type, format: tex.format, filter: gl.LINEAR });
    currentSource.blit( glow_texture );

    //final composition
    var final_texture = this._final_texture;
    if(!final_texture || final_texture.width != tex.width || final_texture.height != tex.height || final_texture.type != type || final_texture.format != tex.format )
        final_texture = this._final_texture = new GL.Texture( tex.width, tex.height, { type: type, format: tex.format, filter: gl.LINEAR });

    uniforms.u_intensity = intensity;

    shader = LGraphTextureGlow._final_shader = renderer.shaders["glow"]; 

    final_texture.drawTo( function(){
        tex.bind(0);
        currentSource.bind(1);
        shader.toViewport( uniforms );
    });
    GL.Texture.releaseTemporary( currentSource );

    return final_texture; // ?Â¿?Â¿?Â¿?
}

function info_check()
{
	// check browser compatibility 
	if (this.browser == 'safari') {
		console.warn( 'browser not supported' );
		return false;
	}

    var SFXComponent = RM.get('ScreenFX');

    if(!SFXComponent || !SFXComponent.tonemapping)
        return false;

	var myToneMapper = RM.tonemappers[ SFXComponent.tonemapping ];
	var fs = myToneMapper.constructor.Uniforms; // declared uniforms

	return [fs.includes('u_maxLum'), fs.includes('u_logMean')];
}

function size( object )
{
   return Object.keys(object).length;
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

	var element = this.createWidget(name,"<span class='inputfield button'><input type='text' tabIndex='"+this.tab_index+"' class='text string' value='"+ (value == "notfound" ? "" : value) +"' "+(options.disabled?"disabled":"")+"/></span><button title='show folders' class='micro'>"+(options.button || LiteGUI.special_codes.open_folder )+"</button>", options);

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

		if(!v.length && options.node) {
			
// 			options.node.textures[name] = "";

			var to_delete = options.node.textures[name];
			delete options.node.textures[name];
			delete gl.textures[to_delete]; // load texture saves this thing
			options.node.setTextureProperties();
			return;
		}

		if(v && v[0] != "@" && v[0] != ":" && !options.skip_load)
		{
			input.style.color = "#EA8";
			
			CORE._renderer.loadTexture(v, {}, function(t, n){

				if(!t) {
					input.style.color = error_color;
					return;
				}
	
				input.style.color = "";
                
				if(options.node)
					options.node.textures[name] = n;
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
		element.setIcon( "https://webglstudio.org/latest/imgs/mini-icon-texture.png" );
	
	//BUTTON select resource
	element.querySelector(".wcontent button").addEventListener( "click", function(e) { 

		gui.selectResource( options, name );
	});

	this.tab_index += 1;
    this.append(element, options);
    
	return element;
}

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

	var element = this.createWidget(name,"<span class='inputfield button'><input type='text' tabIndex='"+this.tab_index+"' class='text string' value='"+value+"' "+(options.disabled?"disabled":"")+"/></span><button title='show folders' class='micro'>"+(options.button || LiteGUI.special_codes.open_folder )+"</button>", options);

	//INPUT
	var input = element.querySelector(".wcontent input");

	//resource missing
	/*if(value && value.constructor === String && value[0] != ":" && value[0] != "@")
	{
		var res = gl.textures[ value ];
		if( !res )
			input.style.color = error_color;
		else if( res._modified )
			input.style.color = modified_color;
	}*/

	if( options.align && options.align == "right" )
		input.style.direction = "rtl";

	if( options.placeHolder )
		input.setAttribute( "placeHolder", options.placeHolder );
	else if(resource_classname)
		input.setAttribute( "placeHolder", resource_classname );

	input.addEventListener( "change", function(e) { 
		
		/*var v = e.target.value;
		if(v && v[0] != "@" && v[0] != ":" && !options.skip_load)
		{
			input.style.color = "#EA8";
			CORE._renderer.loadTexture(v, {}, function(t, name){
                input.style.color = "";
                
                if(!gl.textures[ v ])
			        input.style.color = error_color;
			});
        }

        if(!v || !gl.textures[ v ])
        input.style.color = error_color;*/
		
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
		element.setIcon( "https://webglstudio.org/latest/imgs/mini-icon-texture.png" );
	
	//BUTTON select resource
	element.querySelector(".wcontent button").addEventListener( "click", function(e) { 

		CORE.FS.getFiles( "hdre" ).then( function(e) { gui.selectHDRE( e, options ); } )
	});

	this.tab_index += 1;
    this.append(element, options);
    
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
		options.precision = 2;

	var that = this;
	if(value === undefined || value === null)
		value = 0;
	this.values[name] = value;

	var element = this.createWidget(name,"<span class='inputfield full'>\
				<input tabIndex='"+this.tab_index+"' type='text' class='slider-text fixed nano' value='"+value+"' /><span class='slider-container'></span></span>", options);

	var slider_container = element.querySelector(".slider-container");

	var slider = new LiteGUI.Slider(value,options);
	slider_container.appendChild(slider.root);

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

	//Slider change -> update Text
	slider.onChange = function(value) {
		text_input.value = value;
		Inspector.onWidgetChange.call( that, element, name, value, options);
	};

	this.append(element,options);

	element.setValue = function(v,skip_event) { 
		if(v === undefined)
			return;
		value = v;
		slider.setValue(v,skip_event);
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

	canvas.width = 350;
	canvas.height = 20;
	canvas.style.position = "relative";
	canvas.style.width = "100%";
	canvas.style.height = "1.2em";
	// canvas.height = (canvas.offsetWidth / canvas.offsetHeight) / 300;
	this.root = canvas;
	var that = this;
	this.value = value;

	this.setValue = function(value, skip_event)
	{
		/*if(canvas.parentNode)
			canvas.width = canvas.parentNode.offsetWidth - 15;*/

		//var width = canvas.getClientRects()[0].width;
		var ctx = canvas.getContext("2d");
		var min = options.min || 0.0;
		var max = options.max || 1.0;
		if(value < min) value = min;
		else if(value > max) value = max;
		var range = max - min;
		var norm = (value - min) / range;
		ctx.clearRect(0,0,canvas.width,canvas.height);
		ctx.fillStyle = "#999";
		ctx.fillRect(0,0, canvas.width * norm, canvas.height);
		ctx.fillStyle = "#DA2";
		ctx.fillRect(canvas.width * norm - 1,0,2, canvas.height);

		ctx.fillStyle = "#111";
		ctx.font = "bold 16px Arial";
		ctx.fillText(value.toFixed(options.precision), 12, 17);

		ctx.fillStyle = "#EEE";
		ctx.font = "bold 16px Arial";
		ctx.fillText(value.toFixed(options.precision), 10, 15);

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