/*
*   Alex Rodriguez
*   @jxarco 
*/

// EXRTool.js 
// Dependencies: litegl.js & tinyexr.js

//main namespace
(function(global){

    /**
     * Main namespace
     * @namespace EXRTool
     */
    
    /**
     * the global namespace, access it using WS.
     * @class .
     */

    
    if(!GL)
    throw( "EXRTool.js needs litegl.js to work" );

    if(!Module.EXRLoader)
    throw( "EXRTool.js needs tinyexr.js to work" );
    
    
    var EXRTool = global.EXRTool = {

        version: 1.0,

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
    
    EXRTool.setup = function(o)
    {
        o = o || {};
        if(EXRTool.configuration)
            throw("setup already called");
        EXRTool.configuration = o;
    }

    /**
    * Parse the input data and get all the EXR info 
    * @method parseFile
    * @param {ArrayBuffer} buffer 
    */
    EXRTool.parseFile = function( buffer )
    {
        var EXRHeader = {};

        var magic = new DataView( buffer ).getUint32( 0, true );
        var versionByteZero = new DataView( buffer ).getUint8( 4, true );
        var fullMask = new DataView( buffer ).getUint8( 5, true );

        // Start parsing header
        var offset = { value: 8 };
        var keepReading = true;

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

        return {
            header: EXRHeader,
            width: width,
            height: height,
            data: byteArray,
            numChannels: numChannels
        };
    }

    /**
    * Create a texture based in data received as input 
    * @method toTexture
    * @param {Object} data 
    */
    EXRTool.toTexture = function( data )
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
            options.cubemap_faces_data = faces;

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
        
        return this.toCubemap( texture );
    }

    /**
    * Converts spheremap or panoramic map to a cubemap texture 
    * @method toCubemap
    * @param {Texture} tex
    */
    EXRTool.toCubemap = function( tex )
    {
        var size = this.CUBE_MAP_SIZE || 0;
        
        if(!size)
        throw( "CUBE_MAP_SIZE not defined" );

        Texture.setUploadOptions( this.cubemap_upload_options );

        //save state
        var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
        var viewport = gl.getViewport();

        var fb = gl.createFramebuffer();
        gl.bindFramebuffer( gl.FRAMEBUFFER, fb );
        gl.viewport(0,0, size, size);

        // texture comes in panoramic or sphere format?
        var shader_name = (tex.width == tex.height * 2) ? "fromPanoramic" : "fromSphere";
        var shader = renderer.shaders[shader_name];
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
    * Read exr file and run the EXRLoader
    * @method load
    * @param {string} file
    * @param {Object} options
    * @param {Function} oncomplete
    */
    EXRTool.load = function(file, options, oncomplete)
    {
        options = options || {};
        var that = this;
        
        var onread = function( buffer, options )
        {
            options = options || {};

            t1 = getTime();

            // delete memory
            for(var t in gl.textures)
                if(t.includes(".exr"))
                    delete gl.textures[t];

            var texData = that.parseFile( buffer );
            var texture = that.toTexture( texData );

            // store the texture
            gl.textures[tex_name] = texture;

            t2 = getTime();
            t = (t2-t1).toFixed(2);
            console.warn( "File [" + tex_name + "] parsed in: " + t + "ms" );

            if(oncomplete) // do things when all is loaded
                oncomplete( texture );
        }

        // no read is necessary
        if(options.data)
        {
            onread(options.data, options);
            return;
        }

        var tex_name = this.getName( file ); 
        var xhr = new XMLHttpRequest();
        xhr.open( "GET", file, true );
        xhr.responseType = "arraybuffer";

        xhr.onload = function( e ) {
            onread( this.response, options );
        };

        xhr.send();
    }

    /**
    * Returns name of the texture from path name removing all before last "/"
    * @method getName
    * @param {string} path
    */
    EXRTool.getName = function( path )
    {
        var tokens = path.split("/");
        return tokens[ tokens.length - 1 ];
    }

    /**
    * Precalculate different ems blurred for different roughness values 
    * @method prefilter
    * @param {string} file
    * @param {Object} options
    */
    EXRTool.prefilter = function(file, options)
    {
        var tex_name = this.getName( file );
        var tex = gl.textures[tex_name];
        var shader = options.shader;
        var that = this;

        var inner = function( tex )
        {
            // prefilter texture 5 times to get some blurred samples
            for( var level = 0; level < 5; level++ )
            {
                // prefilter (result tex dimensions depends on the level of blur)
                var result = that.blur( tex, level, shader );
                // store
                var name = "_prem_" + level + "_" + tex_name;
                gl.textures[ name ] = result;
            }

            if(options.oncomplete)
                options.oncomplete();
        };

        if(!tex)
        {
            console.warn("Loading exr file: " + file);
            this.load( file, options, inner );        
        }
        else
            inner( tex );
    }

    /**
    * Blurs a texture depending on the roughness
    * @method blur
    * @param {Texture} input
    * @param {Number} level
    * @param {Shader||String} shader
    */
    EXRTool.blur = function(input, level, shader)
    {
        var size = input.height; // by default

        if(level)
            size = input.height / Math.pow(2, level);

        var roughness_range = [0.2, 0.4, 0.6, 0.8, 1];
        var roughness = roughness_range[ level ] || 0;

        //save state
        var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
        var viewport = gl.getViewport();

        var fb = gl.createFramebuffer();
        gl.bindFramebuffer( gl.FRAMEBUFFER, fb );
        gl.viewport(0,0, size, size);  // viewport remains equal (the shaders modifies the uvs)

        if(shader.constructor !== GL.Shader)
            shader = gl.shaders[ shader ];

        if(!shader)
            throw( "No shader" );

        input.bind(0);
        var mesh = GL.Mesh.getScreenQuad();
        mesh.bindBuffers( shader );
        shader.bind();

        var result = new GL.Texture( size, size, { format: input.format, texture_type: GL.TEXTURE_CUBE_MAP, type: gl.FLOAT } );

        var rot_matrix = GL.temp_mat3;
        var cams = GL.Texture.cubemap_camera_parameters;

        // info for block processing 
        var offset_table = [
            vec2.fromValues(0, 0),
            vec2.fromValues(0.5, 0),
            vec2.fromValues(0, 0.5),
            vec2.fromValues(0.5, 0.5)
        ];

        for(var i = 0; i < 6; i++)
        {
            gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, result.handler, 0);
            var face_info = cams[i];

            mat3.identity( rot_matrix );
            rot_matrix.set( face_info.right, 0 );
            rot_matrix.set( face_info.up, 3 );
            rot_matrix.set( face_info.dir, 6 );

            // process each face in blocks (different drawArrays per face)
            for( var j = 0; j < 4; j++ )
            {

                var uniforms = {
                        'u_rotation': rot_matrix,
                        'u_roughness': roughness,
                        'u_offset': offset_table[j]
                    };
                
                shader.uniforms( uniforms );
                gl.drawArrays( gl.TRIANGLES, 0, 6 );
            }
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
    EXRTool.brdf = function( shader )
    {
        var tex_name = '_brdf_integrator';
       
        if(shader.constructor !== GL.Shader)
            shader = gl.shaders[ shader ];

        if(!shader)
            throw( "No shader" );

        var tex = gl.textures[tex_name] = new GL.Texture(256,256, { texture_type: gl.TEXTURE_2D, minFilter: gl.NEAREST, magFilter: gl.LINEAR });

        tex.drawTo(function(texture) {
            shader.uniforms({}).draw(Mesh.getScreenQuad(), gl.TRIANGLES);
        });
    }

    /**
    * Opens a texture in a new window to download
    * @method download
    * @param {string} name
    */
    EXRTool.download = function(name)
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

    /* 
        Private methods used in parsing steps
    */

    function parseFaces( size, width, height, pixelData )
    {
        var faces = [],
            it = 0,
            F = EXRLoader.CUBE_MAP_NEGATIVE_Y;
    
        for(var i = 0; i < 6; i++)
            faces[i] = new Float32Array(size);
    
        // get 3 vertical faces
        for(var i = 0; i < height; i++)
        {
            var x1_n = (width * 0.25) + (i * width),
                    x2_n = (width * 0.5) + (i * width);
    
            if( i === (height / 3) ) { F = EXRLoader.CUBE_MAP_POSITIVE_Z; it = 0; }
            if( i === (height / 3) * 2 ) { F = EXRLoader.CUBE_MAP_POSITIVE_Y; it = 0; }
    
            var line = pixelData.subarray(x1_n * 3, x2_n * 3);
            faces[F].set(line, it);
            it += line.length;
        }
    
        // from now get the rest from left to right
    
        it = 0;
        F = EXRLoader.CUBE_MAP_NEGATIVE_X; // next face
        for(var i = (height / 3); i < (height / 3) * 2; i++)
        {
            var x1_n = (width * 0.0) + (i * width),
                    x2_n = (width * 0.25) + (i * width);
    
            var line = pixelData.subarray(x1_n * 3, x2_n * 3);
            faces[F].set(line, it);
            it += line.length;
        }
    
        it = 0;
        F = EXRLoader.CUBE_MAP_POSITIVE_X; // next face
        for(var i = (height / 3); i < (height / 3) * 2; i++)
        {
                var x1_n = (width * 0.5) + (i * width),
                        x2_n = (width * 0.75) + (i * width);
    
                var line = pixelData.subarray(x1_n * 3, x2_n * 3);
                faces[F].set(line, it);
                it += line.length;
        }
    
        it = 0;
        F = EXRLoader.CUBE_MAP_NEGATIVE_Z; // next face
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

        ret.push( faces[EXRLoader.CUBE_MAP_POSITIVE_X],
                faces[EXRLoader.CUBE_MAP_POSITIVE_Y],
                faces[EXRLoader.CUBE_MAP_POSITIVE_Z],
                faces[EXRLoader.CUBE_MAP_NEGATIVE_X],
                faces[EXRLoader.CUBE_MAP_NEGATIVE_Y],
                faces[EXRLoader.CUBE_MAP_NEGATIVE_Z] );

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
    
        offset.value = offset.value + endOffset + 1;
    
        return stringValue;
    
    }
    
    function parseFixedLengthString( buffer, offset, size ) {
    
        var stringValue = new TextDecoder().decode(
        new Uint8Array( buffer ).slice( offset.value, offset.value + size )
        );
    
        offset.value = offset.value + size;
    
        return stringValue;
    
    }
    
    function parseUlong( buffer, offset ) {
    
        var uLong = new DataView( buffer.slice( offset.value, offset.value + 4 ) ).getUint32( 0, true );
        offset.value = offset.value + 8;
        return uLong;
    }
    
    function parseUint32( buffer, offset ) {
    
        var Uint32 = new DataView( buffer.slice( offset.value, offset.value + 4 ) ).getUint32( 0, true );
        offset.value = offset.value + 4;
        return Uint32;
    }
    
    function parseUint8( buffer, offset ) {
    
        var Uint8 = new DataView( buffer.slice( offset.value, offset.value + 1 ) ).getUint8( 0, true );
        offset.value = offset.value + 1;
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
    


    // /**
    // *   
    // * @class Class
    // * @constructor
    // */
    // function Class( o )
    // {
    //     if(this.constructor !== EXRTool.Class)
    //         throw("Use new to create EXRTool.Class");

    //     this._ctor();
    //     if(o)
    //         this.configure( o );
    // }
    
    // EXRTool.Class = Class;
    
    // Class.prototype._ctor = function()
    // {
        
    // }
    
    // /**
    // * Configure this Class to a state from an object (used with serialize)
    // * @method configure
    // * @param {Object} o
    // */
    // Class.prototype.configure = function(o)
    // {
    //     //copy to attributes
    //     for(var i in o)
    //     {
    //         switch( i )
    //         {
    //             case "somecase": //special case
    //                 continue;
    //         };

    //         //default
    //         var v = this[i];
    //         if(v === undefined)
    //             continue;

    //         if( v && v.constructor === Float32Array )
    //             v.set( o[i] );
    //         else 
    //             this[i] = o[i];
    //     }
    // }
    
    // Object.defineProperty(Class.prototype, 'property', {
    //     get: function() {  },
    //     set: function(v) {  },
    //     enumerable: true
    // });
    
    //footer
    
    })( typeof(window) != "undefined" ? window : (typeof(self) != "undefined" ? self : global ) );
    
    