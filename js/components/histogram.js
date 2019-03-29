/*
*   Alex Rodriguez
*   @jxarco 
*/

// LGraphHistogram at webglstudio.org graph system (@jagenjo)

function Histogram()
{
	this.mark = true;
	this.enabled = true;
	this.scale = 0.1;
	this.size = [0.25,0.25];
	this.position = [0.005, 0.05];
}

Histogram.masks = [vec3.fromValues(1,0,0),vec3.fromValues(0,1,0),vec3.fromValues(0,0,1)];

Object.assign( Histogram.prototype, {

	setup() {
		
		console.log(RM);
	},

	create(widgets, root) {
		
		var that = this;

		widgets.addSection("Histogram");
		widgets.addCheckbox("Enabled", this.enabled, { callback: function(v){ that.enabled = v; } });
		widgets.addVector2("Size", this.size, {min: 0,step:0.001, callback: function(v){ that.size = v; }});
		widgets.addVector2("Position", this.position, {min:0, max:1,step:0.001,callback: function(v){ that.position = v; }});
		widgets.addSlider("Scale", this.scale, {min:0, max:1,step:0.005,callback: function(v){ that.scale = v; }});
	},

	execute( input ) {
		
		var tex = input;

		if( !tex )
			return; //saves work

		var enabled = this.enabled;

		if(!enabled)
			return tex;


		if(!this._points_mesh)
		{
			var w = 512;
			var h = 256;
			var vertices = new Float32Array(w*h*3);
			for(var y = 0; y < h; ++y)
				for(var x = 0; x < w; ++x)
					vertices.set([x/w,y/h,0], y*w*3 + x*3);
			this._points_mesh = GL.Mesh.load({ vertices: vertices });
		}

		var histogram_bins = 256;

		if(!this._texture)
			this._texture = new GL.Texture(histogram_bins,1,{ type: gl.FLOAT, magFilter: gl.LINEAR, format: gl.RGB});

		if(!Histogram._shader)
			Histogram._shader = new GL.Shader( RM.shaders['histogram'].vs_code, RM.shaders['histogram'].fs_code );

		var mesh = this._points_mesh;
		var shader = Histogram._shader;
		var scale = this.scale;
		shader.setUniform("u_texture",0);
		shader.setUniform("u_factor",1/512);
		tex.bind(0);

		gl.disable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE,gl.ONE);

		//compute
		this._texture.drawTo( function(){
			gl.clearColor(0,0,0,1);
			gl.clear( gl.COLOR_BUFFER_BIT );
			for(var i = 0; i < 3; ++i)
			{
				gl.colorMask( i == 0, i == 1, i == 2, true );
				shader.setUniform("u_mask",Histogram.masks[i]);
				shader.draw( mesh, gl.POINTS );
			}
			gl.colorMask( true,true,true, true );
		});

		if(!this._line_mesh)
		{
			var vertices = new Float32Array(histogram_bins*3);
			for(var x = 0; x < histogram_bins; ++x)
				vertices.set([x/histogram_bins,0,0], x*3);
			this._line_mesh = GL.Mesh.load({ vertices: vertices });
		}

		if(!Histogram._line_shader)
			Histogram._line_shader = new GL.Shader( RM.shaders['line'].vs_code, RM.shaders['line'].fs_code );

		var mesh = this._line_mesh;
		var shader = Histogram._line_shader;
		shader.setUniform("u_texture",0);
		shader.setUniform("u_scale",scale);
		this._texture.bind(0);
		gl.disable(gl.BLEND);

		gl.viewport( this.position[0] * gl.canvas.width, this.position[1] * gl.canvas.height, 
				this.size[0] * gl.canvas.width, this.size[1] * gl.canvas.height );

		for(var i = 0; i < 3; ++i)
		{
			shader.setUniform("u_mask",Histogram.masks[i]);
			shader.draw( mesh, gl.LINE_STRIP );
		}

		gl.viewport( 0,0, gl.canvas.width, gl.canvas.height );
	}
});

// RM.registerComponent( Histogram, 'Histogram');
