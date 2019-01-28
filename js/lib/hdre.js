/*
*   Alex Rodriguez
*   @jxarco 
*/

// hdre.js 

//main namespace
(function(global){

    /**
     * Main namespace
     * @namespace HDRE
     */
    
    var FLO2BYTE = 4;
	var BYTE2BITS = 8;

	var U_BYTE		= 01;
	var HALF_FLOAT	= 02;
	var FLOAT		= 03;

    var HDRE = global.HDRE = {

        version: 1.3,
        maxFileSize: 58000 // KBytes
    };

	// En la v1.4 poner maxFileSize a 58 000 000 (bytes)
    
    HDRE.setup = function(o)
    {
        o = o || {};
        if(HDRE.configuration)
            throw("setup already called");
        HDRE.configuration = o;
    }
    
    // Float32Array -> Float32 -> 32 bits per element -> 4 bytes
    // Float64Array -> Float64 -> 64 bits per element -> 8 bytes
    
    /** HEADER STRUCTURE (128 bytes)
     * Header signature ("HDRE" in ASCII)       4 bytes
     * Format Version                           4 bytes
     * Width                                    2 bytes
     * Height                                   2 bytes
     * Max file size                            4 bytes
     * Number of channels                       1 byte
     * Bits per channel                         1 byte
	 * Header size		                        1 byte
     * Flags                                    1 byte
     */
    
    /**
    * Write and download an HDRE
    * @method write
    * @param {Object} package - [lvl0: { w, h, pixeldata: [faces] }, lvl1: ...]
    * @param {Number} width
    * @param {Number} height
    * @param {Number} buffer size
    * @param {Object} options
    */
    HDRE.write = function( package, width, height, size, options )
    {

		options = options || {};

		var array_type = options.type ? options.type : Float32Array;

        /*
        *   Create header
        */

        // File format information
        var numFaces = 6;
        var numChannels = 4;
        var headerSize = 128; // Bytes (128 in v1.3)
        var contentSize = size * numFaces * numChannels * array_type.BYTES_PER_ELEMENT; // Bytes
        var fileSize = headerSize + contentSize; // Bytes
        var bpChannel = array_type.BYTES_PER_ELEMENT * BYTE2BITS; // Bits

        var contentBuffer = new ArrayBuffer(fileSize);
        var view = new DataView(contentBuffer);
        
        // Signature: "HDRE" in ASCII
        // 72, 68, 82, 69

        // Set 4 bytes of the signature
        view.setUint8(0, 72);
        view.setUint8(1, 68);
        view.setUint8(2, 82);
        view.setUint8(3, 69);
        view.setUint8(4, 0); // End of string

        // Set 4 bytes of version
        view.setFloat32(5, this.version);

        // Set 2 bytes of width, height and max file size
        view.setUint16(9, width);
        view.setUint16(11, height);
        view.setUint16(13, this.maxFileSize);

        // Set rest of the bytes
        view.setUint8(15, numChannels); // Number of channels
        view.setUint8(16, bpChannel); // Bits per channel
		view.setUint8(17, headerSize); // max header size

        // Set flags
        // ...

        /*
        *   Create data
        */
        
        var data = new array_type(size * numFaces * numChannels);
        var offset = 0;

        for(var i = 0; i < package.length; i++)
        {
            let _env = package[i],
                w = _env.width,
                h = _env.height,
                s = w * h * numChannels;

            var suboff = 0;

            for(var f = 0; f < numFaces; f++) {
                var subdata = _env.pixelData[f];
                data.set( subdata, offset + suboff);
                suboff += subdata.length;
            }

            // Apply offset
            offset += (s * numFaces);
        }

		// set max value for luminance
		var maxValue = getFloat32Max( data );
		view.setFloat32(18, maxValue); 

		var type = FLOAT;
		if( array_type == Uint8Array)
			type = U_BYTE;
		
		// set write array type 
		view.setUint16(22, type); 

		/*
		*  END OF HEADER
		*/

        offset = headerSize;

        // Set data into the content buffer
        for(var i = 0; i < data.length; i++)
        {
			if(type == U_BYTE) {
	            view.setUint8(offset, data[i], true);
			}else if(type == FLOAT) {
	            view.setFloat32(offset, data[i], true);
			}

            offset += array_type.BYTES_PER_ELEMENT;
        }

        // Return the ArrayBuffer with the content created
        return contentBuffer;
    }

	function getFloat32Max(data) {
	  return data.reduce((max, p) => p > max ? p : max, data[0]);
	}

    /**
    * Read file
    * @method read
    * @param {String} file 
    */
    HDRE.read = function( file )
    {
        var xhr = new XMLHttpRequest();
        xhr.responseType = "arraybuffer";
        xhr.open( "GET", file, true );
        xhr.onload = (e) => { if(e.target.status != 404) parse(e.target.response) };
        xhr.send();
    }

    /**
    * Parse the input data and create texture
    * @method parse
    * @param {ArrayBuffer} buffer 
    * @param {Function} options (oncomplete, onprogress, filename, ...)
    */
    HDRE.parse = function( buffer, options )
    {
        if(!buffer)
        throw( "No data buffer" );

        var options = options || {};
        var fileSizeInKBytes = buffer.byteLength / 1e3;

        /*
        *   Read header
        */

        // Read signature
        var sg = parseString( buffer, 0 );

        // Read version
        var v = parseFloat32(buffer, 5);

        // Set 2 bytes of width, height and max file size
        var w = parseUint16(buffer, 9);
        var h = parseUint16(buffer, 11);
        var m = parseUint16(buffer, 13);

		//console.log(m, fileSizeInKBytes);

        // Set rest of the bytes
        var c = parseUint8(buffer, 15);
        var b = parseUint8(buffer, 16);
		var s = parseUint8(buffer, 17);
		var i = parseFloat(parseFloat32(buffer, 18));
		var a = parseUint16(buffer, 22);

        var header = {
            version: v,
            signature: sg,
			headerSize: s,
			array_type: a,
            width: w,
            height: h,
            max_size: m,
            nChannels: c,
            bpChannel: b,
			maxIrradiance: i,
        };

//		console.table(header);
		window.parsedFile = {buffer: buffer, header: header};

		if(fileSizeInKBytes > m)
        throw('file not accepted: too big');

        /*
        *   BEGIN READING DATA (Uint8 or Float32)
        */
		

		if(!s){ // previous versions
			s = 164;
		}

        var dataBuffer = buffer.slice(s);

		var array_type = (a == U_BYTE) ? Uint8Array : Float32Array;
        var data = new array_type(dataBuffer);
        var numChannels = c;

        var begin = 0, 
            end = w * w * numChannels * 6;
        var ems = [],
            precomputed = [];

        var offset = 0;

        for(var i = 0; i < 6; i++)
        {
            ems.push( data.slice(offset, offset + (w*w*numChannels*6)) );
            offset += (w*w*numChannels*6);

			// only v1.0 has first level as big as original em
			if(v == 1.0)
                w /= (i == 0) ? 1 : 2;
            else
                w /= 2;
        }

        /*
            Get bytes
        */
        
        // care about new sizes (mip map chain)
        w = header.width;

        for(var i = 0; i < 6; i++)
        {
            var bytes = ems[i];
        
            // Reorder faces
            var faces = [];
            var bPerFace = bytes.length / 6;

            var offset = 0;

            for(var j = 0; j < 6; j++)
            {
                faces[j] = new array_type(bPerFace);

                var subdata = bytes.slice(offset, offset + (numChannels * w * w));
                faces[j].set(subdata);

                offset += (numChannels * w * w);
            }

            // order faces
            var facesSorted = [];

            facesSorted.push( 
                faces[0], // X neg
                faces[2], // Y neg
                faces[4], // Z pos
                faces[1], // X pos
                faces[3], // Y pos
                faces[5] // Z neg
            );

            precomputed.push( {
                data: facesSorted,
                width: w
            });

            // resize next textures
			// only v1.0 has first level as big as original em
            if(v == 1.0)
                w /= (i == 0) ? 1 : 2;
            else
                w /= 2;

            if(options.onprogress)
                options.onprogress( i );
        }

        // return 6 images: original env + 5 levels of roughness
        // pass this to a GL.Texture
        return {header: header, _envs: precomputed};
    }

    /* 
        Private library methods
    */

    function parseString( buffer, offset ) {

        var uintBuffer = new Uint8Array( buffer );
        var endOffset = 0;

        while ( uintBuffer[ offset + endOffset ] != 0 ) 
            endOffset += 1;

        return new TextDecoder().decode(new Uint8Array( buffer ).slice( offset, offset + endOffset ));
    }

    function parseFloat32( buffer, offset ) {
    
        var Float32 = new DataView( buffer.slice( offset, offset + 4 ) ).getFloat32( 0 ).toPrecision(3);
        return Float32;
    }

    function parseUint16( buffer, offset ) {
    
        var Uint16 = new DataView( buffer.slice( offset, offset + 2 ) ).getUint16( 0 );
        return Uint16;
    }

    function parseUint8( buffer, offset ) {
    
        var Uint8 = new DataView( buffer.slice( offset, offset + 1 ) ).getUint8( 0 );
        return Uint8;
    }
    
    //footer
    
    })( typeof(window) != "undefined" ? window : (typeof(self) != "undefined" ? self : global ) );
    
