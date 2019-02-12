/*
*   Alex Rodriguez
*   @jxarco 
*/

// http://john-chapman-graphics.blogspot.com/2013/01/ssao-tutorial.html

var ssao = {

	kernelSize: 64,
	kernel: [],
	noiseSize: 4,
	noiseTexture: null,
	texture: null,
	blurTexture: null,
	
	init: async function()
	{
		this.initTextures();
		this.generateSampleKernel();
		CORE.setUniform('kernel', GL.linearizeArray( this.kernel ));
		CORE.setUniform('noise_tiling', 4);
		/*await CORE.reloadShaders();*/
	},

	initTextures: function()
	{
		var w = (gl.canvas.width)|0;
		var h = (gl.canvas.height)|0;
		var type = gl.FLOAT;

		this.texture = new GL.Texture(w,h, { texture_type: gl.TEXTURE_2D, type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
		this.blurTexture = new GL.Texture(w,h, { texture_type: gl.TEXTURE_2D, type: type, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
		gl.textures['ssao_noise_blur'] = this.blurTexture;
		
		this.generateNoiseTexture();
	},

	generateSampleKernel: function( use_hemisphere )
	{
		
		for (var i = 0; i < this.kernelSize; i++)
		{
			var sample = vec3.create();
			sample[0] = (Math.random() * 2) - 1;
			sample[1] = (Math.random() * 2) - 1;
			sample[2] = Math.random();
			vec3.normalize(sample, sample);

			// distribute points within the hemisphere
			if( use_hemisphere ) {
				vec3.scale(sample, sample, Math.random());
			}

			// distance fallof 
			var scale = i / this.kernelSize;
			scale = lerp(0.1, 1.0, scale * scale);
			vec3.scale(sample, sample, scale);

			this.kernel.push( sample );
		}
	},

	generateNoiseTexture: function()
	{
		if ( SimplexNoise === undefined )
			console.error( 'SimplexNoise missing' );

		var size = this.noiseSize * this.noiseSize;
		var SN = new SimplexNoise();
	
		var data = new Float32Array(size);

		for (var i = 0; i < size; i++) {

			var noise = vec3.create();
			var x = noise[0] = (Math.random() * 2) - 1;
			var y = noise[1] = (Math.random() * 2) - 1;
			var z = noise[2] = 0;
			vec3.normalize(noise, noise);
			
			var noise3d = SN.noise3d( x, y, z );
			data[i] = noise3d;
		}

		/*data[0] = 0.7968388795852661;
		data[1] = 0.5131536722183228;
		data[2] = 0.4655301868915558;
		data[3] = 0.2008838653564453;
		data[4] = 0.6598166227340698;
		data[5] = 0.21552163362503052;
		data[6] = 0.1582496613264084;
		data[7] = 0.11282402276992798;
		data[8] = 0.46743690967559814;
		data[9] = 0.010806102305650711;
		data[10] = 0.17328834533691406;
		data[11] = 0.5647706985473633;
		data[12] = 0.18150515854358673;
		data[13] = 0.46387165784835815;
		data[14] = 0.5509496331214905;
		data[15] = 0.7847991585731506;*/

		var options = {
			type: GL.FLOAT,
			format: GL.LUMINANCE,
			internalFormat: GL.LUMINANCE,
			pixel_data: data,
			filter: gl.NEAREST,
			wrap: gl.REPEAT,
			anisotropic: 1
		}

		var noiseTexture = new GL.Texture(this.noiseSize, this.noiseSize, options);
		this.noiseTexture = gl.textures['ssao_noise'] = noiseTexture;
	}
}