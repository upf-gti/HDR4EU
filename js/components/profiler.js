/*
*   Alex Rodriguez
*   @jxarco 
*/

function Profiler()
{
	this.mark = true;
	this.enabled = true;
	this.scale = 0.1;
	this.size = [0.25,0.25];
	this.position = [0.005, 0.05];

	this.values = [];
}

Object.assign( Profiler.prototype, {

	setup() {
		
		console.log(RM);
	},

	create(widgets, root) {
		
		var that = this;

		widgets.addSection("Profiler");
		widgets.addCheckbox("Enabled", this.enabled, { callback: function(v){ that.enabled = v; } });
		widgets.addVector2("Size", this.size, {min: 0,step:0.001, callback: function(v){ that.size = v; }});
		widgets.addVector2("Position", this.position, {min:0, max:1,step:0.001,callback: function(v){ that.position = v; }});
		widgets.addSlider("Scale", this.scale, {min:0, max:1,step:0.005,callback: function(v){ that.scale = v; }});
	},

	execute( input ) {
		
		if(!this.enabled)
			return;

		if(!this._texture)
			this._texture = new GL.Texture(this.size[0] * gl.canvas.width, this.size[1] * gl.canvas.height);

		if(!Profiler._shader)
			Profiler._shader = new GL.Shader( RM.shaders['profiler'].vs_code, RM.shaders['profiler'].fs_code );

		var mesh = Mesh.getScreenQuad();
		var shader = Profiler._shader;
		var scale = this.scale;
		shader.setUniform("u_factor",0.1);

		this.values = [4, 7, 2, 4, 9, 11, 14, 3, 15, 6];

		shader.setUniform("u_values", GL.linearizeArray(new Float32Array( this.values )))

		gl.disable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE,gl.ONE);

		//compute
		this._texture.drawTo( function(){
			gl.clearColor(0,0,0,1);
			gl.clear( gl.COLOR_BUFFER_BIT );
			shader.draw( mesh );
		});

		gl.viewport( this.position[0] * gl.canvas.width, this.position[1] * gl.canvas.height, 
				this._texture.width, this._texture.height );

		this._texture.toViewport();

		gl.viewport( 0,0, gl.canvas.width, gl.canvas.height );
	}
});

// RM.registerComponent( Profiler, 'Profiler');
