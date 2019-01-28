/*
*   Alex Rodríguez
*   @jxarco 
*/

var MAX_LUM_VALUES = [];
var LOG_MEAN_VALUES = [];
var SMOOTH_SHIFT = 50;

var identity_mat4 = mat4.create();
var temp_mat3 = mat3.create();
var temp_mat4 = mat4.create();
var temp_vec2 = vec2.create();
var temp_vec3 = vec3.create();
var temp_vec3b = vec3.create();
var temp_vec4 = vec4.create();
var temp_quat = quat.create();

function processDrop(e)
{
    e.preventDefault();
    var type = e.dataTransfer.getData("type");

    if(type == "text") {
        textInCanvas( e );
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
        valid_extensions = [ 'exr', 'hdre', 'png', 'jpg', 'obj', 'json' ];

        if(valid_extensions.lastIndexOf(extension) < 0)
        {
            LiteGUI.showMessage("Invalid file extension", {title: "Error"});
            return;
        }
        
        gui.onDragFile( file, extension );
    }
}

function textInCanvas(e)
{
    if(!e) return;

    var uniform = "u_" + e.dataTransfer.getData('uniform');
    console.log("Showing " + uniform);
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

async function resize()
{
    if(!renderer)
    throw("no renderer: cannot set new dimensions");

    if(!camera)
    throw("no camera: cannot apply new perspective");

    var w = window.innerWidth, h = window.innerHeight;

    if(gui)
    {
        w = gui._mainarea.root.clientWidth - gui._sidepanel.root.clientWidth - 4;
		h = gui._mainarea.root.clientHeight;
    }

    renderer.canvas.height = h;
    renderer.canvas.width = w;
    renderer.context.viewport(0, 0, w, h);

    // change viewport texture properties
    CORE._viewport_tex = new GL.Texture(w,h, { texture_type: GL.TEXTURE_2D, type: gl.FLOAT, minFilter: gl.LINEAR, magFilter: gl.LINEAR });

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

// https://github.com/jagenjo/litegraph.js/blob/master/src/nodes/gltextures.js @jagenjo 

/*
	Down sample frame and get average 
*/
function downsampled_getaverage( input )
{
	// check browser compatibility 
	if (CORE && CORE.browser == 'safari')
		throw( 'using safari' );

    if(!input)
        input = CORE._viewport_tex || null;
	
	if(!input)
		throw('no valid input');

    var temp = null;
    var type = gl.FLOAT;

	var input_width = input.width;
	var input_height = input.height;
		
	var mipmap_level = 2;

	var size = Math.pow(2, Math.floor(Math.log(input_width)/Math.log(2))) / Math.pow(2, mipmap_level);
	size = 256;

	var shader = gl.shaders['luminance'];

	if(!shader)
		throw("no luminance shader");

	if(!temp || temp.type != type )
		temp = new GL.Texture( size, size, { type: type, format: gl.RGBA, minFilter: gl.LINEAR_MIPMAP_LINEAR });

	temp.drawTo(function(){
		input.toViewport();
	});

	temp.bind(0);
	gl.generateMipmap(gl.TEXTURE_2D);
	temp.unbind(0);

	var pixelColor = new GL.Texture( 1, 1, { type: type, format: gl.RGBA, filter: gl.NEAREST });

	var properties = { mipmap_offset: 0, low_precision: false };
	var uniforms = { u_mipmap_offset: properties.mipmap_offset };

	pixelColor.drawTo(function(){
		temp.toViewport( shader, uniforms );
	});

	var pixel = pixelColor.getPixels();
	if(pixel)
	{
		var v = new Float32Array(4);
		var type = temp.type;
		v.set( pixel );
		if(type == gl.UNSIGNED_BYTE)
			vec4.scale( v,v, 1/255 );
		else if(type == GL.HALF_FLOAT || type == GL.HALF_FLOAT_OES)
			vec4.scale( v,v, 1/(255*255) ); //is this correct?

		if(!CORE)
		return;

		var logMean = Math.exp( v[0] );
		LOG_MEAN_VALUES.push( logMean );

		var k = LOG_MEAN_VALUES.length;

		if(k > SMOOTH_SHIFT)
		LOG_MEAN_VALUES.shift();

		var smooth_logmean = LOG_MEAN_VALUES.reduce( function(e, r){ return e + r } ) / k;
		CORE.setUniform('logMean', smooth_logmean);
	}

}

/*
	Frame per blocks and get max
*/
function perblock_getmax( input )
{
	// check browser compatibility 
	if (CORE && CORE.browser == 'safari')
		throw( 'using safari' );

    if(!input)
        input = CORE._viewport_tex || null;
	
	if(!input)
		throw('no valid input');

    var temp = null;
    var type = gl.FLOAT;

	var input_width = input.width;
	var input_height = input.height;
	var blockSize = 16;

	var shader = gl.shaders['maxLum'];

	if(!shader)
		throw("no max luminance shader");

	if(!temp || temp.type != type )
		temp = new GL.Texture( 1, 1, { type: type, format: gl.RGBA, filter: gl.NEAREST });

	var uniforms = {};

	temp.drawTo(function(){
		input.toViewport(shader, uniforms);
	});

	var pixel = temp.getPixels();
	if(pixel)
	{	
		var v = new Float32Array(4);
		var type = temp.type;
		v.set( pixel );
		if(type == gl.UNSIGNED_BYTE)
			vec4.scale( v,v, 1/255 );
		else if(type == GL.HALF_FLOAT || type == GL.HALF_FLOAT_OES)
			vec4.scale( v,v, 1/(255*255) ); //is this correct?

		if(!CORE)
		return;

		var maxLum = v[0];			
		MAX_LUM_VALUES.push( maxLum );

		var k = MAX_LUM_VALUES.length;

		if(k > SMOOTH_SHIFT)
		MAX_LUM_VALUES.shift();
	
		var smooth_maxlum = MAX_LUM_VALUES.reduce( function(e, r){ return e + r } ) / k;
        CORE.setUniform('maxLum', smooth_maxlum);
	}

}

function info_check()
{
    var SFXComponent = RM.get('ScreenFX');

    if(!SFXComponent || !SFXComponent.tonemapping)
        return false;

	var myToneMapper = RM.tonemappers[ SFXComponent.tonemapping ];
	var fs = myToneMapper.constructor.Uniforms; // declared uniforms

	if (fs.includes('u_maxLum') || fs.includes('u_logMean'))
	{
		return true;
	}

	return false;
}

function size( object )
{
   return Object.keys(object).length;
}