/*
*   Alex Rodriguez
*   @jxarco 
*/

// HDRTool.js 
// Dependencies: litegl.js

//main namespace
(function(global){

    /**
     * Main namespace
     * @namespace HDRTool
     */

    if(!GL)
    throw( "HDRTool.js needs litegl.js to work" );
    
    
    var HDRTool = global.HDRTool = RT = {

        version: 1.0,
        core: null,
		FIRST_PASS: true,	
		LOAD_STEPS: 0,
		CURRENT_STEP: 0,

        CUBE_MAP_POSITIVE_X: 0,
        CUBE_MAP_POSITIVE_Y: 1,
        CUBE_MAP_POSITIVE_Z: 2,
        CUBE_MAP_NEGATIVE_X: 3,
        CUBE_MAP_NEGATIVE_Y: 4,
        CUBE_MAP_NEGATIVE_Z: 5,

        CUBE_MAP_SIZE: 256,

        ERRORS: {
            "0": "Undefined compression",
            "1": "Unsupported compression",
            "2": "Cannot get bytes from EXR"
        },

        // ldr stuff (not used since I'm using the other method)
        files_loaded: [],
        files_to_load: 0,
        log_exposure_times: [],
        hdr_min: new Float32Array(3),
        hdr_max: new Float32Array(3),
        hdr_avg: new Float32Array(3),
        tmp_avg: new Float32Array(3),
		max_radiance: 50,

        cubemap_upload_options: {no_flip: false},
        spheremap_upload_options: {}
    };
    
    HDRTool.setup = function(o)
    {
        o = o || {};
        if(HDRTool.configuration)
            throw("setup already called");
        HDRTool.configuration = o;
    }

	HDRTool.default_progress = function( loaded )
	{
        $(".pbar").css("width", (loaded)/5 * 100 + "%");
        $("#import-bar").css('width', (loaded)/5 * 100 + "%");
	}

    /**
    * Read exr file and run the EXRLoader
    * @method load
    * @param {string} file
    * @param {Object} options
    * @param {Function} onprogress
    */
    HDRTool.load = function(file, options, onprogress)
    {
        var options = options || {};
        var that = this;
        var tex_name = this.getName( file ); 

        var onload = function( buffer, options )
        {            
            var options = options || {};

            // File has been dropped
            if(options.filename)
                tex_name = options.filename;

            // console.time('Parsed in');
            var result = null;

            if(isHDRE(tex_name)) {
			
				var found = that.parseHDRE( buffer, tex_name, onprogress );
				if(!found) {
					throw("reading error");
				}
			}
                
            else if(isEXR(tex_name))
            {
                var data = that.parseEXR( buffer );
                result = HDRTool.toTexture(data, options.size);
                gl.textures[ tex_name ] = result;
            }

            else if(isRadiance(tex_name))
            {
                var data = that.parseRadianceHDR( buffer );
                result = HDRTool.toTexture(data, options.size);
                gl.textures[ tex_name ] = result;
            }

            else
                throw("file format not accepted");

            // console.timeEnd('Parsed in');

            if(options.oncomplete) // do things when all is loaded
                options.oncomplete( result );
        }

        // no read is necessary
        if(options.data)
            onload(options.data, options);
        else
            this.request({ url: file, dataType: 'arraybuffer', success: onload, options: options });
    }

    /**
    * Parse the input data and create texture
    * @method parseHDRE
    * @param {ArrayBuffer} buffer 
    * @param {String} tex_name
    * @param {Function} onprogress
    */
    HDRTool.parseHDRE = function( buffer, tex_name, onprogress )
    {
        var onprogress = onprogress || this.default_progress;
        var r = HDRE.parse(buffer, {onprogress: onprogress});

		if(!r)
			return false;

        var _envs = r._envs;
        var header = r.header;
        var textures = [];

        var version = header.version;
        printVersion( version );

		if(this.core) {
			this.core.setUniform("is_rgbe", false);
            this.core.setUniform("mipCount", 5);
            
            // new HDRE does not have all the mipmap chain
            delete RM.shader_macros[ 'MIP_COUNT' ];
        }
        
        // Get base enviroment texture

        var type = GL.FLOAT;
        var data = _envs[0].data;

        if(header.array_type == 01) // UBYTE
            type = GL.UNSIGNED_BYTE;
        else if(header.array_type == 02) // HALF FLOAT
            type = GL.HALF_FLOAT_OES;
        else if(header.array_type == 04) { // RGBE
            type = GL.UNSIGNED_BYTE;
            if(this.core)
                this.core.setUniform("is_rgbe", true);
        }

        console.log(header);

        var options = {
            format: header.nChannels === 4 ? gl.RGBA : gl.RGB,
            type: type,
            minFilter: gl.LINEAR_MIPMAP_LINEAR,
            texture_type: GL.TEXTURE_CUBE_MAP,
            pixel_data: data
        };

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false );
        let tex = new GL.Texture( _envs[0].width, _envs[0].width, options);
        tex.mipmap_data = {};
        
        // Generate mipmap
        tex.bind(0);
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        tex.unbind();

        // Upload prefilter mipmaps
        for(var i = 1; i < 6; i++){

            var pixels =  _envs[i].data;
            
            for(var f = 0; f < 6; ++f)
                tex.uploadData( pixels[f], { no_flip: true, cubemap_face: f, mipmap_level: i}, true );

            tex.mipmap_data[i] = pixels;
        }
        
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true );

        // Store the texture 
        gl.textures[tex_name] = tex;
        tex.has_mipmaps = true;
        tex.data = null;

		return true;
    }

    /**
    * Parse the input data and get all the EXR info 
    * @method parseExr
    * @param {ArrayBuffer} buffer 
    */
    HDRTool.parseEXR = function( buffer )
    {
		if(!Module.EXRLoader)
			console.log('smartphone version');
		

        var EXRHeader = {};

        var magic = new DataView( buffer ).getUint32( 0, true );
        var versionByteZero = new DataView( buffer ).getUint8( 4, true );
        var fullMask = new DataView( buffer ).getUint8( 5, true );

        // Start parsing header
        var offset = { value: 8 };
        var keepReading = true;

        // clone buffer
        buffer = buffer.slice(0);

        while( keepReading )
        {
            var attributeName = parseNullTerminatedString( buffer, offset );

            if ( attributeName == 0 )
                keepReading = false;
            else
            {
                var attributeType = parseNullTerminatedString( buffer, offset );
                var attributeSize = parseUint32( buffer, offset );
                var attributeValue = parseValue( buffer, offset, attributeType, attributeSize );
                EXRHeader[ attributeName ] = attributeValue;
            }
        }

        if (EXRHeader.compression === undefined)
        throw "EXR compression is undefined";

        var width = EXRHeader.dataWindow.xMax - EXRHeader.dataWindow.xMin + 1;
        var height = EXRHeader.dataWindow.yMax - EXRHeader.dataWindow.yMin + 1;
        var numChannels = EXRHeader.channels.length;

        var byteArray;

        if (EXRHeader.compression === 'ZIP_COMPRESSION' || EXRHeader.compression == 'NO_COMPRESSION') {

            // get all content from the exr
            try {
                var data = new Uint8Array(buffer);
                var exr = new Module.EXRLoader(data);

                if(exr.ok())
                    byteArray = exr.getBytes();
                else 
                    throw( "Error getting bytes from EXR file" );

            } catch (error) {
                console.error(error);
            }

        }
        else
        {
            console.error('Cannot decompress unsupported compression');
            return; 
        }

        var data = {
            header: EXRHeader,
            width: width,
            height: height,
            rgba: byteArray,
            numChannels: numChannels
        };

        return data;
    }

    /**
    * Parse the input data and get all the HDR (radiance file) info 
    * @method parseRadianceHDR
    * @param {ArrayBuffer} buffer 
    */
    HDRTool.parseRadianceHDR = function( buffer )
    {
        if(!parseHdr)
            console.log('cannot parse hdr file');
        
        var img = parseHdr(buffer);

        var data = {
            header: null,
            width: img.shape[0],
            height: img.shape[1],
            rgba: img.data,
            numChannels: img.data.length/(img.shape[0]*img.shape[1])
        };

        return data;
    }

    /**
    * Create a texture based in data received as input 
    * @method toTexture
    * @param {Object} data 
    * @param {Number} cubemap_size
    */
    HDRTool.toTexture = function( data, cubemap_size, options )
    {
        if(!data)
        throw( "No data to get texture" );

		options = options || {};		

        var width = data.width,
            height = data.height;

        var is_cubemap = ( width/4 === height/3 && GL.isPowerOfTwo(width) ) ? true : false;

		var channels = data.numChannels;
		var pixelData = data.rgba;
		var pixelFormat = channels === 4 ? gl.RGBA : gl.RGB; // EXR and HDR files are written in 4 

        if(!width || !height)
        throw( 'No width or height to generate Texture' );

        if(!pixelData)
        throw( 'No data to generate Texture' );

        var texture = null;
        
		// Set to default options (flip y)
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !(options.no_flip));

        var params = {
            format: pixelFormat,
            type: gl.FLOAT,
            pixel_data: pixelData
        };

        if(is_cubemap)
        {
            var square_length = pixelData.length / 12;
            var faces = parseFaces(square_length, width, height, pixelData);

            width /= 4;
            height /= 3;

            params.texture_type = GL.TEXTURE_CUBE_MAP;
            params.pixel_data = faces;

            texture = new GL.Texture( width, height, params);

			var temp = texture.clone();
			var shader = new GL.Shader(Shader.SCREEN_VERTEX_SHADER, HDRTool.COPY_CUBEMAP_FSHADER);
            
            //save state
            var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
            var viewport = gl.getViewport();
            var fb = gl.createFramebuffer();
            gl.bindFramebuffer( gl.FRAMEBUFFER, fb );
            gl.viewport(0,0, width, height);

            var mesh = Mesh.getScreenQuad();
            
            // Bind original texture
            texture.bind(0);
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
				shader._setUniform( "u_flip", true );
                gl.drawArrays( gl.TRIANGLES, 0, 6 );
            }

            mesh.unbindBuffers( shader );
            //restore previous state
            gl.setViewport(viewport); //restore viewport
            gl.bindFramebuffer( gl.FRAMEBUFFER, current_fbo ); //restore fbo
            gl.bindTexture(temp.texture_type, null); //disable

            temp.is_cubemap = is_cubemap;
        }

        // basic texture or sphere map
        else 
        {
            texture = new GL.Texture( width, height, params);
        }
            
        // texture properties
        texture.wrapS = gl.CLAMP_TO_EDGE;
        texture.wrapT = gl.CLAMP_TO_EDGE;
        texture.magFilter = gl.LINEAR;
        texture.minFilter = gl.LINEAR_MIPMAP_LINEAR;

        if(is_cubemap)
            return temp;

		if(!options.discard_spheremap)
			gl.textures["tmp_spheremap"] = texture;
        
        return this.toCubemap( texture, cubemap_size );
    }

    /**
    * Converts spheremap or panoramic map to a cubemap texture 
    * @method toCubemap
    * @param {Texture} tex
    * @param {Number} cubemap_size
    */
    HDRTool.toCubemap = function( tex, cubemap_size )
    {
        var size = cubemap_size || this.CUBE_MAP_SIZE;
        
        if(!size)
        throw( "CUBEMAP size not defined" );

        //save state
        var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
        var viewport = gl.getViewport();
        var fb = gl.createFramebuffer();
        gl.bindFramebuffer( gl.FRAMEBUFFER, fb );
        gl.viewport(0,0, size, size);

        var shader_type = (tex.width == tex.height * 2) ? HDRTool.LATLONG_MAP_FSHADER : HDRTool.SPHERE_MAP_FSHADER;
        var shader = new GL.Shader(Shader.SCREEN_VERTEX_SHADER, shader_type);

        if(!shader)
            throw( "No shader" );

        // Bind original texture
        tex.bind(0);
        var mesh = Mesh.getScreenQuad();
        mesh.bindBuffers( shader );
        shader.bind();

        var cubemap_texture = new GL.Texture( size, size, { format: tex.format, texture_type: GL.TEXTURE_CUBE_MAP, type: gl.FLOAT, minFilter: GL.LINEAR_MIPMAP_LINEAR } );
        var rot_matrix = GL.temp_mat3;
        var cams = GL.Texture.cubemap_camera_parameters;

        for(var i = 0; i < 6; i++)
        {
            gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, cubemap_texture.handler, 0);
            var face_info = cams[i];

            mat3.identity( rot_matrix );
            rot_matrix.set( face_info.right, 0 );
            rot_matrix.set( face_info.up, 3 );
            rot_matrix.set( face_info.dir, 6 );
            shader._setUniform( "u_rotation", rot_matrix );
            gl.drawArrays( gl.TRIANGLES, 0, 6 );
        }

        mesh.unbindBuffers( shader );

        //restore previous state
        gl.setViewport(viewport); //restore viewport
        gl.bindFramebuffer( gl.FRAMEBUFFER, current_fbo ); //restore fbo
        gl.bindTexture(cubemap_texture.texture_type, null); //disable

		cubemap_texture.bind(0);
		gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        cubemap_texture.unbind();
        
        cubemap_texture.has_mipmaps = true;

        return cubemap_texture;
    }

	/**
    * Generate cubemap using 6 faces
    * @method cubemapFromImages
    * @param {Object} options
    */
    HDRTool.cubemapFromImages = function(images, options)
    {
		var faces = [];

		for(var i in images) {

			var img = images[i];

			faces.push( img.rgba8 );

			/*
            var tex = new GL.Texture( img.width, img.height, {pixel_data: img.rgba8, format: gl.RGBA} );
			gl.textures["fromImages_" + i] = tex;
			*/

		}

		var options = {
                format: gl.RGBA,
                texture_type: GL.TEXTURE_CUBE_MAP,
                pixel_data: faces
        };

		Texture.setUploadOptions( {no_flip: true} );

		var tex = new Texture(images[0].width, images[0].height, options);
		var name = "@cubemap-" + simple_guidGenerator();
		gl.textures[name] = tex;
		
		// reset texture options
		Texture.setUploadOptions( {no_flip: false} );

        if(this.core)
		    this.core.set(name);    
	}

    /**
    * Precalculate different ems blurred for different roughness values 
    * @method prefilter
    * @param {string} image
    * @param {Object} options (shader, oncomplete, data)
    */
    HDRTool.prefilter = function(texture, options)
    {
		if(!this.FIRST_PASS)
		{
			if(options.oncomplete)
                options.oncomplete();
			return;
		}

		console.warn("STEP: Prefilter");
		console.time("Prefiltered in");
		
        var options = options || {};

		var tex = texture;
		var tex_name = options.name || "texture_prefilter";

		if(texture.constructor === String)
		{
			tex_name = this.getName( texture );
	        tex = gl.textures[tex_name];
		}
        
        var that = this;

        var shader = options.shader || "defblur";
        //shader = "CMFT";

        if(shader.constructor !== GL.Shader)
            shader = gl.shaders[ shader ];
		
        var inner = function( tex )
        {
            tex.mipmap_data = {};

            var mipCount = 5;
            // var mipCount = Math.log2(tex.width);
            renderer._uniforms["u_mipCount"] = mipCount;
            
            that.LOAD_STEPS = 0;

            // compute necessary steps
            for( var i = 1; i <= mipCount; ++i )
            {
                var faces = 6;
                var blocks = Math.min(tex.width / Math.pow( 2, i ), 8);
                that.LOAD_STEPS += faces * blocks;
            }

			for( let mip = 1; mip <= mipCount; mip++ )
            {
				that.deferredBlur( tex, mip, mipCount, shader, function(result) {
                    
                    // store
                    tex.mipmap_data[mip] = result.getCubemapPixels();

                    for(var f = 0; f < 6; ++f)
                        tex.uploadData( result.getPixels(f), { no_flip: true, cubemap_face: f, mipmap_level: mip}, true );

                    if(options.oncomplete && that.CURRENT_STEP == that.LOAD_STEPS)
					{
						that.CURRENT_STEP = 0;
                        console.timeEnd("Prefiltered in");
                        tex.data = null;
						options.oncomplete();
					}

				});
            }
        };

        if(!tex)
        {
            var params = {oncomplete: inner};
			var filename = texture;
            
            if(options.data)
                params['data'] = options.data;
            if(options.size)
                params['size'] = options.size;
            
            this.load( filename, params );        
        }
        else
            inner( tex );
    }

    /**
    * Blurs a texture calling different draws from data
    * @method deferredBlur
    * @param {Texture} input
    * @param {Number} level
    * @param {Shader||String} shader
    */
    HDRTool.deferredBlur = function(input, level, mipCount, shader, oncomplete)
    {
        var data = this.getBlurData(input, level, mipCount);
	
		// The next prefilter is not first pass
		this.FIRST_PASS = false;

        if(!data)
        throw('no data to blur');
        
        var options = {
            format: gl.RGBA,
            type: GL.FLOAT,
            minFilter: gl.LINEAR_MIPMAP_LINEAR,
            texture_type: GL.TEXTURE_CUBE_MAP
        };

        var result = new GL.Texture( data.size, data.size, options );
        var current_draw = 0;
		var hammersley_tex = gl.textures["hammersley_sample_texture"];

        //save state
        var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
        var viewport = gl.getViewport();

        var fb = gl.createFramebuffer();
        var mesh = GL.Mesh.getScreenQuad();

        var inner_blur = function() {

            let drawInfo = data.draws[current_draw];
            // console.log(drawInfo);
    
            if(!shader)
                throw( "No shader" );
    
            // bind blur fb each time 
            gl.bindFramebuffer( gl.FRAMEBUFFER, fb );

            input.bind(0);
			hammersley_tex.bind(1);
            shader.bind();
            mesh.bindBuffers( shader );

            gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + drawInfo.face, result.handler, 0);
            gl.viewport( drawInfo.viewport[0], drawInfo.viewport[1], drawInfo.viewport[2], drawInfo.viewport[3] );
            
            shader.uniforms( drawInfo.uniforms );
            gl.drawArrays( gl.TRIANGLES, 0, 6 );

            mesh.unbindBuffers( shader );

			input.unbind();
			hammersley_tex.unbind();

            //restore previous state each draw
            gl.setViewport(viewport); //restore viewport
            gl.bindFramebuffer( gl.FRAMEBUFFER, current_fbo ); //restore fbo
            gl.bindTexture(result.texture_type, null);
        }

		var that = this;

        var interval = setInterval( function() {

            inner_blur();
			current_draw++;

			that.CURRENT_STEP++;
			// update progress bar
			var step = (that.CURRENT_STEP / that.LOAD_STEPS) * 100;
			$('.pbar').css('width', step + "%");
           
            if(current_draw == data.draws.length)
            {
                clearInterval(interval);

                if(oncomplete)
                    oncomplete( result );
            }
        }, 100 );
    }

	 /**
    * Gets info to blur in later pass
    * @method getBlurData
    * @param {Texture} input
    * @param {Number} level
    * @param {Shader} shader
    */
    HDRTool.getBlurData = function(input, level, mipCount)
    {
        var blocks = 8;

        var size = input.height; // by default
		size /= Math.pow(2, level);

		// Recompute number of blocks
        blocks = Math.min(blocks, size);

		var totalLevels = mipCount;
		var roughness = (level+1) / (totalLevels + 1);

        var deferredInfo = {};

        var cams = GL.Texture.cubemap_camera_parameters;
        var cubemap_cameras = [];
        var draws = [];

        for( let c in cams ) {

            let face_info = cams[c];
            let rot_matrix = mat3.create();
            mat3.identity( rot_matrix );
            rot_matrix.set( face_info.right, 0 );
            rot_matrix.set( face_info.up, 3 );
            rot_matrix.set( face_info.dir, 6 );
            cubemap_cameras.push( rot_matrix );
        }

        cubemap_cameras = GL.linearizeArray( cubemap_cameras );
        
        for(var i = 0; i < 6; i++)
        {
            var face_info = cams[i];

            let rot_matrix = mat3.create();
            mat3.identity( rot_matrix );
            rot_matrix.set( face_info.right, 0 );
            rot_matrix.set( face_info.up, 3 );
            rot_matrix.set( face_info.dir, 6 );

            for( var j = 0; j < blocks; j++ )
            {
                let uniforms = {
                        'u_rotation': rot_matrix,
                        'u_blocks': blocks,
						'u_mipCount': mipCount,
                        'u_roughness': roughness,
                        'u_ioffset': j * (1/blocks),
                        'u_cameras': cubemap_cameras,
						'u_color_texture': 0,
						'u_hammersley_sample_texture': 1
                    };

                let blockSize = size/blocks;

                draws.push({
                    uniforms: uniforms, 
                    viewport: [j * blockSize, 0, blockSize, size],
                    face: i
                });
            }
        }

        deferredInfo['blocks'] = blocks;
        deferredInfo['draws'] = draws;
        deferredInfo['size'] = size;
        deferredInfo['roughness'] = roughness;
		deferredInfo['level'] = level;

        return deferredInfo;
    }

    /**
    * Blurs a texture depending on the roughness
    * @method blur
    * @param {Texture} input
    * @param {Number} level
    * @param {Shader||String} shader
    */
    HDRTool.blur = function(input, level, shader)
    {
        var size = input.height; // by default
		size = Math.max(8, size / Math.pow(2, level));

		var roughness_range = [0.2, 0.4, 0.6, 0.8, 1];
		var roughness = roughness_range[ level-1 ] || 0;

		//save state
		var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
		var viewport = gl.getViewport();

		var fb = gl.createFramebuffer();
		gl.bindFramebuffer( gl.FRAMEBUFFER, fb );
		gl.viewport(0,0, size, size);  // viewport remains equal (the shaders modifies the uvs)

		if(!shader)
			throw( "No shader" );

		input.bind(0);
		var mesh = GL.Mesh.getScreenQuad();
		mesh.bindBuffers( shader );
		shader.bind();

		var result = new GL.Texture( size, size, { format: input.format, texture_type: GL.TEXTURE_CUBE_MAP, type: gl.FLOAT } );

		// info for block processing 
		var cams = GL.Texture.cubemap_camera_parameters;

		for(var i = 0; i < 6; i++)
		{
			gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, result.handler, 0);
			var face_info = cams[i];

			let rot_matrix = mat3.create();
			mat3.identity( rot_matrix );
			rot_matrix.set( face_info.right, 0 );
			rot_matrix.set( face_info.up, 3 );
			rot_matrix.set( face_info.dir, 6 );

			var uniforms = {
				'u_rotation': rot_matrix,
				'u_roughness': roughness,
				'u_level': level
			};

			shader.uniforms( Object.assign(renderer._uniforms, uniforms ));
			gl.drawArrays( gl.TRIANGLES, 0, 6 );
		}

		mesh.unbindBuffers( shader );

		//restore previous state
		gl.setViewport(viewport); //restore viewport
		gl.bindFramebuffer( gl.FRAMEBUFFER, current_fbo ); //restore fbo
		gl.bindTexture(result.texture_type, null); //disable

		return result;
    }

    /**
    * Environment BRDF (Store it in a 2D LUT)
    * @method brdf
	* @param {String} path
    */
    HDRTool.brdf = function(path)
    {
		var tex_name = '_brdf_integrator';
		var options = { type: gl.FLOAT, texture_type: gl.TEXTURE_2D, filter: gl.LINEAR};
		
		if(path)
		{
			gl.textures[tex_name] = renderer.loadTexture(path, options);
			return;
		}
        
		var shader = new GL.Shader(HDRTool.BRDF_VSHADER, HDRTool.BRDF_FSHADER);
        var tex = gl.textures[tex_name] = new GL.Texture(128, 128, options);

		var hammersley_tex = gl.textures["hammersley_sample_texture"];
		if(!hammersley_tex && window.Tools)
			hammersley_tex = Tools.create_hammersley_sample_texture();

        tex.drawTo(function(texture) {
    
            if(hammersley_tex)
			    hammersley_tex.bind(0);

            shader.uniforms({
				
				'u_hammersley_sample_texture': 0

			}).draw(Mesh.getScreenQuad(), gl.TRIANGLES);

            if(hammersley_tex)
			    hammersley_tex.unbind();
        });
    }

    /**
    * Returns name of the texture from path name removing all before last "/"
    * @method getName
    * @param {string} path
    */
    HDRTool.getName = function( path )
    {
        var tokens = path.split("/");
        return tokens[ tokens.length - 1 ];
    }

    /**
    * Write an HDRE file to store the cubemap and its roughness levels
    * @method getSkybox
    * @param {Object} options
    */
    HDRTool.getSkybox = function( options )
    {
		options = options || {};
        
        var environment = CORE._environment;

        // is already an hdre, no need to write it again
        // but i'm letting export by now to rewrite rgba to rgb

        // if(environment.includes(".hdre")) 
        // return;
        
        var texture = gl.textures[ environment ];
        var temp = null;
        var width = texture.width;
        var height = texture.height;
		var isRGBE = false;
		var array = Float32Array;

		if(options.type && options.type.BYTES_PER_ELEMENT) // if has this property is a typedArray
		{
			array = options.type;

			// Float32Array cant be rgbe
			if(options.rgbe !== undefined)
			{
				isRGBE = options.rgbe;
			}

		}
            
        if(array === Uint16Array) {
            // in case of half_float: convert to 16 bits from 32 using gpu
            temp = new Texture( width, height, {type: GL.HALF_FLOAT_OES, texture_type: GL.TEXTURE_CUBE_MAP} );
            
            var shader = new GL.Shader(Shader.SCREEN_VERTEX_SHADER, HDRTool.COPY_CUBEMAP_FSHADER);
            
            //save state
            var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
            var viewport = gl.getViewport();
            var fb = gl.createFramebuffer();
            gl.bindFramebuffer( gl.FRAMEBUFFER, fb );
            gl.viewport(0,0, width, height);

            var mesh = Mesh.getScreenQuad();
            
            // Bind original texture
            texture.bind(0);
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
                gl.drawArrays( gl.TRIANGLES, 0, 6 );
            }

            mesh.unbindBuffers( shader );
            //restore previous state
            gl.setViewport(viewport); //restore viewport
            gl.bindFramebuffer( gl.FRAMEBUFFER, current_fbo ); //restore fbo
            gl.bindTexture(temp.texture_type, null); //disable
        }
        
        var originalSkybox = this.processSkybox( temp ? temp : texture, isRGBE );
        var data = [ originalSkybox ];

        // Get all mips
        for(var i = 1; i < 6; i++)
        {
            data.push( {

                width: texture.width / Math.pow(2, i),
                height: texture.height / Math.pow(2, i),
                pixelData: texture.mipmap_data[i]
            } )
            
        }

		var write_options = {
			type: array, 
            rgbe: isRGBE,
            channels: options.channels || 3
		}

		if(options.saveSH && RM.Get("IrradianceCache")){
		
			var shs = IrradianceCache.SHs[environment];

			if(!shs){
				console.warn("sh missing, computing now...")
				shs = RM.Get("IrradianceCache").computeSH( gl.textures[environment] );
			}

			write_options.sh = shs;

		}else if(options.saveSH && !RM.Get("IrradianceCache"))
			console.warn("SH not saved (Use IrradianceCache component to compute them first)");

        var buffer = HDRE.write( data, width, height, write_options );

        if(options.upload)
        return buffer;

		LiteGUI.downloadFile( environment.replace(".exr", ".hdre"), new array(buffer) );
    }

    /**
    * Get info of a texture (pixel data per face, width and height )
    * @method processSkybox
    */
    HDRTool.processSkybox = function( e, isRGBE )
    {
        if(!gl)
        throw( 'no webgl' );

        if(e.constructor === String)
            e = gl.textures[ e ];

        if(!e)
        throw( 'no stored texture with name ' + e );

        var info = {
			width: e.width, 
			height: e.height, 
			pixelData: []
		};

        for(var i = 0; i < 6; i++) {

			// get data for each face
			var faceData = e.getPixels(i);
            info.pixelData.push( isRGBE ? faceData.toRGBE() : faceData);
		}

        return info;
    }

    /**
    * Opens a texture in a new window to download
    * @method download
    * @param {string} name
    */
    HDRTool.downloadTexture = function(name, new_tab)
    {
        var tex = name.constructor === GL.Texture ? name : gl.textures[name];
        if(!tex) {
            console.error("no texture named " + name);
            return;
        }
        var canvas = tex.toCanvas(null, true);
        canvas.style.height = "100%";
        var a = document.createElement("a");
        a.download = name + ".png";
        a.href = canvas.toDataURL();
        
        if(!new_tab)
            a.click();
        else
        {
            a.title = "Texture image";
            a.appendChild(canvas);
            var new_window = window.open();
            new_window.document.title.innerHTML = "Texture image";
            new_window.document.body.appendChild(a);
            new_window.focus();
        }
    }

    /**
    * Upload mipmap data to texture
    * @method uploadMipmap
    * @param {Texture} tex where replace mipmaps 
    * @param {typedArray} data mipmap pixels
    * @param {Number} level mipmap level to replace
    */
    HDRTool.uploadMipmap = function( tex, pixels, level )
    {
        if(!level)
        throw("can't replace base texture");

        tex.bind(0);

        var size = tex.width / Math.pow(2, level);

        if(tex.texture_type === gl.TEXTURE_2D)
        {
            gl.texSubImage2D(gl.TEXTURE_2D, level, 0, 0, size, size, tex.format, tex.type, pixels);
        }else if(tex.texture_type === gl.TEXTURE_CUBE_MAP)
        {
            for(var i = 0; i < 6; i++)
                gl.texSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, level, 0, 0, size, size, tex.format, tex.type, pixels[i]);
        }

        tex.unbind();
    }

    /**
    * Request file by XMLHTTPRequest
    * @method request
    * @param {Object} request
    */
    HDRTool.request = function(request)
	{
		var dataType = request.dataType || "text";
		if(dataType == "json") //parse it locally
			dataType = "text";
		else if(dataType == "xml") //parse it locally
			dataType = "text";
		else if (dataType == "binary")
		{
			dataType = "arraybuffer";
			request.mimeType = "application/octet-stream";
		}	

		//regular case, use AJAX call
        var xhr = new XMLHttpRequest();
        xhr.open( request.data ? 'POST' : 'GET', request.url, true);
        if(dataType)
            xhr.responseType = dataType;
        if (request.mimeType)
            xhr.overrideMimeType( request.mimeType );
		if( request.nocache )
			xhr.setRequestHeader('Cache-Control', 'no-cache');

        xhr.onload = function(load)
		{
			var response = this.response;
			if(this.status != 200)
			{
				var err = "Error " + this.status;
				if(request.error)
					request.error(err);
				return;
			}

			if(request.success)
				request.success.call(this, response, request.options ? request.options : null);
        };
        
        xhr.onerror = function(err) {
			if(request.error)
				request.error(err);
        }
        
        xhr.onprogress = function(e) {
			$("#xhr-load").css("width", parseFloat( (e.loaded)/e.total * 100 ) + "%");
		}

        xhr.send();
		return xhr;
    }

	/**
    * Assemble HDR image from bracketed stack of ldr images
    * @method assembleHDR_HDRGPU
    * @param {} 
    */
	HDRTool.assembleHDR_HDRGPU = function(hdr_scale)
	{

        if(!this.core)
        return;

		delete gl.textures["CROPPED"]; // reset previous cropped 
		delete gl.textures["CROPPED_MIP"]; 
		console.time('assembly');

		var images = this.files_loaded;
		this._sortFiles();

		var that = this;
		var ext = gl.extensions["EXT_sRGB"];

		if(!ext)
			throw("EXT_sRGB not supported");

		const numImages = images.length;
		const width = images[0].Width;
		const height = images[0].Height;

		// output texture
		var hdr = new GL.Texture( width, height, { type: GL.FLOAT, format: GL.RGBA} );
		var mipmaps_assembled = new GL.Texture( nearestPowerOfTwo(width), nearestPowerOfTwo(height), { type: GL.FLOAT, format: GL.RGBA, minFilter: GL.LINEAR_MIPMAP_LINEAR} );

        var stack           = [];
        var ExposureTimes   = [];
        var uniforms        = {
            u_numImages: numImages,
            u_ExposureTimes: [],
            u_WhiteBalance: [],
            u_hdr_scale: hdr_scale
        };

		for(var i = 0; i < numImages; i++)
		{
            images[i].texture.bind(i);
            uniforms["u_ExposureTimes"].push( images[i].ExposureTime[0] );
            if(images[i].verbose)
                uniforms["u_WhiteBalance"].push( new Float32Array( images[i].verbose.multipliers ) );
            uniforms["u_stack" + i] = i;
        }
        
        // first is raw?
        if(images[0].verbose)
        uniforms["u_WhiteBalance"] = GL.linearizeArray( uniforms["u_WhiteBalance"] );

		var shader = gl.shaders['HDRassembly'];
		if(!shader)
        throw("no shader");
        
		hdr.drawTo(function(){

			shader.uniforms(uniforms).draw(Mesh.getScreenQuad(), gl.TRIANGLES);

        });
        
        mipmaps_assembled.drawTo(function(){

			shader.uniforms(uniforms).draw(Mesh.getScreenQuad(), gl.TRIANGLES);

		});

		for(var i = 0; i < numImages; i++)
            images[i].texture.unbind(); 

	    HDRI.changeScale( 855 / width );

		mipmaps_assembled.bind(0);
		gl.generateMipmap(gl.TEXTURE_2D);
		mipmaps_assembled.unbind();

		gl.textures["ASSEMBLED"] = hdr;
		gl.textures["ASSEMBLED_MIP"] = mipmaps_assembled;

		console.timeEnd('assembly');
	}
    
    HDRTool.parseCR2 = function( buffer, name )
    {
        if(!parserCR2)
        throw("cr2 parser missing");

        
        //parserCR2.parse(buffer, name, parserCR2.ONLY_METADATA );

        var dcraw_options = { 
				
            verbose: true, 					// -v 
            use16BitLinearMode: true, 		// -6 -W -g 1 1
            //setCustomGammaCurve: "1 1",                       // no gamma -> linear
            //setNoAutoBrightnessMode: true,	// -W
            useCameraWhiteBalance: true, 	// -w
            //useCustomWhiteBalance: "1 1 0 0",
            setInterpolationQuality: 2,
            exportAsTiff: true				// -T 
        };

        return parserCR2.parse(buffer, name, dcraw_options);
    }

    HDRTool.parseJPG = function( buffer, name )
    {
        var decoder = new JpegImage();
        decoder.parse( new Uint8Array(buffer) );

        var w = decoder.width, h = decoder.height;
        var data = decoder.getData(w, h);

        return {
            rgba8: this.addAlphaChannel(data),
            Width: w,
            Height: h,
            data: data
        };
    }
    
    HDRTool.parsePNG = function( buffer, name )
    {
        var img  = UPNG.decode(buffer);        // put ArrayBuffer of the PNG file into UPNG.decode
        img.rgba8 = this.addAlphaChannel(img.data);

        return {
            rgba8: img.rgba8,
            Width: img.width,
            Height: img.height,
        };
    }
    
    HDRTool.parseHDR = function( buffer, name )
    {
        var img = RGBE.parseHdr(buffer);
        
        return {
            rgba8: img.data,
            Width: img.shape[0],
            Height: img.shape[1],
            hdr: true
        };
    }
    
    HDRTool.parseLDRI = function( buffer, name, extension )
    {
        switch(extension){
            
            case 'hdr':
                return this.parseHDR( buffer, name );
            case 'nef':
            case 'cr2':
                return this.parseCR2( buffer, name );
            case 'jpg':
                return this.parseJPG( buffer, name );
            case 'png':
                return this.parsePNG( buffer, name );
        }
    
    }

    HDRTool._sortFiles = function(higher_first)
    {
        this.files_loaded.sort(function(a, b){

            if(higher_first)
            {
                var aux = Object.assign(a);
                a = b;
                b = aux;
            }

            if(a.name.includes("sample-"))
                return parseInt(a.name[7]) - parseInt(b.name[7]);

            if(a.name.includes("DSC_")){

                var an = parseInt( a.name.slice(4, a.name.length - 4) );
                var bn = parseInt( b.name.slice(4, b.name.length - 4) );
                return parseInt(an - bn);
            }
            
            if(a.name.includes("IMG_")){

                var an = parseInt( a.name.slice(4, a.name.length - 4) );
                var bn = parseInt( b.name.slice(4, b.name.length - 4) );
                return parseInt(an - bn);
            }

            if(!a.ExposureTime || !b.ExposureTime)
                console.warn("missing exp times");

            return a.ExposureTime - b.ExposureTime;
        
        });

        this.log_exposure_times.sort(function(a, b){
        
            return a - b;
        
        });
    }
    
    HDRTool.loadLDRI = function( content, extension, name, options )
    {
        options = options || {};
        var that = this;

        var getParams = function (e) {

            var data = e ? e.currentTarget.result : content;
            let img = that.parseLDRI(data, name, extension);

            img.name = name;
            if(img.rgba8)
                img.rgb = that.extractChannels(img.rgba8, img.Width * img.Height);
            img.url = extension == "cr2" ? "assets/CR2_Example.JPG" : URL.createObjectURL( content );

            // fill exposures in case of png or jpg
            if( !img['ExposureTime'] )
                img['ExposureTime'] = 1/(1+that.files_loaded.length);
            
            evaluate(img);
            
        };

        var evaluate = function (img) {
            
            Texture.setUploadOptions( {no_flip: false} );
            var tex;

            var w = img.Width;
            var h = img.Height;

            if(!img.hdr) {

                if(img.BitsPerSample && img.BitsPerSample[0] == 16)
                    tex = new GL.Texture( w, h, {type: GL.FLOAT, pixel_data: img.rgba32, format: gl.RGBA } );
                else
                    tex = new GL.Texture( w, h, {pixel_data: img.rgba8, format: gl.RGBA } );
            
            }
            else
                tex = new GL.Texture( w, h, {pixel_data: img.rgba8, format: gl.RGBA, type: GL.FLOAT } );

            tex.filename = img.name;
            
            gl.textures[img.name] = tex;
            img.texture = tex;
            that.files_loaded.push( img );

            that.files_in_load++;

            var prog_width = (that.files_in_load / that.files_to_load ) * 100;

            $("#xhr-load").css('width', prog_width + "%");
            
            // all files loaded
            if(prog_width == 100)
            { 
                that._sortFiles();

                if(options.callback)
                    options.callback();
            }
        };

        // content is binary
        if(content.constructor === ArrayBuffer)
        {
            //processFile();
            console.warn('TODO');

        // content is a file
        }else{

            var reader = new FileReader();
            reader.onload = getParams;
            reader.readAsArrayBuffer(content);
        }
    }

    HDRTool.getUniforms = function()
    {
        var uniforms = {
                u_hdr_avg: this.hdr_avg,
                u_tmp_avg: this.tmp_avg,
            
                u_hdr_min: this.hdr_min,
                u_hdr_max: this.hdr_max,
            
                u_max_lum_pixel: this.max_lum_pixel,
                u_max_lum: this.max_lum,
            
                u_min_lum_pixel: this.min_lum_pixel,
                u_min_lum: this.min_lum,
            
                u_max_radiance: this.max_radiance

            };

        return uniforms;
    }

    HDRTool.assembleHDR_DEBEVEC = function( images )
    {
        images = images || this.files_loaded;
    
        var that = this;
        const channels = 3;

        const width = images[0].Width;
        const height = images[0].Height;

        // # Loading exposure images into a list

        var exposure_times = [];

        for(var i in images)
        exposure_times.push( images[i].ExposureTime );

        var hdr = this.computeOutput(exposure_times);

        var mipmaps_assembled = new GL.Texture( nearestPowerOfTwo(width), nearestPowerOfTwo(height), { type: GL.FLOAT, format: GL.RGBA, minFilter: GL.LINEAR_MIPMAP_LINEAR} );

        mipmaps_assembled.drawTo( function() {
            renderer.clear( that.core._background_color );
            Object.assign( renderer._uniforms, HDRTool.getUniforms() );
            hdr.toViewport();
        });

        mipmaps_assembled.bind(0);
        gl.generateMipmap(gl.TEXTURE_2D);
        mipmaps_assembled.unbind();

        gl.textures["ASSEMBLED"] = hdr;
        gl.textures["ASSEMBLED_MIP"] = mipmaps_assembled;

        
    }

    /*
        This method computes the final HDR image with the radiance map 
        of every image channel 

        Returns array(channels) of array(w*h)
    */
    HDRTool.computeOutput = function( ExposureTimes )
    {
        var images = this.files_loaded;
    
        var that = this;
        const channels = 3;
        const smoothing_lambda = 100;

        const width = images[0].Width;
        const height = images[0].Height;

        var hdr_image = new Float32Array( width * height * channels );
        this.hdr_image = hdr_image;

        // shader: normalize, tonemap, adjust, normalize

        this.log_exposure_times = ExposureTimes;

        console.time('compute');

        // python version
        for( var ch = 0; ch < channels; ch++ )
        {
            // this is the data of all the images per channel
            var layer_stack = [];
            for(var i = 0; i < images.length; i++) layer_stack.push( images[i].rgb[ch] );
            
            // now we want to get the intensities for each image (of a channel) in the layer stack
            var intensity_samples = this.sampleIntensitiesLayer( layer_stack, width);
            var response_curve = this.computeResponseCurveLayer( intensity_samples, layer_stack, smoothing_lambda );
            var radiance_map = this.computeRadianceMapLayer( layer_stack, response_curve, width, height, ch);
            // final step, fill hdr image with each radiance_map
            this.composeImageLayer( radiance_map, hdr_image, ch );
        }

        // save lum

        /*this.max_lum = -Infinity;
        this.min_lum = Infinity;
        this.max_lum_pixel = null;
        this.min_lum_pixel = null;

        for( var i = 0; i < this.hdr_image.length; )
        {
            var color = [this.hdr_image[i++],this.hdr_image[i++],this.hdr_image[i++]];
            var lum = 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
            
            if(lum > this.max_lum)
            {
                this.max_lum = lum;
                this.max_lum_pixel = color;
            }
            else if(lum < this.min_lum)
            {
                this.min_lum = lum;
                this.min_lum_pixel = color;
            }
                
        }*/

        console.timeEnd('compute');

        var hdr_tex = new GL.Texture( width, height, {type: GL.FLOAT, pixel_data: hdr_image, format: gl.RGB } );

        return hdr_tex;
    }

    HDRTool._GPU_downloadHDR = function()
    {
        var max_radiance = this.max_radiance; // ojo con this
        var ldr_tex = gl.textures["combined"];
        var norm_tex = gl.textures["combined_scaled"] = new GL.Texture( ldr_tex.width, ldr_tex.height, {type: GL.FLOAT, format: gl.RGB } );
        var shader = gl.shaders['combineHDR'];

        if(!shader)
        throw("no shader");

        var that = this;

        console.time('download');

        ldr_tex.bind(0);
        norm_tex.drawTo(function(){

            shader.uniforms({
                u_hdr_avg: that.hdr_avg,
                u_tmp_avg: that.tmp_avg,
            
                u_hdr_min: that.hdr_min,
                u_hdr_max: that.hdr_max,
            
                u_max_lum_pixel: that.max_lum_pixel,
                u_max_lum: that.max_lum,
            
                u_min_lum_pixel: that.min_lum_pixel,
                u_min_lum: that.min_lum,
            
                u_max_radiance: max_radiance

            }).draw(Mesh.getScreenQuad(), gl.TRIANGLES);

        });
        ldr_tex.unbind();

        return norm_tex;

        console.timeEnd('download');
    }

    /*
        This method normalizes the final HDR image in the CPU
    */
    HDRTool._CPU_downloadHDR = function()
    {
        var hdr_image = this.hdr_image;
        var new_data = new Float32Array(hdr_image.length);
        var max_radiance = this.max_radiance;
        
        console.time('download');

        for( var i = 0; i < hdr_image.length; i+=3 )
        {
            var pixel = [hdr_image[i], hdr_image[i+1], hdr_image[i+2]];

            // linear normalizing to 0-1
            pixel = this.normalize(pixel);

            // scale (not linear) to max intensity (100, 200, 300??)
            pixel = this.scaleToRadiance(pixel, max_radiance);

            // adjust with pattern intensities
            pixel = this.adjustIntensity(pixel,2.0, max_radiance);

            new_data[i] = pixel[0];
            new_data[i+1] = pixel[1];
            new_data[i+2] = pixel[2];
        }

        console.timeEnd('download');

        this.texture_data = new_data;
        var ldr_tex = gl.textures["combined"];
        return gl.textures["combined_scaled"] = new GL.Texture( ldr_tex.width, ldr_tex.height, {type: GL.FLOAT, pixel_data: new_data, format: gl.RGB } );
    }

    HDRTool.normalize = function( Xi )
    {
        var pixel = new Float32Array(3);
        var maxLum = this.max_lum_pixel;
        var minLum = this.min_lum_pixel;

        pixel[0] = (1.0)/(maxLum[0]-minLum[0])*(Xi[0]-minLum[0]);
        pixel[1] = (1.0)/(maxLum[1]-minLum[1])*(Xi[1]-minLum[1]);
        pixel[2] = (1.0)/(maxLum[2]-minLum[2])*(Xi[2]-minLum[2]);

        return pixel;
    }

    HDRTool.scaleToRadiance = function( Xi, max_radiance )
    {
        const A = 20.4730;
        const B = 44.9280;
        const C = 36.7912;
        const D = 13.5250;
        const E = 2.47270;
        const F = 0.14253;
        const G = 0.00032;


        var pixel = new Float32Array(3);

        for(var i = 0; i < Xi.length; i++)
            pixel[i] = (A * Math.pow(Xi[i],6.0)
                - B * Math.pow(Xi[i],5.0)
                + C * Math.pow(Xi[i],4.0)
                - D * Math.pow(Xi[i],3.0)
                + E * Math.pow(Xi[i],2.0)
                - F * Xi[i]
                + G) * max_radiance;

        return pixel;
    }

    HDRTool.adjustIntensity = function( Xi, BIAS, max_radiance )
    {
        if(!BIAS)
            BIAS = 1.0;

        var pixel = new Float32Array(3);
        var pattern = this.tmp_avg; // pattern is already in range 0-1
        var average = this.normalize(this.hdr_avg);// this average is not

        //pattern = this.scaleToRadiance(pattern, max_radiance);
        //average = this.scaleToRadiance(average, max_radiance);

        var patternMatch = numeric.div(pattern, average);
        patternMatch = numeric.mul(patternMatch, BIAS);

        pixel[0] = Xi[0] * patternMatch[0];
        pixel[1] = Xi[1] * patternMatch[1];
        pixel[2] = Xi[2] * patternMatch[2];

        return pixel;
    }

    HDRTool.sampleIntensitiesLayer = function( images, width )
    {
        if(!images)
            throw('bad params');

        const z_min = 0, z_max = 255;
        const num_intensities = z_max - z_min + 1;
        const num_images = images.length;

        // Find the middle image to use as the source for pixel intensity locations
        var mid_img = images[( num_images / 2 )|0];

        // compute size of ocurrence vector
        var rows = new Uint32Array( 1 );
        var cols = new Uint32Array( 1 );

        var intensities = [];

        for( var j = 0; j < num_images; j++ ) {

            var intensity_values = new Uint8Array(num_intensities);
            var img = images[j];
    
            for(var i = 0; i < num_intensities; i++) {

                // very slow if no max ocurrences defined
                var num_rows = this.FastgetXYFromArray( mid_img, width, i, rows, cols, 1);
                
                if(!num_rows)
                    continue;

                var idx = 0;//(Math.random() * num_rows)|0;
                
                var index1D = width * rows[idx] + cols[idx];
                var value = img[ index1D ];
                intensity_values[i] = value;
            }
            
            // push each channel intensity for each image
            intensities.push( intensity_values );
        }

        return intensities;
    }

    /*
    Parameters
    ----------
    smoothing_lambda : float
        A constant value used to correct for scale differences between
        data and smoothing terms in the constraint matrix
    Returns
    -------
        Return a vector g(z) where the element at index i is the log exposure
        of a pixel with intensity value z = i (e.g., g[0] is the log exposure
        of z=0, g[1] is the log exposure of z=1, etc.)
    */
    HDRTool.computeResponseCurveLayer = function(intensity_samples, images, smoothing_lambda)
    {
        var z_min = 0, z_max = 255, 
        intensity_range = z_max - z_min,
        smoothing_lambda = smoothing_lambda || 100;

        const num_samples = intensity_range+1;
        const num_images = images.length;
        const log_exposure_times = this.log_exposure_times;

        if(log_exposure_times.length < num_images){

            LiteGUI.alert("Log exposures times missing", {title: "error"});
            throw("no enough log exposures");
        }
        
        var aN = num_images * num_samples + intensity_range;
        var aM = num_samples + intensity_range + 1;
        var mat_A = new Float64Array( aN * aM );// [ aN, aM ] -> inv: 	[ aM, aN ]
        var mat_b = new Float64Array( aN * 1 ); // [ aN,  1 ] -> 		[ aN,  1 ] can be multiplied! later!!
        
        // 1. Add data-fitting constraints:
        var k = 0;

        for(var i = 0; i < num_samples; i++) {

            for( var j = 0; j < num_images; j++ ) {

                // mat[i][j] == array[width*j+i]
                var z_ij = intensity_samples[j][i];
                var w_ij = this.linearWeight(z_ij);
                var iMa1 = aM * k + z_ij;
                var iMa2 = aM * k + ((intensity_range + 1) + i);
                mat_A[ iMa1 ] = w_ij;
                mat_A[ iMa2 ] = -w_ij;
                mat_b[ k ] = w_ij * log_exposure_times[j];
                k++;
            }
        }

        // 2. Add smoothing constraints:
        for(var z_k = (z_min + 1); z_k < z_max; z_k++) {

            var w_k = this.linearWeight(z_k);
            var iMa1 = aM * k + (z_k - 1);
            var iMa2 = aM * k + (z_k);
            var iMa3 = aM * k + (z_k + 1);
            mat_A[ iMa1] = w_k * smoothing_lambda;
            mat_A[ iMa2 ] = -2 * w_k * smoothing_lambda;
            mat_A[ iMa3 ] = w_k * smoothing_lambda;
            k++;
        }

        // 3. Add color curve centering constraint:
        var constraint = (intensity_range/2)|0;
        var iMa = aM * k + constraint;
        mat_A[ iMa ] = 1;

        // create A from mat_A array
        var A = this.listToMatrix(mat_A, aM);
        var B = this.listToMatrix(mat_b, 1);

        var inv_A = numbers.matrix.pinv(A); // pseudo-inverse (numeric.js and linearAlgebra.js)

        var x = numbers.matrix.multiply(inv_A, B);
        var g = x.slice( 0, intensity_range + 1 );

        return GL.linearizeArray( g, Float64Array );
    }
    /*
        """Calculate a radiance map for each pixel from the response curve.
        Parameters
        ----------
        images : list
        response_curve : list
        weighting_function : Function
        Returns
        -------
        array(float64)
            The image radiance map (in log space)
        """
    */
    HDRTool.computeRadianceMapLayer = function(images, response_curve, width, height, channel)
    {
        // matrix of image w, h
        var num_images = images.length;
        var img_rad_map = new Float32Array(width * height);

        var log_exposure_times = this.log_exposure_times;
        var curves = new Float32Array(num_images);
        var weights = new Float32Array(num_images);

        // Find the middle image to use as the source for pixel intensity locations
        var mid_img = images[( num_images / 2 )|0];
        var avg = 0;

        for(var i = 0; i < width; i++)
        for(var j = 0; j < height; j++) {

            var index = height * i + j;

            // get here template average????
            avg += mid_img[index];


            for( var k = 0; k < num_images; k++ ) {
                var img_data = images[k];
                curves[k] = response_curve[ img_data[index] ];
                weights[k] = this.linearWeight( img_data[index] );
            }

            var SumW = weights.reduce((a, b) => a + b, 0);

            if(SumW > 0) {
                var A = numeric.div( numeric.mul(weights, numeric.sub(curves, log_exposure_times)), SumW );
                var value = A.reduce((a, b) => a + b, 0);
                img_rad_map[index] = value;
            }
            else
            {
                var imi = (num_images/2)|0;
                var value = curves[ imi ] - log_exposure_times[ imi ];
                img_rad_map[index] = value;
            }
        }

        this.tmp_avg[channel] = (avg/(width*height))/255.0;
        return img_rad_map;
    }

    /**
     */
    HDRTool.composeImageLayer = function( radiance_map, hdr_image, channel )
    {
        var num_channels = 3;

        // go through all radiance map as i
        // K begins in channel and k+=channel
        var k = channel;

        // save from here the max and min values
        var min = Infinity;
        var max = -Infinity;
        var avg = 0;

        for( var i = 0; i < radiance_map.length; i++){

            var value = radiance_map[i];
            
            hdr_image[k] = value;
            k+=num_channels;

            // save min, max, avg
            avg += value;
            if(value < min) min = value;
            else if(value > max) max = value;
        }

        this.hdr_min[channel] = min;
        this.hdr_max[channel] = max;
        this.hdr_avg[channel] = avg/radiance_map.length;
    }

    HDRTool.addAlphaChannel = function( array, value )
    {
        value = value || 255;
        var new_size = array.length + array.length/3;
        var data = new array.constructor(new_size);
        var k = 0;

        for( var i = 0; i < new_size;  )
        {
            data[i++] = array[k++];
            data[i++] = array[k++];
            data[i++] = array[k++];
            data[i++] = value;
        }

        return data;
    }

    // extract channels from RGBA
    HDRTool.extractChannels = function( img_data, size)
    {
        var values = [];
        img_data = img_data.slice(0, size*4); // get only valid pixels

        for( var n = 0; n < 3; n++ ) {

            var new_data = new Uint8Array( size );

            for(var i = n, id = 0; i < img_data.length; i+=4, id++)
            {
                new_data[id] = img_data[i];
            }
            values.push( new_data );
        }
        
        return values;
    }

    HDRTool.FastgetXYFromArray = function( array, width, prof, rows, cols, max_p) {

        var r = array.length;
        var index = 0;
    
        for(var i = 0; i < r; i++) {
    
            if(array[i] == prof) {
                rows[index] = ( i/width )|0;
                cols[index] = i % width;
                
                ++index;
    
                if(index > max_p)
                    return index;
            }
        }
    
        return index;
    }

    HDRTool.listToMatrix = function(list, elementsPerSubArray) {
        var matrix = [], i, k;
    
        for (i = 0, k = -1; i < list.length; i++) {
            if (i % elementsPerSubArray === 0) {
                k++;
                matrix[k] = [];
            }
    
            matrix[k].push(list[i]);
        }
    
        return matrix;
    }

    /*"""	Linear weighting function based on pixel intensity that reduces the
            weight of pixel values that are near saturation.
    """*/
    HDRTool.linearWeight = function( value )
    {
        var z_min = 0, z_max = 255;

        if( value <= ((z_min + z_max) / 2))
            return value - z_min;
        return z_max - value;
    }

    /* 
        Private methods used in parsing steps
    */

    function printVersion( v )
    {
        console.log( '%cHDRE v'+v, 'padding: 3px; background: rgba(0, 0, 0, 0.75); color: #6E6; font-weight: bold;' );
    }

    function isHDRE( texture_name )
    {
        return texture_name.toLowerCase().includes(".hdre");
    }

    function isEXR( texture_name )
    {
        return texture_name.toLowerCase().includes(".exr");
    }

    function isRadiance( texture_name )
    {
        return texture_name.toLowerCase().includes(".hdr");
    }

    function parseFaces( size, width, height, pixelData )
    {
        var faces = [],
            it = 0,
            F = HDRTool.CUBE_MAP_NEGATIVE_Y;
    
        for(var i = 0; i < 6; i++)
            faces[i] = new Float32Array(size);
    
        // get 3 vertical faces
        for(var i = 0; i < height; i++)
        {
            var x1_n = (width * 0.25) + (i * width),
                    x2_n = (width * 0.5) + (i * width);
    
            if( i === (height / 3) ) { F = HDRTool.CUBE_MAP_POSITIVE_Z; it = 0; }
            if( i === (height / 3) * 2 ) { F = HDRTool.CUBE_MAP_POSITIVE_Y; it = 0; }
    
            var line = pixelData.subarray(x1_n * 3, x2_n * 3);
            faces[F].set(line, it);
            it += line.length;
        }
    
        // from now get the rest from left to right
    
        it = 0;
        F = HDRTool.CUBE_MAP_NEGATIVE_X; // next face
        for(var i = (height / 3); i < (height / 3) * 2; i++)
        {
            var x1_n = (width * 0.0) + (i * width),
                    x2_n = (width * 0.25) + (i * width);
    
            var line = pixelData.subarray(x1_n * 3, x2_n * 3);
            faces[F].set(line, it);
            it += line.length;
        }
    
        it = 0;
        F = HDRTool.CUBE_MAP_POSITIVE_X; // next face
        for(var i = (height / 3); i < (height / 3) * 2; i++)
        {
                var x1_n = (width * 0.5) + (i * width),
                        x2_n = (width * 0.75) + (i * width);
    
                var line = pixelData.subarray(x1_n * 3, x2_n * 3);
                faces[F].set(line, it);
                it += line.length;
        }
    
        it = 0;
        F = HDRTool.CUBE_MAP_NEGATIVE_Z; // next face
        for(var i = (height / 3); i < (height / 3) * 2; i++)
        {
                var x1_n = (width * 0.75) + (i * width),
                        x2_n = (width * 1.0) + (i * width);
    
                var line = pixelData.subarray(x1_n * 3, x2_n * 3);
                faces[F].set(line, it);
                it += line.length;
        }

        // order faces
        var ret = [];

        ret.push( faces[HDRTool.CUBE_MAP_POSITIVE_X],
                faces[HDRTool.CUBE_MAP_POSITIVE_Y],
                faces[HDRTool.CUBE_MAP_POSITIVE_Z],
                faces[HDRTool.CUBE_MAP_NEGATIVE_X],
                faces[HDRTool.CUBE_MAP_NEGATIVE_Y],
                faces[HDRTool.CUBE_MAP_NEGATIVE_Z] );

        return ret;
    }

    function parseNullTerminatedString( buffer, offset ) {

        var uintBuffer = new Uint8Array( buffer );
        var endOffset = 0;
    
        while ( uintBuffer[ offset.value + endOffset ] != 0 ) 
            endOffset += 1;
    
        var stringValue = new TextDecoder().decode(
        new Uint8Array( buffer ).slice( offset.value, offset.value + endOffset )
        );
    
        offset.value += (endOffset + 1);
    
        return stringValue;
    
    }
    
    function parseFixedLengthString( buffer, offset, size ) {
    
        var stringValue = new TextDecoder().decode(
        new Uint8Array( buffer ).slice( offset.value, offset.value + size )
        );
    
        offset.value += size;
    
        return stringValue;
    
    }
    
    function parseUlong( buffer, offset ) {
    
        var uLong = new DataView( buffer.slice( offset.value, offset.value + 4 ) ).getUint32( 0, true );
        offset.value += 8;
        return uLong;
    }
    
    function parseUint32( buffer, offset ) {
    
        var Uint32 = new DataView( buffer.slice( offset.value, offset.value + 4 ) ).getUint32( 0, true );
        offset.value += 4;
        return Uint32;
    }
    
    function parseUint8( buffer, offset ) {
    
        var Uint8 = new DataView( buffer.slice( offset.value, offset.value + 1 ) ).getUint8( 0, true );
        offset.value += 1;
        return Uint8;
    }
    
    function parseFloat32( buffer, offset ) {
    
        var float = new DataView( buffer.slice( offset.value, offset.value + 4 ) ).getFloat32( 0, true );
        offset.value += 4;
        return float;
    }
    
    // https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript
    
    HDRTool.decodeFloat16 = decodeFloat16;
    
    function decodeFloat16( binary ) {
    
        var exponent = ( binary & 0x7C00 ) >> 10,
        fraction = binary & 0x03FF;
    
        return ( binary >> 15 ? - 1 : 1 ) * (
        exponent ?
            (
            exponent === 0x1F ?
                fraction ? NaN : Infinity :
                Math.pow( 2, exponent - 15 ) * ( 1 + fraction / 0x400 )
            ) :
            6.103515625e-5 * ( fraction / 0x400 )
        );
    
    }

    HDRTool.decodeFloat16 = decodeFloat16;
    
    function parseUint16( buffer, offset ) {
    
        var Uint16 = new DataView( buffer.slice( offset.value, offset.value + 2 ) ).getUint16( 0, true );
        offset.value += 2;
        return Uint16;
    }
    
    function parseFloat16( buffer, offset ) {
    
        return decodeFloat16( parseUint16( buffer, offset) );
    }
    
    function parseChlist( buffer, offset, size ) {
    
        var startOffset = offset.value;
        var channels = [];
    
        while ( offset.value < ( startOffset + size - 1 ) ) {
    
            var name = parseNullTerminatedString( buffer, offset );
            var pixelType = parseUint32( buffer, offset ); // TODO: Cast this to UINT, HALF or FLOAT
            var pLinear = parseUint8( buffer, offset );
            offset.value += 3; // reserved, three chars
            var xSampling = parseUint32( buffer, offset );
            var ySampling = parseUint32( buffer, offset );
        
            channels.push( {
                name: name,
                pixelType: pixelType,
                pLinear: pLinear,
                xSampling: xSampling,
                ySampling: ySampling
            } );
        }
    
        offset.value += 1;
    
        return channels;
    }
    
    function parseChromaticities( buffer, offset ) {
    
        var redX = parseFloat32( buffer, offset );
        var redY = parseFloat32( buffer, offset );
        var greenX = parseFloat32( buffer, offset );
        var greenY = parseFloat32( buffer, offset );
        var blueX = parseFloat32( buffer, offset );
        var blueY = parseFloat32( buffer, offset );
        var whiteX = parseFloat32( buffer, offset );
        var whiteY = parseFloat32( buffer, offset );
    
        return { redX: redX, redY: redY, greenX, greenY, blueX, blueY, whiteX, whiteY };
    }
    
    function parseCompression( buffer, offset ) {
    
        var compressionCodes = [
        'NO_COMPRESSION',
        'RLE_COMPRESSION',
        'ZIPS_COMPRESSION',
        'ZIP_COMPRESSION',
        'PIZ_COMPRESSION'
        ];
    
        var compression = parseUint8( buffer, offset );
    
        return compressionCodes[ compression ];
    
    }
    
    function parseBox2i( buffer, offset ) {
    
        var xMin = parseUint32( buffer, offset );
        var yMin = parseUint32( buffer, offset );
        var xMax = parseUint32( buffer, offset );
        var yMax = parseUint32( buffer, offset );
    
        return { xMin: xMin, yMin: yMin, xMax: xMax, yMax: yMax };
    }
    
    function parseLineOrder( buffer, offset ) {
    
        var lineOrders = [
        'INCREASING_Y'
        ];
    
        var lineOrder = parseUint8( buffer, offset );
    
        return lineOrders[ lineOrder ];
    }
    
    function parseV2f( buffer, offset ) {
    
        var x = parseFloat32( buffer, offset );
        var y = parseFloat32( buffer, offset );
    
        return [ x, y ];
    }
    
    function parseValue( buffer, offset, type, size ) {
    
        if ( type == 'string' || type == 'iccProfile' ) {
            return parseFixedLengthString( buffer, offset, size );
        } else if ( type == 'chlist' ) {
            return parseChlist( buffer, offset, size );
        } else if ( type == 'chromaticities' ) {
            return parseChromaticities( buffer, offset );
        } else if ( type == 'compression' ) {
            return parseCompression( buffer, offset );
        } else if ( type == 'box2i' ) {
            return parseBox2i( buffer, offset );
        } else if ( type == 'lineOrder' ) {
            return parseLineOrder( buffer, offset );
        } else if ( type == 'float' ) {
            return parseFloat32( buffer, offset );
        } else if ( type == 'v2f' ) {
            return parseV2f( buffer, offset );
        } 
    }

    if(window.numbers)
    {
        numbers.matrix.pinv = function(M) {

            if(M.length < M[0].length)
                return linalg.transposeSync(linalg.pinvSync(linalg.transposeSync(M)))
            else
                return linalg.pinvSync(M)
        }
    }
	

	// http://locutus.io/c/math/frexp/
	Math.frexp = function(arg) {

	  arg = Number(arg)

	  const result = [arg, 0]

	  if (arg !== 0 && Number.isFinite(arg)) {
		const absArg = Math.abs(arg)
		// Math.log2 was introduced in ES2015, use it when available
		const log2 = Math.log2 || function log2 (n) { return Math.log(n) * Math.LOG2E }
		let exp = Math.max(-1023, Math.floor(log2(absArg)) + 1)
		let x = absArg * Math.pow(2, -exp)

		while (x < 0.5) {
		  x *= 2
		  exp--
		}
		while (x >= 1) {
		  x *= 0.5
		  exp++
		}

		if (arg < 0) {
		  x = -x
		}
		result[0] = x
		result[1] = exp
	  }
	  return result
	}

	Math.ldexp = function(mantissa, exponent) {
		var steps = Math.min(3, Math.ceil(Math.abs(exponent) / 1023));
		var result = mantissa;
		for (var i = 0; i < steps; i++)
			result *= Math.pow(2, Math.floor((exponent + i) / steps));
		return result;
	}


	// https://github.com/OpenImageIO/oiio/blob/master/src/hdr.imageio/rgbe.cpp
	function rgbe2float( rgbe )
	{
		var f;

		if (rgbe[3] > 0) {   /*nonzero pixel*/
			f = Math.ldexp(1.0, rgbe[3] - (128+8));
			rgbe[0] *= f;
			rgbe[1] *= f;
			rgbe[2] *= f;
			rgbe[3] = 1;
		}
		else {
			rgbe[0] = rgbe[1] = rgbe[2] = 0;
			rgbe[3] = 1;
		}

		return rgbe;
	}

	function float2rgbe(x, y, z)
	{
		var m, e;
		var rgbe = new Float32Array(4);
		var r, g, b;

		if(y === undefined && z === undefined) {
			// x is a vector
			if(x.length < 3)
				throw("bad params")
			r = x[0];
			g = x[1];
			b = x[2];
		}
		else {
			r = x;
			g = y;
			b = z;
		}

		var v = Math.max(r, g, b);

		if(isNaN(v)) {
		
			console.log(x, y, z);
			console.log(r, g, b);
			throw("NaN");
		
		}
		
		if (v == 0.0) {
			rgbe[0] = rgbe[1] = rgbe[2] = rgbe[3] = 0;
		}
		else {
			[m, e] = Math.frexp(v);
			v = m * (256.0 / v);
			rgbe[0] = parseInt((r * v));
			rgbe[1] = parseInt((g * v));
			rgbe[2] = parseInt((b * v));
			rgbe[3] = parseInt((e + 128));
		}

		return rgbe;
	}

	Float32Array.prototype.toRGBE = function(){

		var length = this.length;
		var data = new Uint8Array( length );
		
		for( var i = 0; i < length; i+=4 )
		{
			var rgbei = float2rgbe( this[i],this[i+1],this[i+2] );
			data[i] = rgbei[0];
			data[i+1] = rgbei[1];
			data[i+2] = rgbei[2];
			data[i+3] = rgbei[3];
		}
		
		return data;

	}

	Uint8Array.prototype.toFloat = function(){

		var length = this.length;
		var data = new Float32Array( length );

		for( var i = 0; i < length; i+=4 )
		{
			var floated = rgbe2float( [this[i],this[i+1],this[i+2],this[i+3]] );
			data[i] = floated[0];
			data[i+1] = floated[1];
			data[i+2] = floated[2];
			data[i+3] = 1.0;
		}
		
		return data;

	}

	HDRTool.COPY_CUBEMAP_FSHADER = `
		
		precision highp float;
		varying vec2 v_coord;
		uniform vec4 u_color;
		uniform vec4 background_color;
		uniform vec3 u_camera_position;
		uniform samplerCube u_color_texture;
		uniform mat3 u_rotation;
		uniform bool u_flip;

		void main() {

			vec2 uv = vec2( v_coord.x, 1.0 - v_coord.y );
			vec3 dir = vec3( uv - vec2(0.5), 0.5 );
			dir = u_rotation * dir;

			if(u_flip)
				dir.x *= -1.0;

			gl_FragColor = textureCube(u_color_texture, dir);
		}
	
	`;

	HDRTool.SPHERE_MAP_FSHADER = `
		
		precision highp float;
		varying vec2 v_coord;
		uniform vec4 u_color;
		uniform vec4 background_color;
		uniform vec3 u_camera_position;
		uniform sampler2D u_color_texture;
		uniform mat3 u_rotation;

		vec2 getSphericalUVs(vec3 dir)
		{
			dir = normalize(dir);
			dir = -dir;
			float d = sqrt(dir.x * dir.x + dir.y * dir.y);
			float r = 0.0;

			if(d > 0.0)
				r = 0.159154943 * acos(dir.z) / d;

	    		float u = 0.5 + dir.x * (r);
			float v = 0.5 + dir.y * (r);

			return vec2(u, v);
		}

		void main() {

			vec2 uv = vec2( v_coord.x, 1.0 - v_coord.y );
			vec3 dir = vec3( uv - vec2(0.5), 0.5 );
			dir = u_rotation * dir;
			
			dir.x = -dir.x;

			// use dir to calculate spherical uvs
			vec2 spherical_uv = getSphericalUVs( dir );
			vec4 color = texture2D(u_color_texture, spherical_uv);
			gl_FragColor = color;
		}
	
	`;

	HDRTool.LATLONG_MAP_FSHADER = `
		
		precision highp float;
		varying vec2 v_coord;
		uniform vec4 u_color;
		uniform vec4 background_color;
		uniform vec3 u_camera_position;
		uniform sampler2D u_color_texture;
		uniform mat3 u_rotation;

		#define PI 3.1415926535897932384626433832795

		vec2 getPanoramicUVs(vec3 dir)
		{
			dir = -normalize(dir);

	    		float u = 1.0 + (atan(dir.x, -dir.z) / PI);
			float v = acos(-dir.y) / PI;

			return vec2(u/2.0, v);
		}

		void main() {

			vec2 uv = vec2( v_coord.x, 1.0 - v_coord.y );
			vec3 dir = vec3( uv - vec2(0.5), 0.5 );
			dir = u_rotation * dir;

			vec2 panoramic_uv = getPanoramicUVs( dir );
			vec4 color = texture2D(u_color_texture, panoramic_uv);
			gl_FragColor = color;
		}
	
	`;

	HDRTool.BRDF_SAMPLING_SHADERCODE = `

		/* -- Tangent Space conversion -- */
		vec3 tangent_to_world(vec3 vector, vec3 N, vec3 T, vec3 B)
		{
		  return T * vector.x + B * vector.y + N * vector.z;
		}
		vec2 noise2v(vec2 co)  {
		    return vec2(
				fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453),
				fract(sin(dot(co.yx ,vec2(12.9898,78.233))) * 43758.5453)
			);
		}
		float noise(vec2 co)  {
		    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
		}
		vec3 sample_ggx(vec3 rand, float a2)
		{
		  /* Theta is the aperture angle of the cone */
		  float z = sqrt((1.0 - rand.x) / (1.0 + a2 * rand.x - rand.x)); /* cos theta */
		  float r = sqrt(max(0.0, 1.0 - z * z));                        /* sin theta */
		  float x = r * rand.y;
		  float y = r * rand.z;

		  /* Microfacet Normal */
		  return vec3(x, y, z);
		}
		vec3 hammersley_3d(float i, float invsamplenbr)
		{
		  vec3 Xi; /* Theta, cos(Phi), sin(Phi) */

		  Xi.x = i * invsamplenbr; /* i/samples */
		  Xi.x = fract(Xi.x + jitternoise.x);

		  int u = int(mod(i + jitternoise.y * HAMMERSLEY_SIZE, HAMMERSLEY_SIZE));

		  Xi.yz = texture2D(u_hammersley_sample_texture, vec2(u, 0)).rg;

		  return Xi;
		}
		vec2 Hammersley(const in int index, const in int numSamples){
			vec2 r = fract(vec2(float(index) * 5.3983, float(int(int(2147483647.0) - index)) * 5.4427));
			r += dot(r.yx, r.xy + vec2(21.5351, 14.3137));
			return fract(vec2(float(index) / float(numSamples), (r.x * r.y) * 95.4337));
		}
		vec3 sample_ggx(float nsample, float a2, vec3 N, vec3 T, vec3 B)
		{
			vec3 Xi = vec3(
				Hammersley(int(nsample), sampleCount),
				0.0
			);
			// Xi = hammersley_3d(nsample, float(1.0/float(sampleCount)));
			vec3 Ht = sample_ggx(Xi, a2);
			return tangent_to_world(Ht, N, T, B);
		}
		float G1_Smith_GGX(float NX, float a2)
		{
		  /* Using Brian Karis approach and refactoring by NX/NX
		   * this way the (2*NL)*(2*NV) in G = G1(V) * G1(L) gets canceled by the brdf denominator 4*NL*NV
		   * Rcp is done on the whole G later
		   * Note that this is not convenient for the transmission formula */
		  return NX + sqrt(NX * (NX - NX * a2) + a2);
		  /* return 2 / (1 + sqrt(1 + a2 * (1 - NX*NX) / (NX*NX) ) ); /* Reference function */
		}
		
	`;

	HDRTool.BRDF_VSHADER = `
		
		precision highp float;

		attribute vec3 a_vertex;
		attribute vec3 a_normal;
		attribute vec2 a_coord;

		varying vec2 v_coord;
		varying vec3 v_vertex;

		void main(){
			v_vertex = a_vertex;
			v_coord  = a_coord;
			vec3 pos = v_vertex * 2.0 - vec3(1.0);
			gl_Position = vec4(pos, 1.0);
		}
	`;

	HDRTool.BRDF_FSHADER = `

		// BLENDER METHOD
		precision highp float;
		varying vec2 v_coord;
		varying vec3 v_vertex;
		vec2 jitternoise = vec2(0.0);

		uniform sampler2D u_hammersley_sample_texture;

		#define sampleCount 8192
		#define PI 3.1415926535897932384626433832795
		
		const float HAMMERSLEY_SIZE = 8192.0; 

		`  +  HDRTool.BRDF_SAMPLING_SHADERCODE +  `
		
		 void main() {

			vec3 N, T, B, V;

			float NV = ((clamp(v_coord.y, 1e-4, 0.9999)));
			float sqrtRoughness = clamp(v_coord.x, 1e-4, 0.9999);
			float a = sqrtRoughness * sqrtRoughness;
			float a2 = a * a;

			N = vec3(0.0, 0.0, 1.0);
			T = vec3(1.0, 0.0, 0.0);
			B = vec3(0.0, 1.0, 0.0);
			V = vec3(sqrt(1.0 - NV * NV), 0.0, NV);

			// Setup noise (blender version)
			jitternoise = noise2v(v_coord);

			 /* Integrating BRDF */
			float brdf_accum = 0.0;
			float fresnel_accum = 0.0;
			for (int i = 0; i < sampleCount; i++) {
				vec3 H = sample_ggx(float(i), a2, N, T, B); /* Microfacet normal */
				vec3 L = -reflect(V, H);
				float NL = L.z;

				if (NL > 0.0) {
					float NH = max(H.z, 0.0);
					float VH = max(dot(V, H), 0.0);

					float G1_v = G1_Smith_GGX(NV, a2);
					float G1_l = G1_Smith_GGX(NL, a2);
					float G_smith = 4.0 * NV * NL / (G1_v * G1_l); /* See G1_Smith_GGX for explanations. */

					float brdf = (G_smith * VH) / (NH * NV);
					float Fc = pow(1.0 - VH, 5.0);

					brdf_accum += (1.0 - Fc) * brdf;
					fresnel_accum += Fc * brdf;
				}
			}

			brdf_accum /= float(sampleCount);
			fresnel_accum /= float(sampleCount);

			gl_FragColor = vec4(brdf_accum, fresnel_accum, 0.0, 1.0);
		}
	`;

    //footer
    
    })( typeof(window) != "undefined" ? window : (typeof(self) != "undefined" ? self : global ) );
    
    