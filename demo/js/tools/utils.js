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

class uidGenerator {

	generate( large ){
		var S4 = function() {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
		};
		return (S4()+S4()+ (large ? "-"+S4()+"-"+S4()+"-"+S4() : "") );
	}
}

var uidGen = new uidGenerator();

var myMath = {

    /* From "Sampling with Hammersley and Halton Points" TT Wong
    * Appendix: Source Code 1 */
   radical_inverse(n)
   {
       var u = 0;

       /* This reverse the bitwise representation
       * around the decimal point. */
       for (var p = 0.5; n; p *= 0.5, n >>= 1) {
           if (n & 1) {
           u += p;
           }
       }

       return u;
    },

    lerp (start, end, amt)
    {
        return (1-amt)*start+amt*end;
    },

    nearestMult(num, mult) 
    { 
        var rem = num % mult; 
        return rem >= 5 ? (num - rem + mult) : (num - rem); 
    },

    nearestPowerOfTwo(v)
    {
        v -= 1;
        v |= v >> 1;
        v |= v >> 2;
        v |= v >> 4;
        v |= v >> 8;
        v |= v >> 16;
        v += 1;
        return v;
    },

    tendTo(v, f)
    {
        if(!f)
        return;

        if(v == null)
        v = 0;

        return (v * (1 - f) + v * f);
    }
}

var Tools =  {

    UTF8ArrayToString: function(u8Array, idx)
    {
        var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
        var endPtr = idx;
        while (u8Array[endPtr])
        ++endPtr;
        if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
            return UTF8Decoder.decode(u8Array.subarray(idx, endPtr))
        } else {
            var u0, u1, u2, u3, u4, u5;
            var str = "";
            while (1) {
                u0 = u8Array[idx++];
                if (!u0)
                return str;
                if (!(u0 & 128)) {
                    str += String.fromCharCode(u0);
                    continue
                }
                u1 = u8Array[idx++] & 63;
                if ((u0 & 224) == 192) {
                    str += String.fromCharCode((u0 & 31) << 6 | u1);
                    continue
                }
                u2 = u8Array[idx++] & 63;
                if ((u0 & 240) == 224) {
                    u0 = (u0 & 15) << 12 | u1 << 6 | u2
                } else {
                    u3 = u8Array[idx++] & 63;
                    if ((u0 & 248) == 240) {
                        u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u3
                    } else {
                        u4 = u8Array[idx++] & 63;
                        if ((u0 & 252) == 248) {
                            u0 = (u0 & 3) << 24 | u1 << 18 | u2 << 12 | u3 << 6 | u4
                        } else {
                            u5 = u8Array[idx++] & 63;
                            u0 = (u0 & 1) << 30 | u1 << 24 | u2 << 18 | u3 << 12 | u4 << 6 | u5
                        }
                    }
                }
                if (u0 < 65536) {
                    str += String.fromCharCode(u0)
                } else {
                    var ch = u0 - 65536;
                    str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
                }
            }
        }
    },

    BLI_hammersley_1d(n)
    {
        return myMath.radical_inverse(n);
    },

    create_hammersley_sample_texture(samples)
    {
        samples = samples || 8192;
        var size = samples * 3;
        var texels = new Float32Array(size);
    
        for (var i = 0; i < size; i+=3) {

            var dphi = Tools.BLI_hammersley_1d(i);
            var phi = dphi * 2.0 * Math.PI;
            texels[i] = Math.cos(phi);
            texels[i+1] = Math.sin(phi);
            texels[i+2] = 0;
        }

        return (gl.textures["hammersley_sample_texture"] = new Texture(samples, 1, {pixel_data: texels, type: GL.FLOAT, format: GL.RGB}));
    },

    arrayBufferToBase64( buffer ) {
        var binary = '';
        var bytes = new Uint8Array( buffer );
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode( bytes[ i ] );
        }
        return window.btoa( binary );
    },

    orientTo( node, pos, target, in_world, top )
    { 
        if(!node)
            return;

        var parent = node._parent;
        var global_parent = parent._global_matrix;
        var mat = mat4.create();
        var local_target = vec3.create();
        mat4.invert(mat, global_parent); 
        vec3.transformMat4(local_target, target, mat);

        var tmpMat4 = mat4.create(), tmpQuat = quat.create();
        mat4.lookAt(tmpMat4, local_target, [0,0,0], top);
        quat.fromMat4(tmpQuat, tmpMat4);
        //quat.slerp(tmpQuat, tmpQuat, node.rotation, 0.95);
        node._rotation = tmpQuat;
        node.updateMatrices();
    },

    // litegl.js @javiagenjo
    getBBCorners(bb)
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
    },

    getDate()
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
    },

    downloadBinary ( mesh, format )
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
}

var GFX = {

    generate2DNormals(tex_name, node, options)
    {
        var texture = gl.textures[tex_name];
        options = options || {};
    
        if(!texture)
        return false;

        // clean old textures
        delete gl.textures["@Borders_" + tex_name];
		delete gl.textures["@Blur_" + tex_name];
		delete gl.textures["@ColorBlur_" + tex_name];
        delete gl.textures["@Normals_" + tex_name];
        
        var width = 512;
        var height = texture.height / (texture.width / 512);
    
        var borders_tex = new Texture(width, height, texture.getProperties());
        var blur_tex = new Texture(width, height, texture.getProperties());
        var blur_tex_original = new Texture(width, height, texture.getProperties());
        var blur_color_tex = new Texture(width, height, texture.getProperties());
        var normal_tex = new Texture(width, height, texture.getProperties());
    
        var offset = options.blur.offset || 4.5;
        var iterations = options.blur.iterations || 12;
        var intensity = options.blur.intensity || 1;
    
        /*
            Get silhouette
        */
        borders_tex.drawTo(function(){
    
            texture.toViewport(gl.shaders["silhouette"]);
        });
    
        /*
            Blur silhouette
        */
        for(var i = 0; i < iterations; i++){
            if(!i)
                borders_tex.applyBlur(offset, offset, intensity, blur_tex);
            else
                blur_tex.applyBlur(offset, offset, intensity);
        }
            
    
        /*
            Add color to silhouette
            (Add B&W color to blurred texture before converting to normal)
        */
    
        if(options.color.blur) {
            
            for(var i = 0; i < iterations; i++)
                if(!i)    
                    texture.applyBlur(offset, offset, intensity, blur_tex_original);
                else
                    blur_tex_original.applyBlur(offset, offset);
    
            blur_tex_original.bind(1);
        }
        else
        {
            texture.bind(1);
        }
        
        blur_color_tex.drawTo(function(){
    
            blur_tex.toViewport(gl.shaders["add_color_texture"],{
                "u_factor": options.color.factor || 1,
                "u_texture_color": 1
            });
        });
        
        texture.unbind();
        blur_tex_original.unbind();
    
        if(!options.color.enable)
        blur_color_tex = blur_tex;
    
        /*
            Get normal
        */
    
        normal_tex.drawTo(function(){
    
            blur_color_tex.toViewport(gl.shaders["generate_normal"], {"u_strength": options.normal.strength || 18, "u_size": vec2.fromValues(texture.width, texture.height)});
        });
    
        /*
            Blur normal
        */
        if(options.normal.blur) {
            for(var i = 0; i < iterations; i++)
                normal_tex.applyBlur(offset, offset, intensity, normal_tex);
        }
    
        gl.textures["@Borders_" + tex_name] = borders_tex;
        gl.textures["@Blur_" + tex_name] = blur_tex;
        gl.textures["@ColorBlur_" + tex_name] = blur_color_tex;
        gl.textures["@Normals_" + tex_name] = normal_tex;

        // apply settings
        node.components["ChromaKey"].normal_settings = options;
    
        return true;
    
    },
    
    // glow effect (litegraph.js @javiagenjo) (https://github.com/jagenjo/litegraph.js/blob/master/src/nodes/gltextures.js )
    createGlow( tex, options )
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
    
        return final_texture;
    },
    
    // which info is necessary in each render pass
    info_check()
    {
        // check browser compatibility 
        if (this.browser == 'safari') {
            console.warn( 'browser not supported' );
            return false;
        }
    
       /* var SFXComponent = RM.get('ScreenFX');
    
        if(!SFXComponent || !SFXComponent.tonemapping)
            return false;
    
        var myToneMapper = RM.tonemappers[ SFXComponent.tonemapping ];
        var fs = myToneMapper.constructor.Uniforms; // declared uniforms
    
        return [fs.includes('u_maxLum'), fs.includes('u_logMean')];*/

        return [false, true];
    }
}

var rtime;
var timeout = false;
var delta = 500;

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
    if(!CORE)
    throw("no core instanced");

    var w = nearestPowerOfTwo(window.innerWidth), h = nearestPowerOfTwo(window.innerHeight);

    if(gui && !fullscreen)
    {
        if(gui.editor == SCENE_TAB)
        {                                               // sub margin
            w = $("#canvasarea")[0].clientWidth         - 8;
            h = $("#canvasarea")[0].clientHeight  -24   - 8;

            // resize sliders
            var sliders = document.querySelectorAll(".slider");

            for(var i = 0; i < sliders.length; i++)
                sliders[0].width = gui._sidepanel.root.offsetWidth;
        }
        else
        {
			w = gui.assemblyarea.getSection(0).root.clientWidth - 8;
            h = gui.assemblyarea.getSection(0).root.clientHeight - 32;
        }
    }

    renderer.canvas.width = w;
    renderer.canvas.height = h;
    renderer.context.viewport(0, 0, w, h);

    CORE.graph_manager.resize();
	HDRI.resize(w, h);

    // change viewport texture properties
    CORE.resizeViewportTextures(w, h);
    camera.perspective(camera.fov, w / h, camera.near, camera.far);
	
	CORE.setUniform('viewport', gl.viewport_data);
	RM.shader_macros[ 'INPUT_TEX_WIDTH' ] = gl.viewport_data[2];
    RM.shader_macros[ 'INPUT_TEX_HEIGHT' ] = gl.viewport_data[3];
}

if( !Float32Array.prototype.hasOwnProperty( "nearEq" ) )
{
	Object.defineProperty( Float32Array.prototype, "nearEq", {
		value: function(v){
			for(var i = 0; i < this.length; ++i)
				if( Math.abs(this[i] - v[i]) > 0.00001 )
					return false;
			return true;
		},
		enumerable: false
	});
}