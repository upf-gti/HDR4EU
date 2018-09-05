// glow effect (litegraph.js @javiagenjo)
function getGlowTexture( tex, options )
{
    if(!tex)
        return;	

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
    window.average_texture = average_texture;// ?¿?¿?¿? 

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

    return final_texture; // ?¿?¿?¿?
}

function getAverage(tex)
{
    if(!tex)
        return;

    var LGraphTextureAverage = LiteGraph.Nodes.LGraphTextureAverage;

    var properties = { mipmap_offset: 0, low_precision: false };
    var _uniforms = { u_texture: 0, u_mipmap_offset: properties.mipmap_offset };
	var _luminance = new Float32Array(4);

    if(!LGraphTextureAverage._shader)
    {
        LGraphTextureAverage._shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphTextureAverage.pixel_shader);
        //creates 32 random numbers and stores the, in two mat4 
        var samples = new Float32Array(32);
        for(var i = 0; i < 32; ++i)	
            samples[i] = Math.random();
        LGraphTextureAverage._shader.uniforms({u_samples_a: samples.subarray(0,16), u_samples_b: samples.subarray(16,32) });
    }

    var _temp_texture = null;
    var type = gl.UNSIGNED_BYTE;
    if(tex.type != type) //force floats, half floats cannot be read with gl.readPixels
        type = gl.FLOAT;

    if(!_temp_texture || temp.type != type )
        _temp_texture = new GL.Texture( 1, 1, { type: type, format: gl.RGBA, filter: gl.NEAREST });

    var shader = LGraphTextureAverage._shader;
    var uniforms = _uniforms;
    uniforms.u_mipmap_offset = 0.0; ///////
    _temp_texture.drawTo(function(){
        tex.toViewport( shader, uniforms );
    });

    var pixel = _temp_texture.getPixels();
    if(pixel)
    {
        var v = _luminance;
        var type = _temp_texture.type;
        v.set( pixel );
        if(type == gl.UNSIGNED_BYTE)
            vec4.scale( v,v, 1/255 );
        else if(type == GL.HALF_FLOAT || type == GL.HALF_FLOAT_OES)
            vec4.scale( v,v, 1/(255*255) ); //is this correct?

        var val = (v[0] + v[1] + v[2]) / 3;
        return Math.clamp(val, 0.2, 1.0);
    }
}

function drawDepthTexture()
{
    var tex_name = '_depth_texture';
    var texture = new GL.Texture(gl.canvas.width,gl.canvas.height, { format: gl.DEPTH_COMPONENT, type: gl.UNSIGNED_INT });

    gl.enable( gl.DEPTH_TEST );

    var cam = new RD.Camera();
    cam.perspective( 45, gl.canvas.width / gl.canvas.height, 0.5, 100000);
    cam.lookAt( camera._position, camera._target, camera._up );

    texture.drawTo(function() {
        renderer.clear(bg_color);
        gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

        renderer.render(scene, cam);
    });

    renderer.textures[tex_name] = texture;
}
