/*
*   Alex Rodriguez
*   @jxarco 
*/

// Litescene.js: https://github.com/jagenjo/litescene.js/blob/master/src/components/probes.js
// @jagenjo

function IrradianceCache()
{
	this.enabled = true;
	this.size = vec3.fromValues(10,10,10); //grid size
	this.subdivisions = new Uint8Array([4,1,4]);

	this.near = 0.1;
	this.far = 1000;
	this.sampling_distance = 0.0;
	this.debug = 0.0;
	this.background_color = vec4.create();
	this.intensity_color = vec3.fromValues(1,1,1);

	this.mode = IrradianceCache.VERTEX_MODE;

	this._irradiance_cubemaps = [];
	this._irradiance_shs = [];
	this._shs;
	this._irradiance_matrix = mat4.create();
	this._irradiance_subdivisions = vec3.clone( this.subdivisions );
	this._sh_texture = null;

	this._uniforms = {
		irradiance_texture: 15,//LS.Renderer.IRRADIANCE_TEXTURE_SLOT,
		u_irradiance_subdivisions: this._irradiance_subdivisions,
		u_irradiance_color: this.intensity_color,
		u_irradiance_imatrix: mat4.create(),
		u_irradiance_distance: 0
	};

	//callback
	this.onRecomputingIrradiance = null; //called when recomputing
	this.onPreprocessCubemap = null; //called before generating SHs
	this.onComputedSphericalHarmonics = null; //called after generating SHs
	this.onRecomputingFinished = null; //called when recomputing

	this.mark = true;
	this.collapsed = false;
}

IrradianceCache.icon = "https://webglstudio.org/latest/imgs/mini-icon-lightfx.png";
IrradianceCache.show_probes = false;
IrradianceCache.show_cubemaps = false;
IrradianceCache.probes_size = 1;
IrradianceCache.capture_cubemap_size = 64; //renders the scene to this size
IrradianceCache.final_cubemap_size = 16; //downsamples to this size

IrradianceCache.OBJECT_MODE = 1;
IrradianceCache.VERTEX_MODE = 2;
IrradianceCache.PIXEL_MODE = 3;

IrradianceCache.SHs = {};

IrradianceCache.default_coeffs = new Float32Array([ 0,0,0, 0.5,0.75,1, 0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0 ]);
IrradianceCache.use_sh_low = false; //set to false before shader compilation to use 9 coeffs instead of 4

Object.assign( IrradianceCache.prototype, {

	setup() {
		
		console.log(RM);
	},

	create(widgets, no_section) {
		
		var that = this;

		widgets.widgets_per_row = 1;

    if(!no_section || no_section.constructor === LiteGUI.Panel)
    {
      var element = widgets.addSection("Irradiance Cache", {collapsed: that.collapsed, callback: function(no_collapsed){
        that.collapsed = !no_collapsed;
      }});

      element.addEventListener("dragstart", function(e){
          e.dataTransfer.setData("type", "gui");
          e.dataTransfer.setData("component", "IrradianceCache");
      });

      element.setAttribute("draggable", true);
    }

    widgets.addVector3("Size", that.size, {min: 0.1, step: 0.1, precision: 3, callback: function(v){ that.size = v; }});
    widgets.addVector3("Subdivisions", that.subdivisions, {min: 1, max: 256, step: 1, precision: 0, callback: function(v){ that.subdivisions = v; }});
    widgets.addNumber("Near", that.near, {callback: function(v){ that.near = v; }});
    widgets.addNumber("Far", that.far, {callback: function(v){ that.far = v; }});
    widgets.addColor("Background color", [0, 0, 0], {name_width: "30%", callback: function(v){ that.background_color = v; }});
    widgets.addColor("Intensity color", [1, 1, 1], {name_width: "30%", callback: function(v){ that.intensity_color = v; }});
    widgets.addCombo("Mode", "VERTEX", {values: ["OBJECT", "VERTEX", "PIXEL"], callback: function(v){ 

      that.mode = (v == "OBJECT") ? IrradianceCache.OBJECT_MODE : (v == "VERTEX") ? IrradianceCache.VERTEX_MODE : IrradianceCache.PIXEL_MODE;

    }});

    widgets.widgets_per_row = 3;

    widgets.addInfo("Compute")
    widgets.addButton(null, "Irradiance", {callback: function(){ LiteGUI.alert("TO DO") } });
    widgets.addButton(null, "SH", {callback: function(){ 
      that._shs = that.computeSH( gl.textures[CORE._environment] ) 
      CORE.setUniform( "sh_coeffs", that._shs );
    }});
    widgets.addSeparator();

    widgets.widgets_per_row = 1;
    widgets.addNumber("Probe size", 1);
	},

	//captures the illumination to a cubemap
	captureIrradiance ( position, output_cubemap, near, far, bg_color, force_two_sided, temp_cubemap ) {

		temp_cubemap = temp_cubemap;

		CORE.clearSamplers();

		//disable IR cache first
		// LS.Renderer.disableFrameShaderBlock("applyIrradiance");

		//render all the scene inside the cubemap
		CORE.renderToCubemap( position, 0, temp_cubemap, near, far, bg_color );

		//downsample
		temp_cubemap.copyTo( output_cubemap );
	},

	computeSH ( cubemap, position )
	{
		//read 6 images from cubemap
		var faces = [];
		for(var i = 0; i < 6; ++i)
			faces.push( cubemap.getPixels(i) );

		var coeffs = computeSH( faces, cubemap.width, 4 );
		
		if(this.onComputedSphericalHarmonics)
			this.onComputedSphericalHarmonics( coeffs, position );

		var name = CORE._environment;
		IrradianceCache.SHs[name] = coeffs;
		return coeffs;
	}
});

var cubemapFaceNormals = [
  [ [0, 0, -1], [0, -1, 0], [1, 0, 0] ],  // posx
  [ [0, 0, 1], [0, -1, 0], [-1, 0, 0] ],  // negx

  [ [1, 0, 0], [0, 0, 1], [0, 1, 0] ],    // posy
  [ [1, 0, 0], [0, 0, -1], [0, -1, 0] ],  // negy

  [ [1, 0, 0], [0, -1, 0], [0, 0, 1] ],   // posz
  [ [-1, 0, 0], [0, -1, 0], [0, 0, -1] ]  // negz
]

// give me a cubemap, its size and number of channels
// and i'll give you spherical harmonics
function computeSH( faces, cubemapSize, ch) {
  var size = cubemapSize || 128
  var channels = ch || 4
  var cubeMapVecs = []

  // generate cube map vectors
  faces.forEach( function(face, index) {
    var faceVecs = []
    for (var v = 0; v < size; v++) {
      for (var u = 0; u < size; u++) {
        var fU = (2.0 * u / (size - 1.0)) - 1.0
        var fV = (2.0 * v / (size - 1.0)) - 1.0

        var vecX = []
        vec3.scale(vecX, cubemapFaceNormals[index][0], fU)
        var vecY = []
        vec3.scale(vecY, cubemapFaceNormals[index][1], fV)
        var vecZ = cubemapFaceNormals[index][2]

        var res = []
        vec3.add(res, vecX, vecY)
        vec3.add(res, res, vecZ)
        vec3.normalize(res, res)

        faceVecs.push(res)
      }
    }
    cubeMapVecs.push(faceVecs)
  })

  // generate shperical harmonics
  var sh = [
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3)
  ]
  var weightAccum = 0
  

  faces.forEach( function(face, index) {
    var pixels = face
    var gammaCorrect = true
	var low_precision = true
    if (Object.prototype.toString.call(pixels) === '[object Float32Array]')
	{
		gammaCorrect = false // this is probably HDR image, already in linear space
		low_precision = false;
	}
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var texelVect = cubeMapVecs[index][y * size + x]

        var weight = texelSolidAngle(x, y, size, size)
        // forsyths weights
        var weight1 = weight * 4 / 17
        var weight2 = weight * 8 / 17
        var weight3 = weight * 15 / 17
        var weight4 = weight * 5 / 68
        var weight5 = weight * 15 / 68

        var dx = texelVect[0]
        var dy = texelVect[1]
        var dz = texelVect[2]

        for (var c = 0; c < 3; c++) {
          var value = pixels[y * size * channels + x * channels + c]
		  if(low_precision)
			  value /= 255;
          if (gammaCorrect)
			  value = Math.pow(value, 2.2)
		  //value = Math.clamp( value, 0, 2 );
	
		  sh[0][c] += value * weight1
          sh[1][c] += value * weight2 * dy
          sh[2][c] += value * weight2 * dz
          sh[3][c] += value * weight2 * dx

          sh[4][c] += value * weight3 * dx * dy
          sh[5][c] += value * weight3 * dy * dz
          sh[6][c] += value * weight4 * (3.0 * dz * dz - 1.0)

          sh[7][c] += value * weight3 * dx * dz
          sh[8][c] += value * weight5 * (dx * dx - dy * dy)

          weightAccum += weight
        }
      }
    }
  })

  var linear_sh = new Float32Array(sh.length*3);
  for (var i = 0; i < sh.length; i++) {
    linear_sh[i*3] = sh[i][0] *= 4 * Math.PI / weightAccum;
    linear_sh[i*3+1] = sh[i][1] *= 4 * Math.PI / weightAccum;
    linear_sh[i*3+2] = sh[i][2] *= 4 * Math.PI / weightAccum;
  }

  return linear_sh
}

function texelSolidAngle (aU, aV, width, height) {
  // transform from [0..res - 1] to [- (1 - 1 / res) .. (1 - 1 / res)]
  // ( 0.5 is for texel center addressing)
  var U = (2.0 * (aU + 0.5) / width) - 1.0
  var V = (2.0 * (aV + 0.5) / height) - 1.0

  // shift from a demi texel, mean 1.0 / size  with U and V in [-1..1]
  var invResolutionW = 1.0 / width
  var invResolutionH = 1.0 / height

  // U and V are the -1..1 texture coordinate on the current face.
  // get projected area for this texel
  var x0 = U - invResolutionW
  var y0 = V - invResolutionH
  var x1 = U + invResolutionW
  var y1 = V + invResolutionH
  var angle = areaElement(x0, y0) - areaElement(x0, y1) - areaElement(x1, y0) + areaElement(x1, y1)

  return angle
}

function areaElement (x, y) {
  return Math.atan2(x * y, Math.sqrt(x * x + y * y + 1.0))
}
		
RM.registerClass( IrradianceCache, 'IrradianceCache');