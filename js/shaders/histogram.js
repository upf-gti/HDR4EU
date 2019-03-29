/*
*   Alex Rodríguez
*   @jxarco 
*/

function Histogram_Shader()
{
    if(this.constructor !== Histogram_Shader)
        throw("Use new");

	this.defines = {};
	this.uniforms = {};
}   

Object.assign( Histogram_Shader.prototype, {

    info() {
        console.log("%cSHADER: " + this.constructor.name, 'font-weight: bold');
		console.log("Defines", this.defines);
        console.log("Uniforms", this.uniforms);
    },

	setup(console) {

		if(console)
			this.info();
		this.vs_code = '\tprecision highp float;\n';
		this.fs_code = '\tprecision highp float;\n';
		
		var defines_list = Object.assign(this.defines, RM.shader_macros);

		for(var i in defines_list) {
			this.vs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
			this.fs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
		}
		
		this.vs_code += Histogram_Shader.VS_CODE;
		this.fs_code += Histogram_Shader.FS_CODE;
	}
} );

Histogram_Shader.VS_CODE = `
	attribute vec3 a_vertex;
	uniform sampler2D u_texture;
	uniform vec3 u_mask;
	
	void main() {
		vec3 color = texture2D( u_texture, a_vertex.xy ).xyz * u_mask;
		float pos = min(1.0,length(color));
		gl_Position = vec4(pos*2.0-1.0,0.5,0.0,1.0);
		gl_PointSize = 1.0;
	}
`;

Histogram_Shader.FS_CODE = `
	uniform float u_factor;
	void main() {
		gl_FragColor = vec4(u_factor);
	}
`;

RM.registerShader( Histogram_Shader, "histogram" );


function Line_Shader()
{
    if(this.constructor !== Line_Shader)
        throw("Use new");

	this.defines = {};
	this.uniforms = {};
}   

Object.assign( Line_Shader.prototype, {

    info() {
        console.log("%cSHADER: " + this.constructor.name, 'font-weight: bold');
		console.log("Defines", this.defines);
        console.log("Uniforms", this.uniforms);
    },

	setup(console) {

		if(console)
			this.info();
		this.vs_code = '\tprecision highp float;\n';
		this.fs_code = '\tprecision highp float;\n';
		
		var defines_list = Object.assign(this.defines, RM.shader_macros);

		for(var i in defines_list) {
			this.vs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
			this.fs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
		}
		
		this.vs_code += Line_Shader.VS_CODE;
		this.fs_code += Line_Shader.FS_CODE;
	}
} );

Line_Shader.VS_CODE = `
	attribute vec3 a_vertex;
	uniform sampler2D u_texture;
	uniform vec3 u_mask;
	uniform float u_scale;
	
	void main() {
		vec3 color = texture2D( u_texture, a_vertex.xy ).xyz * u_mask;
		float pos = length(color);
		gl_Position = vec4(a_vertex.x*2.0-1.0, u_scale*pos*2.0-1.0,0.0,1.0);
	}
`;

Line_Shader.FS_CODE = `
	uniform vec3 u_mask;
	void main() {
		gl_FragColor = vec4(u_mask,1.0);
	}
`;

RM.registerShader( Line_Shader, "line" );