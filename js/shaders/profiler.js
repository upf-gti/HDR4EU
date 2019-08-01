/*
*   Alex Rodríguez
*   @jxarco 
*/

function Profiler_Shader()
{
    if(this.constructor !== Profiler_Shader)
        throw("Use new");

	this.defines = {};
	this.uniforms = {};
}   

Object.assign( Profiler_Shader.prototype, {

    info() {
        console.log("%cSHADER: " + this.constructor.name, 'font-weight: bold');
		console.log("Defines", this.defines);
        console.log("Uniforms", this.uniforms);
    },

	setup(console) {

		if(console)
			this.info();

		this.fs_code = '\tprecision highp float;\n';
		this.vs_code = '\tprecision highp float;\n';
		
		var defines_list = Object.assign(this.defines, RM.shader_macros);

		for(var i in defines_list){
			this.vs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
			this.fs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
		}
		
		this.vs_code += Profiler_Shader.VS_CODE;
		this.fs_code += Profiler_Shader.FS_CODE;
	}
} );

Profiler_Shader.VS_CODE = `

	attribute vec3 a_vertex;
	attribute vec2 a_coord;
	varying vec2 v_coord;
	void main() { 
		v_coord = a_coord; 
		gl_Position = vec4(a_coord * 2.0 - 1.0, 0.0, 1.0); 
	}
`;

Profiler_Shader.FS_CODE = `

	uniform float u_values[10];
	uniform float u_factor;

	void main() {

		




		gl_FragColor = vec4(1.0);
	}
`;

RM.registerShader( Profiler_Shader, "profiler" );