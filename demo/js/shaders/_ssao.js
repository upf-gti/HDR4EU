/*
*   author: Alex Rodriguez
*   @jxarco 
*/

// http://john-chapman-graphics.blogspot.com/2013/01/ssao-tutorial.html

var SSAO = {

	kernelSize: 64,
	kernel: [],
    noiseSize: 4,
    noise: [],
	noiseTexture: null,
	
	init: function()
	{
		this.generateSampleKernel();
		this.generateNoiseTexture();
	},

	generateSampleKernel: function()
	{
		for (var i = 0; i < this.kernelSize; i++)
		{
			var sample = vec3.create();
			sample[0] = (Math.random() * 2) - 1;    // -1 to 1
			sample[1] = (Math.random() * 2) - 1;    // -1 to 1
            sample[2] = Math.random();              // 0 to 1  -> hemisphere
            
            sample = vec3.normalize(sample, sample);
            sample = vec3.scale(sample, sample, Math.random());

			// give more weights to closer samples 
			var scale = i / this.kernelSize;
			scale = lerp(0.1, 1.0, scale * scale);
			sample = vec3.scale(sample, sample, scale);

			this.kernel.push( sample );
		}
	},

	generateNoiseTexture: function()
	{
        var size = this.noiseSize * this.noiseSize;
        
        for (var i = 0; i < size; i++)
        {
            var n = vec3.create();
            n[0] = (Math.random());// * 2) - 1;    // -1 to 1
            n[1] = (Math.random());// * 2) - 1;    // -1 to 1
            n[2] = 0;                          // 0 rotate around Z
            
            this.noise.push( n );
        }

        // generate pixel data for noise texture

        var data = new Float32Array(size * 3);

        for (var i = 0; i < size; ++i)
        {
            var k = i*3;
            data[k++] = this.noise[i][0];
            data[k++] = this.noise[i][1];
            data[k++] = this.noise[i][2];
        }

		var options = {
			type: GL.FLOAT,
			format: GL.RGB, //GL.LUMINANCE,
			pixel_data: data,
			filter: gl.NEAREST,
			wrap: gl.REPEAT,
			anisotropic: 1
		}

		var noiseTexture = new GL.Texture(this.noiseSize, this.noiseSize, options);
		this.noiseTexture = gl.textures['ssao_noise'] = noiseTexture;
		this.noiseTexture.name = "noise";
	},

	getUniforms: function()
	{
		return {
			"u_samples": GL.linearizeArray( this.kernel ),
			"u_radius": 1.25,
			"u_bias": 0.025,
			"u_max_dist": 0.8,
			"u_min_dist": 0.025,
			"u_enable": true,
		}
	}
}