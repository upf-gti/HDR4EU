
function EXRLoader(o)
{
    if(this.constructor !== EXRLoader)
		throw("You must use new to create EXRLoader");
	this._ctor();
//	if(o)
//		this.configure( o );
}

EXRLoader.CUBE_MAP_POSITIVE_X = 0;
EXRLoader.CUBE_MAP_POSITIVE_Y = 1;
EXRLoader.CUBE_MAP_POSITIVE_Z = 2;
EXRLoader.CUBE_MAP_NEGATIVE_X = 3;
EXRLoader.CUBE_MAP_NEGATIVE_Y = 4;
EXRLoader.CUBE_MAP_NEGATIVE_Z = 5;

EXRLoader.CUBE_MAP_SIZE = 512;

EXRLoader.ERRORS = {
  "0": "Undefined compression",
  "1": "Unsupported compression",
  "2": "Cannot get bytes from EXR"
};

EXRLoader.prototype._ctor = function()
{
    this.cubemap_upload_options = { no_flip: false };
    this.spheremap_upload_options = {  };
}

EXRLoader.prototype.parse = function( buffer )
{
    var EXRHeader = {};

    var magic = new DataView( buffer ).getUint32( 0, true );
    var versionByteZero = new DataView( buffer ).getUint8( 4, true );
    var fullMask = new DataView( buffer ).getUint8( 5, true );

    // Start parsing header
    var offset = { value: 8 }; // start at 8, after magic stuff
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
           throw "Error getting bytes from EXR file";

      } catch (error) {
        console.error(error);
      }
      

    }
    else
    {
      console.error('Cannot decompress unsupported compression');
      return; 
    }

    // console.log(EXRHeader);

  	return {
  		header: EXRHeader,
  		width: width,
  		height: height,
  		data: byteArray,
  		numChannels: numChannels
  	};
}

EXRLoader.prototype.getTextureParams = function( texData )
{
    var width = texData.width;
    var height = texData.height;

    var is_cubemap = ( width/4 == height/3 && GL.isPowerOfTwo(width) ) ? true : false;

    /*
        tiny exr library always adds an extra channel we want to remove
        3 channels --> 4 channels
        4 channels --> 4 channels
        so... remove extra channel in every case!!
    */

    var oldSize = texData.data.length,
        newSize = oldSize * (3/4),
        compressed_data = new Float32Array( newSize ),
        it = 0;

    for(var i = 0; i < oldSize; i += 4){
            compressed_data[it] = texData.data[i];
            compressed_data[it+1] = texData.data[i+1];
            compressed_data[it+2] = texData.data[i+2];
            compressed_data[it+2] = texData.data[i+2];
            it+=3;
    }

    var channels = compressed_data.length / (width * height);
    if(channels != 3)
        throw "Error when removing the extra channel";

    return {
        width: width,
        height: height,
        pixelData: compressed_data,
        pixelFormat: gl.RGB,
        is_cubemap: is_cubemap
    }
}

EXRLoader.prototype.generateTex = function( texParams, to_cubemap )
{
    texParams = texParams || {};

    if(!texParams.width || !texParams.height)
        throw 'No width or height to generate Texture';

    var width = texParams.width;
    var height = texParams.height;
    var pixelFormat = texParams.pixelFormat || gl.RGB;

    if(!texParams.pixelData)
        throw 'No data to generate Texture';

    var texture = null;
    
    // Set to default options (flip y)
    Texture.setUploadOptions({});

    if(!texParams.is_cubemap || texParams.to_texture2D)
    {
        // basic texture or sphere map
        var options = {
            format: pixelFormat,
            type: gl.FLOAT,
            pixel_data: texParams.pixelData
        };

        texture = new GL.Texture( width, height, options);
        texture.wrapS = texParams.wrapS || gl.CLAMP_TO_EDGE;
        texture.wrapT = texParams.wrapT || gl.CLAMP_TO_EDGE;
        texture.magFilter = texParams.magFilter || gl.LINEAR;
        texture.minFilter = texParams.minFilter || gl.LINEAR_MIPMAP_LINEAR;
    }
    // cubemap texture
    else
    {
        var square_length = texParams.pixelData.length / 12;
        var faces = this.parseFaces(square_length, width, height, texParams.pixelData);

        width /= 4;
        height /= 3;

        var options = {
            format: pixelFormat,
            type: gl.FLOAT,
            texture_type: GL.TEXTURE_CUBE_MAP,
            pixel_data: texParams.pixelData,
            cubemap_faces_data: faces
        };

        texture = new GL.Texture( width, height, options);
        texture.wrapS = texParams.wrapS || gl.CLAMP_TO_EDGE;
        texture.wrapT = texParams.wrapT || gl.CLAMP_TO_EDGE;
        texture.magFilter = texParams.magFilter || gl.LINEAR;
        texture.minFilter = texParams.minFilter || gl.LINEAR_MIPMAP_LINEAR;

        // extra info
        texture.is_cubemap = texParams.is_cubemap;
    }

    // texture here has been flipped 
    // rt["tex"] = texture; 
    Texture.setUploadOptions({});

    if(texParams.is_cubemap) //!to_cubemap
        return texture;
    
    return this.toCubemap( texture );
}

// add callback in options
EXRLoader.prototype.toCubemap = function( tex, callback )
{
    var size = EXRLoader.CUBE_MAP_SIZE || 512;
    Texture.setUploadOptions( this.cubemap_upload_options );

    //save state
    var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
    var viewport = gl.getViewport();

    var fb = gl.createFramebuffer();
    gl.bindFramebuffer( gl.FRAMEBUFFER, fb );
    gl.viewport(0,0, size, size);

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
        // shader._setUniform( "u_correction", -0.1 );
        gl.drawArrays( gl.TRIANGLES, 0, 6 );
    }

    mesh.unbindBuffers( shader );

    //restore previous state
    gl.setViewport(viewport); //restore viewport
    gl.bindFramebuffer( gl.FRAMEBUFFER, current_fbo ); //restore fbo

    gl.bindTexture(cubemap_texture.texture_type, null); //disable

    if(callback)
      callback(cubemap_texture);

    // rt["tex_after"] = cubemap_texture;

    return cubemap_texture;
}

EXRLoader.prototype.parseFaces = function(size, width, height, pixelData)
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

    return sortFaces(faces, size);
}

function sortFaces(faces, size)
{
    var ret = [];

    ret.push( faces[EXRLoader.CUBE_MAP_POSITIVE_X] );
    ret.push( faces[EXRLoader.CUBE_MAP_POSITIVE_Y] );
    ret.push( faces[EXRLoader.CUBE_MAP_POSITIVE_Z] );
    ret.push( faces[EXRLoader.CUBE_MAP_NEGATIVE_X] );
    ret.push( faces[EXRLoader.CUBE_MAP_NEGATIVE_Y] );
    ret.push( faces[EXRLoader.CUBE_MAP_NEGATIVE_Z] );

    return ret;
}

// useful methods for parsing exr
// ....

function parseNullTerminatedString( buffer, offset ) {

  var uintBuffer = new Uint8Array( buffer );
  var endOffset = 0;

  while ( uintBuffer[ offset.value + endOffset ] != 0 ) {

    endOffset += 1;

  }

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

  } else {

    return;
    //throw 'Cannot parse value for unsupported type: ' + type;

  }

}
