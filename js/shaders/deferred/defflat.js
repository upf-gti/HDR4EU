/*
*   Alex Rodríguez
*   @jxarco 
*/

function Flat_Shader_Deferred()
{
	if(this.constructor !== Flat_Shader_Deferred)
        throw("Use new");

	this.defines = {};
	this.uniforms = {};
}   

Object.assign( Flat_Shader_Deferred.prototype, {

	info() {
        console.log("%cSHADER: " + this.constructor.name, 'font-weight: bold');
		console.log("Defines", this.defines);
        console.log("Uniforms", this.uniforms);
    },

	setup(console) {

		if(console)
			this.info();
		this.vs_code = [
			'\tprecision highp float;\n'
		].join('\n');
		this.fs_code = [
			'\t#extension GL_EXT_draw_buffers : require',
			'\t#extension GL_OES_standard_derivatives : enable',
			'\tprecision highp float;\n'
		].join('\n');
		
		var defines_list = Object.assign(this.defines, RM.shader_macros);

		for(var i in defines_list) {
			this.vs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
			this.fs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
		}
		
		this.vs_code += PBR_Shader.VS_CODE;
		this.fs_code += Flat_Shader_Deferred.FS_CODE; // same algorithm
	}
} );

Flat_Shader_Deferred.FS_CODE = `

	uniform vec3 u_albedo;
	uniform vec3 u_camera_position;

	varying vec3 v_wPosition;
	varying vec3 v_wNormal;

	void main() {
        
		vec3 v = normalize(v_wPosition - u_camera_position);
        vec3 n = normalize( v_wNormal );

		gl_FragData[0] = vec4(u_albedo, 1.0);
		gl_FragData[1] = vec4((n * 0.5 + vec3(0.5) ), 1.0); 
    }
`;


RM.registerShader( Flat_Shader_Deferred, "flat_deferred" );