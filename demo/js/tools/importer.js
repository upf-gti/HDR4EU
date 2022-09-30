/*
*   Alex Rodr�guez
*   @jxarco 
*/

// (importer.js @javiagenjo at webglstudio.org)
function getFilesFromEvent( e, options )
{
    var files = [];
    var that = this;

    //first the files
    for(var i=0; i < e.dataTransfer.files.length; i++)
    {
        var file = e.dataTransfer.files[i];
        if(!file.size)
            continue; //folders are files with 0 size
        files.push( file );
    }

    //then the items (they may be folders)
    for(var i=0; i < e.dataTransfer.items.length; i++)
    {
        var item = e.dataTransfer.items[i];
        var func = item.webkitGetAsEntry || item.mozGetAsEntry || item.getAsEntry; //experimental
        if(!func)
            break;
        var entry = func.call( item );
        if(!entry || !entry.isDirectory)
            continue; //not a folder
        traverseFileTree(entry);
    }

    function traverseFileTree( item, path ) {
        path = path || "";
        if (item.isFile) {
            // Get file
            item.file(function(file) {
                //files.push( file );
                that.processFileList([file],options,true);
            });
        } else if (item.isDirectory) {
            // Get folder contents
            var dirReader = item.createReader();
            dirReader.readEntries(function(entries) {
                for (var i=0; i<entries.length; i++) {
                    traverseFileTree(entries[i], path + item.name + "/");
                }
            });
        }
    }

    return files;
}

var parserCR2 = {

	ONLY_METADATA: 1,

	extension: "cr2",
	type: "image",
	
	tags: {
		"t256": "Width",
		"t257": "Height",
		"t258": "BitsPerSample",
		// "t259": "Compression",
		"t271": "Make",
		"t272": "Model",
		// "t273": "PreviewImageStart",
		"t274": "Orientation",
		// "t279": "PreviewImageLength",
		"t282": "XResolution",
		"t283": "YResolution",
		// "t296": "ResolutionUnit",
		"rgba8": "rgba8",
	},

	exifIFD_Tags: {
		"t33434": "ExposureTime",
		"t33437": "FNumber",
		"t34850": "ExposureProgram",
		"t34855": "ISO",
		"t34864": "SensitivityType",
		"t34866": "RecommendedExposureIndex",
		// "t36868": "CreateDate",
		// "t37121": "ComponentsConfiguration",
		"t37377": "ShutterSpeedValue",
		"t37378": "ApertureValue",
		"t37380": "ExposureCompensation",
		// "t37383": "MeteringMode",
		"t37385": "Flash",
		"t37386": "FocalLength",
		"t42036": "ZoomLens"
	},

	parse: function(buffer, name, dcraw_options)
	{
		var ifds;
		var out;
		var img = {};

		if(!dcraw_options)
		{
			if(!UTIF)
			throw("missing UTIF.js");

			ifds = UTIF.decode(buffer);
			out = ifds[0];
			UTIF.decodeImage(buffer, out);
			out.rgba8 = UTIF.toRGBA8(out);
		}
		else
		{
			var metadata = dcraw(new Uint8Array(buffer), { verbose: true, identify: true }).split("\n").filter(String);

			if(dcraw_options === this.ONLY_METADATA)
			{
				console.log(metadata);
				return;
			}

			var RawData = dcraw(new Uint8Array(buffer), dcraw_options);

			var ifds = UTIF.decode(RawData);
			var out = ifds[0];
			UTIF.decodeImage(RawData, out);
		}

		for(var i in out)
			if(this.tags[i])
				img[ this.tags[i] ] = out[i];

		for(var i in out.exifIFD)
			if(this.exifIFD_Tags[i])
				img[ this.exifIFD_Tags[i] ] = out.exifIFD[i];

		img.originalData = [1, out]; // 1 makes this object no be not shown in gui
		img.metadata = metadata;

		// parse verbose info from dcraw call
		img.verbose = this.parseVerbose( globalData );
		
		switch(img.BitsPerSample[0])
		{
			case 8:
				img.rgba8 = UTIF.toRGBA8(out);
				break;
			case 16:

				// SET RGB16
				img.rgb16 = new Uint16Array(out.data.buffer);
				img.rgba16 = HDRTool.addAlphaChannel( img.rgb16, Math.pow(2, 16) - 1);

				// SET RGB8
				// auto
				if(true)
				{
					img.rgba8 = UTIF.toRGBA8(out);
				}
				else
				{
					img.rgba8 = new Uint8Array(img.rgba16.length);
					for(var i = 0; i < img.rgba8.length; i+=4)
					{
						img.rgba8[i] = Math.floor(  (img.rgba16[i] / Math.pow(2, 16)) * Math.pow(2, 8)  );
						img.rgba8[i+1] = Math.floor(  (img.rgba16[i+1] / Math.pow(2, 16)) * Math.pow(2, 8)  );
						img.rgba8[i+2] = Math.floor(  (img.rgba16[i+2] / Math.pow(2, 16)) * Math.pow(2, 8)  );
						img.rgba8[i+3] = Math.floor(  (img.rgba16[i+3] / Math.pow(2, 16)) * Math.pow(2, 8)  );
					}
				}

				// SET RGB32
				img.rgba32 = new Float32Array(img.rgba16.length);
				for(var i = 0; i < img.rgba32.length; i+=4)
				{
					img.rgba32[i] 	= img.rgba16[i]      / Math.pow(2, 16);
					img.rgba32[i+1] = img.rgba16[i+1]   / Math.pow(2, 16);
					img.rgba32[i+2] = img.rgba16[i+2]   / Math.pow(2, 16);
					img.rgba32[i+3] = img.rgba16[i+3]   / Math.pow(2, 16);
				}
				
				break;
		}

		//LiteGUI.downloadFile("qwefwef.tiff", RawData);

		console.log(img);
		return img;
	},

	parseVerbose: function(verbose)
	{
		if(!verbose.length){
			console.error("no verbose info");
			return [];
		}

		var obj = {};

		for( i in verbose )
		{
			var text = verbose[i].string;

			switch(i)
			{
				case "0":
				case "3":
				case "4":
					break;
				case "1":
					obj["darkness"] = parseInt(text.substr(22, text.length).split(" ")[0].replace(",", ""));
					obj["saturation"] = parseInt(text.substr(36, text.length).split(" ")[0].replace(",", ""));
					break;
				case "2":
					text = text.substr( 12, 4 * 9);
					obj["multipliers"] = [];
					for(k = 0; k < text.length; k += 9)
					obj["multipliers"].push( parseFloat(text.substr(k, 8)) );
					break;
			}
		}

		return obj;
	}

};

RM.addSupportedFormat( "cr2", parserCR2 );

var parserDAE = {

	extension: "dae",
	type: "scene",
	resource: "SceneNode",
	format: "text",
	dataType:'text',

	load: function(file, callback)
	{
		if(file.constructor !== File)
		{
			LiteGUI.requestText( file, (function( data ){

				this.parse(data, file, callback);

			}).bind(this) );

			return false;
		}
		
		var reader = new FileReader();
		reader.onprogress = function(e){  $("#xhr-load").css("width", parseFloat( (e.loaded)/e.total * 100 ) + "%") };
		reader.onload = (function (event) {

			this.parse(event.target.result, file.name, callback);

		}).bind(this);
		reader.readAsText(file);
		return false;
	},

	parse: function(data, filename, callback)
	{
		if(!data)
		return;

		var tokens = filename.split("/");
        var clean_filename = tokens[ tokens.length - 1 ];

		var that = this;
		var scene = Collada.parse(data);

		if(callback)
			callback( this.onParsed( scene, clean_filename ) );
		else
		{
			console.warn("no callback when loading dae");
			console.log(this.onParsed( scene, clean_filename ) );
		}
	},

	onParsed: function(scene, filename)
	{
		var options = {};

		Collada.material_translate_table = {
			reflectivity: "reflection_factor",
			specular: "specular_factor",
			shininess: "specular_gloss",
			emission: "emissive",
			diffuse: "color"
		}; //this is done to match LS specification

		scene.root.name = filename;

		//apply 90 degrees rotation to match the Y UP AXIS of the system
		if( scene.metadata && scene.metadata.up_axis == "Z_UP" ){
			scene.root.model = mat4.rotateX( mat4.create(), mat4.create(), -90 * 0.0174532925 );
		}

		//rename meshes, nodes, etc
		var renamed = {};
		var basename = filename.substr(0, filename.indexOf("."));

		//rename meshes names
		var renamed_meshes = {};
		for(var i in scene.meshes)
		{
			var newmeshname = basename + "__" + i + ".wbin";
			newmeshname = newmeshname.replace(/[^a-z0-9\.\-]/gi,"_"); //newmeshname.replace(/ /#/g,"_");
			renamed[ i ] = newmeshname;
			renamed_meshes[ newmeshname ] = scene.meshes[i];
		}
		scene.meshes = renamed_meshes;

		for(var i in scene.meshes)
		{
			var mesh = scene.meshes[i];
			this.processMesh( mesh, renamed );
		}

		//change local collada ids to valid uids 
		inner_replace_names( scene.root );

		function inner_replace_names( node )
		{
			if(node.id == "root")
			{
				console.warn("DAE contains a node named root, renamed to _root");
				node.id = "_root";
				renamed["root"] = node.id;
			}

			//change uid
			if(node.id && !options.skip_renaming )
			{
				node.uid = "@" + basename + "::" + node.id;
				renamed[ node.id ] = node.uid;
			}
			
			//in case the node has some kind of type
			if(node.type)
			{
				node.node_type = node.type;
				delete node.type; //to be sure it doesnt overlaps with some existing var
			}

			//rename materials
			if(node.material)
			{
				var new_name = node.material.replace(/[^a-z0-9\.\-]/gi,"_") + ".json";
				renamed[ node.material ] = new_name
				node.material = new_name;
			}
			if(node.materials)
				for(var i in node.materials)
				{
					var new_name = node.materials[i].replace(/[^a-z0-9\.\-]/gi,"_") + ".json";
					renamed[ node.material ] = new_name
					node.materials[i] = new_name;
				}

			//change mesh names to engine friendly ids
			if(node.meshes)
			{
				for(var i = 0; i < node.meshes.length; i++)
					if(node.meshes[i] && renamed[ node.meshes[i] ])
						node.meshes[i] = renamed[ node.meshes[i] ];
			}
			if(node.mesh && renamed[ node.mesh ])
				node.mesh = renamed[ node.mesh ];

			if(node.children)
				for(var i in node.children)
					inner_replace_names( node.children[i] );
		}

		var parent = new RD.SceneNode();
		CORE.root.addChild(parent);
		parent.name = filename;

		if(scene.root.model)
		mat4.multiply(parent._local_matrix, parent._local_matrix, scene.root.model);
		parent.updateLocalMatrix();

		//replace skinning joint ids
		for(var i in scene.meshes)
		{
			var mesh = scene.meshes[i];
			if(mesh.bones)
			{
				for(var j in mesh.bones)
				{
					var id = mesh.bones[j][0];
					var uid = renamed[ id ];
					if(uid)
						mesh.bones[j][0] = uid;
				}
			}
		}

		var nodes = [];

		for(var i in scene.root.children)
		{
			var node = scene.root.children[i];
			var node_mesh = scene.meshes[ node.mesh ];
			nodes.push( node.name );
			CORE.addMesh( node_mesh.mesh_data, null, node.name, {parent: parent} );
		}

		console.log(scene);

		return nodes;
	},

	processMesh: function( mesh, renamed )
	{
		if(!mesh.vertices)
			return; //mesh without vertices?!

		var num_vertices = mesh.vertices.length / 3;
		var num_coords = mesh.coords ? mesh.coords.length / 2 : 0;

		if(num_coords && num_coords != num_vertices )
		{
			var old_coords = mesh.coords;
			var new_coords = new Float32Array( num_vertices * 2 );

			if(num_coords > num_vertices) //check that UVS have 2 components (MAX export 3 components for UVs)
			{
				for(var i = 0; i < num_vertices; ++i )
				{
					new_coords[i*2] = old_coords[i*3];
					new_coords[i*2+1] = old_coords[i*3+1];
				}
			}
			mesh.coords = new_coords;
		}

		//rename morph targets names
		if(mesh.morph_targets)
			for(var j = 0; j < mesh.morph_targets.length; ++j)
			{
				var morph = mesh.morph_targets[j];
				if(morph.mesh && renamed[ morph.mesh ])
					morph.mesh = renamed[ morph.mesh ];
			}

		//var name = renamed[ mesh.name ];
		//gl.meshes[ mesh.name ] = GL.Mesh.load(mesh);
		mesh.mesh_data = GL.Mesh.load(mesh);
	},

	renameResource: function( old_name, new_name, resources )
	{
		var res = resources[ old_name ];
		if(!res)
		{
			if(!resources[ new_name ])
				console.warn("Resource not found: " + old_name );
			return new_name;
		}
		delete resources[ old_name ];
		resources[ new_name ] = res;
		res.filename = new_name;
		return new_name;
	},

};

RM.addSupportedFormat( "dae", parserDAE );

var parserOBJ = {
	extension: 'obj',
	type: 'mesh',
	resource: 'Mesh',
	format: 'text',
	dataType:'text',

	flipAxis: false,

	parse: function(text, options)
	{
		options = options || {};
		var MATNAME_EXTENSION = options.matextension || "";//".json";
		var support_uint = true;

		//unindexed containers
		var vertices = [];
		var normals = [];
		var uvs = [];

		//final containers
		var vertices_buffer_data = [];
		var normals_buffer_data = [];
		var uvs_buffer_data = [];

		//groups
		var group_id = 0;
		var groups = [];
		var current_group_materials = {};
		var last_group_name = null;
		var materials_found = {};
		var mtllib = null;
		var group = createGroup();

		var indices_map = new Map();
		var next_index = 0;

		var V_CODE = 1;
		var VT_CODE = 2;
		var VN_CODE = 3;
		var F_CODE = 4;
		var G_CODE = 5;
		var O_CODE = 6;
		var USEMTL_CODE = 7;
		var MTLLIB_CODE = 8;
		var codes = { v: V_CODE, vt: VT_CODE, vn: VN_CODE, f: F_CODE, g: G_CODE, o: O_CODE, usemtl: USEMTL_CODE, mtllib: MTLLIB_CODE };

		var x,y,z;

		var lines = text.split("\n");
		var length = lines.length;
		for (var lineIndex = 0;  lineIndex < length; ++lineIndex) {

			var line = lines[lineIndex];
			line = line.replace(/[ \t]+/g, " ").replace(/\s\s*$/, ""); //better than trim

			if(line[ line.length - 1 ] == "\\") //breakline support
			{
				lineIndex += 1;
				var next_line = lines[lineIndex].replace(/[ \t]+/g, " ").replace(/\s\s*$/, ""); //better than trim
				line = (line.substr(0,line.length - 1) + next_line).replace(/[ \t]+/g, " ").replace(/\s\s*$/, "");
			}
			
			if (line[0] == "#")
				continue;
			if(line == "")
				continue;

			var tokens = line.split(" ");
			var code = codes[ tokens[0] ];

			if( code <= VN_CODE ) //v,vt,vn
			{
				x = parseFloat(tokens[1]);
				y = parseFloat(tokens[2]);
				if( code != VT_CODE ) //not always present
					z = parseFloat(tokens[3]); 
			}
			
			switch(code)
			{
				case V_CODE: vertices.push(x,y,z);	break;
				case VT_CODE: uvs.push(x,y);	break;
				case VN_CODE: normals.push(x,y,z);	break;
				case F_CODE: 
					if (tokens.length < 4)
						continue; //faces with less that 3 vertices? nevermind
					//get the triangle indices
					var polygon_indices = [];
					for(var i = 1; i < tokens.length; ++i)
						polygon_indices.push( getIndex( tokens[i] ) );
					group.indices.push( polygon_indices[0], polygon_indices[1], polygon_indices[2] );
					//polygons are break intro triangles
					for(var i = 2; i < polygon_indices.length-1; ++i)
						group.indices.push( polygon_indices[0], polygon_indices[i], polygon_indices[i+1] );
					break;
				case G_CODE:  
				case O_CODE:  //whats the difference?
					var name = tokens[1];
					last_group_name = name;
					if(!group.name)
						group.name = name;
					else
					{
						current_group_materials = {};
						group = createGroup( name );
					}
					break;
				case USEMTL_CODE: 
					changeMaterial( tokens[1] );
					break;
				case MTLLIB_CODE:
					mtllib = tokens[1];
					break;
				default:
			}
		}

		//generate indices
		var indices = [];
		var group_index = 0;
		var final_groups = [];
		for(var i = 0; i < groups.length; ++i)
		{
			var group = groups[i];
			if(!group.indices) //already added?
				continue;
			group.start = group_index;
			group.length = group.indices.length;
			indices = indices.concat( group.indices );
			delete group.indices; //do not store indices in JSON format!
			group_index += group.length;
			final_groups.push( group );
		}
		groups = final_groups;

		//finish mesh
		var mesh = {};

		if(!vertices.length)
		{
			console.error("mesh without vertices");
			return null;
		}

		//create typed arrays
		mesh.vertices = new Float32Array( vertices_buffer_data );
		if ( normals_buffer_data.length )
			mesh.normals = new Float32Array( normals_buffer_data );
		if ( uvs_buffer_data.length )
			mesh.coords = new Float32Array( uvs_buffer_data );
		if ( indices && indices.length > 0 )
			mesh.triangles = new ( support_uint && group_index > 256*256 ? Uint32Array : Uint16Array )(indices);

		//extra info
		mesh.bounding = GL.Mesh.computeBoundingBox( mesh.vertices );
		var info = {};
		if(groups.length > 1)
		{
			info.groups = groups;
			//compute bounding of groups? //TODO: this is complicated, it is affected by indices, etc, better done afterwards
		}

		mesh.info = info;
		if( !mesh.bounding )
		{
			console.log("empty mesh");
			return null;
		}

		if( mesh.bounding.radius == 0 || isNaN(mesh.bounding.radius))
			console.log("no radius found in mesh");
		//console.log(mesh);
		return mesh;

		//this function helps reuse triplets that have been created before
		function getIndex( str )
		{
			var pos,tex,nor,f;
			var has_negative = false;

			//cannot use negative indices as keys, convert them to positive
			if(str.indexOf("-") == -1)
			{
				var index = indices_map.get(str);
				if(index !== undefined)
					return index;
			}
			else
				has_negative = true;

			if(!f) //maybe it was parsed before
				f = str.split("/");

			if (f.length == 1) { //unpacked
				pos = parseInt(f[0]);
				tex = pos;
				nor = pos;
			}
			else if (f.length == 2) { //no normals
				pos = parseInt(f[0]);
				tex = parseInt(f[1]);
				nor = pos;
			}
			else if (f.length == 3) { //all three indexed
				pos = parseInt(f[0]);
				tex = parseInt(f[1]);
				nor = parseInt(f[2]);
			}
			else {
				console.log("Problem parsing: unknown number of values per face");
				return -1;
			}

			//negative indices are relative to the end
			if(pos < 0) 
				pos = vertices.length / 3 + pos + 1;
			if(nor < 0)
				nor = normals.length / 2 + nor + 1;
			if(tex < 0)
				tex = uvs.length / 2 + tex + 1;

			//try again to see if we already have this
			if(has_negative)
			{
				str = pos + "/" + tex + "/" + nor;
				var index = indices_map.get(str);
				if(index !== undefined)
					return index;
			}

			//fill buffers
			pos -= 1; tex -= 1; nor -= 1; //indices in obj start in 1, buffers in 0
			vertices_buffer_data.push( vertices[pos*3+0], vertices[pos*3+1], vertices[pos*3+2] );
			if(uvs.length)
				uvs_buffer_data.push( uvs[tex*2+0], uvs[tex*2+1] );
			if(normals.length)
				normals_buffer_data.push( normals[nor*3+0], normals[nor*3+1], normals[nor*3+2] );

			//store index
			var index = next_index;
			indices_map.set( str, index );
			++next_index;
			return index;
		}

		function createGroup( name )
		{
			var g = {
				name: name || "",
				material: "",
				start: -1,
				length: -1,
				indices: []
			};
			groups.push(g);
			return g;
		}

		function changeMaterial( material_name )
		{
			if( !group.material )
			{
				group.material = material_name + MATNAME_EXTENSION;
				current_group_materials[ material_name ] = group;
				return group;
			}

			var g = current_group_materials[ material_name ];
			if(!g)
			{
				g = createGroup( last_group_name + "_" + material_name );
				g.material = material_name + MATNAME_EXTENSION;
				current_group_materials[ material_name ] = g;
			}
			group = g;
			return g;
		}

	}
};

RM.addSupportedFormat( "obj", parserOBJ );

function processImage ( filename, extension, data, callback, options )
{
	var mimetype = "application/octet-stream";
	if(extension == "jpg" || extension == "jpeg")
		mimetype = "image/jpg";
	else if(extension == "webp")
		mimetype = "image/webp";
	else if(extension == "gif")
		mimetype = "image/gif";
	else if(extension == "png")
		mimetype = "image/png";
	else {
		console.error("not supported extension")
	}

	//blob and load
	var blob = new Blob([data],{type: mimetype});
	var objectURL = URL.createObjectURL( blob );

	//regular image
	var image = new Image();
	image.src = objectURL;
	image.real_filename = filename; //hard to get the original name from the image
	image.onload = function()
	{
		var filename = this.real_filename;
		var img = this;
		
		var default_mag_filter = gl.LINEAR;
		var default_wrap = gl.REPEAT;
		var default_min_filter = gl.LINEAR_MIPMAP_LINEAR;
		if( !isPowerOfTwo(img.width) || !isPowerOfTwo(img.height) )
		{
			default_min_filter = gl.LINEAR;
			default_wrap = gl.CLAMP_TO_EDGE; 
		}
		var texture = null;

		//from TGAs...
		if(img.pixels) //not a real image, just an object with width,height and a buffer with all the pixels
			texture = GL.Texture.fromMemory(img.width, img.height, img.pixels, { format: (img.bpp == 24 ? gl.RGB : gl.RGBA), no_flip: img.flipY, wrapS: default_wrap, wrapT: default_wrap, magFilter: default_mag_filter, minFilter: default_min_filter });
		else //default format is RGBA (because particles have alpha)
			texture = GL.Texture.fromImage(img, { format: gl.RGBA,  wrapS: default_wrap, wrapT: default_wrap, magFilter: default_mag_filter, minFilter: default_min_filter });

		if(!texture)
			return;
		texture.img = img;

		inner_on_texture( texture );
	}
	image.onerror = function(err){
		URL.revokeObjectURL(objectURL); //free memory
		if(callback)
			callback( filename, null, options );
		console.error("Error while loading image, file is not native image format: " + filename); //error if image is not an image I guess
	}

	function inner_on_texture( texture )
	{
		if(callback)
			callback(filename,texture,options);
	}

	return true;
}

RM.processImage = processImage;