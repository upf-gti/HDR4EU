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
	var U_BYTE_RGBE	= 04;

    var HDRE = global.HDRE = {

        version: 2.5,	// v1.5 adds spherical harmonics coeffs for the skybox
                        // v2.0 adds byte padding for C++ uses				
                        // v2.5 allows mip levels to be smaller than 8x8
        maxFileSize: 60e6 // bytes
    };

	// En la v1.4 poner maxFileSize a 58 000 000 (bytes)
    
    HDRE.setup = function(o)
    {
        o = o || {};
        if(HDRE.configuration)
            throw("setup already called");
        HDRE.configuration = o;
    }
    
    // Uint8Array -> UInt8 -> 8 bits per element -> 1 byte
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
	 * Max luminance							4 byte
     * Flags                                    1 byte
     */
    
    /**
    * Write and download an HDRE
    * @method write
    * @param {Object} package - [lvl0: { w, h, pixeldata: [faces] }, lvl1: ...]
    * @param {Number} width
    * @param {Number} height
    * @param {Object} options
    */
    HDRE.write = function( package, width, height, options )
    {
		
		options = options || {};

		var array_type = Float32Array;
		
		if(options.type && options.type.BYTES_PER_ELEMENT)
			array_type = options.type;

		var RGBE = false;

		if(options.rgbe !== undefined)
			RGBE = options.rgbe;

        /*
        *   Create header
        */

		// get total pixels
		var size = 0;
		for(var i = 0; i < package.length; i++)
            size += package[i].width * package[i].height;

        // File format information
        var numFaces = 6;
        var numChannels = 4;
        var headerSize = 256; // Bytes (256 in v2.0)
        var contentSize = size * numFaces * numChannels * array_type.BYTES_PER_ELEMENT; // Bytes
        var fileSize = headerSize + contentSize; // Bytes
        var bpChannel = array_type.BYTES_PER_ELEMENT * BYTE2BITS; // Bits

        var contentBuffer = new ArrayBuffer(fileSize);
        var view = new DataView(contentBuffer);

		var LE = true;// little endian

        // Signature: "HDRE" in ASCII
        // 72, 68, 82, 69

        // Set 4 bytes of the signature
        view.setUint8(0, 72);
        view.setUint8(1, 68);
        view.setUint8(2, 82);
        view.setUint8(3, 69);
        
        // Set 4 bytes of version
        view.setFloat32(4, this.version, LE);

        // Set 2 bytes of width, height
        view.setUint16(8, width, LE);
        view.setUint16(10, height, LE);
		// Set max file size
        view.setFloat32(12, this.maxFileSize, LE);

        // Set rest of the bytes
        view.setUint16(16, numChannels, LE); // Number of channels
        view.setUint16(18, bpChannel, LE); // Bits per channel
		view.setUint16(20, headerSize, LE); // max header size
		view.setUint16(22, LE ? 1 : 0, LE); // endian encoding

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
		view.setFloat32(24, _getMax( data ), LE); 

		var type = FLOAT;
		if( array_type === Uint8Array)
            type = U_BYTE;
        if( array_type === Uint16Array)
            type = HALF_FLOAT;

		if(RGBE)
			type = U_BYTE_RGBE;
            
		console.log(type);

		// set write array type 
		view.setUint16(28, type, LE); 

		// SH COEFFS
		if(options.sh) {
		
			var SH = options.sh;

			view.setUint16(30, 1, LE);
			view.setFloat32(32, SH.length / 3, LE); // number of coeffs
			var pos = 36;
			for(var i = 0; i < SH.length; i++) {
				view.setFloat32(pos, SH[i], LE); 
				pos += 4;
			}
		}
		else
			view.setUint16(30, 0, LE);

		/*
		*  END OF HEADER
		*/

        offset = headerSize;

        // Set data into the content buffer
        for(var i = 0; i < data.length; i++)
        {
			if(type == U_BYTE || type == U_BYTE_RGBE) {
	            view.setUint8(offset, data[i]);
			}else if(type == HALF_FLOAT) {
	            view.setUint16(offset, data[i], true);
			}else {
	            view.setFloat32(offset, data[i], true);
			}

            offset += array_type.BYTES_PER_ELEMENT;
        }

        // Return the ArrayBuffer with the content created
        return contentBuffer;
    }

	function _getMax(data) {
	  return data.reduce((max, p) => p > max ? p : max, data[0]);
	}

	window.getMaxOfArray = _getMax;

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
        var fileSizeInBytes = buffer.byteLength;
		var LE = true;

        /*
        *   Read header
        */

        // Read signature
        var sg = parseSignature( buffer, 0 );

        // Read version
        var v = parseFloat32(buffer, 4, LE);

        // Get 2 bytes of width, height
        var w = parseUint16(buffer, 8, LE);
        var h = parseUint16(buffer, 10, LE);
		// Get max file size in bytes
        var m = parseFloat(parseFloat32(buffer, 12, LE));

        // Set rest of the bytes
        var c = parseUint16(buffer, 16, LE);
        var b = parseUint16(buffer, 18, LE);
		var s = parseUint16(buffer, 20, LE);
		var isLE = parseUint16(buffer, 22, LE);

		var i = parseFloat(parseFloat32(buffer, 24, LE));
		var a = parseUint16(buffer, 28, LE);

		var shs = null;
		var hasSH = parseUint16(buffer, 30, LE);

		if(hasSH) {
		
			var Ncoeffs = parseFloat32(buffer, 32, LE) * 3;
			shs = [];
			var pos = 36;

			for(var i = 0; i < Ncoeffs; i++)  {
				shs.push( parseFloat32(buffer, pos, LE) );
				pos += 4;
			}
		}

        var header = {
            version: v,
            signature: sg,
			headerSize: s,
			type: a,
            width: w,
            height: h,
            max_size: m,
            nChannels: c,
            bpChannel: b,
			maxIrradiance: i,
			shs: shs,
			encoding: isLE
        };

		// console.table(header);
        window.parsedFile = {buffer: buffer, header: header};
        
		if(v < 2 || v > 1e3){ // bad encoding
			console.error('old version, please update the HDRE');
			return false;
		}

		if(fileSizeInBytes > m){
			console.error('file too big');
			return false;
		}


        /*
        *   BEGIN READING DATA (Uint8 or Float32)
        */

        var dataBuffer = buffer.slice(s);

        var array_type = Float32Array;
        
        if(a == U_BYTE || a == U_BYTE_RGBE)
            array_type = Uint8Array;
        else if(a == HALF_FLOAT)
            array_type = Uint16Array;


		var dataSize = dataBuffer.byteLength / 4;
		var data = new array_type(dataSize);
		var view = new DataView(dataBuffer);
	
		var pos = 0;

		for(var i = 0 ; i < dataSize; i++)
		{
			data[i] = view.getFloat32(pos, LE);
			pos += 4;
		}

        var numChannels = c;

        var begin = 0, 
            end = w * w * numChannels * 6;
        var ems = [],
            precomputed = [];

        var offset = 0;
		var originalWidth = w;

        for(var i = 0; i < 6; i++)
        {
			var mip_level = i + 1;

			var offsetEnd = w * w * numChannels * 6;
            ems.push( data.slice(offset, offset + offsetEnd) );
            offset += offsetEnd;
            
            if(v > 2.0)
                w = originalWidth / Math.pow(2, mip_level);
            else
                w = Math.max(8, originalWidth / Math.pow(2, mip_level));
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

            precomputed.push( {
                data: faces,
                width: w
            });

            // resize next textures
            var mip_level = i + 1;
            
            if(v > 2.0)
                w = originalWidth / Math.pow(2, mip_level);
            else
                w = Math.max(8, originalWidth / Math.pow(2, mip_level));

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

	   function parseSignature( buffer, offset ) {

        var uintBuffer = new Uint8Array( buffer );
        var endOffset = 4;

        return window.TextDecoder !== undefined ? new TextDecoder().decode(new Uint8Array( buffer ).slice( offset, offset + endOffset )) : "";
    }

    function parseString( buffer, offset ) {

        var uintBuffer = new Uint8Array( buffer );
        var endOffset = 0;

        while ( uintBuffer[ offset + endOffset ] != 0 ) 
            endOffset += 1;

        return window.TextDecoder !== undefined ? new TextDecoder().decode(new Uint8Array( buffer ).slice( offset, offset + endOffset )) : "";
    }

    function parseFloat32( buffer, offset, LE ) {
    
        var Float32 = new DataView( buffer.slice( offset, offset + 4 ) ).getFloat32( 0, LE );
        return Float32;
    }

    function parseUint16( buffer, offset, LE ) {
    
        var Uint16 = new DataView( buffer.slice( offset, offset + 2 ) ).getUint16( 0, LE );
        return Uint16;
    }

    function parseUint8( buffer, offset ) {
    
        var Uint8 = new DataView( buffer.slice( offset, offset + 1 ) ).getUint8( 0 );
        return Uint8;
    }
    
    //footer
    
    })( typeof(window) != "undefined" ? window : (typeof(self) != "undefined" ? self : global ) );
    