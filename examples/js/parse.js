
function parseEXRImage( buffer )
{

  var EXRHeader = {};

	var magic = new DataView( buffer ).getUint32( 0, true );
	var versionByteZero = new DataView( buffer ).getUint8( 4, true );
	var fullMask = new DataView( buffer ).getUint8( 5, true );

  // start of header

	var offset = { value: 8 }; // start at 8, after magic stuff
	var keepReading = true;

	while ( keepReading ) {

		var attributeName = parseNullTerminatedString( buffer, offset );

		if ( attributeName == 0 ) {

			keepReading = false;

		} else {

			var attributeType = parseNullTerminatedString( buffer, offset );
			var attributeSize = parseUint32( buffer, offset );
			var attributeValue = parseValue( buffer, offset, attributeType, attributeSize );

			EXRHeader[ attributeName ] = attributeValue;
		}
	}

    if (EXRHeader.compression === undefined)
      throw( "EXR compression is undefined" );


    var width = EXRHeader.dataWindow.xMax - EXRHeader.dataWindow.xMin + 1;
    var height = EXRHeader.dataWindow.yMax - EXRHeader.dataWindow.yMin + 1;
    var numChannels = EXRHeader.channels.length;

    var byteArray;

    if (EXRHeader.compression === 'ZIP_COMPRESSION' || EXRHeader.compression == 'NO_COMPRESSION') {

      // get all exr
      var data = new Uint8Array(buffer);
      var exr = new Module.EXRLoader(data);
      byteArray = exr.getBytes();

    }
    else
      throw 'Cannot decompress unsupported compression';

  	return {
  		header: EXRHeader,
  		width: width,
  		height: height,
  		data: byteArray,
  		numChannels: numChannels
  	};
}
