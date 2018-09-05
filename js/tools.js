/*
*   Alex Rodríguez
*   @jxarco 
*/

/*
    Precalculate first PBR sum for different roughness values 
*/
function PREFILTER_EM( file, options )
{
    var tex_name = getTexName( file );
    var tex = renderer.textures[tex_name];
    
    var f = function(tex)
    {
        var roughness_range = [0.2, 0.4, 0.6, 0.8, 1];
        var aux_tex = tex.clone();

        // prefilter texture 5 times to get some blurred samples
        for( var i = 0; i < roughness_range.length; i++ )
        {
            // update roughness for prefilter sample
            let a = roughness_range[i];
            // prefilter
            var out = (irradiance_mode == EXRLoader.CONVO) ? applyBlur( aux_tex, null, {roughness: 0.4} ) : applyBlur( tex, null, {roughness: a} )
            // store
            var out_name = "_prem_"+i+"_" + tex_name;
            renderer.textures[ out_name ] = out;

            aux_tex = out.clone();
        }

        if(options.callback)
            options.callback();
    }

    if(!tex)
    {
        console.warn("No texture. Loading file ["+file+"]");
        loadEXRTexture( file, options, f );        
    }
    else
        f( tex );
}

/*
    Environment BRDF (Store it in a 2D LUT)
*/
function Integrate_BRDF_EM( callback )
{
    var tex_name = '_brdf_integrator';
    var tex = renderer.textures[tex_name];
    
    if(!tex)
        tex = new GL.Texture(512,512, { texture_type: gl.TEXTURE_2D, minFilter: gl.NEAREST, magFilter: gl.LINEAR });

    var f = function()
    {
        tex.drawTo(function(texture, face) {
            renderer.shaders['brdfIntegrator'].uniforms({}).draw(Mesh.getScreenQuad(), gl.TRIANGLES);
            return;
        });
    
        renderer.textures[tex_name] = tex;
        window.aux = tex;

        // update node uniforms 
        model.textures['brdf'] = "_brdf_integrator";
        
        if(callback)
            callback();
    };
    
    if(!renderer.shaders['brdfIntegrator'])
        renderer.loadShaders("data/shaders.glsl", f, default_shader_macros);

    else
        f();
    
}

/*
    read exr file and run the EXRLoader
*/
function loadEXRTexture( file, options, callback)
{

    options = options || {};

    var onread = function( buffer, options )
    {
        options = options || {};
        tex_name = tex_name || options.filename;

        t1 = getTime();

        // delete memory
        for(var t in gl.textures)
            if(t.includes(".exr"))
            delete gl.textures[t];
        //

        var texture = null;
        var texData = loader.parse(buffer),
            texParams = loader.getTextureParams(texData);

        if(options.to_texture2D)
            texParams.to_texture2D = true;
        texture = loader.generateTex(texParams, options.to_cubemap);

       if(options.to_texture2D)
            renderer.textures["_2D_"+tex_name] = texture;
        else
            renderer.textures[tex_name] = texture;
        
        t2 = getTime();
        t = Math.round(t2-t1);
        console.warn( "Texture [" + tex_name + "] parsed in: " + t + "ms" );

        if(callback)
            callback(texture);
    }

    if(options.data){
        onread(options.data, options, callback);
        return;
    }

    var tex_name = getTexName( file );
    var xhr = new XMLHttpRequest();
    xhr.open( "GET", file, true );
    xhr.responseType = "arraybuffer";

    xhr.onload = function( e ) {
        onread( this.response, options, callback );
    };

    xhr.send();
}

/*
    
*/
function applyBlur( tex, output, options )
{
  var size = tex.height || 512;
  options = options || {};

  var roughness = options.roughness || 0.0;

  //save state
  var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
  var viewport = gl.getViewport();

  var fb = gl.createFramebuffer();
  gl.bindFramebuffer( gl.FRAMEBUFFER, fb );
  gl.viewport(0,0, size, size);

  var shader = renderer.shaders["cubemapBlur"];
  tex.bind(0);
  var mesh = Mesh.getScreenQuad();
  mesh.bindBuffers( shader );
  shader.bind();

  //Texture.setUploadOptions( EXRLoader.cubemap_upload_options );

  var result = output;
  if(!output)
          result = new GL.Texture( size, size, { format: tex.format, texture_type: GL.TEXTURE_CUBE_MAP, type: gl.FLOAT } );

  var rot_matrix = GL.temp_mat3;
  var cams = GL.Texture.cubemap_camera_parameters;

  for(var i = 0; i < 6; i++)
  {
      gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, result.handler, 0);
      var face_info = cams[i];

      mat3.identity( rot_matrix );
      rot_matrix.set( face_info.right, 0 );
      rot_matrix.set( face_info.up, 3 );
      rot_matrix.set( face_info.dir, 6 );

      var uniforms = {
                      'u_rotation': rot_matrix,
                      'u_roughness': roughness
                  };

      shader.uniforms( uniforms );
      gl.drawArrays( gl.TRIANGLES, 0, 6 );
  }

  mesh.unbindBuffers( shader );

  //restore previous state
  gl.setViewport(viewport); //restore viewport
  gl.bindFramebuffer( gl.FRAMEBUFFER, current_fbo ); //restore fbo
  gl.bindTexture(result.texture_type, null); //disable

  return result;
}

/*
    
*/
function renderFPS( enable )
{
    var e = (enable == null) ? params_gui['Show FPS'] : enable;
    var now = getTime();
	var elapsed = now - window.last_time;

	window.frames++;

	if(elapsed > window.refresh_time)
	{
        window.last_fps = window.frames;
        $("#fps").html( window.last_fps * (1000 / window.refresh_time) + " FPS");
		window.frames = 0;
        window.last_time = now;
    }
    
    if(e)
        $("#fps").show();
    else
        $("#fps").hide();
}

/*
    Download texture
*/
function downloadTex( name )
{
    var tex = renderer.textures[name];
    if(!tex)
        return;
    
    var canvas = tex.toCanvas();
    var a = document.createElement("a");
    a.download = name + ".png";
    a.href = canvas.toDataURL();
    a.title = "Download file";
    a.appendChild(canvas);
    var new_window = window.open();
    new_window.document.title.innerHTML = "Download texture";
    new_window.document.body.appendChild(a);
    new_window.focus();
}

/*
    Remove path to get only file name
*/
function getTexName( file )
{
    var tokens = file.split("/");
    return tokens[ tokens.length-1 ];
}

function tendTo(v, f)
{
    if(!f)
        return;

	if(v == null)
        v = 0;
        
	return (v * (1 - f) + v * f);
}

function resize()
{
    var w = window.innerWidth, h = window.innerHeight;
    renderer.canvas.height = h;
    renderer.canvas.width = w;
    renderer.context.viewport(0, 0, w, h);

    if(camera)
        camera.perspective(camera.fov, w / h, camera.near, camera.far);
}

function getQueryString() {
  // This function is anonymous, is executed immediately and 
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
}