/*
*   author: Alex Rodriguez
*   @jxarco 
*/

// http://john-chapman-graphics.blogspot.com/2013/01/ssao-tutorial.html

function SSAO()
{
	this.kernelSize = 64;
	this.kernel = [];
    this.noiseSize = 4;
    this.noise = [];
	this.noiseTexture = null;

	this.values_output = ["DEFAULT", "SSAO", "BEAUTY"];
	this.selected_output = "DEFAULT";

	this.mark = true;
	this.collapsed = false;
}

SSAO.icon = "https://webglstudio.org/latest/imgs/mini-icon-mask.png";

Object.assign( SSAO.prototype, {

	toJSON() {
			
		return {
			uniforms: this.ssaoPass.uniforms,
			output: this.selected_output
		};
	},

	setup() {
		
		console.log(RM);

		this.generateSampleKernel();
		this.generateNoiseTexture();

		var ssaoPass = new RenderPass( "ssaoPass", gl.shaders[ "ssao" ], [ this.noiseTexture ]);
		ssaoPass.uniforms = this.getUniforms();
		ssaoPass.type = RC.MULTIPLY;
		ssaoPass.enabled = false;

		ssaoPass.blurEnabled = true;
		ssaoPass.blurOffset = vec2.fromValues(0.5, 0.5);

		ssaoPass.onShaderPass = function( result ){

			if(this.blurEnabled)
				result.applyBlur( this.blurOffset[0], this.blurOffset[1] , 1);
		};

		this.ssaoPass = ssaoPass;
		CORE.renderComposer.add( this.ssaoPass );
	},

	create(widgets, no_section) {
		
		var that = this;

		widgets.widgets_per_row = 1;

		if(!no_section || no_section.constructor === LiteGUI.Panel)
		{
			var element = widgets.addSection("SSAO", {collapsed: that.collapsed, callback: function(no_collapsed){
			that.collapsed = !no_collapsed;
			}});
		
			element.addEventListener("dragstart", function(e){
				e.dataTransfer.setData("type", "gui");
				e.dataTransfer.setData("component", "SSAO");
			});
		
			element.setAttribute("draggable", true);
		}

		var uniforms = that.ssaoPass.uniforms;

		widgets.widgets_per_row = 1;
		widgets.addCheckbox("Enabled", that.ssaoPass.enabled, {callback: function(v){ that.ssaoPass.enabled = v; }});
		
		widgets.addCombo("Output", that.selected_output, { values: that.values_output, callback: function(v){
			that.selected_output = v;
			CORE.setUniform("u_output_buffer", that.values_output.indexOf(v));
		}});

		var QualityValues = ["DOWNSAMPLED", "HIGH"];
		console.log(that.ssaoPass.qlt);
		widgets.addCombo("Quality", QualityValues[that.ssaoPass.qlt] , { values: QualityValues, callback: function(v){ 
			that.ssaoPass.qlt = QualityValues.indexOf(v); 
		}});

		widgets.addSeparator();
		widgets.addTitle("Settings");

		// widgets.addNumber("Kernel samples", )
		widgets.addSlider("Radius", uniforms["u_radius"], { min: 0.1, max: 10, step: 0.05, callback: function(v){ that.ssaoPass.uniforms["u_radius"] = v; }});
		widgets.addSlider("Bias", uniforms["u_bias"], { min: 0, max: 0.1, step: 0.001, callback: function(v){ that.ssaoPass.uniforms["u_bias"] = v; }});

		widgets.addSlider("Min dist", uniforms["u_min_dist"], { min: 0, max: 1, step: 0.005, callback: function(v){ that.ssaoPass.uniforms["u_min_dist"] = v; }});
		widgets.addSlider("Max dist", uniforms["u_max_dist"], { min: 0, max: 10, step: 0.05, callback: function(v){ that.ssaoPass.uniforms["u_max_dist"] = v; }});

		widgets.addTitle("BlurPass");
		widgets.addCheckbox("Enabled", that.ssaoPass.blurEnabled, {callback: function(v){ that.ssaoPass.blurEnabled = v; }});
		widgets.addVector2("Offset", that.ssaoPass.blurOffset, {callback: function(v){ that.ssaoPass.blurOffset = v; }});
	},

	generateSampleKernel()
	{
		this.kernelSize.length = 0;

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

	generateNoiseTexture()
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

	getUniforms()
	{
		return {
			"u_samples": GL.linearizeArray( this.kernel ),
			"u_radius": 1.25,
			"u_bias": 0.025,
			"u_max_dist": 5,
			"u_min_dist": 0.025
		}
	}
});

// RM.registerClass( SSAO, 'SSAO');