/*
*   Alex Rodriguez
*   @jxarco 
*/

// HDRTool.js 
// Dependencies: litegl.js & tinyexr.js

//main namespace
(function(global){

    /**
     * Main namespace
     * @namespace HDRTool
     */

    if(!GL)
    throw( "HDRTool.js needs litegl.js to work" );

    /*if(!Module.EXRLoader)
    throw( "HDRTool.js needs tinyexr.js to work" );*/
    
    
    var HDRTool = global.HDRTool = RT = {

        version: 1.0,
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

        // ldr stuff
        files_loaded: [],
        files_to_load: 0,
        log_exposure_times: [ 
            //1/160,	
            // 1/125,
            //1/80,
            // 1/60,	
            //1/40,	
            // 1/15
        ],
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

            console.time('Parsed in');
            var result = null;

            if(isHDRE(tex_name))
                that.parseHDRE( buffer, tex_name, onprogress );

            else if(isEXR(tex_name))
            {
                var data = that.parseEXR( buffer );
                result = HDRTool.toTexture(data, options.size);
                gl.textures[ tex_name ] = result;
            }

            else
                throw("file format not accepted");

            console.timeEnd('Parsed in');

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
        var _envs = r._envs;
        var header = r.header;
        var textures = [];

        // create textures
        for(var i = 0; i < _envs.length; i++)
        {
            var type = GL.FLOAT;
            var data = _envs[i].data;

            if(header.array_type == 01) // UBYTE
                type = GL.UNSIGNED_BYTE;
            if(header.array_type == 02) // HALF FLOAT
                type = GL.HALF_FLOAT_OES;

            var options = {
                format: gl.RGBA,
                type: type,
                texture_type: GL.TEXTURE_CUBE_MAP,
                pixel_data: data
            };

            Texture.setUploadOptions( {no_flip: true} );
            textures.push( new GL.Texture( _envs[i].width, _envs[i].width, options) );
            Texture.setUploadOptions();
        }

		var version = header.version;

		if(version < 1.3)
		{
			console.error('old version, update file!');
		}

        printVersion( version );

        // store the texture 
        gl.textures[tex_name] = textures[0];
        gl.textures["_prem_0_"+tex_name] = textures[1];
        gl.textures["_prem_1_"+tex_name] = textures[2];
        gl.textures["_prem_2_"+tex_name] = textures[3];
        gl.textures["_prem_3_"+tex_name] = textures[4];
        gl.textures["_prem_4_"+tex_name] = textures[5];
    }

    /**
    * Parse the input data and get all the EXR info 
    * @method parseExr
    * @param {ArrayBuffer} buffer 
    * @param {Number} cubemap_size 
    */
    HDRTool.parseEXR = function( buffer, cubemap_size )
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

        // tiny exr library always adds an extra channel we want to remove

		var channels = data.numChannels;
		var pixelData = data.rgba;
		var pixelFormat = gl.RGB;

		if(channels > 3)
		{
			var oldSize = pixelData.length,
            newSize = oldSize * (3/4),
            compressed_data = new Float32Array( newSize ),
            it = 0;

			for(var i = 0; i < oldSize; i += 4){
					compressed_data[it] = pixelData[i];
					compressed_data[it+1] = pixelData[i+1];
					compressed_data[it+2] = pixelData[i+2];
					it+=3;
			}

			channels = compressed_data.length / (width * height);

			 if(channels > 3)
				throw "Error when removing the extra channel";
			 else
				pixelData = compressed_data;
		}

        if(!width || !height)
        throw( 'No width or height to generate Texture' );

        if(!pixelData)
        throw( 'No data to generate Texture' );

        var texture = null;
        
		// Set to default options (flip y)
		if(options.no_flip)
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

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
            texture.is_cubemap = is_cubemap;
        }
        else // basic texture or sphere map
            texture = new GL.Texture( width, height, params);
            
        // texture properties
        texture.wrapS = gl.CLAMP_TO_EDGE;
        texture.wrapT = gl.CLAMP_TO_EDGE;
        texture.magFilter = gl.LINEAR;
        texture.minFilter = gl.LINEAR_MIPMAP_LINEAR;

        // default upload options
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        if(is_cubemap)
            return texture;
        
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

        var shader_name = (tex.width == tex.height * 2) ? "fromPanoramic" : "fromSphere";
        var shader = gl.shaders[ shader_name ];

        if(!shader)
            throw( "No shader" );

        // Bind original texture
        tex.bind(0);
        var mesh = Mesh.getScreenQuad();
        mesh.bindBuffers( shader );
        shader.bind();

        var cubemap_texture = new GL.Texture( size, size, { format: tex.format, texture_type: GL.TEXTURE_CUBE_MAP, type: gl.FLOAT } );
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

        return cubemap_texture;
    }

    /**
    * Precalculate different ems blurred for different roughness values 
    * @method prefilter
    * @param {string} file
    * @param {Object} options (shader, oncomplete, data)
    */
    HDRTool.prefilter = function(file, options)
    {
		if(!this.FIRST_PASS)
		{
			if(options.oncomplete)
                options.oncomplete();
			return;
		}

		console.warn("STEP: Prefilter");
		
        var options = options || {};
        var tex_name = this.getName( file );
        var tex = gl.textures[tex_name];
		var blocks = 8;
        var that = this;

		this.LOAD_STEPS = 5 /*Levels*/ * 6 /*Faces*/ * blocks;

        var shader = options.shader || "defblur";
        if(shader.constructor !== GL.Shader)
            shader = gl.shaders[ shader ];

        var inner = function( tex )
        {
            // prefilter texture 5 times to get some blurred samples
            for( let level = 0; level < 5; level++ )
            {
				let name = '_prem_'+level+'_'+tex_name;
				// prefilter (result tex dimensions depends on the level of blur)
				that.deferredBlur( tex, (level+1), shader, blocks, function(result) {
					// store
					gl.textures[name] = result;

					if(options.oncomplete && level == 4)
						options.oncomplete();
				});
            }

            
        };

        if(!tex)
        {
            var params = {oncomplete: inner};
            
            if(options.data)
                params['data'] = options.data;
            if(options.size)
                params['size'] = options.size;
            
            this.load( file, params );        
        }
        else
            inner( tex );
    }

    /**
    * Gets info to blur in later pass
    * @method getBlurData
    * @param {Texture} input
    * @param {Number} level
    * @param {Shader} shader
    */
    HDRTool.getBlurData = function(input, level, blocks)
    {
        var size = input.height; // by default

        if(level)
            size = input.height / Math.pow(2, level);

        var roughness_range = [0.2, 0.4, 0.6, 0.8, 1];
        var roughness = roughness_range[ level-1 ] || 0;
        var blocks = blocks || 32;
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
                        'u_roughness': roughness,
                        'u_ioffset': j * (1/blocks),
                        'u_cameras': cubemap_cameras
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

        return deferredInfo;
    }

    /**
    * Blurs a texture calling different draws from data
    * @method deferredBlur
    * @param {Texture} input
    * @param {Number} level
    * @param {Shader||String} shader
	* @param {Number} number of blocks
    */
    HDRTool.deferredBlur = function(input, level, shader, blocks, oncomplete)
    {
		var blocks = blocks || 4;
        var data = this.getBlurData(input, level, blocks);
		// The next prefilter is not first pass
		this.FIRST_PASS = false;
        //console.log(data);

        if(!data)
        throw('no data to blur');
        
        var result = new GL.Texture( data.size, data.size, { format: input.format, texture_type: GL.TEXTURE_CUBE_MAP, type: gl.FLOAT } );
        var current_draw = 0;

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
            shader.bind();
            mesh.bindBuffers( shader );

            gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + drawInfo.face, result.handler, 0);
            gl.viewport( drawInfo.viewport[0], drawInfo.viewport[1], drawInfo.viewport[2], drawInfo.viewport[3] );
            
            shader.uniforms( drawInfo.uniforms );
            gl.drawArrays( gl.TRIANGLES, 0, 6 );

            mesh.unbindBuffers( shader );

            //restore previous state each draw
            gl.setViewport(viewport); //restore viewport
            gl.bindFramebuffer( gl.FRAMEBUFFER, current_fbo ); //restore fbo
            gl.bindTexture(result.texture_type, null);
        }

		var that = this;

        var int = setInterval( function() {

            inner_blur();
			current_draw++;
			that.CURRENT_STEP++;

            // update progress bar
			var step = (that.CURRENT_STEP / that.LOAD_STEPS) * 100;
			$('.pbar').css('width', step + "%");

			if(that.CURRENT_STEP == that.LOAD_STEPS)
			{
				that.CURRENT_STEP = 0;
			}


            if(current_draw == data.draws.length)
            {
                clearInterval(int);

                if(oncomplete)
                    oncomplete( result );
            }
        }, 100 );
    }

    /**
    * Blurs a texture depending on the roughness
    * @method blur
    * @param {Texture} input
    * @param {Number} level
    * @param {Shader||String} shader
    */
    HDRTool.blur = function(input, level, shader, debug)
    {
        var size = input.height; // by default

        if(level)
            size = input.height / Math.pow(2, level);

        var roughness_range = [0.2, 0.4, 0.6, 0.8, 1];
        var roughness = roughness_range[ level-1 ];

        if(level == 0)
        roughness = 0;

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

    /**
    * Environment BRDF (Store it in a 2D LUT)
    * @method brdf
    * @param {Shader||String} shader
	* @param {bool} multiscattering
    */
    HDRTool.brdf = function( shader, multiscattering )
    {
        var tex_name = '_brdf_integrator';
     
		if(multiscattering)
			tex_name += '_multi';

        if(shader.constructor !== GL.Shader)
            shader = gl.shaders[ shader ];

        if(!shader)
            throw( "No shader" );

        var tex = gl.textures[tex_name] = new GL.Texture(512,512, { type: gl.HIGH_PRECISION_FORMAT, texture_type: gl.TEXTURE_2D, wrap: gl.CLAMP_TO_EDGE, minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR });

        tex.drawTo(function(texture) {
            shader.uniforms({}).draw(Mesh.getScreenQuad(), gl.TRIANGLES);
        });

        tex.bind(0);
        gl.generateMipmap(gl.TEXTURE_2D);
        tex.unbind(0);
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
    * @param {string} environment
    * @param {ArrayConstructor} array
    */
    HDRTool.getSkybox = function( environment, array )
    {
		if(!array) 
            array = Float32Array;

        var texture = gl.textures[ environment ];
        var temp = null;
        var width = texture.width;
        var height = texture.height;
        var totalSize = width * height;
            
        if(array === Uint16Array) {
            // in case of half_float: convert to 16 bits from 32 using gpu
            temp = new Texture( width, height, {type: GL.HALF_FLOAT_OES, texture_type: GL.TEXTURE_CUBE_MAP} );
            
            var shader = gl.shaders["copyCubemap"];
            
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
        
        var env = this.processSkybox( temp ? temp : texture );
        var data = [ env ];

        // Get all roughness levels
        for(var i = 0; i < 5; i++)
        {
            let name = '_prem_' + i +'_' + environment;
            let _processed = this.processSkybox(name);
            data.push( _processed );

            // update final size
            totalSize += _processed.width * _processed.height;
        }

        var buffer = HDRE.write( data, width, height, totalSize, {type: array} );
        LiteGUI.downloadFile( environment.replace(".exr", ".hdre"), new array(buffer) );
    }

    /**
    * Get info of a texture (pixel data per face, width and height )
    * @method processSkybox
    */
    HDRTool.processSkybox = function( e )
    {
        if(!gl)
        throw( 'no webgl' );

        if(e.constructor === String)
            e = gl.textures[ e ];

        if(!e)
        throw( 'no stored texture' );

        var info = {width: e.width, height: e.height, pixelData: []};

        for(var i = 0; i < 6; i++)
            info.pixelData.push( e.getPixels(i) );

        return info;
    }

    /**
    * Opens a texture in a new window to download
    * @method download
    * @param {string} name
    */
    HDRTool.downloadTexture = function(name)
    {
        var tex = gl.textures[name];
        if(!tex) {
            console.error("no texture named " + name);
            return;
        }
        var canvas = tex.toCanvas();
        var a = document.createElement("a");
        a.download = name + ".png";
        a.href = canvas.toDataURL();
        a.title = "Texture image";
        a.appendChild(canvas);
        var new_window = window.open();
        new_window.document.title.innerHTML = "Texture image";
        new_window.document.body.appendChild(a);
        new_window.focus();
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
    
    Object.assign( HDRTool, {

        parseCR2: function( buffer )
        {
            var ifds = UTIF.decode(buffer);
            var img = ifds[0];
            UTIF.decodeImage(buffer, img);
            img.rgba8 = UTIF.toRGBA8(img);
            return img;
        },

        parseJPG: function( buffer )
        {
            var decoder = new JpegImage();
            decoder.parse( new Uint8Array(buffer) );

            var w = decoder.width, h = decoder.height;
            var data = decoder.getData(w, h);

            return {
                rgba8: this.addAlphaChannel(data),
                width: w,
                height: h,
                data: data
            };
        },
        
        parsePNG: function( buffer )
        {
            var img  = UPNG.decode(buffer);        // put ArrayBuffer of the PNG file into UPNG.decode
            img.rgba8 = this.addAlphaChannel(img.data );
            return img;
        },
        
        parseLDRI: function( buffer, extension )
        {
            switch(extension){
                
                case 'cr2':
                    return this.parseCR2( buffer );
                case 'jpg':
                    return this.parseJPG( buffer )
                case 'png':
                    return this.parsePNG( buffer )
            }
        
        },

		_sortFiles: function()
		{
			this.files_loaded.sort(function(a, b){
			
				if(!a.exp_time || !b.exp_time)
					console.warn("missing exp times");

				return a.exp_time - b.exp_time;
			
			});

			this.log_exposure_times.sort(function(a, b){
			
				return a - b;
			
			});
		},
        
        loadLDRI: function( content, extension, name, callback )
        {
            var that = this;

            var getParams = function (e) {

                var data = e ? e.target.result : content;
                let img = that.parseLDRI(data, extension);

                img.name = name;
                img.rgb = that.extractChannels(img.rgba8, img.width*img.height);
				img.url = URL.createObjectURL( content );

                // fill exposures in case of CR2
                if( !img['exifIFD'] ) {

					// allow editing later
					img.exp_time = 1/(1+that.files_loaded.length);
					evaluate(img);
                }
                else{
                
					var t = img['exifIFD']['t33434'][0];
                    // that.log_exposure_times.push( t );
					img.exp_time = t;
					evaluate(img);
                }
             
            };

			var evaluate = function (img) {
                
                Texture.setUploadOptions( {no_flip: false} );
                var tex = new GL.Texture( img.width, img.height, {pixel_data: img.rgba8, format: gl.RGBA } );

                gl.textures[img.name] = tex;
                that.files_loaded.push( img );

                var prog_width = (that.files_loaded.length / that.files_to_load) * 100;
                
                // all files loaded
                if(prog_width == 100)
                { 
					console.log("Images loaded");
					that._sortFiles();

					if(callback)
						callback();
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
        },

		getUniforms: function()
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
		},

        /*
            This method computes the final HDR image with the radiance map 
            of every image channel 

            Returns array(channels) of array(w*h)
        */
        computeOutput: function( images )
        {
            images = images || this.files_loaded;
		
			this._sortFiles(images);

			var that = this;
            const channels = 3;
            const smoothing_lambda = 100;

            const width = images[0].width;
            const height = images[0].height;

            var hdr_image = new Float32Array( width * height * channels );
            this.hdr_image = hdr_image;

			this.log_exposure_times.length = 0;
			images.forEach( function(element){ that.log_exposure_times.push(element.exp_time) } );
            
            // shader: normalize, tonemap, adjust, normalize

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

            this.max_lum = -Infinity;
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
                    
            }
            console.timeEnd('compute');

            gl.textures["combined"] = new GL.Texture( width, height, {type: GL.FLOAT, pixel_data: hdr_image, format: gl.RGB } );
        },

        _GPU_downloadHDR: function()
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
        },

        /*
            This method normalizes the final HDR image in the CPU
        */
        _CPU_downloadHDR: function()
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
        },

        normalize: function( Xi )
        {
            var pixel = new Float32Array(3);
            var maxLum = this.max_lum_pixel;
            var minLum = this.min_lum_pixel;

            pixel[0] = (1.0)/(maxLum[0]-minLum[0])*(Xi[0]-minLum[0]);
            pixel[1] = (1.0)/(maxLum[1]-minLum[1])*(Xi[1]-minLum[1]);
            pixel[2] = (1.0)/(maxLum[2]-minLum[2])*(Xi[2]-minLum[2]);

            return pixel;
        },

        scaleToRadiance: function( Xi, max_radiance )
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
        },

        adjustIntensity: function( Xi, BIAS, max_radiance )
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
        },

        sampleIntensitiesLayer: function( images, width )
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
        },

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
        computeResponseCurveLayer: function(intensity_samples, images, smoothing_lambda)
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
        },
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
        computeRadianceMapLayer: function(images, response_curve, width, height, channel)
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
        },

        /**
         */
        composeImageLayer: function( radiance_map, hdr_image, channel )
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
        },

        addAlphaChannel: function( array, value )
        {
            value = value || 1;
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
        },

        // extract channels from RGBA
        extractChannels: function( img_data, size)
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
        },

        FastgetXYFromArray: function( array, width, prof, rows, cols, max_p) {

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
        },

        listToMatrix: function(list, elementsPerSubArray) {
            var matrix = [], i, k;
        
            for (i = 0, k = -1; i < list.length; i++) {
                if (i % elementsPerSubArray === 0) {
                    k++;
                    matrix[k] = [];
                }
        
                matrix[k].push(list[i]);
            }
        
            return matrix;
        },

        /*"""	Linear weighting function based on pixel intensity that reduces the
                weight of pixel values that are near saturation.
        """*/
        linearWeight: function( value )
        {
            var z_min = 0, z_max = 255;

            if( value <= ((z_min + z_max) / 2))
                return value - z_min;
            return z_max - value;
        }
    } )

    /* 
        Private methods used in parsing steps
    */

    function printVersion( v )
    {
        console.log( '%cHDRE v'+v, 'padding: 3px; background: black; color: #6E6; font-weight: bold;' );
    }

    function isHDRE( texture_name )
    {
        return texture_name.toLowerCase().includes(".hdre");
    }

    function isEXR( texture_name )
    {
        return texture_name.toLowerCase().includes(".exr");
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
    
    //footer
    
    })( typeof(window) != "undefined" ? window : (typeof(self) != "undefined" ? self : global ) );
    
    