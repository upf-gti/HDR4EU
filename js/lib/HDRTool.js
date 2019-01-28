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
            var options = {
                format: gl.RGBA,
                type: gl.FLOAT,
                texture_type: GL.TEXTURE_CUBE_MAP,
                pixel_data: _envs[i].data
            };

            var texture = null;
            Texture.setUploadOptions( {no_flip: true} );
            texture = new GL.Texture( _envs[i].width, _envs[i].width, options);

            Texture.setUploadOptions();
            textures.push( texture );
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
            data: byteArray,
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
    HDRTool.toTexture = function( data, cubemap_size )
    {
        if(!data)
        throw( "No data to get texture" );

        var width = data.width,
            height = data.height;

        var is_cubemap = ( width/4 === height/3 && GL.isPowerOfTwo(width) ) ? true : false;

        // tiny exr library always adds an extra channel we want to remove

        var oldSize = data.data.length,
            newSize = oldSize * (3/4),
            compressed_data = new Float32Array( newSize ),
            it = 0;

        for(var i = 0; i < oldSize; i += 4){
                compressed_data[it] = data.data[i];
                compressed_data[it+1] = data.data[i+1];
                compressed_data[it+2] = data.data[i+2];
                compressed_data[it+2] = data.data[i+2];
                it+=3;
        }

        var channels = compressed_data.length / (width * height);
        if(channels > 3)
            throw "Error when removing the extra channel";

        var pixelData = compressed_data;
        var pixelFormat = gl.RGB;

        if(!width || !height)
        throw( 'No width or height to generate Texture' );

        if(!pixelData)
        throw( 'No data to generate Texture' );

        var texture = null;
        
        // Set to default options (flip y)
        Texture.setUploadOptions({});

        var options = {
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

            options.texture_type = GL.TEXTURE_CUBE_MAP;
            options.pixel_data = faces;

            texture = new GL.Texture( width, height, options);
            texture.is_cubemap = is_cubemap;
        }
        else // basic texture or sphere map
            texture = new GL.Texture( width, height, options);
            
        // texture properties
        texture.wrapS = gl.CLAMP_TO_EDGE;
        texture.wrapT = gl.CLAMP_TO_EDGE;
        texture.magFilter = gl.LINEAR;
        texture.minFilter = gl.LINEAR_MIPMAP_LINEAR;

        // texture here has been flipped 
        Texture.setUploadOptions({});

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

        Texture.setUploadOptions( this.cubemap_upload_options );

        //save state
        var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
        var viewport = gl.getViewport();
        var fb = gl.createFramebuffer();
        gl.bindFramebuffer( gl.FRAMEBUFFER, fb );
        gl.viewport(0,0, size, size);

        var shader_name = (tex.width == tex.height * 2) ? "fromPanoramic" : "fromSphere";
        var shader = renderer.shaders[ shader_name ];

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
    */
    HDRTool.brdf = function( shader )
    {
        var tex_name = '_brdf_integrator';
       
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
    * @param {string} e
    * @param {Num} type
    */
    HDRTool.getSkybox = function( e, type)
    {
		
		var array_type = Float32Array;
		
		console.log(type);

		if(type == GL.UNSIGNED_BYTE) 
			array_type = Uint8Array;

				console.log(array_type);


        /**
         * GET HERE THE DATA TO AVOID DEPENDENCIES OF WEBGL IN HDRE.JS
         */

        var env = this.processSkybox(e);
        var width = env.width;
        var height = env.height;
        var package = [ env ];
        var acc_size = width * height;

        // Get all roughness levels
        for(var i = 0; i < 5; i++)
        {
            let a = '_prem_'+i+'_'+e;;
            let _env = this.processSkybox(a);

            let w = _env.width;
            let h = _env.height;

            // update final size
            acc_size += w * h;
            package.push( _env );
        }

        var buffer = HDRE.write( package, width, height, acc_size, {type: array_type} );
        LiteGUI.downloadFile( e.replace(".exr", ".hdre"), new array_type(buffer) );
    }

    /**
    * Get info of a texture (pixel data per face, width and height )
    * @method processSkybox
    */
    HDRTool.processSkybox = function(e)
    {
        if(!gl)
        throw( 'no webgl' );

        var env = gl.textures[e];
        if(!env)
        throw( 'no stored texture' );

        var info = {width: env.width, height: env.height, pixelData: []};

        for(var i = 0; i < 6; i++)
            info.pixelData.push( env.getPixels(i) );

        return info;
    }

    /**
    * Opens a texture in a new window to download
    * @method download
    * @param {string} name
    */
    HDRTool.download = function(name)
    {
        var tex = gl.textures[name];
        if(!tex)
            return;

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
    
    